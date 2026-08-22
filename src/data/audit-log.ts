/**
 * 操作日志 Mock 数据层（append-only 审计日志）
 *
 * - 追加式写入：只提供 add / query，不提供 update / delete，日志不可修改
 * - 持久化：Taro storage（模拟后端落库，**长期保留不删除**）；Node 测试环境自动退化为内存
 * - 展示策略（用户口径 2026-08-22 修正）：后端一直保留，前端【仅展示最近 90 天】——
 *   查询层强制过滤 90 天前数据，历史日志仍在存储中
 */
import Taro from '@tarojs/taro';
import { AUDIT_ACTION_LABELS } from '@/types/audit-log';
import type { AuditLogEntry, AuditLogPage, AuditLogQuery } from '@/types/audit-log';

export const AUDIT_LOG_STORAGE_KEY = 'yunce-edu-audit-log';
/** 前端展示范围（天）：仅展示最近 90 天；后端数据长期保留 */
export const AUDIT_LOG_DISPLAY_DAYS = 90;

let _logs: AuditLogEntry[] | null = null;

function isTaroRuntime(): boolean {
  return typeof Taro !== 'undefined' && typeof Taro.getStorageSync === 'function';
}

function load(): AuditLogEntry[] {
  if (_logs) return _logs;
  try {
    if (isTaroRuntime()) {
      const raw = Taro.getStorageSync(AUDIT_LOG_STORAGE_KEY);
      _logs = Array.isArray(raw) ? (raw as AuditLogEntry[]) : [];
    } else {
      _logs = [];
    }
  } catch {
    _logs = [];
  }
  return _logs;
}

function persist(): void {
  try {
    if (isTaroRuntime()) {
      Taro.setStorageSync(AUDIT_LOG_STORAGE_KEY, _logs || []);
    }
  } catch {
    // storage 不可用时仅保留内存态（mock 阶段可接受）
  }
}

/** 追加一条日志（append-only，永不删除）；actionLabel 不传时按 action 自动填充 */
export function addAuditLog(
  input: Omit<AuditLogEntry, 'id' | 'createdAt' | 'actionLabel'> & { actionLabel?: string },
): AuditLogEntry {
  load();
  const entry: AuditLogEntry = {
    ...input,
    // actionLabel 未显式传入时按动作类型自动填充，保证历史记录可读
    actionLabel: input.actionLabel ?? AUDIT_ACTION_LABELS[input.action],
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };
  _logs!.unshift(entry);
  persist();
  return entry;
}

/** 分页查询（只读）。强制仅返回最近 AUDIT_LOG_DISPLAY_DAYS 天，历史日志不展示但保留 */
export function queryAuditLogs(query: AuditLogQuery = {}): AuditLogPage {
  const logs = load();
  const { action, keyword, operatorId, startDate, endDate, page = 1, pageSize = 20 } = query;
  let filtered = logs;

  // 展示范围上限：最近 90 天（后端长期保留，前端仅展示三个月）
  const displayCutoff = Date.now() - AUDIT_LOG_DISPLAY_DAYS * 24 * 60 * 60 * 1000;
  filtered = filtered.filter((l) => new Date(l.createdAt).getTime() >= displayCutoff);

  if (action) {
    filtered = filtered.filter((l) => l.action === action);
  }
  if (operatorId) {
    filtered = filtered.filter((l) => l.operatorId === operatorId);
  }
  const kw = (keyword || '').trim().toLowerCase();
  if (kw) {
    filtered = filtered.filter(
      (l) =>
        l.operatorName.toLowerCase().includes(kw) ||
        l.detail.toLowerCase().includes(kw) ||
        (l.actionLabel || '').toLowerCase().includes(kw),
    );
  }
  if (startDate) {
    const s = new Date(`${startDate}T00:00:00`).getTime();
    filtered = filtered.filter((l) => new Date(l.createdAt).getTime() >= s);
  }
  if (endDate) {
    const e = new Date(`${endDate}T23:59:59.999`).getTime();
    filtered = filtered.filter((l) => new Date(l.createdAt).getTime() <= e);
  }

  const total = filtered.length;
  const start = (page - 1) * pageSize;
  return {
    list: filtered.slice(start, start + pageSize),
    total,
    page,
    pageSize,
  };
}

/** 仅测试用：重置内存日志 */
export function __resetAuditLogsForTest(): void {
  _logs = [];
}
