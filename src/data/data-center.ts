/**
 * 数据中心 Mock 数据
 *
 * 场馆经营数据风格；类型定义见 @/types/data-center
 */
import dayjs from 'dayjs';
import type {
  VenueOverviewType,
  RevenueTrendItem,
  RevenueTrendType,
  FinanceDataType,
  MemberDataType,
  CardDataType,
  SalaryDataType,
  FinanceDetailItem,
  FinanceDetailType,
  MemberRadarData,
  MemberDetailItem,
  MemberDetailType,
  CardSoldItem,
  CardConsumedItem,
  CardDetailType,
  CoachSalaryItem,
  SalaryDetailType,
  ExpenseCategoryType,
  IncomeCategoryType,
  TransactionRecordType,
} from '@/types/data-center';
import { useCampusStore } from '@/stores/campus';

export type {
  VenueOverviewType,
  RevenueTrendItem,
  RevenueTrendType,
  FinanceDataType,
  MemberDataType,
  CardDataType,
  SalaryDataType,
  FinanceDetailItem,
  FinanceDetailType,
  MemberRadarData,
  MemberDetailItem,
  MemberDetailType,
  CardSoldItem,
  CardConsumedItem,
  CardDetailType,
  CoachSalaryItem,
  SalaryDetailType,
  ExpenseCategoryType,
  IncomeCategoryType,
  TransactionRecordType,
} from '@/types/data-center';

// ============================================
// 常量数据
// ============================================

const VENUE_NAME = '云策健身·总馆';

const EXPENSE_CATEGORIES: ExpenseCategoryType[] = [
  { id: 'rent', name: '场地租金', icon: 'mdi-office-building' },
  { id: 'salary', name: '员工薪资', icon: 'mdi-cash' },
  { id: 'utilities', name: '水电物业', icon: 'mdi-cog' },
  { id: 'equipment', name: '器材采购', icon: 'mdi-school' },
  { id: 'marketing', name: '营销推广', icon: 'mdi-bullhorn-outline' },
  { id: 'maintenance', name: '维修维护', icon: 'mdi-cog' },
  { id: 'supplies', name: '日常耗材', icon: 'mdi-package-variant' },
  { id: 'other', name: '其他支出', icon: 'mdi-dots-vertical' },
];

const INCOME_CATEGORIES: IncomeCategoryType[] = [
  { id: 'membership', name: '会员费', icon: 'mdi-account-group-outline' },
  { id: 'private-class', name: '私教课', icon: 'mdi-school' },
  { id: 'group-class', name: '团课', icon: 'mdi-account-group' },
  { id: 'card-sales', name: '卡项销售', icon: 'mdi-cash-plus' },
  { id: 'merchandise', name: '周边商品', icon: 'mdi-star' },
  { id: 'venue-rental', name: '场地租赁', icon: 'mdi-office-building' },
  { id: 'other', name: '其他收入', icon: 'mdi-cash-plus' },
];

// ============================================
// 工具函数
// ============================================

function delay(ms = 100): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================
// Mock 函数
// ============================================

/** 获取场馆经营概览 */
export async function mockGetVenueOverview(): Promise<VenueOverviewType> {
  await delay();
  const campusState = useCampusStore.getState();
  const campus = campusState.campuses.find((c) => c.id === campusState.currentCampusId);
  const venueName = campus?.name || VENUE_NAME;
  return {
    venueName,
    todayRevenue: 12580,
    revenueChange: 12.5,
    todayOrders: 23,
    newMembers: 5,
    floatBalance: 286450,
  };
}

/** 获取营收趋势 */
export async function mockGetRevenueTrend(
  period: 'day' | 'week' | 'month' | 'year',
): Promise<RevenueTrendType> {
  await delay();

  let data: RevenueTrendItem[] = [];
  let total = 0;
  let average = 0;
  let totalLabel = '';
  let averageLabel = '';

  if (period === 'day') {
    // 日视图：近7天，按星期显示，最后一天为今天（高亮）
    const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
    const todayIndex = dayjs().day();
    const labels: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const idx = (todayIndex - i + 7) % 7;
      labels.push(weekDays[idx]);
    }
    const values = [8600, 10240, 9860, 11580, 12340, 13680, 12580];
    data = labels.map((label, i) => ({ label, value: values[i] }));
    total = values.reduce((sum, v) => sum + v, 0);
    average = Math.round(total / 7);
    totalLabel = '近7日累计';
    averageLabel = '单店日均';
  } else if (period === 'week') {
    // 周视图：近8周
    const labels: string[] = [];
    for (let i = 7; i >= 0; i--) {
      const date = dayjs().subtract(i * 7, 'day');
      labels.push(`${date.month() + 1}/${date.date()}`);
    }
    const values = [8600, 29800, 12400, 11580, 13680, 15480, 18920, 12580];
    data = labels.map((label, i) => ({ label, value: values[i] }));
    total = values.reduce((sum, v) => sum + v, 0);
    average = Math.round(total / 8);
    totalLabel = '近8周累计';
    averageLabel = '单店周均';
  } else if (period === 'month') {
    // 月视图：近12个月
    const labels: string[] = [];
    for (let i = 11; i >= 0; i--) {
      const date = dayjs().subtract(i, 'month');
      labels.push(`${date.month() + 1}月`);
    }
    const values = [
      28500, 24800, 31200, 35600, 38900, 41200, 45800, 47800, 42500, 39800, 36800, 2980,
    ];
    data = labels.map((label, i) => ({ label, value: values[i] }));
    total = values.reduce((sum, v) => sum + v, 0);
    average = Math.round(total / 12);
    totalLabel = '近12月累计';
    averageLabel = '单店月均';
  } else {
    // 年视图：近5年
    const labels: string[] = [];
    for (let i = 4; i >= 0; i--) {
      const year = dayjs().subtract(i, 'year').year();
      labels.push(`${year.toString().slice(-2)}年`);
    }
    const values = [86000, 128000, 156000, 198000, 2980];
    data = labels.map((label, i) => ({ label, value: values[i] }));
    total = values.reduce((sum, v) => sum + v, 0);
    average = Math.round(total / 5);
    totalLabel = '近5年累计';
    averageLabel = '单店年均';
  }

  return { period, data, total, average, totalLabel, averageLabel };
}

/** 获取财务数据卡片 */
export async function mockGetFinanceData(): Promise<FinanceDataType> {
  await delay();
  const income = 412580;
  const expense = 268420;
  const float = 144160;
  return {
    monthNetIncome: float,
    netIncomeChange: 15.8,
    income,
    expense,
    float,
  };
}

/** 获取会员数据卡片 */
export async function mockGetMemberData(): Promise<MemberDataType> {
  await delay();
  return {
    activeMembers: 856,
    activeChange: 8.3,
    newThisMonth: 42,
    expiringSoon: 28,
    churnWarning: 15,
  };
}

/** 获取卡项数据卡片 */
export async function mockGetCardData(): Promise<CardDataType> {
  await delay();
  return {
    monthCardSales: 186500,
    salesChange: 22.4,
    soldCount: 68,
    pendingRedeem: 1256,
    topSeller: '年卡·尊享版',
  };
}

/** 获取薪资数据卡片 */
export async function mockGetSalaryData(): Promise<SalaryDataType> {
  await delay();
  return {
    monthSalaryPayable: 128600,
    salaryChange: 10.2,
    classFee: 68400,
    commission: 25800,
    coachCount: 12,
  };
}

/** 获取财务详情 */
export async function mockGetFinanceDetail(params: {
  date?: string;
  periodType?: 'day' | 'month' | 'year';
}): Promise<FinanceDetailType> {
  await delay();
  const periodType = params.periodType || 'month';
  const date = params.date || dayjs().format('YYYY-MM-DD');

  const income = periodType === 'day' ? 12580 : periodType === 'month' ? 412580 : 4568000;
  const expense = periodType === 'day' ? 8420 : periodType === 'month' ? 268420 : 3125000;
  const float = income - expense;
  const profit = Math.round(float * 0.72);

  const incomeTrendData: RevenueTrendItem[] = (() => {
    if (periodType === 'day') {
      // 近7天
      const labels: string[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = dayjs().subtract(i, 'day');
        labels.push(`${d.month() + 1}-${d.date()}`);
      }
      const values = [8600, 10240, 9860, 11580, 12340, 13680, 12580];
      return labels.map((label, i) => ({ label, value: values[i] }));
    }
    if (periodType === 'year') {
      const months = [
        '1月',
        '2月',
        '3月',
        '4月',
        '5月',
        '6月',
        '7月',
        '8月',
        '9月',
        '10月',
        '11月',
        '12月',
      ];
      const values = [
        285000, 248000, 312000, 356000, 389000, 412000, 458000, 478000, 425000, 398000, 368000,
        402000,
      ];
      return months.map((label, i) => ({ label, value: values[i] }));
    }
    // month: 近30天
    const labels: string[] = [];
    const values: number[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = dayjs().subtract(i, 'day');
      labels.push(`${d.date()}`);
      const base = 12000 + Math.sin(i * 0.3) * 3000;
      const weekendBoost = i % 7 === 0 || i % 7 === 6 ? 4000 : 0;
      values.push(Math.round(base + weekendBoost));
    }
    return labels.map((label, i) => ({ label, value: values[i] }));
  })();

  const expenseTrendData: RevenueTrendItem[] = (() => {
    if (periodType === 'day') {
      const labels: string[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = dayjs().subtract(i, 'day');
        labels.push(`${d.month() + 1}-${d.date()}`);
      }
      const values = [6200, 7800, 7200, 8400, 9100, 10200, 8420];
      return labels.map((label, i) => ({ label, value: values[i] }));
    }
    if (periodType === 'year') {
      const months = [
        '1月',
        '2月',
        '3月',
        '4月',
        '5月',
        '6月',
        '7月',
        '8月',
        '9月',
        '10月',
        '11月',
        '12月',
      ];
      const values = [
        195000, 178000, 215000, 236000, 258000, 272000, 298000, 312000, 285000, 268000, 248000,
        268420,
      ];
      return months.map((label, i) => ({ label, value: values[i] }));
    }
    // month: 近30天
    const labels: string[] = [];
    const values: number[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = dayjs().subtract(i, 'day');
      labels.push(`${d.date()}`);
      const base = 8000 + Math.sin(i * 0.25) * 2000;
      values.push(Math.round(base));
    }
    return labels.map((label, i) => ({ label, value: values[i] }));
  })();

  const detailList: FinanceDetailItem[] = [
    { date, category: '会员费', amount: 58000, remark: '年卡续费 3 笔', type: 'income' },
    { date, category: '私教课', amount: 32000, remark: '私教课程 12 节', type: 'income' },
    { date, category: '团课', amount: 18600, remark: '团课收入 28 人次', type: 'income' },
    { date, category: '卡项销售', amount: 12500, remark: '月卡 5 张', type: 'income' },
    { date, category: '场地租金', amount: 28000, remark: '本月场地租金', type: 'expense' },
    { date, category: '员工薪资', amount: 86000, remark: '12 名员工', type: 'expense' },
    { date, category: '水电物业', amount: 8500, remark: '水电物业费', type: 'expense' },
    { date, category: '营销推广', amount: 6800, remark: '抖音推广', type: 'expense' },
  ];

  return {
    date,
    periodType,
    income,
    expense,
    float,
    profit,
    incomeChange: 12.5,
    expenseChange: 8.3,
    floatChange: 15.8,
    profitChange: 18.2,
    aiInsight:
      '本月营收较上月增长 12.5%，主要得益于私教课和年卡续费的双轮驱动。支出控制良好，仅增长 8.3%，净利润率提升至 35%。建议继续加大私教课程推广，同时关注场地租金占比偏高的问题。',
    incomeTrendData,
    expenseTrendData,
    detailList,
  };
}

/** 获取会员详情 */
export async function mockGetMemberDetail(params: {
  month?: string;
  periodType?: 'day' | 'month' | 'year';
}): Promise<MemberDetailType> {
  await delay();
  const periodType = params.periodType || 'month';
  const month = params.month || dayjs().format('YYYY-MM');

  const radarData: MemberRadarData = {
    categories: ['购买力', '到店频率', '课程参与', '社交活跃', '满意度', '续卡意愿'],
    purchaseData: [85, 72, 68, 55, 90, 78],
    attendanceData: [78, 88, 75, 62, 85, 82],
  };

  const detailList: MemberDetailItem[] = [
    { id: 'm001', name: '张伟', type: 'new', value: '年卡·3680元', date: month + '-15' },
    { id: 'm002', name: '李娜', type: 'new', value: '季卡·1280元', date: month + '-14' },
    { id: 'm003', name: '王强', type: 'active', value: '到店 23 次', date: month + '-16' },
    { id: 'm004', name: '刘芳', type: 'expiring', value: '剩余 5 天', date: month + '-20' },
    { id: 'm005', name: '陈磊', type: 'churned', value: '30 天未到店', date: month + '-10' },
    { id: 'm006', name: '赵敏', type: 'active', value: '到店 18 次', date: month + '-16' },
  ];

  return {
    month,
    periodType,
    totalMembers: 856,
    newMembers: 42,
    churnedMembers: 12,
    prospects: 86,
    totalChange: 5.2,
    newChange: 15.8,
    churnedChange: -8.3,
    prospectsChange: 22.4,
    radarData,
    detailList,
  };
}

/** 获取卡项详情 */
export async function mockGetCardDetail(params: {
  month?: string;
  periodType?: 'day' | 'month' | 'year';
}): Promise<CardDetailType> {
  await delay();
  const periodType = params.periodType || 'month';
  const month = params.month || dayjs().format('YYYY-MM');

  const soldList: CardSoldItem[] = [
    { id: 'cs001', cardName: '年卡·尊享版', count: 15, amount: 55200, date: month },
    { id: 'cs002', cardName: '年卡·标准版', count: 22, amount: 61600, date: month },
    { id: 'cs003', cardName: '季卡', count: 18, amount: 23040, date: month },
    { id: 'cs004', cardName: '月卡', count: 8, amount: 5440, date: month },
    { id: 'cs005', cardName: '次卡·50次', count: 5, amount: 14000, date: month },
  ];

  const consumedList: CardConsumedItem[] = [
    { id: 'cc001', cardName: '年卡·尊享版', count: 186, amount: 22320, date: month },
    { id: 'cc002', cardName: '年卡·标准版', count: 256, amount: 20480, date: month },
    { id: 'cc003', cardName: '季卡', count: 142, amount: 11360, date: month },
    { id: 'cc004', cardName: '私教课', count: 320, amount: 64000, date: month },
    { id: 'cc005', cardName: '团课', count: 580, amount: 17400, date: month },
  ];

  return {
    month,
    periodType,
    cardConsumed: 135560,
    cardSold: 186500,
    remainingCards: 1256,
    expiringCards: 48,
    soldChange: 22.4,
    soldList,
    consumedList,
  };
}

/** 获取薪资详情 */
export async function mockGetSalaryDetail(params: {
  month?: string;
  periodType?: 'month' | 'year';
}): Promise<SalaryDetailType> {
  await delay();
  const periodType = params.periodType || 'month';
  const month = params.month || dayjs().format('YYYY-MM');

  const trendData: RevenueTrendItem[] = (() => {
    if (periodType === 'year') {
      const months = [
        '1月',
        '2月',
        '3月',
        '4月',
        '5月',
        '6月',
        '7月',
        '8月',
        '9月',
        '10月',
        '11月',
        '12月',
      ];
      const values = [
        98000, 102000, 115000, 118000, 122000, 128600, 135000, 142000, 128000, 118000, 112000,
        125000,
      ];
      return months.map((label, i) => ({ label, value: values[i] }));
    }
    const weeks = ['第1周', '第2周', '第3周', '第4周'];
    const values = [30500, 32800, 31200, 34100];
    return weeks.map((label, i) => ({ label, value: values[i] }));
  })();

  const coachList: CoachSalaryItem[] = [
    { name: '张教练', performance: 28500, hours: 128, cardConsumed: 86 },
    { name: '李教练', performance: 25600, hours: 116, cardConsumed: 72 },
    { name: '王教练', performance: 22400, hours: 108, cardConsumed: 68 },
    { name: '赵教练', performance: 19800, hours: 96, cardConsumed: 58 },
    { name: '刘教练', performance: 18500, hours: 88, cardConsumed: 52 },
    { name: '陈教练', performance: 16200, hours: 76, cardConsumed: 45 },
    { name: '周教练', performance: 14800, hours: 68, cardConsumed: 38 },
    { name: '吴教练', performance: 12600, hours: 56, cardConsumed: 32 },
  ];

  return {
    month,
    periodType,
    totalSalary: 128600,
    fixedCost: 48000,
    groupClass: 25800,
    privateClass: 54800,
    trendData,
    coachList,
  };
}

/** 获取支出分类列表 */
export async function mockGetExpenseCategories(): Promise<ExpenseCategoryType[]> {
  await delay();
  return EXPENSE_CATEGORIES;
}

/** 获取收入分类列表 */
export async function mockGetIncomeCategories(): Promise<IncomeCategoryType[]> {
  await delay();
  return INCOME_CATEGORIES;
}

/** 创建交易记录（记一笔） */
export async function mockCreateTransaction(
  data: Omit<TransactionRecordType, 'id'>,
): Promise<{ success: boolean }> {
  await delay();
  // 模拟写入成功
  console.info('[mock] 创建交易记录:', data);
  return { success: true };
}
