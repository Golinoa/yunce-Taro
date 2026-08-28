/**
 * 数据中心 Mock 转发层（分包专用，生产构建由 stub 替换）
 */
import {
  mockGetVenueOverview as getVenueOverviewBase,
  mockGetRevenueTrend as getRevenueTrendBase,
  mockGetFinanceData as getFinanceDataBase,
  mockGetMemberData as getMemberDataBase,
  mockGetCardData as getCardDataBase,
  mockGetSalaryData as getSalaryDataBase,
  mockGetFinanceDetail,
  mockGetMemberDetail,
  mockGetCardDetail,
  mockGetSalaryDetail,
  mockGetExpenseCategories,
  mockGetIncomeCategories,
  mockCreateTransaction,
} from '@/data/data-center';
import type {
  CardDataType,
  CardDetailType,
  FinanceDataType,
  FinanceDetailType,
  MemberDataType,
  MemberDetailType,
  SalaryDataType,
  SalaryDetailType,
  TransactionRecordType,
  VenueOverviewType,
  RevenueTrendType,
  ExpenseCategoryType,
  IncomeCategoryType,
} from '@/types/data-center';

export async function mockGetVenueOverview(_campusId?: string): Promise<VenueOverviewType> {
  return getVenueOverviewBase();
}

export async function mockGetRevenueTrend(
  period: 'day' | 'week' | 'month' | 'year',
  _campusId?: string,
): Promise<RevenueTrendType> {
  return getRevenueTrendBase(period);
}

export async function mockGetFinanceData(_campusId?: string): Promise<FinanceDataType> {
  return getFinanceDataBase();
}

export async function mockGetMemberData(_campusId?: string): Promise<MemberDataType> {
  return getMemberDataBase();
}

export async function mockGetCardData(_campusId?: string): Promise<CardDataType> {
  return getCardDataBase();
}

export async function mockGetSalaryData(_campusId?: string): Promise<SalaryDataType> {
  return getSalaryDataBase();
}

export {
  mockGetFinanceDetail,
  mockGetMemberDetail,
  mockGetCardDetail,
  mockGetSalaryDetail,
  mockGetExpenseCategories,
  mockGetIncomeCategories,
  mockCreateTransaction,
};

export async function mockCreateLedgerCategory(input: {
  type: 'expense' | 'income';
  name: string;
}): Promise<ExpenseCategoryType | IncomeCategoryType> {
  return {
    id: `custom-${Date.now()}`,
    name: input.name,
    icon: 'mdi-dots-vertical',
  };
}

export type {
  CardDataType,
  CardDetailType,
  FinanceDataType,
  FinanceDetailType,
  MemberDataType,
  MemberDetailType,
  SalaryDataType,
  SalaryDetailType,
  TransactionRecordType,
  VenueOverviewType,
  RevenueTrendType,
  ExpenseCategoryType,
  IncomeCategoryType,
};
