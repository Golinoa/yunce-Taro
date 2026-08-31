import Taro from '@tarojs/taro';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/request', () => ({
  post: vi.fn(),
  get: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
}));

vi.mock('@/services/campus-invite', () => ({
  campusInviteService: {
    preview: vi.fn(),
  },
}));

vi.mock('@/utils/build-env', () => ({
  isUseMock: () => false,
  isDevApiEnv: () => true,
  getApiBaseUrl: () => 'https://dev.chancore.cn/api/app/v1',
  PROD_API_BASE_URL: 'https://api.chancore.cn/api/app/v1',
  API_BASE_URL: 'https://dev.chancore.cn/api/app/v1',
}));

describe('auth service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    Taro.setStorageSync('yunce-edu-register-draft-local', '');
  });

  it('测环境支持账号密码与邮箱验证码登录能力', async () => {
    const { authCapabilities } = await import('@/services/auth');
    expect(authCapabilities.supportsEmailCodeLogin).toBe(true);
    expect(authCapabilities.supportsAccountPasswordLogin).toBe(true);
    expect(authCapabilities.usesMockRegister).toBe(false);
  });

  it('registerStep1ByEmail 校验邮箱格式', async () => {
    const { registerStep1ByEmail } = await import('@/services/auth');
    const invalid = await registerStep1ByEmail('not-an-email', '123456');
    expect(invalid.tempToken).toBeNull();
    expect(invalid.error?.message).toContain('邮箱');
  });

  it('registerStep1ByPhone 校验手机号格式', async () => {
    const { registerStep1ByPhone } = await import('@/services/auth');
    const invalid = await registerStep1ByPhone('12345', '123456');
    expect(invalid.tempToken).toBeNull();
    expect(invalid.error?.message).toContain('手机号');
  });

  it('login 走 /auth/password-login（短用户名映射邮箱）', async () => {
    const { post } = await import('@/utils/request');
    vi.mocked(post).mockResolvedValueOnce({
      token: 'tok',
      refreshToken: 'rt',
      expiresIn: 3600,
      user: {
        id: 'user-principal-001',
        profileId: 'profile-user-principal-001',
        nickname: '万老师',
        role: 'PRINCIPAL',
        avatar: null,
        phone: '13800000001',
      },
    });

    const { login } = await import('@/services/auth');
    const result = await login('principal1', '123456');

    expect(post).toHaveBeenCalledWith(
      '/auth/password-login',
      { email: 'principal1@yunce.com', password: '123456' },
      { skipAuth: true },
    );
    expect(result.error).toBeNull();
    expect(result.session?.access_token).toBe('tok');
  });

  it('getTestAccounts 在真链路返回空数组', async () => {
    const { getTestAccounts, getTestPassword } = await import('@/services/auth');
    await expect(getTestAccounts()).resolves.toEqual([]);
    await expect(getTestPassword()).resolves.toBe('');
  });
});
