import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrganizationQuotaUsage } from '@/services/organization';

const getMock = vi.fn();
const postMock = vi.fn();

vi.mock('@/utils/request', () => ({
  get: (...args: unknown[]) => getMock(...args),
  post: (...args: unknown[]) => postMock(...args),
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

describe('organizationService.redeemActivationCode', () => {
  beforeEach(() => {
    vi.resetModules();
    getMock.mockReset();
    postMock.mockReset();
  });

  it('校验空码与过短码', async () => {
    const { organizationService } = await import('@/services/organization');
    expect(await organizationService.redeemActivationCode('')).toEqual({
      error: { message: '请输入激活码' },
    });
    expect(await organizationService.redeemActivationCode('HXK-1')).toEqual({
      error: { message: '激活码格式不正确' },
    });
    expect(postMock).not.toHaveBeenCalled();
  });

  it('成功兑换走 POST /organization/redeem-activation-code', async () => {
    postMock.mockResolvedValueOnce({
      versionCode: 'BASIC',
      versionName: '基础版',
      versionUpgraded: true,
      message: '兑换成功',
    });
    const { organizationService } = await import('@/services/organization');
    const basic = await organizationService.redeemActivationCode('HXK-DEMO-BASIC-XXXX');
    expect(postMock).toHaveBeenCalledWith('/organization/redeem-activation-code', {
      code: 'HXK-DEMO-BASIC-XXXX',
    });
    expect(basic.error).toBeNull();
    expect(basic.versionCode).toBe('BASIC');
    expect(basic.versionUpgraded).toBe(true);
  });

  it('后端失败映射为 error.message', async () => {
    postMock.mockRejectedValueOnce(new Error('激活码不存在'));
    const { organizationService } = await import('@/services/organization');
    const bad = await organizationService.redeemActivationCode('BADCODE99XX');
    expect(bad.error?.message).toContain('激活码不存在');
  });
});

describe('organizationService.getMembershipTips', () => {
  beforeEach(() => {
    vi.resetModules();
    getMock.mockReset();
  });

  it('合并远端 tips；空/失败降级 null', async () => {
    getMock.mockResolvedValueOnce({ tips: [{ tipId: 'E-A', title: '远端' }] });
    let { organizationService } = await import('@/services/organization');
    expect(await organizationService.getMembershipTips()).toEqual([
      { tipId: 'E-A', title: '远端' },
    ]);

    vi.resetModules();
    getMock.mockResolvedValueOnce({ tips: [] });
    ({ organizationService } = await import('@/services/organization'));
    expect(await organizationService.getMembershipTips()).toBeNull();

    vi.resetModules();
    getMock.mockRejectedValueOnce(new Error('network'));
    ({ organizationService } = await import('@/services/organization'));
    expect(await organizationService.getMembershipTips()).toBeNull();
  });
});
