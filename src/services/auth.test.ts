import { beforeEach, describe, expect, it, vi } from 'vitest';
import Taro from '@tarojs/taro';
import { authCapabilities, registerStep1ByPhone } from '@/services/auth';

vi.mock('@/utils/request', () => ({
  post: vi.fn(),
  get: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
}));

describe('auth service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Taro.setStorageSync('yunce-edu-register-draft-local', '');
  });

  it('真实模式下注册走手机号', () => {
    expect(authCapabilities.usesMockRegister).toBe(
      typeof process !== 'undefined' && process.env.VITE_USE_MOCK !== 'false',
    );
  });

  it('registerStep1ByPhone 校验手机号格式', async () => {
    const invalid = await registerStep1ByPhone('12345');
    expect(invalid.tempToken).toBeNull();
    expect(invalid.error?.message).toContain('手机号');
  });
});
