/**
 * Service 层 — 数据中心相关 API
 *
 * 场馆经营数据：概览、营收趋势、财务/会员/卡项/薪资四大模块及详情
 * 以及"记一笔"收支分类与交易记录
 *
 * 接口契约定义，当前由 mock 实现，联调时替换为 request 调用
 */
import type {
  VenueOverviewType,
  RevenueTrendType,
  FinanceDataType,
  MemberDataType,
  CardDataType,
  SalaryDataType,
  FinanceDetailType,
  MemberDetailType,
  CardDetailType,
  SalaryDetailType,
  ExpenseCategoryType,
  IncomeCategoryType,
  TransactionRecordType,
} from '@/types/data-center';
import { loadDataCenterMock } from '@/utils/mock-loaders';
import { isUseMock } from '@/utils/build-env';

let dcMockMod: Awaited<ReturnType<typeof loadDataCenterMock>> | undefined;
async function dc() {
  dcMockMod ??= await loadDataCenterMock();
  return dcMockMod;
}

import { get, post } from '@/utils/request';

// ============================================
// 类型定义（接口契约）
// ============================================

/** 营收趋势请求参数 */
export interface RevenueTrendQueryParams {
  period: 'day' | 'week' | 'month' | 'year';
}

/** 财务详情请求参数 */
export interface FinanceDetailQueryParams {
  date?: string;
  periodType?: 'day' | 'month' | 'year';
}

/** 会员详情请求参数 */
export interface MemberDetailQueryParams {
  month?: string;
  periodType?: 'day' | 'month' | 'year';
}

/** 卡项详情请求参数 */
export interface CardDetailQueryParams {
  month?: string;
  periodType?: 'day' | 'month' | 'year';
}

/** 薪资详情请求参数 */
export interface SalaryDetailQueryParams {
  month?: string;
  periodType?: 'month' | 'year';
}

/** 创建交易记录请求参数 */
export type CreateTransactionParams = Omit<TransactionRecordType, 'id'>;

// ============================================
// 后端响应类型（联调时使用）
// ============================================

interface BackendVenueOverviewResponse {
  venueName: string;
  todayRevenue: number;
  revenueChange: number;
  todayOrders: number;
  newMembers: number;
  floatBalance: number;
}

interface BackendRevenueTrendResponse {
  period: 'day' | 'week' | 'month' | 'year';
  data: Array<{ label: string; value: number }>;
  total: number;
  average: number;
  totalLabel: string;
  averageLabel: string;
}

interface BackendFinanceDataResponse {
  monthNetIncome: number;
  netIncomeChange: number;
  income: number;
  expense: number;
  float: number;
}

interface BackendMemberDataResponse {
  activeMembers: number;
  activeChange: number;
  newThisMonth: number;
  expiringSoon: number;
  churnWarning: number;
}

interface BackendCardDataResponse {
  monthCardSales: number;
  salesChange: number;
  soldCount: number;
  pendingRedeem: number;
  topSeller: string;
}

interface BackendSalaryDataResponse {
  monthSalaryPayable: number;
  salaryChange: number;
  classFee: number;
  commission: number;
  coachCount: number;
}

// ============================================
// 同步 Fallback 数据（空数据时的默认展示）
// ============================================

/** 场馆概览 fallback */
function getVenueOverviewFallback(): VenueOverviewType {
  return {
    venueName: '云策健身·总馆',
    todayRevenue: 0,
    revenueChange: 0,
    todayOrders: 0,
    newMembers: 0,
    floatBalance: 0,
  };
}

/** 营收趋势 fallback */
function getRevenueTrendFallback(period: 'day' | 'week' | 'month' | 'year'): RevenueTrendType {
  return {
    period,
    data: [],
    total: 0,
    average: 0,
    totalLabel: '累计',
    averageLabel: '平均',
  };
}

/** 财务数据 fallback */
function getFinanceDataFallback(): FinanceDataType {
  return {
    monthNetIncome: 0,
    netIncomeChange: 0,
    income: 0,
    expense: 0,
    float: 0,
  };
}

/** 会员数据 fallback */
function getMemberDataFallback(): MemberDataType {
  return {
    activeMembers: 0,
    activeChange: 0,
    newThisMonth: 0,
    expiringSoon: 0,
    churnWarning: 0,
  };
}

/** 卡项数据 fallback */
function getCardDataFallback(): CardDataType {
  return {
    monthCardSales: 0,
    salesChange: 0,
    soldCount: 0,
    pendingRedeem: 0,
    topSeller: '',
  };
}

/** 薪资数据 fallback */
function getSalaryDataFallback(): SalaryDataType {
  return {
    monthSalaryPayable: 0,
    salaryChange: 0,
    classFee: 0,
    commission: 0,
    coachCount: 0,
  };
}

// ============================================
// 接口契约（联调时替换 mock 为 request 调用）
// ============================================

export const dataCenterService = {
  // ---------- 场馆概览 ----------
  /** 获取场馆经营概览 */
  getVenueOverview: async (): Promise<VenueOverviewType> =>
    isUseMock()
      ? (await dc()).mockGetVenueOverview()
      : get<BackendVenueOverviewResponse>('/data-center/venue-overview'),

  // ---------- 营收趋势 ----------
  /** 获取营收趋势 */
  getRevenueTrend: async (params: RevenueTrendQueryParams): Promise<RevenueTrendType> =>
    isUseMock()
      ? (await dc()).mockGetRevenueTrend(params.period)
      : get<BackendRevenueTrendResponse>(`/data-center/revenue-trend?period=${params.period}`),

  // ---------- 财务数据 ----------
  /** 获取财务数据卡片 */
  getFinanceData: async (): Promise<FinanceDataType> =>
    isUseMock() ? (await dc()).mockGetFinanceData() : get<BackendFinanceDataResponse>('/data-center/finance'),

  /** 获取财务详情 */
  getFinanceDetail: async (params: FinanceDetailQueryParams): Promise<FinanceDetailType> =>
    isUseMock()
      ? (await dc()).mockGetFinanceDetail(params)
      : get<FinanceDetailType>(
          `/data-center/finance/detail?date=${params.date || ''}&periodType=${params.periodType || ''}`,
        ),

  // ---------- 会员数据 ----------
  /** 获取会员数据卡片 */
  getMemberData: async (): Promise<MemberDataType> =>
    isUseMock() ? (await dc()).mockGetMemberData() : get<BackendMemberDataResponse>('/data-center/member'),

  /** 获取会员详情 */
  getMemberDetail: async (params: MemberDetailQueryParams): Promise<MemberDetailType> =>
    isUseMock()
      ? (await dc()).mockGetMemberDetail(params)
      : get<MemberDetailType>(
          `/data-center/member/detail?month=${params.month || ''}&periodType=${params.periodType || ''}`,
        ),

  // ---------- 卡项数据 ----------
  /** 获取卡项数据卡片 */
  getCardData: async (): Promise<CardDataType> =>
    isUseMock() ? (await dc()).mockGetCardData() : get<BackendCardDataResponse>('/data-center/card'),

  /** 获取卡项详情 */
  getCardDetail: async (params: CardDetailQueryParams): Promise<CardDetailType> =>
    isUseMock()
      ? (await dc()).mockGetCardDetail(params)
      : get<CardDetailType>(
          `/data-center/card/detail?month=${params.month || ''}&periodType=${params.periodType || ''}`,
        ),

  // ---------- 薪资数据 ----------
  /** 获取薪资数据卡片 */
  getSalaryData: async (): Promise<SalaryDataType> =>
    isUseMock() ? (await dc()).mockGetSalaryData() : get<BackendSalaryDataResponse>('/data-center/salary'),

  /** 获取薪资详情 */
  getSalaryDetail: async (params: SalaryDetailQueryParams): Promise<SalaryDetailType> =>
    isUseMock()
      ? (await dc()).mockGetSalaryDetail(params)
      : get<SalaryDetailType>(
          `/data-center/salary/detail?month=${params.month || ''}&periodType=${params.periodType || ''}`,
        ),

  // ---------- 记一笔 ----------
  /** 获取支出分类列表 */
  getExpenseCategories: async (): Promise<ExpenseCategoryType[]> =>
    isUseMock()
      ? (await dc()).mockGetExpenseCategories()
      : get<ExpenseCategoryType[]>('/data-center/expense-categories'),

  /** 获取收入分类列表 */
  getIncomeCategories: async (): Promise<IncomeCategoryType[]> =>
    isUseMock()
      ? (await dc()).mockGetIncomeCategories()
      : get<IncomeCategoryType[]>('/data-center/income-categories'),

  /** 创建交易记录（记一笔） */
  createTransaction: async (data: CreateTransactionParams): Promise<{ success: boolean }> =>
    isUseMock()
      ? (await dc()).mockCreateTransaction(data)
      : post<{ success: boolean }>(
          '/data-center/transaction',
          data as unknown as Record<string, unknown>,
        ),

  // ---------- 同步 Fallback ----------
  getVenueOverviewFallback,
  getRevenueTrendFallback,
  getFinanceDataFallback,
  getMemberDataFallback,
  getCardDataFallback,
  getSalaryDataFallback,
};
