/**
 * 会员货架展示：由后端 OrganizationVersion（plans）+ 可购 SKU 组装。
 * 价格 / 配额 / 功能以接口为准；本文件只做映射与本地试算，不含价目表。
 *
 * 短周期（如成长版 1 天 / TEST_PAY）与 2/3 年同档展示，不单独做「联调」入口。
 */
import { formatQuotaCap, isUnlimitedQuota } from '@/constants/membership-plans';
import type { MembershipCatalogPlan, MembershipSku } from '@/services/payment';

/** 多年期 */
export type ShelfTermYears = 2 | 3;
/** 货架时长键：多年或短周期 1 天 */
export type ShelfTermKey = ShelfTermYears | '1d';

export type ShelfPlanCode = string;

export interface MembershipShelfPlan {
  code: ShelfPlanCode;
  shortName: string;
  name: string;
  /** 年标价（元）：由多年期 SKU 折算；短周期不参与划线年价 */
  yearPrice: number;
  /** 货架实付：时长键 → 元（来自 SKU.price） */
  pay: Partial<Record<ShelfTermKey, number>>;
  /** 可用开通时长（由 SKU durationDays 推导；短周期在前） */
  terms: ShelfTermKey[];
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

/** 与后端 VERSION_RANK 对齐：用于货架过滤不可降档 */
export const SHELF_VERSION_RANK: Record<string, number> = {
  FREE: 0,
  TRIAL: 1,
  BASIC: 2,
  STANDARD: 3,
  FLAGSHIP: 4,
};

/**
 * 有效期内：隐藏众创与更低付费档，避免点下去被后端拒单。
 * 已过期 / 未开通：展示全部。
 */
export function filterShelfPlansByEntitlement(
  plans: MembershipShelfPlan[],
  input: { versionCode?: string | null; entitled: boolean },
): MembershipShelfPlan[] {
  if (!input.entitled || !input.versionCode) return plans;
  const raw = input.versionCode.trim().toUpperCase();
  const minRank = SHELF_VERSION_RANK[raw] ?? SHELF_VERSION_RANK[shelfBaseVersionCode(raw)] ?? 0;
  return plans.filter((p) => {
    const code = p.code.toUpperCase();
    if (p.free || code === 'FREE') return false;
    return (SHELF_VERSION_RANK[code] ?? 0) >= minRank;
  });
}

/** 将 SKU code 对齐到权益档（TEST_* → STANDARD，与后端 toEntitlement 一致） */
export function shelfBaseVersionCode(versionCode: string): string {
  const u = versionCode.trim().toUpperCase();
  if (u.startsWith('TEST_')) return 'STANDARD';
  const m = u.match(/^(BASIC|STANDARD|FLAGSHIP|FREE)/);
  return m ? m[1] : u;
}

export function durationDaysToShelfTerm(durationDays: number): ShelfTermKey | null {
  if (durationDays > 0 && durationDays <= 3) return '1d';
  const years = durationDays / 365;
  if (Math.abs(years - 2) <= 20 / 365) return 2;
  if (Math.abs(years - 3) <= 20 / 365) return 3;
  if (Math.abs(durationDays - 730) <= 20) return 2;
  if (Math.abs(durationDays - 1095) <= 20) return 3;
  return null;
}

/** @deprecated 用 durationDaysToShelfTerm；保留给旧测试别名 */
export function durationDaysToShelfYears(durationDays: number): ShelfTermYears | null {
  const t = durationDaysToShelfTerm(durationDays);
  return t === 2 || t === 3 ? t : null;
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

function sortTerms(terms: ShelfTermKey[]): ShelfTermKey[] {
  const rank = (t: ShelfTermKey) => (t === '1d' ? 0 : t);
  return [...terms].sort((a, b) => Number(rank(a)) - Number(rank(b)));
}

/** Object.keys 会把数字键变成字符串；这里还原为 ShelfTermKey */
function termKeysFromPay(pay: Partial<Record<ShelfTermKey, number>>): ShelfTermKey[] {
  return (Object.keys(pay) as string[])
    .map((k): ShelfTermKey | null => {
      if (k === '1d') return '1d';
      if (k === '2') return 2;
      if (k === '3') return 3;
      return null;
    })
    .filter((t): t is ShelfTermKey => t != null);
}

/**
 * 用后端 plans + skus 组装货架。无 plans 时仅从 skus 推导付费档（不含众创）。
 * TEST_* 短周期 SKU 并入成长版时长，不当独立档。
 */
export function buildShelfPlans(
  plans: MembershipCatalogPlan[] | undefined,
  skus: MembershipSku[],
): MembershipShelfPlan[] {
  const byBase = new Map<string, MembershipSku[]>();
  for (const sku of skus) {
    const base = shelfBaseVersionCode(sku.versionCode);
    if (!['BASIC', 'STANDARD', 'FLAGSHIP'].includes(base)) continue;
    const list = byBase.get(base) || [];
    list.push(sku);
    byBase.set(base, list);
  }

  const buildPayMap = (base: string): Partial<Record<ShelfTermKey, number>> => {
    const pay: Partial<Record<ShelfTermKey, number>> = {};
    const group = byBase.get(base) || [];
    // 同时长多 SKU：优先价高（1 元优于 1 分）
    const sorted = [...group].sort((a, b) => b.price - a.price);
    for (const sku of sorted) {
      const t = durationDaysToShelfTerm(sku.durationDays);
      if (!t) continue;
      if (pay[t] == null) {
        pay[t] = Math.round(sku.price) / 100;
      }
    }
    return pay;
  };

  const yearPriceFromPay = (pay: Partial<Record<ShelfTermKey, number>>): number => {
    // 年标价须高于「实付/年」，否则最短多年期立省恒为 0（v3 价签看不见省多少）
    // 约定：有 2 年价时按约 9 折反推；仅 3 年时按约 8.4 折反推（对齐设计稿成长档 ¥398）
    const y2 = pay[2];
    if (y2 != null && y2 > 0) return Math.round(y2 / 2 / 0.9);
    const y3 = pay[3];
    if (y3 != null && y3 > 0) return Math.round(y3 / 3 / 0.84);
    let max = 0;
    (Object.entries(pay) as Array<[string, number]>).forEach(([key, amount]) => {
      if (key === '1d') return;
      const years = Number(key);
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
        const terms = sortTerms(termKeysFromPay(pay));
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

  return ['BASIC', 'STANDARD', 'FLAGSHIP']
    .filter((code) => byBase.has(code))
    .map((code) => {
      const group = byBase.get(code)!;
      const sample = group.find((s) => !/^TEST_/i.test(s.versionCode)) || group[0];
      const pay = buildPayMap(code);
      const terms = sortTerms(termKeysFromPay(pay));
      return {
        code,
        name: sample.name.replace(/-\d+年$/u, '').replace(/-1天$/u, '') || code,
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

export function defaultShelfTerm(terms: ShelfTermKey[] | undefined): ShelfTermKey {
  if (!terms?.length) return 3;
  // 各版本默认优先 3 年（有则选）
  if (terms.includes(3)) return 3;
  if (terms.includes(2)) return 2;
  return terms[0];
}

export type ShelfTermOption = {
  term: ShelfTermKey;
  label: string;
  /** 角标：更划算 / 立省 */
  badge: string | null;
  hint: string;
  pay: number;
  list: number;
  save: number;
  savePct: number;
  perYear: number;
  daily: number;
  /** 同档里立省金额最高 */
  bestSave: boolean;
};

/** 开通时长选项：按该档实际 SKU；含原价/实付/立省（对齐 pricing-v3） */
export function buildShelfTerms(plan: MembershipShelfPlan | undefined): ShelfTermOption[] {
  const terms = plan?.terms?.length ? plan.terms : ([] as ShelfTermKey[]);
  const yearPrice = plan?.yearPrice || 0;

  const rows = terms.map((term): ShelfTermOption => {
    const pay = plan?.pay[term] ?? 0;
    if (term === '1d') {
      return {
        term,
        label: '1 天开通',
        badge: null,
        hint: '',
        pay,
        list: pay,
        save: 0,
        savePct: 0,
        perYear: 0,
        daily: pay,
        bestSave: false,
      };
    }
    const list = yearPrice * term;
    const save = Math.max(0, list - pay);
    const savePct = list > 0 ? Math.round((save / list) * 100) : 0;
    const perYear = term > 0 ? Math.round((pay / term) * 10) / 10 : 0;
    const daily = term > 0 ? Math.round((pay / (term * 365)) * 100) / 100 : 0;
    return {
      term,
      label: `${term} 年开通`,
      badge: null,
      hint: yearPrice > 0 ? `¥${yearPrice}/年 × ${term}` : '',
      pay,
      list,
      save,
      savePct,
      perYear,
      daily,
      bestSave: false,
    };
  });

  let bestIdx = -1;
  let bestSave = -1;
  rows.forEach((r, i) => {
    if (r.term !== '1d' && r.save > bestSave) {
      bestSave = r.save;
      bestIdx = i;
    }
  });
  return rows.map((r, i) => {
    if (r.term === '1d' || r.save <= 0) return r;
    const isBest = i === bestIdx;
    return {
      ...r,
      bestSave: isBest,
      badge: isBest ? '更划算' : '立省',
    };
  });
}

export function calcShelfPay(input: {
  plan: MembershipShelfPlan;
  term: ShelfTermKey;
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
  const { plan, term } = input;
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
  const basePay = plan.pay[term] ?? 0;
  if (term === '1d') {
    return {
      mode: 'paid',
      basePay,
      list: basePay,
      campusPay: 0,
      pay: basePay,
      save: 0,
      perYear: 0,
      daily: basePay,
    };
  }
  const list = plan.yearPrice * term;
  const campusPay = 0;
  const pay = basePay;
  const save = Math.max(0, list - basePay);
  const perYear = term > 0 ? Math.round((pay / term) * 10) / 10 : 0;
  const daily = term > 0 ? Math.round((pay / (term * 365)) * 100) / 100 : 0;
  return { mode: 'paid', basePay, list, campusPay, pay, save, perYear, daily };
}

export function matchShelfSku(
  skus: MembershipSku[],
  versionCode: string,
  term: ShelfTermKey,
): MembershipSku | null {
  const base = shelfBaseVersionCode(versionCode);
  const sameVersion = skus.filter((s) => shelfBaseVersionCode(s.versionCode) === base);
  if (term === '1d') {
    const short = sameVersion
      .filter((s) => s.durationDays > 0 && s.durationDays <= 3)
      .sort((a, b) => b.price - a.price);
    return short[0] || null;
  }
  const targetDays = term * 365;
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
  ];
}
