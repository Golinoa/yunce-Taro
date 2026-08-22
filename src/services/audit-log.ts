/**
 * 操作日志 Service 层（审计日志）
 * - 双分支：USE_MOCK ? mock（本地持久化） : notWired（真实后端接口待联调）
 * - 只提供 record / query，无 update / delete，保证日志不可修改
 */
import { addAuditLog, queryAuditLogs } from '@/data/audit-log';
import type { AuditLogEntry, AuditLogPage, AuditLogQuery } from '@/types/audit-log';
import { notWired } from '@/utils/not-wired';

const USE_MOCK =
  typeof process !== 'undefined' && typeof process.env !== 'undefined'
    ? process.env.VITE_USE_MOCK !== 'false'
    : true;

/** 记录入参（id/createdAt 由数据层生成） */
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

/** 查询者身份（用于可见范围控制，模拟后端数据权限） */
export interface AuditLogViewer {
  id: string;
  /** 管理角色（admin/principal）可查看全部；其余只能看自己的 */
  isManager: boolean;
}

/** 是否管理角色（admin / principal 可看下属全部日志） */
export function isAuditLogManager(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'principal';
}

export const auditLogService = {
  /** 记录一条操作日志（append-only） */
  record: async (input: AuditLogInput): Promise<AuditLogEntry> => {
    if (!USE_MOCK) notWired('auditLog.record');
    return addAuditLog(input);
  },

  /**
   * 查询操作日志（只读、分页）
   * 可见范围：管理角色可查全部（也可传 operatorId 定向查某员工）；
   * 非管理角色强制只能查自己的日志（operatorId 被覆盖，防越权）。
   */
  query: async (viewer: AuditLogViewer, query?: AuditLogQuery): Promise<AuditLogPage> => {
    if (!USE_MOCK) notWired('auditLog.query');
    const safeQuery: AuditLogQuery = {
      ...query,
      // 非管理角色：无论传什么，只能看自己的操作日志
      operatorId: viewer.isManager ? query?.operatorId : viewer.id,
    };
    return queryAuditLogs(safeQuery);
  },
};
