/**
 * FE-11 回归：refresh 失败的终态收口 + 单飞覆盖并发/冷启动
 *
 * 覆盖点：
 * 1. 冷启动时多个请求同时发现 access 过期 → 只发一次 POST /auth/refresh；
 * 2. refresh 被服务端拒绝（401「刷新令牌无效」）→ 清 token + 清 profile + 跳登录页，
 *    且并发请求不会重复跳转、不会各打一遍注定 401 的业务请求；
 * 3. refresh 成功（后端轮换）→ 新的 access/refresh 都落盘，业务请求带上新 token。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/build-env', () => ({
  getApiBaseUrl: () => 'https://dev.chancore.cn/api/app/v1',
}));

vi.mock('@/utils/local-debug', () => ({
  reportLocalDebug: vi.fn(),
}));

const AUTH_TOKEN_KEY = 'yunce-edu-auth-token';
const USER_PROFILE_KEY = 'yunce-edu-user-profile';
const LOGIN_URL = '/package-auth/pages/login/index';

/** 取「本次模块注册表」里的 Taro 实例，保证与随后 import 的 request 模块用的是同一个 */
async function freshTaro() {
  const taro = (await import('@tarojs/taro')).default;
  const mutable = taro as unknown as {
    getCurrentPages: () => Array<{ route: string }>;
    redirectTo: (options: { url: string; fail?: () => void }) => void;
    reLaunch: (options: { url: string }) => void;
  };
  mutable.getCurrentPages = () => [{ route: 'pages/home/index' }];
  mutable.redirectTo = () => {};
  mutable.reLaunch = () => {};
  return taro;
}

/** 构造 Taro.request 的成功响应 */
function ok<T>(data: T) {
  return {
    statusCode: 200,
    data: { code: 0, data, message: 'ok' },
    header: {},
    cookies: [],
    errMsg: 'ok',
  };
}

describe('FE-11 refresh 失败收口（清 token + 清 profile + 跳登录页）', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('冷启动 refresh 被判无效：并发 3 个请求只 refresh 一次、只跳一次、不再打注定 401 的业务请求', async () => {
    const taro = await freshTaro();
    // 冷启动现场：access 已过期、refreshToken 已被上一次轮换作废、profile 仍在（脏 profile）
    taro.setStorageSync(
      AUTH_TOKEN_KEY,
      JSON.stringify({ access_token: 'expired-access', refresh_token: 'R1', expires_at: 1 }),
    );
    taro.setStorageSync(USER_PROFILE_KEY, JSON.stringify({ id: 'p1', identities: [] }));

    const redirectTo = vi.fn();
    (taro as unknown as { redirectTo: unknown }).redirectTo = redirectTo;

    const spy = vi.spyOn(taro, 'request').mockResolvedValue({
      statusCode: 401,
      data: { code: 401, message: '刷新令牌无效', data: null },
      header: {},
      cookies: [],
      errMsg: 'ok',
    } as never);

    const { get } = await import('@/utils/request');
    const results = await Promise.allSettled([get('/a'), get('/b'), get('/c')]);

    // 三个请求都以「登录已过期」失败，且没有一个真的打到后端
    expect(results.map((r) => r.status)).toEqual(['rejected', 'rejected', 'rejected']);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0].url).toBe('https://dev.chancore.cn/api/app/v1/auth/refresh');

    // 收口：清 token + 清 profile
    expect(taro.getStorageSync(AUTH_TOKEN_KEY)).toBe('');
    expect(taro.getStorageSync(USER_PROFILE_KEY)).toBe('');

    // 收口：明确跳登录页，且并发下只跳一次
    expect(redirectTo).toHaveBeenCalledTimes(1);
    expect(redirectTo).toHaveBeenCalledWith(expect.objectContaining({ url: LOGIN_URL }) as never);
  });

  it('refresh 成功：并发请求只换一次 token，新 access/refresh 落盘并用于业务请求', async () => {
    const taro = await freshTaro();
    taro.setStorageSync(
      AUTH_TOKEN_KEY,
      JSON.stringify({ access_token: 'expired-access', refresh_token: 'R1', expires_at: 1 }),
    );

    const spy = vi.spyOn(taro, 'request').mockImplementation(((opts: { url: string }) => {
      if (opts.url.endsWith('/auth/refresh')) {
        return Promise.resolve(
          ok({ token: 'fresh-access', refreshToken: 'R2', expiresIn: 7200 }) as never,
        );
      }
      return Promise.resolve(ok({ ok: 1 }) as never);
    }) as never);

    const { get } = await import('@/utils/request');
    await expect(Promise.all([get('/x'), get('/y')])).resolves.toEqual([{ ok: 1 }, { ok: 1 }]);

    const refreshCalls = spy.mock.calls.filter((c) => c[0].url.endsWith('/auth/refresh'));
    expect(refreshCalls).toHaveLength(1);

    // 轮换后的 refreshToken 必须落盘（否则下次冷启动就会拿废 token 换来 401）
    const stored = JSON.parse(String(taro.getStorageSync(AUTH_TOKEN_KEY)));
    expect(stored.access_token).toBe('fresh-access');
    expect(stored.refresh_token).toBe('R2');

    const businessCalls = spy.mock.calls.filter((c) => !c[0].url.endsWith('/auth/refresh'));
    expect(businessCalls.map((c) => c[0].header?.Authorization)).toEqual([
      'Bearer fresh-access',
      'Bearer fresh-access',
    ]);
  });
});
