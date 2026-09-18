import type { DeductionType, TeacherUIModel, SalaryRuleConfig } from '@/types/teacher';

export interface SalaryAdjustmentDraft {
  reason: string;
  amount: number;
  type: DeductionType;
}

export interface SalaryAdjustmentFormInput {
  base: string;
  lateFine: string;
  otherFine: string;
  bonusAmount: string;
  socialInsurance: string;
  customRows: Array<{ reason: string; amount: string; type: DeductionType }>;
}

function parseAdjustmentAmount(value: string): number {
  const amount = Number.parseFloat(value);
  return Number.isFinite(amount) ? Math.max(0, amount) : 0;
}

/** 把页面可编辑字段转换为后端可审计的奖励/扣款明细。 */
export function buildSalaryAdjustmentDrafts(
  input: SalaryAdjustmentFormInput,
  currentBase: number,
): SalaryAdjustmentDraft[] {
  const drafts: SalaryAdjustmentDraft[] = [];
  const push = (reason: string, amount: number, type: DeductionType) => {
    const normalized = Number(amount.toFixed(2));
    if (normalized > 0) drafts.push({ reason, amount: normalized, type });
  };

  const baseDelta = parseAdjustmentAmount(input.base) - Math.max(0, currentBase);
  push('底薪调整', Math.abs(baseDelta), baseDelta >= 0 ? 'bonus' : 'deduct');
  push('个人社保', parseAdjustmentAmount(input.socialInsurance), 'deduct');
  push('迟到罚款', parseAdjustmentAmount(input.lateFine), 'deduct');
  push('其他罚款', parseAdjustmentAmount(input.otherFine), 'deduct');
  push('奖金', parseAdjustmentAmount(input.bonusAmount), 'bonus');
  input.customRows.forEach((row) => {
    push(row.reason.trim() || '自定义调整', parseAdjustmentAmount(row.amount), row.type);
  });
  return drafts;
}

/** 计算教师薪资总额（含扣款/补发）；UI 展示与 mockExecutePay 实发共用同一算法 */
export function calcTotal(t: TeacherUIModel): number {
  if (
    t.selectedSalaryRecord &&
    ['confirmed', 'paid'].includes(String(t.selectedSalaryRecord.status))
  ) {
    return Math.max(0, Number(t.selectedSalaryRecord.amount) || 0);
  }
  const categorySum = t.categoryLessonFees?.reduce(
    (sum, item) => sum + (Number(item.amount) || 0),
    0,
  );
  const lessonFee = categorySum ?? (Number(t.hours) || 0) * (Number(t.rate) || 0);
  let total = (Number(t.base) || 0) + lessonFee + (Number(t.attend) || 0) + (Number(t.perf) || 0);
  total -= t.socialInsurance || 0;
  total -= t.lateFine || 0;
  total -= t.otherFine || 0;
  total += t.bonusAmount || 0;
  t.deductions.forEach((d) => {
    total += d.type === 'bonus' ? Number(d.amount) || 0 : -(Number(d.amount) || 0);
  });
  return Number.isFinite(total) ? Math.max(0, total) : 0;
}

/** 创建默认空薪资规则配置 */
export function createDefaultSalaryRule(): SalaryRuleConfig {
  return {
    baseMode: 'fixed',
    fixedBaseAmount: 0,
    baseTiers: [],
    insurance: {
      enabled: false,
      companyAmount: '',
      personalAmount: '',
    },
    lessonFeeMode: 'unified',
    unifiedLessonRate: 80,
    courseGroupFees: [
      {
        categoryId: 'cat-class',
        groupType: 'class',
        groupName: '班课',
        useRevenueShare: false,
        courses: [],
      },
      {
        categoryId: 'cat-group',
        groupType: 'group',
        groupName: '团课',
        useRevenueShare: false,
        courses: [],
      },
      {
        categoryId: 'cat-private',
        groupType: 'private',
        groupName: '私教课',
        useRevenueShare: false,
        courses: [],
      },
    ],
    attendanceTiers: [{ id: 'a1', minCount: '', maxCount: '', rate: '' }],
    lessonTierGroups: [
      {
        type: 'group',
        name: '团课课时费阶梯',
        enabled: true,
        feeBasis: 'hours',
        calcMethod: 'tier_unified',
        tiers: [{ id: 't1', threshold: '', rate: '' }],
      },
      {
        type: 'private',
        name: '私教课时费阶梯',
        enabled: true,
        feeBasis: 'hours',
        calcMethod: 'tier_unified',
        tiers: [{ id: 't2', threshold: '', rate: '' }],
      },
    ],
    perfTiers: [{ id: 'p1', threshold: '', rate: '' }],
    categoryLessonFees: [
      {
        id: 'cl-class',
        categoryId: 'cat-class',
        name: '班课',
        groupType: 'class',
        algorithm: 'default',
        fixedRate: '',
        tiers: [{ id: 'ct1', threshold: '', rate: '' }],
        feeBasis: 'hours',
        calcMethod: 'tier_unified',
        perfTiers: [{ id: 'cp1', threshold: '', rate: '' }],
        perfPayoutMode: 'revenue_share',
      },
      {
        id: 'cl-group',
        categoryId: 'cat-group',
        name: '团课',
        groupType: 'group',
        algorithm: 'default',
        fixedRate: '',
        tiers: [{ id: 'ct2', threshold: '', rate: '' }],
        feeBasis: 'hours',
        calcMethod: 'tier_unified',
        perfTiers: [{ id: 'cp2', threshold: '', rate: '' }],
        perfPayoutMode: 'revenue_share',
      },
      {
        id: 'cl-private',
        categoryId: 'cat-private',
        name: '私教课',
        groupType: 'private',
        algorithm: 'default',
        fixedRate: '',
        tiers: [{ id: 'ct3', threshold: '', rate: '' }],
        feeBasis: 'hours',
        calcMethod: 'tier_unified',
        perfTiers: [{ id: 'cp3', threshold: '', rate: '' }],
        perfPayoutMode: 'revenue_share',
      },
    ],
    categoryExtraFees: [{ id: 'e1', name: '担任助教', rate: '', description: '助教课时补贴' }],
    commissionMode: 'personal_perf',
    commissionTiers: [{ id: 'cm1', perfThreshold: '', rate: '' }],
  };
}
