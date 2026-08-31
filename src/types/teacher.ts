import type { Profile } from './profile';

/**
 * 教师信息 (teachers 表) - 后端模型
 */
export interface Teacher {
  id: string;
  user_id: string;
  invite_code: string;
  profile?: Profile;
  created_at: string;
  updated_at: string;
}

// ============================================
// 教师管理 UI 扩展类型
// ============================================

/** 教师身份（员工身份预设） */
export type TeacherIdentity = 'principal' | 'teacher' | 'assistant' | 'reception';

/** 教师角色（薪资/排课维度） */
export type TeacherRole = 'lead' | 'assist' | 'parttime';

/** 教师数据权限档位 */
export type TeacherAccessScope = 'self' | 'subject' | 'org';

/** 性别 */
export type Gender = 'male' | 'female' | 'other';

/** 薪资状态流转：待核对 → 已核对 → 确认中 → 已确认 → 已归档 */
// L-05 说明：实际实现为四态 pending→confirmed→sending→archived；
// teacher_confirmed（员工已确认工资单）为保留状态，当前 mock 流从不置位，
// UI 仅做防御性兼容（SALARY_STATUS_META/薪资明细页），联调时若后端引入该态需同步实现流转。
export type SalaryStatus = 'pending' | 'confirmed' | 'sending' | 'teacher_confirmed' | 'archived';

/** 薪资状态元数据（标签文案/颜色/步骤图标） */
export interface SalaryStatusMeta {
  label: string;
  bgClass: string;
  textClass: string;
  stepIcon: string;
  description: string;
}

export const SALARY_STATUS_META: Record<SalaryStatus, SalaryStatusMeta> = {
  pending: {
    label: '待核对',
    bgClass: 'bg-warning-bg',
    textClass: 'text-warning',
    stepIcon: '⏳',
    description: '员工薪资尚未核对，可编辑调整奖金、罚款等自定义项',
  },
  confirmed: {
    label: '已核对',
    bgClass: 'bg-info-bg',
    textClass: 'text-info',
    stepIcon: '✓',
    description: '机构已完成薪资核对，等待发送工资单给员工',
  },
  sending: {
    label: '确认中',
    bgClass: 'bg-accent-bg',
    textClass: 'text-accent',
    stepIcon: '✉️',
    description: '工资单已发送给员工，等待员工本人确认',
  },
  teacher_confirmed: {
    label: '已确认',
    bgClass: 'bg-success-bg',
    textClass: 'text-success',
    stepIcon: '✓',
    description: '员工已确认工资单，等待最终发放归档',
  },
  archived: {
    label: '已归档',
    bgClass: 'bg-muted',
    textClass: 'text-muted-foreground',
    stepIcon: '✓',
    description: '工资单已发放并归档，不可再调整',
  },
};

/** 旧版 paid 统一映射为 archived，保证外部历史数据兼容 */
export function normalizeSalaryStatus(status: string): SalaryStatus {
  if (status === 'paid') return 'archived';
  return (SALARY_STATUS_META[status as SalaryStatus] ? status : 'pending') as SalaryStatus;
}

/** 教师在职状态 */
export type TeacherStatus = 'active' | 'resigned';

/** 离职类型 */
export type ResignType = 'quit' | 'expire' | 'dismiss';

/** 工资模型类型 */
export type SalaryModelType = 'standard' | 'hourly' | 'custom';

/** 扣款/补发类型 */
export type DeductionType = 'deduct' | 'bonus';

/** 扣款/补发记录 */
export interface Deduction {
  id: string;
  reason: string;
  amount: number;
  type: DeductionType;
  /** 提交时可选：用于拦截已确认/已发薪月份 */
  month?: string;
}

/** 班级计费覆盖 */
export interface ClassRateOverride {
  className: string;
  rate: number;
}

// ============================================
// 薪资规则配置类型
// ============================================

/** 底薪设置模式 */
export type BaseSalaryMode = 'fixed' | 'personal_perf' | 'shop_perf';

/** 底薪阶梯 */
export interface BaseSalaryTier {
  id: string;
  /** 业绩达到（元） */
  perfThreshold: number | '';
  /** 底薪为（元） */
  baseAmount: number | '';
}

/** 医社保配置 */
export interface InsuranceConfig {
  enabled: boolean;
  /** 公司缴交金额 */
  companyAmount: number | '';
  /** 个人缴交金额 */
  personalAmount: number | '';
}

/** 课时费设置模式 */
export type LessonFeeMode =
  | 'unified'
  | 'by_course'
  | 'by_attendance'
  | 'by_monthly_tier'
  | 'by_perf_tier';

/** 课时费计费口径：按课时数 / 按上课业绩 */
export type FeeBasis = 'hours' | 'perf';

/** 课时费计算方式：落档统一 / 阶梯累进 */
export type CalcMethod = 'tier_unified' | 'tier_progressive';

/** 团课/私教课 课时阶梯 */
export interface LessonFeeTier {
  id: string;
  /** 满足条件：课时数(节) 或 业绩(元) */
  threshold: number | '';
  /** 课时费单价（元/节） 或 比例 (%) */
  rate: number | '';
}

/** 课程分类课时费（按课程设置模式） */
export interface CourseFeeItem {
  id: string;
  courseId: string;
  courseName: string;
  /** 是否开启课时分成（按业绩比例） */
  useRevenueShare: boolean;
  /** 课时费单价 或 分成比例 */
  rate: number | '';
}

/** 课程分组类型：班课 / 团课 / 私教 / 自定义 */
export type CourseGroupType = 'class' | 'group' | 'private' | 'custom';

/** 课程分组（按课程设置） */
export interface CourseGroupFee {
  /** 课程分类 ID */
  categoryId: string;
  /** 分组类型 */
  groupType: CourseGroupType;
  /** 分组名称 */
  groupName: string;
  /** 是否开启课时分成总开关 */
  useRevenueShare: boolean;
  /** 课程列表 */
  courses: CourseFeeItem[];
}

/** 课时费阶梯配置（按月课量阶梯模式） */
export interface LessonTierGroup {
  /** 类型：团课 / 私教 */
  type: 'group' | 'private';
  /** 分组名称 */
  name: string;
  /** 是否启用 */
  enabled: boolean;
  /** 计费口径 */
  feeBasis: FeeBasis;
  /** 计算方式 */
  calcMethod: CalcMethod;
  /** 阶梯列表 */
  tiers: LessonFeeTier[];
}

/** 提成设置模式 */
export type CommissionMode = 'none' | 'personal_perf' | 'shop_perf';

/** 提成阶梯 */
export interface CommissionTier {
  id: string;
  /** 业绩达到（元） */
  perfThreshold: number | '';
  /** 提成比例 (%) */
  rate: number | '';
}

/** 按上课人数阶梯 */
export interface AttendanceTier {
  id: string;
  /** 人数下限（含） */
  minCount: number | '';
  /** 人数上限（含），空表示不限制 */
  maxCount: number | '';
  /** 每节课时费（元/节） */
  rate: number | '';
}

/** 按业绩阶梯 */
export interface PerfTier {
  id: string;
  /** 业绩达到（元） */
  threshold: number | '';
  /** 比例（%）或固定金额（元） */
  rate: number | '';
}

/** 按课程分类单独设置的算法 */
export type CategoryFeeAlgorithm = 'default' | 'fixed' | 'tier' | 'perf';

/** 业绩阶梯到档发放方式 */
export type PerfPayoutMode = 'revenue_share' | 'fixed';

/** 按课程分类单独设置 */
export interface CategoryLessonFee {
  id: string;
  /** 课程分类 ID */
  categoryId: string;
  /** 分类名称 */
  name: string;
  /** 分类类型 */
  groupType: CourseGroupType;
  /** 算法：跟随默认 / 固定单价 / 课量阶梯 / 业绩阶梯 */
  algorithm: CategoryFeeAlgorithm;
  /** 固定单价（元/节） */
  fixedRate: number | '';
  /** 课量阶梯 */
  tiers: LessonFeeTier[];
  /** 计费口径 */
  feeBasis: FeeBasis;
  /** 计算方式 */
  calcMethod: CalcMethod;
  /** 业绩阶梯 */
  perfTiers: PerfTier[];
  /** 业绩到档发放方式 */
  perfPayoutMode: PerfPayoutMode;
}

/** 担任助教等角色额外补贴 */
export interface CategoryExtraFee {
  id: string;
  name: string;
  /** 单价（元/节） */
  rate: number | '';
  /** 说明 */
  description?: string;
}

/** 完整薪资规则配置（单个教师或模板） */
export interface SalaryRuleConfig {
  /** 底薪设置 */
  baseMode: BaseSalaryMode;
  /** 固定底薪金额 */
  fixedBaseAmount: number | '';
  /** 底薪阶梯（个人/全店业绩模式） */
  baseTiers: BaseSalaryTier[];

  /** 医社保 */
  insurance: InsuranceConfig;

  /** 课时费模式 */
  lessonFeeMode: LessonFeeMode;
  /** 统一课时费单价 */
  unifiedLessonRate: number | '';
  /** 按课程设置（所有课程分类） */
  courseGroupFees: CourseGroupFee[];
  /** 按上课人数阶梯 */
  attendanceTiers: AttendanceTier[];
  /** 按月课量阶梯 */
  lessonTierGroups: LessonTierGroup[];
  /** 按业绩阶梯（全局） */
  perfTiers: PerfTier[];

  /** 按课程分类单独设置 */
  categoryLessonFees: CategoryLessonFee[];
  /** 担任助教等角色额外补贴 */
  categoryExtraFees: CategoryExtraFee[];

  /** 提成模式 */
  commissionMode: CommissionMode;
  /** 提成阶梯 */
  commissionTiers: CommissionTier[];
}

/** 薪资模板 */
export interface SalaryTemplate {
  id: string;
  name: string;
  /** 简短描述，如"兼职80/次" */
  summary?: string;
  /** 是否默认模板 */
  isDefault?: boolean;
  /** 使用中的员工数 */
  teacherCount?: number;
  /** 完整薪资规则 */
  config: SalaryRuleConfig;
  /** 创建时间 */
  createdAt?: string;
  /** 更新时间 */
  updatedAt?: string;
}

/** 工资模型（保留旧版兼容） */
export interface SalaryModel {
  id: string;
  name: string;
  type: SalaryModelType;
  base: number; // 底薪
  rate: number; // 课时费单价
  attend: number; // 全勤奖
  perf: number; // 绩效奖金
  isDefault?: boolean;
  teacherCount?: number;
  /** 班级差异化费率（二期实现） */
  class_rates?: ClassRateOverride[];
}

/** 发放方式 */
export type PayMethod = 'wechat' | 'alipay' | 'salary_card' | 'union_card' | 'cash' | 'other';

/** 发放方式显示文案 */
export const PAY_METHOD_TEXT: Record<PayMethod, string> = {
  wechat: '微信',
  alipay: '支付宝',
  salary_card: '工资卡',
  union_card: '银联卡',
  cash: '现金',
  other: '其他',
};

/** 单条课时费明细 */
export interface LessonFeeRecord {
  /** 日期，格式 MM-DD */
  date: string;
  /** 课程/班级名称 */
  courseName: string;
  /** 课时数 */
  hours: number;
  /** 金额 */
  amount: number;
}

/** 按课程分类的课时费汇总（用于调整工资页） */
export interface CategoryLessonFeeItem {
  /** 课程分类 ID */
  categoryId: string;
  /** 课程分类名称，如：班课 / 团课 / 私教 */
  categoryName: string;
  /** 该分类课时费合计 */
  amount: number;
  /** 明细记录 */
  records: LessonFeeRecord[];
}

/** 月度发薪快照 */
export interface PayHistoryRecord {
  month: string; // '2025-05'
  amount: number;
  status: SalaryStatus;
  remark?: string;
  paidAt?: string;
  /** 发放方式 */
  payMethod?: PayMethod;
  /** 流水单号 */
  serialNo?: string;
}

/** 教师管理 UI 完整数据模型 */
export interface TeacherUIModel {
  id: string;
  name: string;
  /** 头像图片 URL，为空时使用品牌默认 Logo */
  avatar?: string;
  /** 员工身份预设 */
  identity?: TeacherIdentity;
  /** 教师角色（薪资/排课维度） */
  role: TeacherRole;
  roleText: string;
  accessScope: TeacherAccessScope;
  accessScopeText: string;
  subject: string;
  phone: string;
  /** 性别 */
  gender?: Gender;
  /** 生日 yyyy-MM-dd */
  birthday?: string;
  /** 老师简介 */
  intro?: string;
  /** 教师宣传图 URL 列表 */
  promoImages?: string[];
  /** 是否展示在私教老师列表 */
  showInPrivateList?: boolean;
  hours: number;
  students: number;
  classes: number;
  base: number;
  rate: number;
  attend: number;
  perf: number;
  salaryStatus: SalaryStatus;
  modelIdx: number;
  color: string;
  initial: string;
  deductions: Deduction[];
  /** 迟到罚款 */
  lateFine?: number;
  /** 其他罚款 */
  otherFine?: number;
  /** 奖金金额 */
  bonusAmount?: number;
  /** 个人社保代扣 */
  socialInsurance?: number;
  /** 公司缴纳社保 */
  companySocialInsurance?: number;
  payRemark?: string;
  /** 当前月份发放方式 */
  payMethod?: PayMethod;
  /** 当前月份发放时间 */
  paidAt?: string;
  /** 当前月份流水单号 */
  serialNo?: string;
  status: TeacherStatus;
  campus?: string;
  /** 可授课校区ID列表 */
  campusIds?: string[];
  /** 是否允许跨校区上课 */
  canCrossCampus?: boolean;
  resignType?: ResignType;
  resignDate?: string;
  resignReason?: string;
  classRateOverrides?: ClassRateOverride[];
  payHistory?: PayHistoryRecord[];
  /** 薪资规则配置（新结构，优先使用） */
  salaryRule?: SalaryRuleConfig;
  /** 套用的薪资模板ID */
  salaryTemplateId?: string;
  /** 按课程分类的课时费汇总（班课/团课/私教） */
  categoryLessonFees?: CategoryLessonFeeItem[];
  /** 本月消课次数（详情接口） */
  lessonCount?: number;
}

/** 筛选条件 */
export interface TeacherFilter {
  role: string;
  subject: string;
  status: string;
}

/** 发放确认动作 */
export interface PendingPayAction {
  type: 'single' | 'batch';
  ids: string[];
}

/** 发送工资单动作 */
export interface PendingSendAction {
  type: 'single' | 'batch';
  ids: string[];
}

/** 发送工资单失败项 */
export interface SendFailure {
  id: string;
  name: string;
  reason: string;
}

/** 发送工资单结果 */
export interface SendResult {
  success: string[];
  failed: SendFailure[];
}

/** 发薪设置 */
export interface SalarySettings {
  payDay: number;
  pushDaysBefore: number;
  autoConfirm: boolean;
  pushEnabled: boolean;
}

/** 套用模板结果 */
export interface ApplyTemplateResult {
  success: boolean;
  appliedIds: string[];
  failedIds?: string[];
  message?: string;
}
