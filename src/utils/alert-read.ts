/**
 * 预警已读状态管理
 * 前端临时方案：Taro.setStorageSync
 * 联调时切换为后端 API，前端乐观更新
 */
import Taro from '@tarojs/taro';

/** 存储键 */
const STORAGE_KEYS = {
  /** 已读的预警详情ID列表 */
  alertReadIds: 'alert_read_ids',
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
