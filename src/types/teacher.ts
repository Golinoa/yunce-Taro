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

/** 教师角色 */
export type TeacherRole = 'lead' | 'assist' | 'parttime';

/** 薪资状态流转：待确认 → 已确认 → 已发放 */
export type SalaryStatus = 'pending' | 'confirmed' | 'paid';

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
}

/** 工资模型 */
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
}

/** 班级计费覆盖 */
export interface ClassRateOverride {
  className: string;
  rate: number;
}

/** 月度发薪快照 */
export interface PayHistoryRecord {
  month: string; // '2025-05'
  amount: number;
  status: SalaryStatus;
  remark?: string;
  paidAt?: string;
}

/** 教师管理 UI 完整数据模型 */
export interface TeacherUIModel {
  id: string;
  name: string;
  role: TeacherRole;
  roleText: string;
  subject: string;
  phone: string;
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
  payRemark?: string;
  status: TeacherStatus;
  campus?: string;
  resignType?: ResignType;
  resignDate?: string;
  resignReason?: string;
  classRateOverrides?: ClassRateOverride[];
  payHistory?: PayHistoryRecord[];
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

/** 发薪设置 */
export interface SalarySettings {
  payDay: number;
  pushDaysBefore: number;
  autoConfirm: boolean;
  pushEnabled: boolean;
}
