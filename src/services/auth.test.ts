import { beforeEach, describe, expect, it, vi } from 'vitest';
import Taro from '@tarojs/taro';

const mockLogin = vi.fn();
const mockGetSession = vi.fn();

vi.mock('@/utils/mock-loaders', () => ({
  loadAuthMock: vi.fn(async () => ({
    mockLogin,
    mockGetSession,
    mockWechatLogin: vi.fn(),
    mockBindWechatCredentials: vi.fn(),
    mockPhoneLogin: vi.fn(),
    mockCheckLoginAccount: vi.fn(),
    mockPrepareEmailLogin: vi.fn(),
    mockLoginByEmailCode: vi.fn(),
    mockPrepareAccountRecovery: vi.fn(),
    mockRecoverAccountByEmailCode: vi.fn(),
    mockPreparePasswordReset: vi.fn(),
    mockResetPasswordByEmailCode: vi.fn(),
    mockRegisterStep1: vi.fn(),
    mockRegisterStep1ByPhone: vi.fn(),
    mockRegisterStep2: vi.fn(),
    mockRegisterStep3: vi.fn(),
    mockVerifyCampusCode: vi.fn(),
    mockVerifyStudentCode: vi.fn(),
    mockValidateInviteCode: vi.fn(),
    mockSwitchIdentity: vi.fn(),
    mockUpdateProfile: vi.fn(),
    mockGetProfileExtra: vi.fn(),
    mockAddIdentity: vi.fn(),
    mockRestoreRegisterDrafts: vi.fn(),
    mockLogout: vi.fn(),
  })),
}));

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

describe('auth service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('VITE_USE_MOCK', 'false');
    Taro.setStorageSync('yunce-edu-register-draft-local', '');
  });

  it('真实模式下支持邮箱验证码登录能力', async () => {
    const { authCapabilities } = await import('@/services/auth');
    expect(authCapabilities.supportsEmailCodeLogin).toBe(true);
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

  it('mock 模式下 login 动态加载 auth mock', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'true');
    vi.resetModules();
    mockLogin.mockResolvedValueOnce({
      session: { access_token: 't' },
      profile: { id: '1' },
      error: null,
    });

    const { login } = await import('@/services/auth');
    const { loadAuthMock } = await import('@/utils/mock-loaders');

    await login('principal1', '123456');

    expect(loadAuthMock).toHaveBeenCalled();
    expect(mockLogin).toHaveBeenCalledWith('principal1', '123456');
  });

  it('getTestAccounts 在非 mock 模式返回空数组', async () => {
    const { getTestAccounts, getTestPassword } = await import('@/services/auth');
    await expect(getTestAccounts()).resolves.toEqual([]);
    await expect(getTestPassword()).resolves.toBe('');
  });
});
