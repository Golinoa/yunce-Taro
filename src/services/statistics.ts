/**
 * Service 层 — 统计相关 API
 *
 * 接口契约定义，当前由 mock 实现，联调时替换为 request 调用
 *
 * 预警和洞察均由后端计算（cron 任务），前端只负责渲染
 */
import type { AlertItem } from '@/components/statistics/AlertSheet';
import type { ChartDataItem } from '@/components/statistics/ChartContainer';
import type { FinanceKpiItem } from '@/components/statistics/FinanceKpi';
import type { InsightItem } from '@/components/statistics/InsightCard';
import type { OperationKpiItem } from '@/components/statistics/OperationKpi';
import { get } from '@/utils/request';
import {
  computeOperationKpi,
  computeFinanceKpi,
  computeTrend,
  computeStudentRank,
  computeTeacherRank,
  computeCampusRank,
  computeCompare,
  computeFinanceAnalysis,
} from '@/data/mock';
import {
  mockGetLessonTrend,
  mockGetIncomeTrend,
  mockGetLessonRank,
  mockGetPaymentRank,
  mockGetParentTrend,
  mockGetExpenseRatios,
  mockGetFinanceAlerts,
  mockGetOperationAlerts,
  mockGetInsights,
  MOCK_PARENT_TREND,
  MOCK_PAYMENT_RANK,
  MOCK_OPERATION_ALERTS,
  MOCK_FINANCE_ALERTS,
  MOCK_INSIGHTS,
} from '@/data/statistics';

const USE_MOCK =
  typeof process !== 'undefined' && typeof process.env !== 'undefined'
    ? process.env.VITE_USE_MOCK !== 'false'
    : true;

// ============================================
// 类型定义（接口契约）
// ============================================

/** 预警请求参数 */
export interface AlertQueryParams {
  /** 视图类型：运营 / 财务 */
  viewType: 'operation' | 'finance';
  /** 年份 */
  year: number;
  /** 月份（quarter 模式下为季度 1-4） */
  month: number;
  /** 筛选模式 */
  filterMode: 'month' | 'quarter' | 'year' | 'custom';
  /** 自定义开始日期 */
  startDate?: string;
  /** 自定义结束日期 */
  endDate?: string;
}

/** 洞察请求参数 */
export interface InsightQueryParams {
  /** 视图类型 */
  viewType: 'operation' | 'finance';
  /** 年份 */
  year: number;
  /** 月份 */
  month: number;
  /** 筛选模式 */
  filterMode: 'month' | 'quarter' | 'year' | 'custom';
  /** 自定义开始日期 */
  startDate?: string;
  /** 自定义结束日期 */
  endDate?: string;
}

/** 排行请求参数 */
export interface RankQueryParams {
  /** 排行类型 */
  type: 'lesson' | 'payment' | 'teacher' | 'campus';
  /** 年份 */
  year: number;
  /** 月份 */
  month: number;
  /** 筛选模式 */
  filterMode: 'month' | 'quarter' | 'year' | 'custom';
}

type RankFallbackItem = { label: string; value: number; unit: string };

interface BackendAlertItem {
  detail: string;
  level: 'danger' | 'warning' | 'primary';
  targetId?: string;
  title: string;
  type: string;
}

interface BackendInsightItem {
  detail: string;
  metric?: number;
  title: string;
  trend?: 'down' | 'stable' | 'up';
  type: string;
}

interface BackendLessonRankItem {
  avatar?: null | string;
  lessonCount: number;
  rank: number;
  studentId: string;
  studentName: string;
  totalMinutes: number;
}

interface BackendPaymentRankItem {
  amount: number;
  count: number;
  method: string;
  rank: number;
}

interface BackendExpenseRatioResponse {
  breakdown: Array<{
    amount: number;
    category: string;
    ratio: number;
  }>;
  totalExpense: number;
}

function buildStatisticsQuery(params: {
  filterMode?: 'custom' | 'month' | 'quarter' | 'year';
  month?: number;
  year?: number;
}): string {
  const period =
    params.filterMode === 'custom' ? 'month' : (params.filterMode || 'month');
  const search = new URLSearchParams();
  search.set('period', period);
  if (params.year) search.set('year', String(params.year));
  if (params.month) search.set('month', String(params.month));
  return search.toString();
}

function buildAlertQuery(params: AlertQueryParams | InsightQueryParams): string {
  const search = new URLSearchParams();
  search.set('viewType', params.viewType);
  search.set('year', String(params.year));
  search.set('month', String(params.month));
  search.set('filterMode', params.filterMode);
  if (params.startDate) search.set('startDate', params.startDate);
  if (params.endDate) search.set('endDate', params.endDate);
  return search.toString();
}

function mapBackendAlertItem(alert: BackendAlertItem): AlertItem {
  return normalizeAlertItem({
    id: `${alert.type}-${alert.targetId || alert.title}`,
    level: alert.level,
    title: alert.title,
    desc: alert.detail,
    count: 1,
    details: [
      {
        id: alert.targetId || `${alert.type}-${alert.title}`,
        name: alert.title,
        info: alert.detail,
        refId: alert.targetId,
      },
    ],
  });
}

function mapBackendInsightItem(insight: BackendInsightItem): InsightItem {
  return {
    id: `${insight.type}-${insight.title}`,
    type:
      insight.trend === 'down'
        ? 'warning'
        : insight.trend === 'up'
          ? 'success'
          : 'info',
    weight: insight.metric || 0,
    title: insight.title,
    desc: insight.detail,
  };
}

function normalizeStudentRefId(refId?: string): string | undefined {
  if (!refId) return undefined;
  if (/^s\d+$/i.test(refId)) {
    return refId;
  }
  const matched = refId.match(/^stu-(\d+)$/i);
  if (!matched) {
    return refId;
  }
  return `s${Number(matched[1])}`;
}

function normalizeAlertItem(alert: AlertItem): AlertItem {
  return {
    ...alert,
    details: alert.details.map((detail) => ({
      ...detail,
      refId: normalizeStudentRefId(detail.refId),
    })),
  };
}

function getAllAlertFallbacks(): AlertItem[] {
  return [...MOCK_OPERATION_ALERTS, ...MOCK_FINANCE_ALERTS].map(normalizeAlertItem);
}

// ============================================
// 同步 Fallback 数据（空数据时的默认展示）
// ============================================

/** 课时趋势 fallback（从全局一致数据源派生） */
function getLessonTrendFallback(): ChartDataItem[] {
  return computeTrend().lessonTrend;
}

/** 收入趋势 fallback（从全局一致数据源派生） */
function getIncomeTrendFallback(): ChartDataItem[] {
  return computeTrend().incomeTrend;
}

/** 课时排行 fallback（从全局一致数据源派生） */
function getLessonRankFallback(): { label: string; value: number; unit: string }[] {
  return computeStudentRank();
}

/** 收费方式排行 fallback */
function getPaymentRankFallback(): { label: string; value: number; unit: string }[] {
  return MOCK_PAYMENT_RANK;
}

/** 家长端课时趋势 fallback */
function getParentTrendFallback(): ChartDataItem[] {
  return MOCK_PARENT_TREND;
}

/** 支出比例配置 fallback（从全局一致数据源派生） */
function getExpenseRatiosFallback(): { label: string; ratio: number; barClass: string }[] {
  const analysis = computeFinanceAnalysis();
  return analysis.expenseComposition.map((item) => ({
    label: item.label,
    ratio: item.percent / 100,
    barClass: item.barClass,
  }));
}

/** 运营视图预警 fallback */
function getOperationAlertsFallback(): AlertItem[] {
  return MOCK_OPERATION_ALERTS.map(normalizeAlertItem);
}

/** 财务视图预警 fallback */
function getFinanceAlertsFallback(): AlertItem[] {
  return MOCK_FINANCE_ALERTS.map(normalizeAlertItem);
}

/** 洞察数据 fallback */
function getInsightsFallback(): InsightItem[] {
  return MOCK_INSIGHTS;
}

function getOperationKpiFallback(): OperationKpiItem {
  return computeOperationKpi() as OperationKpiItem;
}

function getFinanceKpiFallback(): FinanceKpiItem {
  return computeFinanceKpi() as FinanceKpiItem;
}

function getTeacherRankFallback(): RankFallbackItem[] {
  return computeTeacherRank();
}

function getCampusRankFallback(): RankFallbackItem[] {
  return computeCampusRank();
}

function getCompareFallback() {
  return computeCompare();
}

function getFinanceAnalysisComputedFallback() {
  return computeFinanceAnalysis();
}

// ============================================
// 接口契约（联调时替换 mock 为 request 调用）
// ============================================

export const statisticsService = {
  // ---------- 趋势数据 ----------
  /** 课时趋势（近12个月） */
  getLessonTrend: (params?: {
    filterMode?: 'custom' | 'month' | 'quarter' | 'year';
    month?: number;
    year?: number;
  }): Promise<ChartDataItem[]> =>
    USE_MOCK
      ? mockGetLessonTrend()
      : get<ChartDataItem[]>(`/statistics/lesson-trend?${buildStatisticsQuery(params || {})}`),
  /** 收入趋势（近12个月） */
  getIncomeTrend: (params?: {
    filterMode?: 'custom' | 'month' | 'quarter' | 'year';
    month?: number;
    year?: number;
  }): Promise<ChartDataItem[]> =>
    USE_MOCK
      ? mockGetIncomeTrend()
      : get<ChartDataItem[]>(`/statistics/income-trend?${buildStatisticsQuery(params || {})}`),
  /** 家长端课时趋势 */
  getParentTrend: (params?: {
    filterMode?: 'custom' | 'month' | 'quarter' | 'year';
    month?: number;
    year?: number;
  }): Promise<ChartDataItem[]> =>
    USE_MOCK
      ? mockGetParentTrend()
      : get<ChartDataItem[]>(`/statistics/parent-trend?${buildStatisticsQuery(params || {})}`),

  // ---------- 排行数据 ----------
  /** 学员课时消耗排行 */
  getLessonRank: (params?: {
    filterMode?: 'custom' | 'month' | 'quarter' | 'year';
    month?: number;
    year?: number;
  }): Promise<{ label: string; value: number; unit: string }[]> =>
    USE_MOCK
      ? mockGetLessonRank()
      : get<BackendLessonRankItem[]>(
          `/statistics/lesson-rank?${buildStatisticsQuery(params || {})}`,
        ).then((list) =>
          list.map((item) => ({
            label: item.studentName,
            value: item.totalMinutes,
            unit: '分钟',
          })),
        ),
  /** 收费方式收入排行 */
  getPaymentRank: (params?: {
    filterMode?: 'custom' | 'month' | 'quarter' | 'year';
    month?: number;
    year?: number;
  }): Promise<{ label: string; value: number; unit: string }[]> =>
    USE_MOCK
      ? mockGetPaymentRank()
      : get<BackendPaymentRankItem[]>(
          `/statistics/payment-rank?${buildStatisticsQuery(params || {})}`,
        ).then((list) =>
          list.map((item) => ({
            label: item.method,
            value: item.amount,
            unit: '元',
          })),
        ),

  // ---------- 财务数据 ----------
  /** 支出比例配置 */
  getExpenseRatios: (params?: {
    filterMode?: 'custom' | 'month' | 'quarter' | 'year';
    month?: number;
    year?: number;
  }): Promise<{ label: string; ratio: number; barClass: string }[]> =>
    USE_MOCK
      ? mockGetExpenseRatios()
      : get<BackendExpenseRatioResponse>(
          `/statistics/expense-ratios?${buildStatisticsQuery(params || {})}`,
        ).then((result) =>
          result.breakdown.map((item, index) => ({
            label: item.category,
            ratio: item.ratio / 100,
            barClass: ['bg-progress-primary', 'bg-progress-purple', 'bg-progress-warning', 'bg-progress-info'][
              index % 4
            ],
          })),
        ),

  // ---------- 预警数据（后端 cron 计算） ----------
  /**
   * 获取预警列表
   * 后端通过 cron 任务定期扫描，计算结果缓存
   * @param params 视图类型 + 时间范围
   */
  getAlerts: (params: AlertQueryParams): Promise<AlertItem[]> => {
    if (USE_MOCK) {
      if (params.viewType === 'finance') {
        return mockGetFinanceAlerts().then((alerts) => alerts.map(normalizeAlertItem));
      }
      return mockGetOperationAlerts().then((alerts) => alerts.map(normalizeAlertItem));
    }

    return get<BackendAlertItem[]>(`/statistics/alerts?${buildAlertQuery(params)}`).then((alerts) =>
      alerts.map(mapBackendAlertItem),
    );
  },

  // ---------- 洞察数据（后端计算） ----------
  /**
   * 获取洞察列表
   * 后端基于完整历史数据分析后生成
   * @param params 视图类型 + 时间范围
   */
  getInsights: (params: InsightQueryParams): Promise<InsightItem[]> => {
    if (USE_MOCK) {
      return mockGetInsights();
    }

    return get<BackendInsightItem[]>(`/statistics/insights?${buildAlertQuery(params)}`).then(
      (insights) => insights.map(mapBackendInsightItem),
    );
  },

  /**
   * 获取单条预警详情
   * 详情页统一走 Service，避免页面直接依赖 @/data/statistics
   */
  getAlertById: async (alertId: string): Promise<AlertItem | null> => {
    const alert = getAllAlertFallbacks().find((item) => item.id === alertId);
    return alert || null;
  },
  // ---------- 同步 Fallback ----------
  getLessonTrendFallback,
  getIncomeTrendFallback,
  getLessonRankFallback,
  getPaymentRankFallback,
  getParentTrendFallback,
  getExpenseRatiosFallback,
  getOperationAlertsFallback,
  getFinanceAlertsFallback,
  getInsightsFallback,
  getOperationKpiFallback,
  getFinanceKpiFallback,
  getTeacherRankFallback,
  getCampusRankFallback,
  getCompareFallback,
  getFinanceAnalysisComputedFallback,
};
