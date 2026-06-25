/**
 * 校区设置模块 — 类型定义
 *
 * 包含校区、薪资模板、节假日、营业时间等数据模型
 */

// ============================================
// 校区类型
// ============================================

/** 校区经营类型 */
export type CampusType = 'self' | 'partner';

/** 合作模式（仅合作校区） */
export type PartnerMode = 'hourly_share' | 'venue_rental';

/** 校区 UI 模型 */
export interface CampusUIModel {
  id: string;
  /** 校区名称 */
  name: string;
  /** 经营类型 */
  type: CampusType;
  /** 合作模式（仅合作校区） */
  partnerMode?: PartnerMode;
  /** 合作信息标签（如"分成比例 30%"） */
  partnerTags?: string[];
  /** 联系电话 */
  phone: string;
  /** 校区地址 */
  address: string;
  /** 图标 emoji */
  icon: string;
  /** 图标背景渐变色 */
  iconGradient: string;
  /** 是否主校区 */
  isMain: boolean;
  /** 月租金（元），0表示未配置 */
  monthlyRent: number;
  /** 租金到期日（每月几号），1-28 */
  rentDueDay: number;
  /** 统计数据 */
  stats: CampusStats;
}

/** 校区统计数据 */
export interface CampusStats {
  /** 学生数 */
  students: number;
  /** 教师数 */
  teachers: number;
  /** 月营收（元） */
  revenue: number;
  /** 营收单位文本（如"万"） */
  revenueUnit?: string;
}

/** 校区表单数据（添加/编辑） */
export interface CampusFormData {
  name: string;
  type: CampusType;
  partnerMode?: PartnerMode;
  phone: string;
  address: string;
  icon: string;
  iconGradient: string;
  /** 月租金（元） */
  monthlyRent?: number;
  /** 租金到期日（每月几号） */
  rentDueDay?: number;
}

// ============================================
// 薪资模板
// ============================================

/** 薪资模板类型 */
export type SalaryModelType = 'standard' | 'hourly' | 'custom';

/** 薪资模板 */
export interface SalaryModel {
  id: string;
  /** 模板名称 */
  name: string;
  /** 模板类型 */
  type: SalaryModelType;
  /** 底薪 */
  base: number;
  /** 课时费比例/单价 */
  rate: number;
  /** 全勤奖 */
  attend: number;
  /** 绩效奖金 */
  perf: number;
  /** 是否默认模板 */
  isDefault: boolean;
  /** 关联教师数 */
  teacherCount: number;
}

// ============================================
// 发薪日设置
// ============================================

/** 发薪模式 */
export type PayDayMode = 'fixed' | 'weekday';

/** 发薪日设置 */
export interface PayDaySettings {
  /** 发薪模式 */
  mode: PayDayMode;
  /** 固定日期（1-28） */
  fixedDay?: number;
  /** 指定星期（1-7，1=周一） */
  weekday?: number;
  /** 第几周（1-4） */
  weekOrdinal?: number;
}

// ============================================
// 节假日
// ============================================

/** 节假日状态 */
export type HolidayStatus = 'rest' | 'adjust';

/** 节假日 — 校长自主管理，不预置法定节假日 */
export interface Holiday {
  id: string;
  /** 假期名称 */
  name: string;
  /** 图标 */
  icon: string;
  /** 开始日期 */
  startDate: string;
  /** 结束日期 */
  endDate: string;
  /** 状态：休息/调课 */
  status: HolidayStatus;
}

// ============================================
// 营业时间
// ============================================

/** 营业时间 */
export interface BusinessHours {
  /** 工作日开始时间（HH:mm） */
  weekdayStart: string;
  /** 工作日结束时间（HH:mm） */
  weekdayEnd: string;
  /** 周末开始时间 */
  weekendStart: string;
  /** 周末结束时间 */
  weekendEnd: string;
  /** 特殊日期 */
  specialDates: SpecialDate[];
}

/** 特殊日期 */
export interface SpecialDate {
  id: string;
  date: string;
  label: string;
  isOpen: boolean;
  start?: string;
  end?: string;
}

// ============================================
// 通知设置
// ============================================

/** 通知项 */
export interface NotifyItem {
  id: string;
  /** 通知标签 */
  label: string;
  /** 补充说明 */
  sub?: string;
  /** 是否开启 */
  enabled: boolean;
}

/** 通知分组 */
export interface NotifyGroup {
  /** 分组标题 */
  title: string;
  /** 通知项列表 */
  items: NotifyItem[];
}

// ============================================
// 科目
// ============================================

/** 科目 */
export interface Subject {
  id: string;
  /** 科目名称 */
  name: string;
  /** 图标 emoji */
  icon: string;
  /** 主题色 HEX */
  color: string;
  /** 图标背景渐变色 */
  iconGradient: string;
  /** 在读学员数 */
  studentCount: number;
  /** 授课教师数 */
  teacherCount: number;
  /** 排课数 */
  courseCount: number;
}

/** 科目表单数据（添加） */
export interface SubjectFormData {
  name: string;
  icon: string;
  color: string;
  iconGradient: string;
}

// ============================================
// 运营数据
// ============================================

/** 运营数据时间维度 */
export type DataPeriod = 'month' | 'quarter' | 'year' | 'all';

/** 学员数据 */
export interface StudentData {
  /** 在读学员 */
  total: number;
  /** 本期新增 */
  newThis: number;
  /** 本期流失 */
  leftThis: number;
  /** 续费率(%) */
  renewalRate: number;
}

/** 教师数据 */
export interface TeacherData {
  /** 教师总数 */
  total: number;
  /** 全职 */
  fullTime: number;
  /** 兼职 */
  partTime: number;
  /** 平均课时 */
  avgHours: number;
}

/** 财务数据 */
export interface FinanceData {
  /** 营收(元) */
  revenue: number;
  /** 课时费(元) */
  courseFee: number;
  /** 教材费(元) */
  materialFee: number;
  /** 其他收入(元) */
  otherFee: number;
  /** 支出(元) */
  expense: number;
  /** 净收入(元) */
  netIncome: number;
}

/** 课时数据 */
export interface CourseData {
  /** 总课时 */
  totalHours: number;
  /** 出勤率(%) */
  attendanceRate: number;
  /** 补课率(%) */
  makeupRate: number;
  /** 平均班容 */
  avgClassSize: number;
}

/** 教室数据 */
export interface RoomData {
  /** 教室总数 */
  total: number;
  /** 利用率(%) */
  utilization: number;
}

/** 单个时间维度运营数据 */
export interface PeriodData {
  students: StudentData;
  teachers?: TeacherData;
  finance: FinanceData;
  courses: CourseData;
  rooms?: RoomData;
}

/** 科目排行项 */
export interface SubjectRankItem {
  name: string;
  icon: string;
  students: number;
  revenue: number;
}

/** 校区运营数据（多时间维度） */
export interface CampusOperationalData {
  /** 校区ID */
  campusId: string;
  /** 本月 */
  month: PeriodData;
  /** 季度 */
  quarter: PeriodData;
  /** 年度 */
  year: PeriodData;
  /** 全部 */
  all: PeriodData;
  /** 月度营收趋势(12个月) */
  monthlyRevenue: number[];
  /** 科目排行 */
  subjectRank: SubjectRankItem[];
}
