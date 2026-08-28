/**
 * 操作日志 Service 层（审计日志）
 * - 查询走 GET /audit-logs
 * - 写入仍由前端 mock 层 append（后端暂未提供写入接口）
 */
import type { AuditLogEntry, AuditLogPage, AuditLogQuery } from '@/types/audit-log';
import { loadAuditLogMock } from '@/utils/mock-loaders';
import { isUseMock } from '@/utils/build-env';
import { get } from '@/utils/request';
import {
  type PaginatedResponse,
  formatApiDateTime,
  unwrapPaginatedList,
} from '@/utils/pagination';

export interface AuditLogInput {
  action: AuditLogEntry['action'];
  operatorId: string;
  operatorName: string;
  operatorRole: string;
  targetType: string;
  targetId?: string;
  detail: string;
  meta?: Record<string, unknown>;
}

export interface AuditLogViewer {
  id: string;
  isManager: boolean;
}

export function isAuditLogManager(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'principal';
}

function mapBackendAuditLog(raw: Record<string, unknown>): AuditLogEntry {
  return {
    id: String(raw.id ?? ''),
    action: String(raw.action ?? 'lesson.record') as AuditLogEntry['action'],
    actionLabel: String(raw.actionLabel ?? raw.action ?? '操作记录'),
    operatorId: String(raw.userId ?? raw.operatorId ?? ''),
    operatorName: String(raw.userName ?? raw.operatorName ?? '未知用户'),
    operatorRole: String(raw.userRole ?? raw.operatorRole ?? ''),
    targetType: String(raw.module ?? raw.targetType ?? ''),
    targetId: raw.targetId ? String(raw.targetId) : undefined,
    detail: String(raw.detail ?? raw.message ?? ''),
    meta: (raw.meta as Record<string, unknown>) ?? undefined,
    createdAt: formatApiDateTime(raw.createdAt),
  };
}

export const auditLogService = {
  record: async (input: AuditLogInput): Promise<AuditLogEntry> => {
    const { addAuditLog } = await loadAuditLogMock();
    return addAuditLog(input);
  },

  query: async (viewer: AuditLogViewer, query?: AuditLogQuery): Promise<AuditLogPage> => {
    const safeQuery: AuditLogQuery = {
      ...query,
      operatorId: viewer.isManager ? query?.operatorId : viewer.id,
    };

    if (isUseMock()) {
      const { queryAuditLogs } = await loadAuditLogMock();
      return queryAuditLogs(safeQuery);
    }

    const data = await get<PaginatedResponse<Record<string, unknown>>>('/audit-logs', {
      page: safeQuery.page ?? 1,
      pageSize: safeQuery.pageSize ?? 20,
      userId: safeQuery.operatorId,
      action: safeQuery.action,
      startDate: safeQuery.startDate,
      endDate: safeQuery.endDate,
    });

    const list = unwrapPaginatedList(data).map(mapBackendAuditLog);
    const pagination = Array.isArray(data) ? null : data.pagination;
    return {
      list,
      total: pagination?.total ?? list.length,
      page: pagination?.page ?? safeQuery.page ?? 1,
      pageSize: pagination?.pageSize ?? safeQuery.pageSize ?? 20,
    };
  },
};
