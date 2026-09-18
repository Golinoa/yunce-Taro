import Taro from '@tarojs/taro';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/build-env', () => ({
  getApiBaseUrl: () => 'https://dev.chancore.cn/api/app/v1',
}));

vi.mock('@/utils/local-debug', () => ({
  reportLocalDebug: vi.fn(),
}));

describe('request 401 分流', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    try {
      Taro.removeStorageSync('yunce-edu-auth-token');
    } catch {
      /* ignore */
    }
  });

  it('skipAuth + HTTP 401：透传后端「邮箱或密码错误」，不改成登录过期', async () => {
    vi.spyOn(Taro, 'request').mockResolvedValue({
      statusCode: 401,
      data: { code: 401, message: '邮箱或密码错误', data: null },
      header: {},
      cookies: [],
      errMsg: 'ok',
    } as unknown as Taro.request.SuccessCallbackResult);

    const { post } = await import('@/utils/request');
    await expect(
      post('/auth/password-login', { email: 'x', password: 'y' }, { skipAuth: true }),
    ).rejects.toMatchObject({
      name: 'ApiError',
      code: 401,
      message: '邮箱或密码错误',
    });
  });
});

/** 构造一个成功响应；delayMs 用于让多个并发请求真正重叠 */
function okResponse<T>(data: T, delayMs: number) {
  return new Promise((resolve) => {
    setTimeout(
      () =>
        resolve({
          statusCode: 200,
          data: { code: 0, data, message: 'ok' },
          header: {},
          cookies: [],
          errMsg: 'ok',
        }),
      delayMs,
    );
  });
}

describe('request GET 同参数 in-flight 去重', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    try {
      Taro.removeStorageSync('yunce-edu-auth-token');
    } catch {
      /* ignore */
    }
  });

  it('同 method+url+query 的并发 GET 只打一次网络', async () => {
    const spy = vi.spyOn(Taro, 'request').mockReturnValue(okResponse({ list: ['a'] }, 10) as never);

    const { get } = await import('@/utils/request');
    const [r1, r2, r3] = await Promise.all([
      get('/classes/c1/students', { page: 1, pageSize: 50 }),
      get('/classes/c1/students', { pageSize: 50, page: 1 }),
      get('/classes/c1/students', { page: 1, pageSize: 50 }),
    ]);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(r1).toEqual({ list: ['a'] });
    expect(r2).toEqual(r1);
    expect(r3).toEqual(r1);
  });

  it('参数不同则不去重', async () => {
    const spy = vi.spyOn(Taro, 'request').mockReturnValue(okResponse({ ok: 1 }, 5) as never);

    const { get } = await import('@/utils/request');
    await Promise.all([
      get('/classes/c1/students', { page: 1 }),
      get('/classes/c1/students', { page: 2 }),
    ]);

    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('写请求（POST）一律不去重', async () => {
    const spy = vi.spyOn(Taro, 'request').mockReturnValue(okResponse({ ok: 1 }, 5) as never);

    const { post } = await import('@/utils/request');
    await Promise.all([
      post('/classes/c1/students', { studentId: 's1' }),
      post('/classes/c1/students', { studentId: 's1' }),
    ]);

    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('失败不被驻留：并发失败只发一次，随后重试可重新发请求', async () => {
    const spy = vi
      .spyOn(Taro, 'request')
      .mockImplementationOnce((() => Promise.reject(new Error('network fail'))) as never)
      .mockReturnValue(okResponse({ ok: 1 }, 5) as never);

    const { get } = await import('@/utils/request');
    const results = await Promise.allSettled([
      get('/attendance/reschedules', { teacherId: 't1' }),
      get('/attendance/reschedules', { teacherId: 't1' }),
    ]);
    expect(results.map((r) => r.status)).toEqual(['rejected', 'rejected']);
    expect(spy).toHaveBeenCalledTimes(1);

    // 失败已释放飞行态 → 下一次同参数请求照常发出（不会拿到缓存住的失败）
    await expect(get('/attendance/reschedules', { teacherId: 't1' })).resolves.toEqual({ ok: 1 });
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
