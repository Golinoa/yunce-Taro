import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/data/auth', () => ({
  mockLogin: vi.fn(async () => ({ session: null, profile: null, error: null })),
}));

vi.mock('@/data/home', () => ({
  mockGetTeacher: vi.fn(async () => null),
}));

describe('mock-loaders', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('loadAuthMock 仅在被调用时动态 import', async () => {
    const { loadAuthMock } = await import('@/utils/mock-loaders');
    const mod = await loadAuthMock();
    expect(typeof mod.mockLogin).toBe('function');
    await mod.mockLogin('u', 'p');
    expect(mod.mockLogin).toHaveBeenCalledWith('u', 'p');
  });

  it('loadHomeMock 缓存同一 promise', async () => {
    const { loadHomeMock } = await import('@/utils/mock-loaders');
    const first = loadHomeMock();
    const second = loadHomeMock();
    expect(first).toBe(second);
    await first;
  });
});
