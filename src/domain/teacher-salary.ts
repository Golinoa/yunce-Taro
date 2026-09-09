import type { TeacherUIModel, SalaryRuleConfig } from '@/types/teacher';

/** 计算教师薪资总额（含扣款/补发）；UI 展示与 mockExecutePay 实发共用同一算法 */
export function calcTotal(t: TeacherUIModel): number {
  if (t.selectedSalaryRecord) return Math.max(0, Number(t.selectedSalaryRecord.amount) || 0);
  if (t.selectedSalaryRecord === null) return 0;
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
