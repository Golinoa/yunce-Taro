/**
 * 预警/洞察已读状态管理
 * 前端临时方案：Taro.setStorageSync
 * 联调时切换为后端 API，前端乐观更新
 */
import Taro from '@tarojs/taro';

/** 存储键 */
const STORAGE_KEYS = {
  /** 已读的预警详情ID列表 */
  alertReadIds: 'alert_read_ids',
  /** 已读的洞察ID列表 */
  insightReadIds: 'insight_read_ids',
  /** 不再提示的洞察类型ID列表 */
  insightDismissedIds: 'insight_dismissed_ids',
  /** 不再提示的预警类型ID列表 */
  alertDismissedIds: 'alert_dismissed_ids',
} as const;

/** 通用：获取已读ID集合 */
function getIds(key: string): Set<string> {
  try {
    const raw = Taro.getStorageSync(key) || '[]';
    return new Set(JSON.parse(raw as string));
  } catch {
    return new Set();
  }
}

/** 通用：保存ID集合 */
function saveIds(key: string, ids: Set<string>): void {
  Taro.setStorageSync(key, JSON.stringify([...ids]));
}

// ============ 预警详情已读 ============

/** 获取已读的预警详情ID */
export function getAlertReadIds(): Set<string> {
  return getIds(STORAGE_KEYS.alertReadIds);
}

/** 标记预警详情已读（单条） */
export function markAlertRead(detailId: string): void {
  const ids = getAlertReadIds();
  ids.add(detailId);
  saveIds(STORAGE_KEYS.alertReadIds, ids);
}

/** 批量标记预警详情已读 */
export function markAlertsRead(detailIds: string[]): void {
  const ids = getAlertReadIds();
  detailIds.forEach((id) => ids.add(id));
  saveIds(STORAGE_KEYS.alertReadIds, ids);
}

/** 检查预警详情是否已读 */
export function isAlertRead(detailId: string): boolean {
  return getAlertReadIds().has(detailId);
}

// ============ 洞察已读 ============

/** 获取已读的洞察ID */
export function getInsightReadIds(): Set<string> {
  return getIds(STORAGE_KEYS.insightReadIds);
}

/** 标记洞察已读 */
export function markInsightRead(insightId: string): void {
  const ids = getInsightReadIds();
  ids.add(insightId);
  saveIds(STORAGE_KEYS.insightReadIds, ids);
}

// ============ 不再提示 ============

/** 获取不再提示的洞察ID */
export function getInsightDismissedIds(): Set<string> {
  return getIds(STORAGE_KEYS.insightDismissedIds);
}

/** 标记洞察不再提示 */
export function dismissInsight(insightId: string): void {
  const ids = getInsightDismissedIds();
  ids.add(insightId);
  saveIds(STORAGE_KEYS.insightDismissedIds, ids);
  // 同时标记已读
  markInsightRead(insightId);
}

/** 获取不再提示的预警类型ID */
export function getAlertDismissedIds(): Set<string> {
  return getIds(STORAGE_KEYS.alertDismissedIds);
}

/** 标记预警类型不再提示 */
export function dismissAlertType(alertTypeId: string): void {
  const ids = getAlertDismissedIds();
  ids.add(alertTypeId);
  saveIds(STORAGE_KEYS.alertDismissedIds, ids);
}

// ============ 过滤 ============

/** 过滤掉已读和不再提示的洞察 */
export function filterActiveInsights<T extends { id: string }>(insights: T[]): T[] {
  const readIds = getInsightReadIds();
  const dismissedIds = getInsightDismissedIds();
  return insights.filter((i) => !readIds.has(i.id) && !dismissedIds.has(i.id));
}

/** 过滤掉不再提示的预警类型 */
export function filterActiveAlerts<T extends { id: string }>(alerts: T[]): T[] {
  const dismissedIds = getAlertDismissedIds();
  return alerts.filter((a) => !dismissedIds.has(a.id));
}
