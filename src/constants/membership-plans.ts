/**
 * 机构会员套餐目录（对齐设计稿定稿）
 * 后端 OrganizationVersion 为权威；本文件作展示兜底与 mock。
 */
export type MembershipPlanCode = 'FREE' | 'BASIC' | 'STANDARD' | 'FLAGSHIP' | 'TRIAL';

export interface MembershipPlanFeatures {
  teaching: boolean;
  leadTrace: boolean;
  marketing: boolean;
  multiCampus: boolean;
  batchImportExport: boolean;
}

export interface MembershipPlan {
  code: MembershipPlanCode;
  name: string;
  shortName: string;
  subtitle: string;
  recommended?: boolean;
  maxMembers: number;
  maxEmployees: number;
  maxCampuses: number;
  features: MembershipPlanFeatures;
  sort: number;
}

export type MembershipFeatureKey = keyof MembershipPlanFeatures | 'members' | 'employees';

/** 不限额度哨兵 */
export const UNLIMITED_QUOTA = -1;

export function formatQuotaCap(max: number): string {
  if (max < 0 || max >= 99999) return '不限';
  return String(max);
}

export function isUnlimitedQuota(max: number): boolean {
  return max < 0 || max >= 99999;
}

export const MEMBERSHIP_PLANS: MembershipPlan[] = [
  {
    code: 'FREE',
    name: '众创版',
    shortName: '众创',
    subtitle: '申请',
    maxMembers: 40,
    maxEmployees: 2,
    maxCampuses: 1,
    features: {
      teaching: true,
      leadTrace: false,
      marketing: false,
      multiCampus: false,
      batchImportExport: false,
    },
    sort: 1,
  },
  {
    code: 'BASIC',
    name: '基础版',
    shortName: '基础',
    subtitle: '100人',
    maxMembers: 100,
    maxEmployees: UNLIMITED_QUOTA,
    maxCampuses: 1,
    features: {
      teaching: true,
      leadTrace: false,
      marketing: false,
      multiCampus: false,
      batchImportExport: false,
    },
    sort: 2,
  },
  {
    code: 'STANDARD',
    name: '成长版',
    shortName: '成长',
    subtitle: '300人',
    recommended: true,
    maxMembers: 300,
    maxEmployees: UNLIMITED_QUOTA,
    maxCampuses: 1,
    features: {
      teaching: true,
      leadTrace: true,
      marketing: true,
      multiCampus: false,
      batchImportExport: false,
    },
    sort: 3,
  },
  {
    code: 'FLAGSHIP',
    name: '旗舰版',
    shortName: '旗舰',
    subtitle: '800人·含2校区',
    maxMembers: 800,
    maxEmployees: UNLIMITED_QUOTA,
    maxCampuses: 2,
    features: {
      teaching: true,
      leadTrace: true,
      marketing: true,
      multiCampus: true,
      batchImportExport: true,
    },
    sort: 4,
  },
];

export const MEMBERSHIP_FEATURE_ROWS: Array<{ key: MembershipFeatureKey; label: string }> = [
  { key: 'members', label: '会员名额' },
  { key: 'employees', label: '员工名额' },
  { key: 'teaching', label: '排课教务' },
  { key: 'leadTrace', label: '线索溯源' },
  { key: 'marketing', label: '营销获客' },
  { key: 'multiCampus', label: '多校区' },
  { key: 'batchImportExport', label: '批量导入导出' },
];

/**
 * 试用期展示对齐成长版能力；生命周期上 TRIAL 仍视为未付费（见 membership-tips / organization）。
 */
export function getMembershipPlan(code?: string | null): MembershipPlan | undefined {
  if (!code) return undefined;
  if (code === 'TRIAL') return MEMBERSHIP_PLANS.find((p) => p.code === 'STANDARD');
  return MEMBERSHIP_PLANS.find((p) => p.code === code);
}

export function getPlanFeatureDisplay(plan: MembershipPlan, key: MembershipFeatureKey): string {
  if (key === 'members') return formatQuotaCap(plan.maxMembers);
  if (key === 'employees') return formatQuotaCap(plan.maxEmployees);
  return plan.features[key] ? '✓' : '—';
}
