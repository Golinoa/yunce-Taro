import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/build-env', () => ({
  isDevApiEnv: vi.fn(() => true),
}));

vi.mock('@/constants/dev-switch-accounts', () => ({
  resolveDevLoginEmail: (input: string) => {
    if (input === 'principal1') return 'principal1@yunce.com';
    return null;
  },
}));

describe('auth-email helpers (Q2-4)', () => {
  beforeEach(async () => {
    const { isDevApiEnv } = await import('@/utils/build-env');
    vi.mocked(isDevApiEnv).mockReturnValue(true);
  });

  it('dev 短用户名映射邮箱', async () => {
    const { resolveLoginEmailInput } = await import('./auth-email');
    expect(resolveLoginEmailInput('principal1')).toBe('principal1@yunce.com');
  });

  it('合法邮箱转小写', async () => {
    const { resolveLoginEmailInput } = await import('./auth-email');
    expect(resolveLoginEmailInput('  Foo@Bar.COM ')).toBe('foo@bar.com');
  });

  it('生产环境拒绝非邮箱', async () => {
    const { isDevApiEnv } = await import('@/utils/build-env');
    vi.mocked(isDevApiEnv).mockReturnValue(false);
    vi.resetModules();
    const { resolveLoginEmailInput } = await import('./auth-email');
    expect(resolveLoginEmailInput('principal1')).toBeNull();
  });

  it('maskEmailAddress 保留域名', async () => {
    const { maskEmailAddress } = await import('./auth-email');
    expect(maskEmailAddress('ab@x.com')).toBe('a***@x.com');
    expect(maskEmailAddress('abcd@x.com')).toBe('ab***@x.com');
  });
});
