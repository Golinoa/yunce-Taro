import { describe, expect, it } from 'vitest';
import {
  buildShelfPlans,
  buildShelfTerms,
  calcShelfPay,
  defaultShelfTerm,
  filterShelfPlansByEntitlement,
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
    const y3 = calcShelfPay({ plan, term: 3 });
    expect(y3.mode).toBe('paid');
    expect(y3.pay).toBe(999);
    expect(y3.campusPay).toBe(0);
    expect(y3.daily).toBe(0.91);
    // 年标价按 2 年约 9 折反推，2/3 年都应能显示立省
    expect(plan.yearPrice).toBe(398);
    const y2 = calcShelfPay({ plan, term: 2 });
    expect(y2.save).toBeGreaterThan(0);
    expect(y3.save).toBeGreaterThan(y2.save);
  });

  it('众创 free；matchShelfSku 按 durationDays；terms 由 SKU 推导', () => {
    const shelf = buildShelfPlans(samplePlans, sampleSkus);
    expect(calcShelfPay({ plan: getShelfPlan(shelf, 'FREE')!, term: 3 }).mode).toBe('free');
    expect(matchShelfSku(sampleSkus, 'STANDARD', 3)?.productId).toBe('yunce_growth_3y');
    expect(matchShelfSku(sampleSkus, 'STANDARD', 2)?.versionCode).toBe('STANDARD_2Y');
    expect(matchShelfSku(sampleSkus, 'BASIC', 3)).toBeNull();
    expect(buildShelfTerms(getShelfPlan(shelf, 'STANDARD')).map((t) => t.term)).toEqual([2, 3]);
  });

  it('TEST_PAY 并入成长版 1 天时长，不单独成档', () => {
    const withTest: MembershipSku[] = [
      ...sampleSkus,
      {
        versionCode: 'TEST_PAY',
        name: '成长版-1天',
        price: 100,
        durationDays: 1,
        productId: 'yunce_test_pay_1y',
        maxMembers: 300,
        maxEmployees: 99999,
        maxCampuses: 1,
      },
    ];
    const shelf = buildShelfPlans(samplePlans, withTest);
    const growth = getShelfPlan(shelf, 'STANDARD')!;
    expect(growth.terms).toEqual(['1d', 2, 3]);
    expect(growth.pay['1d']).toBe(1);
    expect(matchShelfSku(withTest, 'STANDARD', '1d')?.versionCode).toBe('TEST_PAY');
    expect(calcShelfPay({ plan: growth, term: '1d' }).pay).toBe(1);
    expect(buildShelfTerms(growth)[0]).toMatchObject({ term: '1d', label: '1 天开通' });
    const y3 = buildShelfTerms(growth).find((t) => t.term === 3)!;
    expect(y3.save).toBeGreaterThan(0);
    expect(y3.bestSave).toBe(true);
    expect(y3.badge).toBe('更划算');
    expect(defaultShelfTerm(growth.terms)).toBe(3);
  });

  it('shelfFeatureRows 营销文案', () => {
    const flagship = getShelfPlan(buildShelfPlans(samplePlans, sampleSkus), 'FLAGSHIP')!;
    const rows = shelfFeatureRows(flagship);
    expect(rows.find((r) => r[0] === '营销获客')?.[1]).toBe('✓');
    expect(rows.find((r) => r[0] === '额外校区')).toBeUndefined();
  });

  it('无 plans 时仍可从 skus 推导付费档', () => {
    const shelf = buildShelfPlans(undefined, sampleSkus);
    expect(shelf.some((p) => p.code === 'FREE')).toBe(false);
    expect(getShelfPlan(shelf, 'STANDARD')?.pay[3]).toBe(999);
  });

  it('filterShelfPlansByEntitlement：有效期内隐藏众创与更低档', () => {
    const shelf = buildShelfPlans(samplePlans, sampleSkus);
    expect(
      filterShelfPlansByEntitlement(shelf, { versionCode: 'STANDARD', entitled: true }).map(
        (p) => p.code,
      ),
    ).toEqual(['STANDARD', 'FLAGSHIP']);
    expect(
      filterShelfPlansByEntitlement(shelf, { versionCode: 'FLAGSHIP', entitled: true }).map(
        (p) => p.code,
      ),
    ).toEqual(['FLAGSHIP']);
    expect(
      filterShelfPlansByEntitlement(shelf, { versionCode: 'STANDARD', entitled: false }).map(
        (p) => p.code,
      ),
    ).toEqual(['FREE', 'BASIC', 'STANDARD', 'FLAGSHIP']);
    expect(
      filterShelfPlansByEntitlement(shelf, { versionCode: 'TRIAL', entitled: true }).map(
        (p) => p.code,
      ),
    ).toEqual(['BASIC', 'STANDARD', 'FLAGSHIP']);
    expect(
      filterShelfPlansByEntitlement(shelf, { versionCode: 'STANDARD_2Y', entitled: true }).map(
        (p) => p.code,
      ),
    ).toEqual(['STANDARD', 'FLAGSHIP']);
  });
});
