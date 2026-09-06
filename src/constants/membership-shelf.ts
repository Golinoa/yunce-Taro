/**
 * 会员货架展示：由后端 OrganizationVersion（plans）+ 可购 SKU 组装。
 * 价格 / 配额 / 功能以接口为准；本文件只做映射与本地试算，不含价目表。
 */
import { formatQuotaCap, isUnlimitedQuota } from '@/constants/membership-plans';
import type { MembershipCatalogPlan, MembershipSku } from '@/services/payment';

export type ShelfTermYears = 2 | 3;

export type ShelfPlanCode = string;

export interface MembershipShelfPlan {
  code: ShelfPlanCode;
  shortName: string;
  name: string;
  /** 年标价（元）：由各时长 SKU 折算后的最高年价，用于划线价；无 SKU 为 0 */
  yearPrice: number;
  /** 货架实付：年数 → 元（来自 SKU.price） */
  pay: Partial<Record<ShelfTermYears, number>>;
  /** 可用开通时长（由 SKU durationDays 推导） */
  terms: ShelfTermYears[];
  recommended?: boolean;
  free?: boolean;
  membersLabel: string;
  employeesLabel: string;
  campusesLabel: string;
  includedCampuses: number;
  marketing: boolean;
  features: Record<string, boolean>;
}

export const MEMBERSHIP_MARKETING_RED = '#FF6A2B';

/** 将货架年数对齐到后端 SKU（容差 ±20 天；兼容 STANDARD / STANDARD_3Y） */
export function shelfBaseVersionCode(versionCode: string): string {
  const m = versionCode
    .trim()
    .toUpperCase()
    .match(/^(BASIC|STANDARD|FLAGSHIP|FREE)/);
  return m ? m[1] : versionCode.trim().toUpperCase();
}

export function durationDaysToShelfYears(durationDays: number): ShelfTermYears | null {
  const years = durationDays / 365;
  if (Math.abs(years - 2) <= 20 / 365) return 2;
  if (Math.abs(years - 3) <= 20 / 365) return 3;
  // 宽松：约 730 / 1095 天
  if (Math.abs(durationDays - 730) <= 20) return 2;
  if (Math.abs(durationDays - 1095) <= 20) return 3;
  return null;
}

function shortNameFromPlan(name: string, code: string): string {
  const trimmed = name.replace(/版$/u, '').trim();
  if (trimmed) return trimmed;
  const map: Record<string, string> = {
    FREE: '众创',
    BASIC: '基础',
    STANDARD: '成长',
    FLAGSHIP: '旗舰',
  };
  return map[code] || code;
}

function campusesLabel(maxCampuses: number): string {
  if (isUnlimitedQuota(maxCampuses)) return '不限';
  if (maxCampuses >= 2) return `含 ${maxCampuses}`;
  return String(maxCampuses);
}

/**
 * 用后端 plans + skus 组装货架。无 plans 时仅从 skus 推导付费档（不含众创）。
 */
export function buildShelfPlans(
  plans: MembershipCatalogPlan[] | undefined,
  skus: MembershipSku[],
): MembershipShelfPlan[] {
  const paidSkus = skus.filter((s) => !/^TEST_/i.test(s.versionCode));

  const byBase = new Map<string, MembershipSku[]>();
  for (const sku of paidSkus) {
    const base = shelfBaseVersionCode(sku.versionCode);
    if (!['BASIC', 'STANDARD', 'FLAGSHIP'].includes(base)) continue;
    const list = byBase.get(base) || [];
    list.push(sku);
    byBase.set(base, list);
  }

  const buildPayMap = (base: string): Partial<Record<ShelfTermYears, number>> => {
    const pay: Partial<Record<ShelfTermYears, number>> = {};
    for (const sku of byBase.get(base) || []) {
      const y = durationDaysToShelfYears(sku.durationDays);
      if (!y) continue;
      pay[y] = Math.round(sku.price) / 100;
    }
    return pay;
  };

  const yearPriceFromPay = (pay: Partial<Record<ShelfTermYears, number>>): number => {
    let max = 0;
    (Object.entries(pay) as Array<[string, number]>).forEach(([y, amount]) => {
      const years = Number(y);
      if (years > 0 && amount > 0) {
        max = Math.max(max, amount / years);
      }
    });
    return Math.round(max);
  };

  if (plans && plans.length > 0) {
    return [...plans]
      .sort((a, b) => a.sort - b.sort)
      .filter((p) => ['FREE', 'BASIC', 'STANDARD', 'FLAGSHIP'].includes(p.code.toUpperCase()))
      .map((p) => {
        const code = p.code.toUpperCase();
        const free = code === 'FREE';
        const pay = free ? {} : buildPayMap(code);
        const terms = (Object.keys(pay).map(Number) as ShelfTermYears[]).sort((a, b) => a - b);
        const features = p.features || {};
        return {
          code,
          name: p.name,
          shortName: shortNameFromPlan(p.name, code),
          yearPrice: free ? 0 : yearPriceFromPay(pay),
          pay,
          terms,
          recommended: code === 'STANDARD',
          free,
          membersLabel: formatQuotaCap(p.maxMembers),
          employeesLabel: formatQuotaCap(p.maxEmployees),
          campusesLabel: campusesLabel(p.maxCampuses),
          includedCampuses: Math.max(1, p.maxCampuses > 0 ? p.maxCampuses : 1),
          marketing: Boolean(features.marketing),
          features,
        };
      });
  }

  // 无 plans：仅 SKU 推导付费档
  return ['BASIC', 'STANDARD', 'FLAGSHIP']
    .filter((code) => byBase.has(code))
    .map((code) => {
      const group = byBase.get(code)!;
      const sample = group[0];
      const pay = buildPayMap(code);
      const terms = (Object.keys(pay).map(Number) as ShelfTermYears[]).sort((a, b) => a - b);
      return {
        code,
        name: sample.name.replace(/-\d+年$/u, '') || code,
        shortName: shortNameFromPlan(sample.name, code),
        yearPrice: yearPriceFromPay(pay),
        pay,
        terms,
        recommended: code === 'STANDARD',
        free: false,
        membersLabel: formatQuotaCap(sample.maxMembers),
        employeesLabel: formatQuotaCap(sample.maxEmployees),
        campusesLabel: campusesLabel(sample.maxCampuses),
        includedCampuses: Math.max(1, sample.maxCampuses > 0 ? sample.maxCampuses : 1),
        marketing: code !== 'BASIC',
        features: {},
      };
    });
}

export function getShelfPlan(
  plans: MembershipShelfPlan[],
  code: string,
): MembershipShelfPlan | undefined {
  return plans.find((p) => p.code === code);
}

/** 开通时长选项：按该档实际 SKU；无则空 */
export function buildShelfTerms(
  plan: MembershipShelfPlan | undefined,
): Array<{ years: ShelfTermYears; label: string; badge: string | null; hint: string }> {
  const terms = plan?.terms?.length ? plan.terms : ([] as ShelfTermYears[]);
  const yearPrice = plan?.yearPrice || 0;
  return terms.map((years) => {
    const pay = plan?.pay[years] ?? 0;
    const list = yearPrice * years;
    const save = Math.max(0, list - pay);
    const savePct = list > 0 ? Math.round((save / list) * 100) : 0;
    return {
      years,
      label: `${years} 年`,
      badge: savePct >= 10 ? `省${savePct}%` : null,
      hint: savePct > 0 ? `约${(10 - savePct / 10).toFixed(1).replace(/\.0$/, '')}折` : '正价',
    };
  });
}

export function calcShelfPay(input: {
  plan: MembershipShelfPlan;
  years: ShelfTermYears;
  campusExtra?: number;
}): {
  mode: 'free' | 'paid';
  basePay: number;
  list: number;
  campusPay: number;
  pay: number;
  save: number;
  perYear: number;
  daily: number;
} {
  const { plan, years } = input;
  if (plan.free) {
    return {
      mode: 'free',
      basePay: 0,
      list: 0,
      campusPay: 0,
      pay: 0,
      save: 0,
      perYear: 0,
      daily: 0,
    };
  }
  const basePay = plan.pay[years] ?? 0;
  const list = plan.yearPrice * years;
  // 校区加购不在线计价，须联系运营；不计入货架实付
  const campusPay = 0;
  const pay = basePay;
  const save = Math.max(0, list - basePay);
  const perYear = years > 0 ? Math.round((pay / years) * 10) / 10 : 0;
  const daily = years > 0 ? Math.round((pay / (years * 365)) * 100) / 100 : 0;
  return { mode: 'paid', basePay, list, campusPay, pay, save, perYear, daily };
}

export function matchShelfSku(
  skus: MembershipSku[],
  versionCode: string,
  years: ShelfTermYears,
): MembershipSku | null {
  const targetDays = years * 365;
  const base = shelfBaseVersionCode(versionCode);
  const sameVersion = skus.filter((s) => shelfBaseVersionCode(s.versionCode) === base);
  const exact = sameVersion.find((s) => Math.abs(s.durationDays - targetDays) <= 20);
  return exact || null;
}

export function shelfFeatureRows(plan: MembershipShelfPlan): Array<[string, string]> {
  const f = plan.features || {};
  return [
    ['会员', plan.membersLabel],
    ['员工', plan.employeesLabel],
    ['校区', plan.campusesLabel],
    ['约课/排课/候补/代课', '✓'],
    ['会员/课时核销/签到', '✓'],
    ['基础财务/收款/报表', '✓'],
    ['移动端（学员/教练）', '✓'],
    ['营销获客', plan.marketing || f.marketing ? '✓' : '—'],
    ['额外校区', '联系运营'],
  ];
}
