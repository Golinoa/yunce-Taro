/**
 * 卡种（会员卡模板）Mock 数据层
 *
 * 提供卡种模板的增删改查 mock 实现，联调时由 Service 层切换真实 API。
 */

import { DEFAULT_CATEGORY_IDS } from '@/data/course-category';
import type {
  CardType,
  CardTypeBookingMethod,
  CardTypeCategory,
  CardTypeFormData,
  CardTypeKind,
  CardTypeScope,
  CardTypeStatus,
} from '@/types/card-type';

// ============================================
// 常量池
// ============================================

/** 卡种类型选项 */
export const CARD_TYPE_OPTIONS: { label: string; value: CardTypeKind; desc: string }[] = [
  { label: '次卡', value: 'count', desc: '限定上课次数，可叠加有效期' },
  { label: '时间卡', value: 'time', desc: '只看时间不看次数' },
  { label: '储值卡', value: 'stored', desc: '充钱进卡包，按节扣费' },
];

/** 可用范围选项 */
export const CARD_SCOPE_OPTIONS: { label: string; value: CardTypeScope }[] = [
  { label: '课程', value: 'course' },
  { label: '场地', value: 'venue' },
];

/** 约课方式选项 */
export const BOOKING_METHOD_OPTIONS: {
  label: string;
  value: CardTypeBookingMethod;
  desc: string;
}[] = [
  { label: '按课程', value: 'course', desc: '会员按课程表自主约课' },
  { label: '按老师', value: 'teacher', desc: '会员指定老师预约（适用私教/教练制）' },
  { label: '不用约课', value: 'none', desc: '班课制度的固定班级' },
];

/** 列表页课程范围过滤 Tab（与课程分类 mode 对齐） */
export const COURSE_FILTER_TABS: { label: string; value: 'all' | 'class' | 'group' | 'private' }[] =
  [
    { label: '全部', value: 'all' },
    { label: '班课', value: 'class' },
    { label: '团课', value: 'group' },
    { label: '私教', value: 'private' },
  ];

/** 会员卡种类选项 */
export const CARD_CATEGORY_OPTIONS: { label: string; value: CardTypeCategory }[] = [
  { label: '正式卡', value: 'formal' },
  { label: '体验卡', value: 'trial' },
  { label: '赠卡', value: 'gift' },
];

/** 星期选项 */
export const WEEKDAY_OPTIONS: { label: string; value: number }[] = [
  { label: '周一', value: 1 },
  { label: '周二', value: 2 },
  { label: '周三', value: 3 },
  { label: '周四', value: 4 },
  { label: '周五', value: 5 },
  { label: '周六', value: 6 },
  { label: '周日', value: 7 },
];

/** 提成计算选项 */
export const COMMISSION_OPTIONS: { label: string; value: string }[] = [
  { label: '按员工薪资设置', value: 'salary' },
  { label: '按卡种固定比例', value: 'fixed_ratio' },
  { label: '按卡种固定金额', value: 'fixed_amount' },
  { label: '不计算提成', value: 'none' },
];

/** Tooltip 提示文案 */
export const CARD_TYPE_TOOLTIPS: Record<string, string> = {
  name: '会员在前台看到的会员卡名称，如「美术素描年卡」。',
  kind: '次卡按次数扣减；时间卡按有效期不限次；储值卡按课程单价扣费。',
  scope: '选择「课程」仅用于约课消课；选择「场地」可用于场地预约；支持同时选中。',
  bookingMethod: '按课程：会员按课程表自主约课；按老师：会员指定老师预约；不用约课：班课固定班级。',
  applicableCourseRange: '设置该卡种可用于哪些课程分类，空表示全部课程。',
  count: '次卡可用总次数，如 40 次卡填 40。',
  validDays: '自开卡/购卡日起计算的有效天数，0=永久有效。',
  price: '该卡种标准售价，前台开卡/续费时默认显示。',
  freezeCount: '会员在卡有效期内累计可申请冻卡的次数。',
  freezeDays: '会员在卡有效期内累计可申请冻卡的天数。',
  benefits: '会员卡额外权益说明，会展示给会员。',
  cardCategory: '正式卡为常规售卡；体验卡用于新生体验；赠卡为活动赠送。',
  renewalPrice: '会员续卡时的优惠价格，不填则按售价续卡。',
  dailyMaxBookings: '每天最多可约课次数，0=不限。',
  weeklyMaxBookings: '每周最多可约课次数，0=不限。',
  monthlyMaxBookings: '每月最多可约课次数，0=不限。',
  freeCancelCount: '会员可免费取消预约的次数，0=无免费取消。',
  advanceBookingMinutes: '需提前多少分钟预约，0=随时可约。',
  availableWeekdays: '设置该卡种可约课的星期，默认全周可用。',
  onlinePurchase: '开启后会员可在小程序端自行购买该卡种。',
  studentIdentityLimit: '开启后仅限学生身份会员购买。',
  isGiftCard: '标记为赠卡后可用于活动赠送，不计入销售收入。',
  allowTransfer: '开启后允许会员将该卡转给他人。',
  usageLimit: '该卡最多可供几人使用，0=不限。',
  commissionCalc: '设置该卡种销售提成计算方式。',
};

/** 卡种类型标签映射 */
export const CARD_KIND_LABELS: Record<CardTypeKind, string> = {
  count: '次卡',
  time: '时间卡',
  stored: '储值卡',
};

/** 卡种状态标签映射 */
export const CARD_STATUS_LABELS: Record<CardTypeStatus, string> = {
  active: '在售',
  inactive: '停售',
};

/** 卡种范围标签映射 */
export const CARD_SCOPE_LABELS: Record<CardTypeScope, string> = {
  course: '课程',
  venue: '场地',
};

/** 卡种类别标签映射 */
export const CARD_CATEGORY_LABELS: Record<CardTypeCategory, string> = {
  formal: '正式卡',
  trial: '体验卡',
  gift: '赠卡',
};

// ============================================
// Mock 数据
// ============================================

let MOCK_CARD_TYPES: CardType[] = [
  {
    id: 'card-001',
    name: '美术素描年卡',
    kind: 'count',
    status: 'active',
    scopes: ['course'],
    bookingMethod: 'course',
    categoryIds: [DEFAULT_CATEGORY_IDS.group],
    applicableCourseRange: '团课',
    count: 40,
    validDays: 380,
    price: 298000,
    freezeCount: 20,
    freezeDays: 20,
    benefits: '',
    cardCategory: 'formal',
    renewalPrice: 0,
    dailyMaxBookings: 0,
    weeklyMaxBookings: 0,
    monthlyMaxBookings: 0,
    freeCancelCount: 0,
    advanceBookingMinutes: 0,
    availableWeekdays: [],
    onlinePurchase: true,
    studentIdentityLimit: false,
    isGiftCard: false,
    allowTransfer: false,
    usageLimit: 0,
    commissionCalc: 'salary',
    stats: {
      sold: 1,
      inUse: 1,
      usedUp: 0,
      notActivated: 0,
      frozen: 0,
      activeMembers: 1,
    },
    campusCount: 1,
    createdAt: '2026-07-01T10:00:00Z',
    updatedAt: '2026-07-15T10:00:00Z',
  },
  {
    id: 'card-002',
    name: '硬笔书法年卡',
    kind: 'count',
    status: 'active',
    scopes: ['course', 'venue'],
    bookingMethod: 'course',
    categoryIds: [DEFAULT_CATEGORY_IDS.group],
    applicableCourseRange: '团课',
    count: 40,
    validDays: 380,
    price: 328000,
    freezeCount: 20,
    freezeDays: 20,
    benefits: '',
    cardCategory: 'formal',
    renewalPrice: 0,
    dailyMaxBookings: 0,
    weeklyMaxBookings: 0,
    monthlyMaxBookings: 0,
    freeCancelCount: 0,
    advanceBookingMinutes: 0,
    availableWeekdays: [],
    onlinePurchase: true,
    studentIdentityLimit: false,
    isGiftCard: false,
    allowTransfer: false,
    usageLimit: 0,
    commissionCalc: 'salary',
    stats: {
      sold: 1,
      inUse: 1,
      usedUp: 0,
      notActivated: 0,
      frozen: 0,
      activeMembers: 1,
    },
    campusCount: 1,
    createdAt: '2026-07-02T10:00:00Z',
    updatedAt: '2026-07-16T10:00:00Z',
  },
  {
    id: 'card-003',
    name: '私教拳击体验卡',
    kind: 'count',
    status: 'active',
    scopes: ['course'],
    bookingMethod: 'teacher',
    categoryIds: [DEFAULT_CATEGORY_IDS.private],
    applicableCourseRange: '私教',
    count: 10,
    validDays: 90,
    price: 199000,
    freezeCount: 2,
    freezeDays: 7,
    benefits: '',
    cardCategory: 'trial',
    renewalPrice: 0,
    dailyMaxBookings: 1,
    weeklyMaxBookings: 3,
    monthlyMaxBookings: 0,
    freeCancelCount: 1,
    advanceBookingMinutes: 120,
    availableWeekdays: [],
    onlinePurchase: true,
    studentIdentityLimit: false,
    isGiftCard: false,
    allowTransfer: false,
    usageLimit: 1,
    commissionCalc: 'salary',
    stats: {
      sold: 0,
      inUse: 0,
      usedUp: 0,
      notActivated: 0,
      frozen: 0,
      activeMembers: 0,
    },
    campusCount: 1,
    createdAt: '2026-07-03T10:00:00Z',
    updatedAt: '2026-07-17T10:00:00Z',
  },
  {
    id: 'card-004',
    name: '30天舞蹈月卡',
    kind: 'time',
    status: 'active',
    scopes: ['course'],
    bookingMethod: 'course',
    categoryIds: [DEFAULT_CATEGORY_IDS.group],
    applicableCourseRange: '团课',
    validDays: 30,
    price: 99000,
    freezeCount: 0,
    freezeDays: 0,
    benefits: '',
    cardCategory: 'formal',
    renewalPrice: 0,
    dailyMaxBookings: 0,
    weeklyMaxBookings: 0,
    monthlyMaxBookings: 0,
    freeCancelCount: 0,
    advanceBookingMinutes: 0,
    availableWeekdays: [],
    onlinePurchase: true,
    studentIdentityLimit: false,
    isGiftCard: false,
    allowTransfer: false,
    usageLimit: 0,
    commissionCalc: 'salary',
    stats: {
      sold: 1,
      inUse: 1,
      usedUp: 0,
      notActivated: 0,
      frozen: 0,
      activeMembers: 1,
    },
    campusCount: 1,
    createdAt: '2026-07-04T10:00:00Z',
    updatedAt: '2026-07-18T10:00:00Z',
  },
  {
    id: 'card-005',
    name: '综合储值卡',
    kind: 'stored',
    status: 'active',
    scopes: ['course', 'venue'],
    bookingMethod: 'course',
    categoryIds: [],
    applicableCourseRange: '全部课程',
    validDays: 365,
    price: 100000,
    freezeCount: 0,
    freezeDays: 0,
    benefits: '',
    cardCategory: 'formal',
    renewalPrice: 0,
    dailyMaxBookings: 0,
    weeklyMaxBookings: 0,
    monthlyMaxBookings: 0,
    freeCancelCount: 0,
    advanceBookingMinutes: 0,
    availableWeekdays: [],
    onlinePurchase: true,
    studentIdentityLimit: false,
    isGiftCard: false,
    allowTransfer: false,
    usageLimit: 0,
    commissionCalc: 'salary',
    stats: {
      sold: 1,
      inUse: 1,
      usedUp: 0,
      notActivated: 0,
      frozen: 0,
      activeMembers: 1,
    },
    campusCount: 1,
    createdAt: '2026-07-05T10:00:00Z',
    updatedAt: '2026-07-19T10:00:00Z',
  },
];

// ============================================
// Mock CRUD
// ============================================

function delay(ms = 200): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nowISO(): string {
  return new Date().toISOString();
}

function buildCard(data: CardTypeFormData): CardType {
  return {
    ...data,
    id: `card-${Date.now()}`,
    stats: {
      sold: 0,
      inUse: 0,
      usedUp: 0,
      notActivated: 0,
      frozen: 0,
      activeMembers: 0,
    },
    campusCount: 1,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  };
}

export async function mockGetCardTypes(): Promise<CardType[]> {
  await delay();
  return [...MOCK_CARD_TYPES];
}

export async function mockGetCardTypeById(id: string): Promise<CardType | null> {
  await delay();
  return MOCK_CARD_TYPES.find((item) => item.id === id) || null;
}

export async function mockCreateCardType(data: CardTypeFormData): Promise<CardType> {
  await delay(300);
  const created = buildCard(data);
  MOCK_CARD_TYPES.unshift(created);
  return created;
}

export async function mockUpdateCardType(
  id: string,
  data: Partial<CardTypeFormData>,
): Promise<CardType> {
  await delay(300);
  const idx = MOCK_CARD_TYPES.findIndex((item) => item.id === id);
  if (idx < 0) throw new Error('卡种不存在');
  const updated: CardType = {
    ...MOCK_CARD_TYPES[idx],
    ...data,
    updatedAt: nowISO(),
  };
  MOCK_CARD_TYPES[idx] = updated;
  return updated;
}

export async function mockToggleCardTypeStatus(
  id: string,
  status: CardTypeStatus,
): Promise<CardType> {
  await delay(200);
  const idx = MOCK_CARD_TYPES.findIndex((item) => item.id === id);
  if (idx < 0) throw new Error('卡种不存在');
  MOCK_CARD_TYPES[idx] = {
    ...MOCK_CARD_TYPES[idx],
    status,
    updatedAt: nowISO(),
  };
  return MOCK_CARD_TYPES[idx];
}

export async function mockRemoveCardType(id: string): Promise<void> {
  await delay(200);
  MOCK_CARD_TYPES = MOCK_CARD_TYPES.filter((item) => item.id !== id);
}
