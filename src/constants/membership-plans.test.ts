import { describe, expect, it } from 'vitest';
import {
  MEMBERSHIP_FEATURE_ROWS,
  MEMBERSHIP_PLANS,
  formatQuotaCap,
  getMembershipPlan,
  getPlanFeatureDisplay,
  isUnlimitedQuota,
} from '@/constants/membership-plans';

describe('membership-plans', () => {
  it('四档套餐配额与设计稿一致', () => {
    const byCode = Object.fromEntries(MEMBERSHIP_PLANS.map((p) => [p.code, p]));
    expect(byCode.FREE.maxMembers).toBe(40);
    expect(byCode.FREE.maxEmployees).toBe(2);
    expect(byCode.BASIC.maxMembers).toBe(100);
    expect(byCode.BASIC.maxEmployees).toBe(5);
    expect(byCode.STANDARD.maxMembers).toBe(220);
    expect(byCode.STANDARD.maxEmployees).toBe(8);
    expect(isUnlimitedQuota(byCode.FLAGSHIP.maxMembers)).toBe(true);
    expect(isUnlimitedQuota(byCode.FLAGSHIP.maxEmployees)).toBe(true);
    expect(byCode.FLAGSHIP.maxCampuses).toBe(10);
    expect(MEMBERSHIP_FEATURE_ROWS.length).toBeGreaterThanOrEqual(7);
  });

  it('旗舰独有多校区与批量导入；标准版营销/线索', () => {
    const flagship = getMembershipPlan('FLAGSHIP')!;
    const standard = getMembershipPlan('STANDARD')!;
    expect(getPlanFeatureDisplay(flagship, 'multiCampus')).toBe('✓');
    expect(getPlanFeatureDisplay(flagship, 'batchImportExport')).toBe('✓');
    expect(getPlanFeatureDisplay(flagship, 'members')).toBe('不限');
    expect(getPlanFeatureDisplay(flagship, 'employees')).toBe('不限');
    expect(getPlanFeatureDisplay(standard, 'multiCampus')).toBe('—');
    expect(getPlanFeatureDisplay(standard, 'marketing')).toBe('✓');
    expect(getPlanFeatureDisplay(standard, 'leadTrace')).toBe('✓');
    expect(getPlanFeatureDisplay(getMembershipPlan('BASIC')!, 'marketing')).toBe('—');
  });

  it('formatQuotaCap / isUnlimitedQuota', () => {
    expect(formatQuotaCap(-1)).toBe('不限');
    expect(formatQuotaCap(99999)).toBe('不限');
    expect(formatQuotaCap(220)).toBe('220');
    expect(isUnlimitedQuota(0)).toBe(false);
    expect(isUnlimitedQuota(100)).toBe(false);
  });

  it('getMembershipPlan：空码 / TRIAL 映射 / 未知码', () => {
    expect(getMembershipPlan(null)).toBeUndefined();
    expect(getMembershipPlan(undefined)).toBeUndefined();
    expect(getMembershipPlan('')).toBeUndefined();
    expect(getMembershipPlan('TRIAL')?.code).toBe('FREE');
    expect(getMembershipPlan('UNKNOWN')).toBeUndefined();
  });
});
