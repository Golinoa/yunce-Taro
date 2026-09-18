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
  // services/auth-shared 的 authCapabilities 在模块初始化时会读这两个开关
  isDevApiEnv: () => true,
  isUseMock: () => false,
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

  it('refresh 5xx：不清会话、不跳登录，本次请求按可重试失败；随后恢复可续期成功', async () => {
    const taro = await freshTaro();
    taro.setStorageSync(
      AUTH_TOKEN_KEY,
      JSON.stringify({ access_token: 'expired-access', refresh_token: 'R1', expires_at: 1 }),
    );
    taro.setStorageSync(USER_PROFILE_KEY, JSON.stringify({ id: 'p1', identities: [] }));

    const redirectTo = vi.fn();
    (taro as unknown as { redirectTo: unknown }).redirectTo = redirectTo;

    let refreshStatus = 500;
    const spy = vi.spyOn(taro, 'request').mockImplementation(((opts: { url: string }) => {
      if (opts.url.endsWith('/auth/refresh')) {
        if (refreshStatus === 200) {
          return Promise.resolve(
            ok({ token: 'fresh-access', refreshToken: 'R2', expiresIn: 7200 }),
          );
        }
        return Promise.resolve({
          statusCode: refreshStatus,
          data: { code: 500, message: '服务暂时不可用', data: null },
          header: {},
          cookies: [],
          errMsg: 'ok',
        });
      }
      return Promise.resolve(ok({ ok: 1 }));
    }) as never);

    const { get } = await import('@/utils/request');
    await expect(get('/a')).rejects.toMatchObject({ code: -1 });

    // 带 refreshToken 却没换成 token 时，绝不能发「无 Authorization」的业务请求（否则必 401 → 被踢）
    expect(spy.mock.calls.filter((c) => !c[0].url.endsWith('/auth/refresh'))).toHaveLength(0);
    // 会话保持原样：token / profile 都在，未跳登录
    expect(taro.getStorageSync(AUTH_TOKEN_KEY)).not.toBe('');
    expect(taro.getStorageSync(USER_PROFILE_KEY)).not.toBe('');
    expect(redirectTo).not.toHaveBeenCalled();

    // 后端恢复后，下一次请求仍有机会续期成功
    refreshStatus = 200;
    await expect(get('/b')).resolves.toEqual({ ok: 1 });
    const stored = JSON.parse(String(taro.getStorageSync(AUTH_TOKEN_KEY)));
    expect(stored.access_token).toBe('fresh-access');
    expect(stored.refresh_token).toBe('R2');
  });

  it('refresh 网络错误/超时：不清会话、不跳登录，按可重试失败', async () => {
    const taro = await freshTaro();
    taro.setStorageSync(
      AUTH_TOKEN_KEY,
      JSON.stringify({ access_token: 'expired-access', refresh_token: 'R1', expires_at: 1 }),
    );
    taro.setStorageSync(USER_PROFILE_KEY, JSON.stringify({ id: 'p1', identities: [] }));

    const redirectTo = vi.fn();
    (taro as unknown as { redirectTo: unknown }).redirectTo = redirectTo;

    // Taro.request 的 fail 回调没有 statusCode —— 网络类失败只能走 reject
    const spy = vi.spyOn(taro, 'request').mockImplementation(((opts: { url: string }) => {
      if (opts.url.endsWith('/auth/refresh')) {
        return Promise.reject(new Error('request:fail timeout'));
      }
      return Promise.resolve(ok({ ok: 1 }));
    }) as never);

    const { get } = await import('@/utils/request');
    await expect(get('/a')).rejects.toMatchObject({ code: -1 });

    expect(spy.mock.calls.filter((c) => !c[0].url.endsWith('/auth/refresh'))).toHaveLength(0);
    expect(taro.getStorageSync(AUTH_TOKEN_KEY)).not.toBe('');
    expect(taro.getStorageSync(USER_PROFILE_KEY)).not.toBe('');
    expect(redirectTo).not.toHaveBeenCalled();
  });

  it('并发续期只发一次：refreshSessionForTenant 与静默续期共用同一单飞', async () => {
    const taro = await freshTaro();
    taro.setStorageSync(
      AUTH_TOKEN_KEY,
      JSON.stringify({ access_token: 'expired-access', refresh_token: 'R1', expires_at: 1 }),
    );
    taro.setStorageSync(USER_PROFILE_KEY, JSON.stringify({ id: 'p1', identities: [] }));
    (taro as unknown as { redirectTo: unknown }).redirectTo = vi.fn();

    const spy = vi.spyOn(taro, 'request').mockImplementation((async (opts: { url: string }) => {
      if (opts.url.endsWith('/auth/refresh')) {
        // 让两路请求真正重叠：若未共用单飞，会看到两次 POST /auth/refresh
        await new Promise((resolve) => setTimeout(resolve, 10));
        return ok({ token: 'fresh-access', refreshToken: 'R2', expiresIn: 7200 });
      }
      if (opts.url.endsWith('/auth/me')) {
        // /auth/me 故意失败 → refreshSessionForTenant 走 JWT 兜底分支，不影响本用例结论
        return {
          statusCode: 500,
          data: { code: 500, message: 'x', data: null },
          header: {},
          cookies: [],
          errMsg: 'ok',
        };
      }
      return ok({ ok: 1 });
    }) as never);

    const { get } = await import('@/utils/request');
    const { refreshSessionForTenant } = await import('@/services/auth-session');

    const [business, refreshed] = await Promise.all([get('/a'), refreshSessionForTenant()]);

    expect(business).toEqual({ ok: 1 });
    expect(refreshed.ok).toBe(true);
    expect(spy.mock.calls.filter((c) => c[0].url.endsWith('/auth/refresh'))).toHaveLength(1);
    expect(spy.mock.calls.filter((c) => c[0].url.endsWith('/a'))[0][0].header?.Authorization).toBe(
      'Bearer fresh-access',
    );
  });
});
