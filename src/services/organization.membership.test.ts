import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrganizationQuotaUsage } from '@/services/organization';

vi.mock('@/utils/request', () => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}));

function baseQuota(partial: Partial<OrganizationQuotaUsage> = {}): OrganizationQuotaUsage {
  return {
    organizationId: 'org-mock',
    organizationName: '松果排课',
    versionCode: 'FREE',
    versionName: '众创版',
    expireAt: null,
    members: { current: 5, max: 40 },
    employees: { current: 1, max: 2 },
    campuses: { current: 1, max: 1 },
    features: { leadTrace: false, batchImportExport: false },
    ...partial,
  };
}

describe('isOrgMembershipActive', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('空 / 众创 / 试用 / 已过期为 false；付费有效为 true', async () => {
    const { isOrgMembershipActive } = await import('@/services/organization');
    expect(isOrgMembershipActive(null)).toBe(false);
    expect(isOrgMembershipActive(baseQuota({ versionCode: 'FREE' }))).toBe(false);
    expect(isOrgMembershipActive(baseQuota({ versionCode: 'TRIAL' }))).toBe(false);
    expect(
      isOrgMembershipActive(
        baseQuota({
          versionCode: 'STANDARD',
          expireAt: new Date(Date.now() - 86400000).toISOString(),
        }),
      ),
    ).toBe(false);
    expect(
      isOrgMembershipActive(
        baseQuota({
          versionCode: 'BASIC',
          expireAt: new Date(Date.now() + 86400000 * 30).toISOString(),
        }),
      ),
    ).toBe(true);
    expect(isOrgMembershipActive(baseQuota({ versionCode: 'FLAGSHIP', expireAt: null }))).toBe(
      true,
    );
  });
});

describe('organizationService mock 兑换配额', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('VITE_USE_MOCK', 'true');
  });

  it('校验空码与过短码', async () => {
    const { organizationService } = await import('@/services/organization');
    expect(await organizationService.redeemActivationCode('')).toEqual({
      error: { message: '请输入激活码' },
    });
    expect(await organizationService.redeemActivationCode('HXK-1')).toEqual({
      error: { message: '激活码格式不正确' },
    });
  });

  it('BASIC / FLAGSHIP / 非法前缀配额与文案正确', async () => {
    vi.useFakeTimers();
    const Taro = (await import('@tarojs/taro')).default;
    Taro.removeStorageSync('yunce:mock-org-membership');

    const { organizationService } = await import('@/services/organization');

    const basicP = organizationService.redeemActivationCode('HXK-DEMO-BASIC-XXXX');
    await vi.advanceTimersByTimeAsync(500);
    const basic = await basicP;
    expect(basic.error).toBeNull();
    expect(basic.versionCode).toBe('BASIC');
    expect(basic.versionUpgraded).toBe(true);

    let stored = JSON.parse(
      String(Taro.getStorageSync('yunce:mock-org-membership')),
    ) as OrganizationQuotaUsage;
    expect(stored.members.max).toBe(100);
    expect(stored.employees.max).toBe(5);

    const flagP = organizationService.redeemActivationCode('HXK-DEMO-FLAGSHIP');
    await vi.advanceTimersByTimeAsync(500);
    const flag = await flagP;
    expect(flag.versionCode).toBe('FLAGSHIP');
    stored = JSON.parse(
      String(Taro.getStorageSync('yunce:mock-org-membership')),
    ) as OrganizationQuotaUsage;
    expect(stored.members.max).toBe(-1);
    expect(stored.employees.max).toBe(-1);
    expect(stored.campuses.max).toBe(10);
    expect(stored.features.batchImportExport).toBe(true);

    const badP = organizationService.redeemActivationCode('BADCODE99');
    await vi.advanceTimersByTimeAsync(500);
    expect(await badP).toEqual({ error: { message: '激活码不存在' } });

    vi.useRealTimers();
  });
});

describe('organizationService.getMembershipTips', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('mock 模式直接返回 null', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'true');
    const { organizationService } = await import('@/services/organization');
    expect(await organizationService.getMembershipTips()).toBeNull();
  });

  it('真实模式合并远端 tips；失败降级 null', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false');
    const { get } = await import('@/utils/request');
    const getMock = get as unknown as ReturnType<typeof vi.fn>;

    getMock.mockResolvedValueOnce({ tips: [{ tipId: 'E-A', title: '远端' }] });
    let { organizationService } = await import('@/services/organization');
    expect(await organizationService.getMembershipTips()).toEqual([
      { tipId: 'E-A', title: '远端' },
    ]);

    vi.resetModules();
    vi.stubEnv('VITE_USE_MOCK', 'false');
    const req = await import('@/utils/request');
    (req.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ tips: [] });
    ({ organizationService } = await import('@/services/organization'));
    expect(await organizationService.getMembershipTips()).toBeNull();

    vi.resetModules();
    vi.stubEnv('VITE_USE_MOCK', 'false');
    const req2 = await import('@/utils/request');
    (req2.get as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('network'));
    ({ organizationService } = await import('@/services/organization'));
    expect(await organizationService.getMembershipTips()).toBeNull();
  });
});
