/**
 * 卡种（会员卡模板）类型定义
 *
 * 卡种是门店的「会员卡价目表/模板库」，配置好后前台给会员开卡/续费时直接选用。
 */

/** 卡种类型 */
export type CardTypeKind = 'count' | 'time' | 'stored';

/** 卡种状态 */
export type CardTypeStatus = 'active' | 'inactive';

/** 可用范围 */
export type CardTypeScope = 'course' | 'venue';

/** 会员卡种类 */
export type CardTypeCategory = 'formal' | 'trial' | 'gift';

/** 约课方式 */
export type CardTypeBookingMethod = 'course' | 'teacher' | 'none';

/** 卡种销售统计数据 */
export interface CardTypeStats {
  /** 已售 */
  sold: number;
  /** 在用 */
  inUse: number;
  /** 用完 */
  usedUp: number;
  /** 未开卡 */
  notActivated: number;
  /** 冻卡/停卡 */
  frozen: number;
  /** 在用会员数（去重） */
  activeMembers?: number;
}

/** 卡种对象 */
export interface CardType {
  id: string;
  /** 会员卡名称 */
  name: string;
  /** 卡种类型：次卡/时间卡/储值卡 */
  kind: CardTypeKind;
  /** 状态：在售/停售 */
  status: CardTypeStatus;
  /** 可用范围：课程/场地，支持多选 */
  scopes: CardTypeScope[];
  /** 约课方式 */
  bookingMethod: CardTypeBookingMethod;
  /** 适用课程分类 ID 列表，空数组表示全部课程 */
  categoryIds: string[];
  /** 适用课程范围描述（由 categoryIds 派生，仅用于展示） */
  applicableCourseRange?: string;
  /** 次数（次卡） */
  count?: number;
  /** 有效期限（天） */
  validDays: number;
  /** 售价（分） */
  price: number;
  /** 可冻卡总次数 */
  freezeCount: number;
  /** 可冻卡总天数 */
  freezeDays: number;
  /** 会员权益说明 */
  benefits?: string;
  /** 会员卡种类 */
  cardCategory: CardTypeCategory;
  /** 续卡价（分） */
  renewalPrice?: number;
  /** 每日最大约课次数，0=不限 */
  dailyMaxBookings: number;
  /** 每周最大约课次数，0=不限 */
  weeklyMaxBookings: number;
  /** 每月最大约课次数，0=不限 */
  monthlyMaxBookings: number;
  /** 免责取消次数，0=无 */
  freeCancelCount: number;
  /** 提前约课分钟数，0=不限 */
  advanceBookingMinutes: number;
  /** 可约课星期，空数组表示全周可用 */
  availableWeekdays: number[];
  /** 是否支持线上购买 */
  onlinePurchase: boolean;
  /** 是否有学生身份购买限制 */
  studentIdentityLimit: boolean;
  /** 是否赠卡 */
  isGiftCard: boolean;
  /** 是否允许转卡 */
  allowTransfer: boolean;
  /** 使用人数限制，0=不限 */
  usageLimit: number;
  /** 提成计算方式 */
  commissionCalc: string;
  /** 会员卡底图 URL */
  backgroundImage?: string;
  /** 销售统计 */
  stats: CardTypeStats;
  /** 适用校区数量，0=不限 */
  campusCount?: number;
  createdAt: string;
  updatedAt: string;
}

/** 卡种表单数据 */
export interface CardTypeFormData {
  name: string;
  kind: CardTypeKind;
  status: CardTypeStatus;
  scopes: CardTypeScope[];
  bookingMethod: CardTypeBookingMethod;
  categoryIds: string[];
  applicableCourseRange?: string;
  count?: number;
  validDays: number;
  price: number;
  freezeCount: number;
  freezeDays: number;
  benefits?: string;
  cardCategory: CardTypeCategory;
  renewalPrice?: number;
  dailyMaxBookings: number;
  weeklyMaxBookings: number;
  monthlyMaxBookings: number;
  freeCancelCount: number;
  advanceBookingMinutes: number;
  availableWeekdays: number[];
  onlinePurchase: boolean;
  studentIdentityLimit: boolean;
  isGiftCard: boolean;
  allowTransfer: boolean;
  usageLimit: number;
  commissionCalc: string;
  backgroundImage?: string;
}
