/**
 * 会员货架展示价（对齐 UI 定稿 membership-pricing.html）
 * 支付以后端 SKU / OrganizationVersion 为准；本文件只负责展示与本地试算。
 */
import type { MembershipPlanCode } from '@/constants/membership-plans';
import type { MembershipSku } from '@/services/payment';

export type ShelfTermYears = 2 | 3;

export type ShelfPlanCode = Extract<MembershipPlanCode, 'FREE' | 'BASIC' | 'STANDARD' | 'FLAGSHIP'>;

export interface MembershipShelfPlan {
  code: ShelfPlanCode;
  shortName: string;
  name: string;
  /** 年标价（元），众创为 0 */
  yearPrice: number;
  /** 货架实付：2 年 / 3 年（元） */
  pay: Partial<Record<ShelfTermYears, number>>;
  recommended?: boolean;
  free?: boolean;
  membersLabel: string;
  employeesLabel: string;
  campusesLabel: string;
  includedCampuses: number;
  /** 额外校区年费；0 表示不可加购 */
  campusFeePerYear: number;
  marketing: boolean;
}

export const MEMBERSHIP_SHELF_PLANS: MembershipShelfPlan[] = [
  {
    code: 'FREE',
    shortName: '众创',
    name: '众创版',
    yearPrice: 0,
    pay: {},
    free: true,
    membersLabel: '40',
    employeesLabel: '2',
    campusesLabel: '1',
    includedCampuses: 1,
    campusFeePerYear: 0,
    marketing: false,
  },
  {
    code: 'BASIC',
    shortName: '基础',
    name: '基础版',
    yearPrice: 198,
    pay: { 2: 356, 3: 499 },
    membersLabel: '100',
    employeesLabel: '不限',
    campusesLabel: '1',
    includedCampuses: 1,
    campusFeePerYear: 0,
    marketing: false,
  },
  {
    code: 'STANDARD',
    shortName: '成长',
    name: '成长版',
    yearPrice: 398,
    pay: { 2: 716, 3: 999 },
    recommended: true,
    membersLabel: '300',
    employeesLabel: '不限',
    campusesLabel: '1',
    includedCampuses: 1,
    campusFeePerYear: 200,
    marketing: true,
  },
  {
    code: 'FLAGSHIP',
    shortName: '旗舰',
    name: '旗舰版',
    yearPrice: 999,
    pay: { 2: 1798, 3: 2499 },
    membersLabel: '800',
    employeesLabel: '不限',
    campusesLabel: '含 2',
    includedCampuses: 2,
    campusFeePerYear: 200,
    marketing: true,
  },
];

export const MEMBERSHIP_SHELF_TERMS: Array<{
  years: ShelfTermYears;
  label: string;
  badge: string | null;
  hint: string;
}> = [
  { years: 2, label: '2 年', badge: '省10%', hint: '9折' },
  { years: 3, label: '3 年', badge: '省16%', hint: '约8.3折' },
];

export const MEMBERSHIP_MARKETING_RED = '#FF6A2B';

export function getShelfPlan(code: string): MembershipShelfPlan | undefined {
  return MEMBERSHIP_SHELF_PLANS.find((p) => p.code === code);
}

export function calcShelfPay(input: {
  plan: MembershipShelfPlan;
  years: ShelfTermYears;
  campusExtra: number;
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
  const { plan, years, campusExtra } = input;
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
  const campusPay = (plan.campusFeePerYear || 0) * Math.max(0, campusExtra) * years;
  const pay = basePay + campusPay;
  const save = Math.max(0, list - basePay);
  const perYear = years > 0 ? Math.round((pay / years) * 10) / 10 : 0;
  const daily = years > 0 ? Math.round((pay / (years * 365)) * 100) / 100 : 0;
  return { mode: 'paid', basePay, list, campusPay, pay, save, perYear, daily };
}

/** 将货架年数对齐到后端 SKU（容差 ±20 天；兼容 STANDARD / STANDARD_3Y） */
export function shelfBaseVersionCode(versionCode: string): string {
  const m = versionCode
    .trim()
    .toUpperCase()
    .match(/^(BASIC|STANDARD|FLAGSHIP|FREE)/);
  return m ? m[1] : versionCode;
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
  return [
    ['会员', plan.membersLabel],
    ['员工', plan.employeesLabel],
    ['校区', plan.campusesLabel],
    ['约课/排课/候补/代课', '✓'],
    ['会员/课时核销/签到', '✓'],
    ['基础财务/收款/报表', '✓'],
    ['移动端（学员/教练）', '✓'],
    ['营销获客', plan.marketing ? '✓' : '—'],
    [
      '额外校区',
      plan.campusFeePerYear > 0
        ? `第${plan.includedCampuses + 1}个起 +¥${plan.campusFeePerYear}/年`
        : '—',
    ],
  ];
}
