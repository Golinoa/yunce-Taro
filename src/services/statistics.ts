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
import type { OperationKpiItem } from '@/components/statistics/OperationKpi';
import { get } from '@/utils/request';

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
  const period = params.filterMode === 'custom' ? 'month' : params.filterMode || 'month';
  const search = new URLSearchParams();
  search.set('period', period);
  if (params.year) search.set('year', String(params.year));
  if (params.month) search.set('month', String(params.month));
  return search.toString();
}

function buildAlertQuery(params: AlertQueryParams): string {
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

// ============================================
// 同步 Fallback（空默认，供 useMemo 同步消费；mock 数据走下方 async Service 方法）
// ============================================

function getLessonTrendFallback(): ChartDataItem[] {
  return [];
}

function getIncomeTrendFallback(): ChartDataItem[] {
  return [];
}

function getLessonRankFallback(): { label: string; value: number; unit: string }[] {
  return [];
}

function getPaymentRankFallback(): { label: string; value: number; unit: string }[] {
  return [];
}

function getParentTrendFallback(): ChartDataItem[] {
  return [];
}

function getExpenseRatiosFallback(): { label: string; ratio: number; barClass: string }[] {
  return [];
}

async function getOperationAlertsFallback(): Promise<AlertItem[]> {
  return [];
}

async function getFinanceAlertsFallback(): Promise<AlertItem[]> {
  return [];
}

function getOperationKpiFallback(): OperationKpiItem {
  return {
    revenue: '¥0',
    revenueBadge: '+0%',
    bills: '0笔收费',
    avg: '客均 ¥0',
    lessonAmount: '¥0',
    lessonTrend: '+0%',
    newAmount: '¥0',
    newNote: '0位新学员',
    pending: '¥0',
    pendingNote: '无待收',
    totalRevenue: '¥0',
    totalExpense: '¥0',
    netProfit: '¥0',
    profitMargin: '0%',
  } as unknown as OperationKpiItem;
}

function getFinanceKpiFallback(): FinanceKpiItem {
  return {
    revenue: '¥0',
    revenueBadge: '+0%',
    bills: '0笔收费',
    avg: '客均 ¥0',
    lessonAmount: '¥0',
    lessonTrend: '+0%',
    newAmount: '¥0',
    newNote: '0位新学员',
    pending: '¥0',
    pendingNote: '无待收',
    totalRevenue: '¥0',
    totalExpense: '¥0',
    netProfit: '¥0',
    profitMargin: '0%',
  } as unknown as FinanceKpiItem;
}

function getTeacherRankFallback(): RankFallbackItem[] {
  return [];
}

function getCampusRankFallback(): RankFallbackItem[] {
  return [];
}

function getCompareFallback() {
  return { mom: '+0%', momValue: '上月 ¥0', yoy: '+0%', yoyValue: '去年 ¥0' };
}

function getFinanceAnalysisComputedFallback() {
  return {
    totalRevenue: '¥0',
    totalExpense: '¥0',
    netProfit: '¥0',
    profitMargin: '0%',
    expenseTrend: '+0%',
    incomeComposition: [] as { label: string; amount: string; percent: number; barClass: string }[],
    expenseComposition: [] as {
      label: string;
      amount: string;
      percent: number;
      barClass: string;
    }[],
    compare: getCompareFallback(),
  };
}

// ============================================
// 接口契约（联调时替换 mock 为 request 调用）
// ============================================

export const statisticsService = {
  // ---------- 趋势数据 ----------
  /** 课时趋势（近12个月） */
  getLessonTrend: async (params?: {
    filterMode?: 'custom' | 'month' | 'quarter' | 'year';
    month?: number;
    year?: number;
  }): Promise<ChartDataItem[]> =>
    get<ChartDataItem[]>(`/statistics/lesson-trend?${buildStatisticsQuery(params || {})}`),
  /** 收入趋势（近12个月） */
  getIncomeTrend: async (params?: {
    filterMode?: 'custom' | 'month' | 'quarter' | 'year';
    month?: number;
    year?: number;
  }): Promise<ChartDataItem[]> =>
    get<ChartDataItem[]>(`/statistics/income-trend?${buildStatisticsQuery(params || {})}`),
  /** 家长端课时趋势 */
  getParentTrend: async (params?: {
    filterMode?: 'custom' | 'month' | 'quarter' | 'year';
    month?: number;
    year?: number;
  }): Promise<ChartDataItem[]> =>
    get<ChartDataItem[]>(`/statistics/parent-trend?${buildStatisticsQuery(params || {})}`),

  // ---------- 排行数据 ----------
  /** 学员课时消耗排行 */
  getLessonRank: async (params?: {
    filterMode?: 'custom' | 'month' | 'quarter' | 'year';
    month?: number;
    year?: number;
  }): Promise<{ label: string; value: number; unit: string }[]> =>
    get<BackendLessonRankItem[]>(
      `/statistics/lesson-rank?${buildStatisticsQuery(params || {})}`,
    ).then((list) =>
      list.map((item) => ({
        label: item.studentName,
        value: item.totalMinutes,
        unit: '分钟',
      })),
    ),
  /** 收费方式收入排行 */
  getPaymentRank: async (params?: {
    filterMode?: 'custom' | 'month' | 'quarter' | 'year';
    month?: number;
    year?: number;
  }): Promise<{ label: string; value: number; unit: string }[]> =>
    get<BackendPaymentRankItem[]>(
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
  getExpenseRatios: async (params?: {
    filterMode?: 'custom' | 'month' | 'quarter' | 'year';
    month?: number;
    year?: number;
  }): Promise<{ label: string; ratio: number; barClass: string }[]> =>
    get<BackendExpenseRatioResponse>(
      `/statistics/expense-ratios?${buildStatisticsQuery(params || {})}`,
    ).then((result) =>
      result.breakdown.map((item, index) => ({
        label: item.category,
        ratio: item.ratio / 100,
        barClass: [
          'bg-progress-primary',
          'bg-progress-purple',
          'bg-progress-warning',
          'bg-progress-info',
        ][index % 4],
      })),
    ),

  // ---------- 预警数据（后端 cron 计算） ----------
  /**
   * 获取预警列表
   * 后端通过 cron 任务定期扫描，计算结果缓存
   * @param params 视图类型 + 时间范围
   */
  getAlerts: async (params: AlertQueryParams): Promise<AlertItem[]> => {
    return get<BackendAlertItem[]>(`/statistics/alerts?${buildAlertQuery(params)}`).then((alerts) =>
      alerts.map(mapBackendAlertItem),
    );
  },

  /**
   * 获取单条预警详情
   * 详情页统一走 Service，避免页面直接依赖 @/data/statistics
   */
  getAlertById: async (alertId: string): Promise<AlertItem | null> => {
    try {
      const alert = await get<BackendAlertItem>(
        `/statistics/alerts/${encodeURIComponent(alertId)}`,
      );
      return mapBackendAlertItem(alert);
    } catch {
      // 单条接口未就绪时回退列表查找
      const [op, fin] = await Promise.all([
        get<BackendAlertItem[]>(
          `/statistics/alerts?${buildAlertQuery({
            viewType: 'operation',
            year: new Date().getFullYear(),
            month: new Date().getMonth() + 1,
            filterMode: 'month',
          })}`,
        ).catch(() => [] as BackendAlertItem[]),
        get<BackendAlertItem[]>(
          `/statistics/alerts?${buildAlertQuery({
            viewType: 'finance',
            year: new Date().getFullYear(),
            month: new Date().getMonth() + 1,
            filterMode: 'month',
          })}`,
        ).catch(() => [] as BackendAlertItem[]),
      ]);
      const found = [...op, ...fin]
        .map(mapBackendAlertItem)
        .find((item) => item.id === alertId || item.id.endsWith(alertId));
      return found || null;
    }
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
  getOperationKpiFallback,
  getFinanceKpiFallback,
  getTeacherRankFallback,
  getCampusRankFallback,
  getCompareFallback,
  getFinanceAnalysisComputedFallback,
};
