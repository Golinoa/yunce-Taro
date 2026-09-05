import { describe, expect, it } from 'vitest';
import {
  MEMBERSHIP_SHELF_PLANS,
  calcShelfPay,
  getShelfPlan,
  matchShelfSku,
  shelfFeatureRows,
} from '@/constants/membership-shelf';
import type { MembershipSku } from '@/services/payment';

describe('membership-shelf', () => {
  it('货架价对齐定稿：成长/旗舰 2·3 年与旗舰含 2 校区', () => {
    const growth = getShelfPlan('STANDARD')!;
    const flagship = getShelfPlan('FLAGSHIP')!;
    expect(growth.name).toBe('成长版');
    expect(growth.recommended).toBe(true);
    expect(growth.pay[2]).toBe(716);
    expect(growth.pay[3]).toBe(999);
    expect(flagship.pay[2]).toBe(1798);
    expect(flagship.pay[3]).toBe(2499);
    expect(flagship.includedCampuses).toBe(2);
    expect(flagship.campusesLabel).toBe('含 2');
    expect(MEMBERSHIP_SHELF_PLANS).toHaveLength(4);
  });

  it('calcShelfPay：3 年成长含日均；2 年不算日均展示但仍可算', () => {
    const plan = getShelfPlan('STANDARD')!;
    const y3 = calcShelfPay({ plan, years: 3, campusExtra: 0 });
    expect(y3.mode).toBe('paid');
    expect(y3.pay).toBe(999);
    expect(y3.list).toBe(1194);
    expect(y3.save).toBe(195);
    expect(y3.daily).toBe(0.91);

    const y2Campus = calcShelfPay({ plan, years: 2, campusExtra: 1 });
    expect(y2Campus.basePay).toBe(716);
    expect(y2Campus.campusPay).toBe(400);
    expect(y2Campus.pay).toBe(1116);
  });

  it('众创为 free；matchShelfSku 按 durationDays 精确匹配，兼容 *_2Y/*_3Y', () => {
    expect(calcShelfPay({ plan: getShelfPlan('FREE')!, years: 3, campusExtra: 0 }).mode).toBe(
      'free',
    );
    const skus: MembershipSku[] = [
      {
        versionCode: 'STANDARD_2Y',
        name: '成长版-2年',
        price: 71600,
        durationDays: 730,
        productId: 'yunce_growth_2y',
        maxMembers: 300,
        maxEmployees: -1,
        maxCampuses: 1,
      },
      {
        versionCode: 'STANDARD_3Y',
        name: '成长版-3年',
        price: 99900,
        durationDays: 1095,
        productId: 'yunce_growth_3y',
        maxMembers: 300,
        maxEmployees: -1,
        maxCampuses: 1,
      },
    ];
    expect(matchShelfSku(skus, 'STANDARD', 3)?.productId).toBe('yunce_growth_3y');
    expect(matchShelfSku(skus, 'STANDARD', 2)?.versionCode).toBe('STANDARD_2Y');
    expect(matchShelfSku(skus, 'BASIC', 3)).toBeNull();
  });

  it('shelfFeatureRows 含营销与额外校区文案', () => {
    const rows = shelfFeatureRows(getShelfPlan('FLAGSHIP')!);
    expect(rows.find((r) => r[0] === '营销获客')?.[1]).toBe('✓');
    expect(rows.find((r) => r[0] === '额外校区')?.[1]).toContain('第3个起');
  });
});
