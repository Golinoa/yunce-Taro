/** 操作日志 Service 层（审计查询由后端提供；写入由业务写接口事务审计）。 */
import type { AuditLogEntry, AuditLogPage, AuditLogQuery } from '@/types/audit-log';
import { AUDIT_ACTION_LABELS } from '@/types/audit-log';
import { type PaginatedResponse, formatApiDateTime, unwrapPaginatedList } from '@/utils/pagination';
import { get } from '@/utils/request';

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
  const action = String(raw.action ?? 'lesson.record') as AuditLogEntry['action'];
  return {
    id: String(raw.id ?? ''),
    action,
    // 后端只存 action 码（如 `RECHARGE`），不返回中文标签；
    // 页面要显示中文必须在前端映射，查不到才回落原始码而不是显示空白。
    actionLabel: AUDIT_ACTION_LABELS[action] ?? String(raw.actionLabel ?? raw.action ?? '操作记录'),
    operatorId: String(raw.userId ?? raw.operatorId ?? ''),
    // 后端已关联 User/Profile 补出真实姓名（2026-10-03）；查不到才回落「未知用户」
    operatorName: String(raw.userName ?? raw.operatorName ?? '未知用户'),
    operatorRole: String(raw.userRole ?? raw.operatorRole ?? ''),
    targetType: String(raw.module ?? raw.targetType ?? ''),
    targetId: raw.targetId ? String(raw.targetId) : undefined,
    // 主显描述：写入时由后端固化的 `description`。历史记录（2026-10-03 迁移前）没有该字段，
    // 回落旧 `detail`；再没有就显示动作标签，不会出现空白条目。
    detail: String(raw.description ?? raw.detail ?? raw.message ?? action),
    meta: (raw.meta as Record<string, unknown>) ?? undefined,
    createdAt: formatApiDateTime(raw.createdAt),
  };
}

export const auditLogService = {
  /**
   * 审计写入已下沉到后端业务写接口（点名/补签/编辑课时/撤销/试听签到等自动补流水）。
   * 前端不再写入——保留空实现仅兼容历史调用点，避免抛「接口未接通」误报
   * （用户口径 2026-09-30：签到流水必须可追溯操作人，由后端落 AuditLog）。
   */
  record: async (_input: AuditLogInput): Promise<void> => {},

  query: async (viewer: AuditLogViewer, query?: AuditLogQuery): Promise<AuditLogPage> => {
    const safeQuery: AuditLogQuery = {
      ...query,
      operatorId: viewer.isManager ? query?.operatorId : viewer.id,
    };

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
