import type {
  BaseSalaryMode,
  CalcMethod,
  CategoryFeeAlgorithm,
  CommissionMode,
  CourseGroupType,
  FeeBasis,
  LessonFeeMode,
  PerfPayoutMode,
} from '@/types/teacher';

export const BASE_MODE_OPTIONS: { label: string; value: BaseSalaryMode }[] = [
  { label: '固定金额无责底薪', value: 'fixed' },
  { label: '按个人业绩计算', value: 'personal_perf' },
  { label: '按全店业绩计算', value: 'shop_perf' },
];

export const INSURANCE_OPTIONS = [
  { label: '不缴纳医社保', value: 'off' },
  { label: '缴纳医社保', value: 'on' },
];

export const LESSON_FEE_MODE_OPTIONS: { label: string; value: LessonFeeMode }[] = [
  { label: '统一课时费', value: 'unified' },
  { label: '按课程设置', value: 'by_course' },
  { label: '按上课人数', value: 'by_attendance' },
  { label: '按月课量阶梯', value: 'by_monthly_tier' },
  { label: '按业绩阶梯', value: 'by_perf_tier' },
];

export const COMMISSION_MODE_OPTIONS: { label: string; value: CommissionMode }[] = [
  { label: '无提成', value: 'none' },
  { label: '按个人业绩计算', value: 'personal_perf' },
  { label: '按全店业绩计算', value: 'shop_perf' },
];

export const FEE_BASIS_OPTIONS: { label: string; value: FeeBasis }[] = [
  { label: '按课时数(元/节)', value: 'hours' },
  { label: '按上课业绩(%)', value: 'perf' },
];

export const CALC_METHOD_OPTIONS: { label: string; value: CalcMethod }[] = [
  { label: '全部按最高档', value: 'tier_unified' },
  { label: '分段累加', value: 'tier_progressive' },
];

export const CATEGORY_ALGORITHM_OPTIONS: { label: string; value: CategoryFeeAlgorithm }[] = [
  { label: '跟随默认', value: 'default' },
  { label: '固定单价', value: 'fixed' },
  { label: '课量阶梯', value: 'tier' },
  { label: '业绩阶梯', value: 'perf' },
];

export const PERF_PAYOUT_OPTIONS: { label: string; value: PerfPayoutMode }[] = [
  { label: '消课金额×比例%', value: 'revenue_share' },
  { label: '固定元/节', value: 'fixed' },
];

/** 各配置项的问号提示文案 */
export const HINTS: Record<string, string> = {
  base: '选择固定金额时只需填写底薪；选择业绩模式时可按业绩区间设置阶梯底薪。',
  insurance: '开启后将从工资中扣除个人缴交部分，公司缴交部分计入用工成本。',
  lessonFee:
    '统一课时费：所有课程同一标准。按课程设置：不同课程单独定价。按上课人数：按每节课实际到课人数落档。按月课量阶梯：按当月累计课量落档。按业绩阶梯：按当月个人卖卡业绩定档。',
  attendance: '按单节课实际到课人数落档计费，例如 1-5 人 80 元/节、6-10 人 100 元/节。',
  perfTier:
    '按当月个人卖卡业绩达到的最高档结算课时费，到档发放可选择「消课金额×比例」或「固定元/节」。',
  categoryLessonFee:
    '给某个课程分类单独指定课时费算法（如团课分类固定单价、私教分类按业绩阶梯），未单独设置的分类仍按上方默认方式计。业绩阶梯按当月个人卖卡业绩定档，到档发放可选「消课金额×比例」或「固定元/节」。',
  categoryExtra: '员工以助教身份带的课，每节额外发的固定金额；不影响主教身份课时费。',
  commission: '选择业绩提成后，可按业绩区间设置不同提成比例。',
};

/** 模式标签映射 */
export const CATEGORY_MODE_LABEL: Record<CourseGroupType, string> = {
  class: '班课',
  group: '团课',
  private: '私教',
  custom: '自定义',
};
