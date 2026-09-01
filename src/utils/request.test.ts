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
