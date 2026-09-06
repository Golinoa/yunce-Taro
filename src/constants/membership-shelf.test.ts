import { describe, expect, it } from 'vitest';
import {
  buildShelfPlans,
  buildShelfTerms,
  calcShelfPay,
  getShelfPlan,
  matchShelfSku,
  shelfFeatureRows,
} from '@/constants/membership-shelf';
import type { MembershipCatalogPlan, MembershipSku } from '@/services/payment';

const samplePlans: MembershipCatalogPlan[] = [
  {
    code: 'FREE',
    name: '众创版',
    maxMembers: 40,
    maxEmployees: 2,
    maxCampuses: 1,
    features: { marketing: false },
    sort: 1,
  },
  {
    code: 'BASIC',
    name: '基础版',
    maxMembers: 100,
    maxEmployees: 99999,
    maxCampuses: 1,
    features: { marketing: false },
    sort: 2,
  },
  {
    code: 'STANDARD',
    name: '成长版',
    maxMembers: 300,
    maxEmployees: 99999,
    maxCampuses: 1,
    features: { marketing: true },
    sort: 3,
  },
  {
    code: 'FLAGSHIP',
    name: '旗舰版',
    maxMembers: 800,
    maxEmployees: 99999,
    maxCampuses: 2,
    features: { marketing: true },
    sort: 4,
  },
];

const sampleSkus: MembershipSku[] = [
  {
    versionCode: 'STANDARD_2Y',
    name: '成长版-2年',
    price: 71600,
    durationDays: 730,
    productId: 'yunce_growth_2y',
    maxMembers: 300,
    maxEmployees: 99999,
    maxCampuses: 1,
  },
  {
    versionCode: 'STANDARD_3Y',
    name: '成长版-3年',
    price: 99900,
    durationDays: 1095,
    productId: 'yunce_growth_3y',
    maxMembers: 300,
    maxEmployees: 99999,
    maxCampuses: 1,
  },
  {
    versionCode: 'FLAGSHIP_2Y',
    name: '旗舰版-2年',
    price: 179800,
    durationDays: 730,
    productId: 'yunce_flagship_2y',
    maxMembers: 800,
    maxEmployees: 99999,
    maxCampuses: 2,
  },
  {
    versionCode: 'FLAGSHIP_3Y',
    name: '旗舰版-3年',
    price: 249900,
    durationDays: 1095,
    productId: 'yunce_flagship_3y',
    maxMembers: 800,
    maxEmployees: 99999,
    maxCampuses: 2,
  },
];

describe('membership-shelf (from catalog)', () => {
  it('buildShelfPlans：价格与配额来自 plans+skus，不硬编码价目', () => {
    const shelf = buildShelfPlans(samplePlans, sampleSkus);
    expect(shelf).toHaveLength(4);
    const growth = getShelfPlan(shelf, 'STANDARD')!;
    const flagship = getShelfPlan(shelf, 'FLAGSHIP')!;
    expect(growth.name).toBe('成长版');
    expect(growth.recommended).toBe(true);
    expect(growth.pay[2]).toBe(716);
    expect(growth.pay[3]).toBe(999);
    expect(flagship.pay[2]).toBe(1798);
    expect(flagship.pay[3]).toBe(2499);
    expect(flagship.includedCampuses).toBe(2);
    expect(flagship.membersLabel).toBe('800');
  });

  it('运营改配额后货架标签跟随 plans', () => {
    const plans = samplePlans.map((p) =>
      p.code === 'STANDARD' ? { ...p, maxMembers: 500, name: '成长Plus' } : p,
    );
    const shelf = buildShelfPlans(plans, sampleSkus);
    const growth = getShelfPlan(shelf, 'STANDARD')!;
    expect(growth.name).toBe('成长Plus');
    expect(growth.membersLabel).toBe('500');
  });

  it('calcShelfPay：实付取 SKU；校区不加价', () => {
    const plan = getShelfPlan(buildShelfPlans(samplePlans, sampleSkus), 'STANDARD')!;
    const y3 = calcShelfPay({ plan, years: 3 });
    expect(y3.mode).toBe('paid');
    expect(y3.pay).toBe(999);
    expect(y3.campusPay).toBe(0);
    expect(y3.daily).toBe(0.91);
  });

  it('众创 free；matchShelfSku 按 durationDays；terms 由 SKU 推导', () => {
    const shelf = buildShelfPlans(samplePlans, sampleSkus);
    expect(calcShelfPay({ plan: getShelfPlan(shelf, 'FREE')!, years: 3 }).mode).toBe('free');
    expect(matchShelfSku(sampleSkus, 'STANDARD', 3)?.productId).toBe('yunce_growth_3y');
    expect(matchShelfSku(sampleSkus, 'STANDARD', 2)?.versionCode).toBe('STANDARD_2Y');
    expect(matchShelfSku(sampleSkus, 'BASIC', 3)).toBeNull();
    expect(buildShelfTerms(getShelfPlan(shelf, 'STANDARD')).map((t) => t.years)).toEqual([2, 3]);
  });

  it('shelfFeatureRows 营销与额外校区文案', () => {
    const flagship = getShelfPlan(buildShelfPlans(samplePlans, sampleSkus), 'FLAGSHIP')!;
    const rows = shelfFeatureRows(flagship);
    expect(rows.find((r) => r[0] === '营销获客')?.[1]).toBe('✓');
    expect(rows.find((r) => r[0] === '额外校区')?.[1]).toBe('联系运营');
  });

  it('无 plans 时仍可从 skus 推导付费档', () => {
    const shelf = buildShelfPlans(undefined, sampleSkus);
    expect(shelf.some((p) => p.code === 'FREE')).toBe(false);
    expect(getShelfPlan(shelf, 'STANDARD')?.pay[3]).toBe(999);
  });
});
