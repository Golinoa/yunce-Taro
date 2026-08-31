/**
 * Service �?�?数据中心相关 API
 *
 * 场馆经营数据：概览、营收趋势、财�?会员/卡项/薪资四大模块及详�? * 以及"记一�?收支分类与交易记�? *
 * 接口契约定义，当前由 mock 实现，联调时替换�?request 调用
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

import { get, post } from '@/utils/request';

// ============================================
// 类型定义（接口契约）
// ============================================

/** 经营数据请求 �?可选校�?scope（仅拉取该校区经营数据，不影响全局校区�?*/
export interface DataCenterScopeParams {
  campusId?: string;
}

/** 营收趋势请求参数 */
export interface RevenueTrendQueryParams extends DataCenterScopeParams {
  period: 'day' | 'week' | 'month' | 'year';
}

/** 财务详情请求参数 */
export interface FinanceDetailQueryParams extends DataCenterScopeParams {
  date?: string;
  periodType?: 'day' | 'month' | 'year';
}

/** 会员详情请求参数 */
export interface MemberDetailQueryParams extends DataCenterScopeParams {
  month?: string;
  periodType?: 'day' | 'month' | 'year';
}

/** 卡项详情请求参数 */
export interface CardDetailQueryParams extends DataCenterScopeParams {
  month?: string;
  periodType?: 'day' | 'month' | 'year';
}

/** 薪资详情请求参数 */
export interface SalaryDetailQueryParams extends DataCenterScopeParams {
  month?: string;
  periodType?: 'month' | 'year';
}

/** 创建交易记录请求参数 */
export type CreateTransactionParams = Omit<TransactionRecordType, 'id'>;

function appendCampusQuery(base: string, campusId?: string): string {
  if (!campusId) return base;
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}campusId=${encodeURIComponent(campusId)}`;
}

// ============================================
// 后端响应类型（联调时使用�?// ============================================

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
// 同步 Fallback 数据（空数据时的默认展示�?// ============================================

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
// 接口契约（联调时替换 mock �?request 调用�?// ============================================

export const dataCenterService = {
  // ---------- 场馆概览 ----------
  /** 获取场馆经营概览 */
  getVenueOverview: (params?: DataCenterScopeParams): Promise<VenueOverviewType> =>
    get<BackendVenueOverviewResponse>(appendCampusQuery('/data-center/venue-overview', params?.campusId)),

  // ---------- 营收趋势 ----------
  /** 获取营收趋势 */
  getRevenueTrend: (params: RevenueTrendQueryParams): Promise<RevenueTrendType> =>
    get<BackendRevenueTrendResponse>(
          appendCampusQuery(`/data-center/revenue-trend?period=${params.period}`, params.campusId),
        ),

  // ---------- 财务数据 ----------
  /** 获取财务数据卡片 */
  getFinanceData: (params?: DataCenterScopeParams): Promise<FinanceDataType> =>
    get<BackendFinanceDataResponse>(appendCampusQuery('/data-center/finance', params?.campusId)),

  /** 获取财务详情 */
  getFinanceDetail: (params: FinanceDetailQueryParams): Promise<FinanceDetailType> =>
    get<FinanceDetailType>(
          appendCampusQuery(
            `/data-center/finance/detail?date=${params.date || ''}&periodType=${params.periodType || ''}`,
            params.campusId,
          ),
        ),

  // ---------- 会员数据 ----------
  /** 获取会员数据卡片 */
  getMemberData: (params?: DataCenterScopeParams): Promise<MemberDataType> =>
    get<BackendMemberDataResponse>(appendCampusQuery('/data-center/member', params?.campusId)),

  /** 获取会员详情 */
  getMemberDetail: (params: MemberDetailQueryParams): Promise<MemberDetailType> =>
    get<MemberDetailType>(
          appendCampusQuery(
            `/data-center/member/detail?month=${params.month || ''}&periodType=${params.periodType || ''}`,
            params.campusId,
          ),
        ),

  // ---------- 卡项数据 ----------
  /** 获取卡项数据卡片 */
  getCardData: (params?: DataCenterScopeParams): Promise<CardDataType> =>
    get<BackendCardDataResponse>(appendCampusQuery('/data-center/card', params?.campusId)),

  /** 获取卡项详情 */
  getCardDetail: (params: CardDetailQueryParams): Promise<CardDetailType> =>
    get<CardDetailType>(
          appendCampusQuery(
            `/data-center/card/detail?month=${params.month || ''}&periodType=${params.periodType || ''}`,
            params.campusId,
          ),
        ),

  // ---------- 薪资数据 ----------
  /** 获取薪资数据卡片 */
  getSalaryData: (params?: DataCenterScopeParams): Promise<SalaryDataType> =>
    get<BackendSalaryDataResponse>(appendCampusQuery('/data-center/salary', params?.campusId)),

  /** 获取薪资详情 */
  getSalaryDetail: (params: SalaryDetailQueryParams): Promise<SalaryDetailType> =>
    get<SalaryDetailType>(
          appendCampusQuery(
            `/data-center/salary/detail?month=${params.month || ''}&periodType=${params.periodType || ''}`,
            params.campusId,
          ),
        ),

  // ---------- 记一�?----------
  /** 获取支出分类列表 */
  getExpenseCategories: (): Promise<ExpenseCategoryType[]> =>
    get<ExpenseCategoryType[]>('/data-center/expense-categories'),

  /** 获取收入分类列表 */
  getIncomeCategories: (): Promise<IncomeCategoryType[]> =>
    get<IncomeCategoryType[]>('/data-center/income-categories'),

  /** 创建自定义记账分�?*/
  createLedgerCategory: (input: {
    type: 'expense' | 'income';
    name: string;
  }): Promise<ExpenseCategoryType | IncomeCategoryType> =>
    post<ExpenseCategoryType | IncomeCategoryType>(
          '/data-center/categories',
          input as unknown as Record<string, unknown>,
        ),

  /** 创建交易记录（记一笔） */
  createTransaction: (data: CreateTransactionParams): Promise<{ success: boolean }> =>
    post<{ success: boolean }>(
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
