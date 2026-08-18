/**
 * 校区设置模块 — 类型定义
 *
 * 包含校区、薪资模板、节假日、营业时间等数据模型
 */

import type { SelectedBusinessCategory } from '@/constants/business-categories';

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
  /** 校区 Logo URL */
  logo?: string;
  /** 营业执照名称 */
  licenseName?: string;
  /** 联系人 */
  contactName?: string;
  /** 经营类型 */
  type: CampusType;
  /** 合作模式（仅合作校区） */
  partnerMode?: PartnerMode;
  /** 合作信息标签（如"分成比例 30%"） */
  partnerTags?: string[];
  /** 联系电话 */
  phone: string;
  /** 所在地区（如：河南省-郑州市-惠济区） */
  region?: string;
  /** 校区地址 */
  address: string;
  /** 营业时间（如：08:00:00至22:00:00） */
  businessHours?: string;
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
  /** 门店介绍 */
  intro?: string;
  /** 场馆图片 URL 列表 */
  venueImages?: string[];
  /** 地图定位名称（由 wx.chooseLocation 选择） */
  locationName?: string;
  /** 纬度 */
  latitude?: number;
  /** 经度 */
  longitude?: number;
  /** 统计数据 */
  stats: CampusStats;
  /** 主营业态 */
  businessCategories: SelectedBusinessCategory[];
  /** 门店标签（首页校区卡片展示，最多 4 个，每标签最多 5 字） */
  tags?: string[];
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
  /** 校区 Logo URL */
  logo?: string;
  /** 营业执照名称 */
  licenseName?: string;
  /** 联系人 */
  contactName?: string;
  type: CampusType;
  /** 是否主校区 */
  isMain?: boolean;
  partnerMode?: PartnerMode;
  phone: string;
  /** 所在地区 */
  region?: string;
  address: string;
  /** 营业时间 */
  businessHours?: string;
  icon: string;
  iconGradient: string;
  /** 月租金（元） */
  monthlyRent?: number;
  /** 租金到期日（每月几号） */
  rentDueDay?: number;
  /** 门店介绍 */
  intro?: string;
  /** 场馆图片 URL 列表 */
  venueImages?: string[];
  /** 地图定位名称（由 wx.chooseLocation 选择） */
  locationName?: string;
  /** 纬度 */
  latitude?: number;
  /** 经度 */
  longitude?: number;
  /** 主营业态 */
  businessCategories?: SelectedBusinessCategory[];
  /** 门店标签（首页校区卡片展示，最多 4 个，每标签最多 5 字） */
  tags?: string[];
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

// ============================================
// 场地 / 教室
// ============================================

/** 场地状态 */
export type VenueStatus = 'active' | 'inactive';

/** 场地（场馆） */
export interface Venue {
  /** 场地ID */
  id: string;
  /** 所属校区ID */
  campusId: string;
  /** 场地名称 */
  name: string;
  /** 场地地址（可选） */
  address?: string;
  /** 场地状态 */
  status: VenueStatus;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
}

/** 教室状态 */
export type RoomStatus = 'active' | 'inactive';

/** 教室 */
export interface Room {
  /** 教室ID */
  id: string;
  /** 所属场地ID */
  venueId: string;
  /** 所属校区ID（冗余，方便按校区过滤） */
  campusId: string;
  /** 教室名称 */
  name: string;
  /** 容纳人数（可选） */
  capacity?: number;
  /** 教室状态 */
  status: RoomStatus;
  /** 是否开启场地预约模式 */
  bookingEnabled?: boolean;
  /** 场地照片 URL 列表（最多 3 张） */
  photos?: string[];
  /** 开放开始时间（HH:mm） */
  openTimeStart?: string;
  /** 开放结束时间（HH:mm） */
  openTimeEnd?: string;
  /** 单次付费金额（元），0 表示免费 */
  pricePerSession?: number;
  /** 是否开启分时段收费 */
  timeBasedPricing?: boolean;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
}

/** 场地表单数据 */
export interface VenueFormData {
  campusId: string;
  name: string;
  address?: string;
  status: VenueStatus;
}

/** 教室表单数据 */
export interface RoomFormData {
  venueId: string;
  campusId: string;
  name: string;
  capacity?: number;
  status: RoomStatus;
  /** 是否开启场地预约模式 */
  bookingEnabled?: boolean;
  /** 场地照片 URL 列表（最多 3 张） */
  photos?: string[];
  /** 开放开始时间（HH:mm） */
  openTimeStart?: string;
  /** 开放结束时间（HH:mm） */
  openTimeEnd?: string;
  /** 单次付费金额（元），0 表示免费 */
  pricePerSession?: number;
  /** 是否开启分时段收费 */
  timeBasedPricing?: boolean;
}
