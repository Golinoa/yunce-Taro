/**
 * Service 层 — 统计预警 API
 *
 * 现网 DataCenter 走 data-center；本模块仅服务 package-statistics/alert-detail。
 * 预警由后端 cron 计算，前端只负责渲染。
 */
import type { AlertItem } from '@/components/statistics/AlertSheet';
import { get } from '@/utils/request';

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

interface BackendAlertItem {
  detail: string;
  level: 'danger' | 'warning' | 'primary';
  targetId?: string;
  title: string;
  type: string;
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

export const statisticsService = {
  /**
   * 获取预警列表
   * 后端通过 cron 任务定期扫描，计算结果缓存
   */
  getAlerts: async (params: AlertQueryParams): Promise<AlertItem[]> => {
    return get<BackendAlertItem[]>(`/statistics/alerts?${buildAlertQuery(params)}`).then((alerts) =>
      alerts.map(mapBackendAlertItem),
    );
  },

  /**
   * 获取单条预警详情
   * 详情页统一走 Service，避免页面直接依赖 data 层
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
};
