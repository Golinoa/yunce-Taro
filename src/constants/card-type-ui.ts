/** 卡种 UI 常量（与 mock 数据分离） */
import type {
  CardTypeBookingMethod,
  CardTypeCategory,
  CardTypeKind,
  CardTypeScope,
  CardTypeStatus,
} from '@/types/card-type';

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
