/** 数据中心领域类型（与 mock 实现分离） */

/** 场馆经营概览 */
export interface VenueOverviewType {
  /** 场馆名 */
  venueName: string;
  /** 今日营收（元） */
  todayRevenue: number;
  /** 较昨日变化率（百分比，如 +12.5 表示 +12.5%） */
  revenueChange: number;
  /** 今日订单数 */
  todayOrders: number;
  /** 今日新增会员数 */
  newMembers: number;
  /** 浮盈余额（元） */
  floatBalance: number;
}

/** 营收趋势数据项 */
export interface RevenueTrendItem {
  label: string;
  value: number;
}

/** 营收趋势 */
export interface RevenueTrendType {
  /** 周期 */
  period: 'day' | 'week' | 'month' | 'year';
  /** 趋势数据 */
  data: RevenueTrendItem[];
  /** 累计金额（元） */
  total: number;
  /** 平均值（元） */
  average: number;
  /** 累计文案（如"近7日累计"） */
  totalLabel: string;
  /** 平均值文案（如"单店日均"） */
  averageLabel: string;
}

/** 财务数据卡片 */
export interface FinanceDataType {
  /** 本月净收入（元） */
  monthNetIncome: number;
  /** 净收入变化率 */
  netIncomeChange: number;
  /** 收入（元） */
  income: number;
  /** 支出（元） */
  expense: number;
  /** 浮盈（元） */
  float: number;
}

/** 会员数据卡片 */
export interface MemberDataType {
  /** 活跃会员数 */
  activeMembers: number;
  /** 活跃会员变化率 */
  activeChange: number;
  /** 本月新增 */
  newThisMonth: number;
  /** 即将到期 */
  expiringSoon: number;
  /** 流失预警 */
  churnWarning: number;
}

/** 卡项数据卡片 */
export interface CardDataType {
  /** 本月售卡金额（元） */
  monthCardSales: number;
  /** 售卡变化率 */
  salesChange: number;
  /** 售出张数 */
  soldCount: number;
  /** 待核销 */
  pendingRedeem: number;
  /** 热卖卡种 */
  topSeller: string;
}

/** 薪资数据卡片 */
export interface SalaryDataType {
  /** 本月应发薪资（元） */
  monthSalaryPayable: number;
  /** 薪资变化率 */
  salaryChange: number;
  /** 课时费（元） */
  classFee: number;
  /** 提成（元） */
  commission: number;
  /** 教练数 */
  coachCount: number;
}

/** 财务详情 - 数据明细项 */
export interface FinanceDetailItem {
  date: string;
  category: string;
  amount: number;
  remark: string;
  type: 'income' | 'expense';
}

/** 财务详情 */
export interface FinanceDetailType {
  /** 日期 */
  date: string;
  /** 周期类型 */
  periodType: 'day' | 'month' | 'year';
  /** 收入（元） */
  income: number;
  /** 支出（元） */
  expense: number;
  /** 浮盈（元） */
  float: number;
  /** 纯利（元） */
  profit: number;
  /** 收入变化率 */
  incomeChange: number;
  /** 支出变化率 */
  expenseChange: number;
  /** 浮盈变化率 */
  floatChange: number;
  /** 纯利变化率 */
  profitChange: number;
  /** AI 解读文本 */
  aiInsight: string;
  /** 趋势图数据 - 收入 */
  incomeTrendData: RevenueTrendItem[];
  /** 趋势图数据 - 支出 */
  expenseTrendData: RevenueTrendItem[];
  /** 数据明细列表 */
  detailList: FinanceDetailItem[];
}

/** 会员详情 - 雷达图数据 */
export interface MemberRadarData {
  categories: string[];
  purchaseData: number[];
  attendanceData: number[];
}

/** 会员详情 - 数据明细项 */
export interface MemberDetailItem {
  id: string;
  name: string;
  type: 'new' | 'active' | 'expiring' | 'churned';
  value: string;
  date: string;
}

/** 会员详情 */
export interface MemberDetailType {
  /** 月份 */
  month: string;
  /** 周期类型 */
  periodType: 'day' | 'month' | 'year';
  /** 在籍总数 */
  totalMembers: number;
  /** 新增 */
  newMembers: number;
  /** 流失 */
  churnedMembers: number;
  /** 客资数量 */
  prospects: number;
  /** 总数变化率 */
  totalChange: number;
  /** 新增变化率 */
  newChange: number;
  /** 流失变化率 */
  churnedChange: number;
  /** 客资变化率 */
  prospectsChange: number;
  /** 雷达图数据 */
  radarData: MemberRadarData;
  /** 数据明细 */
  detailList: MemberDetailItem[];
}

/** 卡项详情 - 售卡明细项 */
export interface CardSoldItem {
  id: string;
  cardName: string;
  count: number;
  amount: number;
  date: string;
}

/** 卡项详情 - 耗卡明细项 */
export interface CardConsumedItem {
  id: string;
  cardName: string;
  count: number;
  amount: number;
  date: string;
}

/** 卡项详情 */
export interface CardDetailType {
  /** 月份 */
  month: string;
  /** 周期类型 */
  periodType: 'day' | 'month' | 'year';
  /** 耗卡数据（元） */
  cardConsumed: number;
  /** 售卡数据（元） */
  cardSold: number;
  /** 剩余卡项（张） */
  remainingCards: number;
  /** 卡片到期（张） */
  expiringCards: number;
  /** 售卡变化率 */
  soldChange: number;
  /** 售卡明细 */
  soldList: CardSoldItem[];
  /** 耗卡明细 */
  consumedList: CardConsumedItem[];
}

/** 薪资详情 - 教练列表项 */
export interface CoachSalaryItem {
  name: string;
  performance: number;
  hours: number;
  cardConsumed: number;
}

/** 薪资详情 */
export interface SalaryDetailType {
  /** 月份 */
  month: string;
  /** 周期类型 */
  periodType: 'month' | 'year';
  /** 总薪资（元） */
  totalSalary: number;
  /** 固定薪资成本（元） */
  fixedCost: number;
  /** 团课（元） */
  groupClass: number;
  /** 私教课（元） */
  privateClass: number;
  /** 趋势图数据 */
  trendData: RevenueTrendItem[];
  /** 教练列表 */
  coachList: CoachSalaryItem[];
}

/** 支出分类 */
export interface ExpenseCategoryType {
  id: string;
  name: string;
  icon: string;
}

/** 收入分类 */
export interface IncomeCategoryType {
  id: string;
  name: string;
  icon: string;
}

/** 交易记录 */
export interface TransactionRecordType {
  id: string;
  amount: number;
  type: 'expense' | 'income';
  category: string;
  date: string;
  remark: string;
  /** 摊销期数（月），可选 */
  amortizationPeriod?: number;
}
