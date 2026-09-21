/**
 * 数据中心 Service 的唯一兼容出口。
 *
 * 实现位于统计分包目录，页面和公共 Service 导出都复用同一份契约，
 * 避免概览页与详情页使用不同的校区参数和响应处理。
 */
export { dataCenterService } from '@/package-statistics/services/data-center';
export type {
  DataCenterScopeParams,
  RevenueTrendQueryParams,
  FinanceDetailQueryParams,
  MemberDetailQueryParams,
  CardDetailQueryParams,
  SalaryDetailQueryParams,
  CreateTransactionParams,
} from '@/package-statistics/services/data-center';
