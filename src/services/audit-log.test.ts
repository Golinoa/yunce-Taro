/**
 * 操作日志 Service — 真 API 契约（GET /audit-logs）
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getMock = vi.fn();

vi.mock('@/utils/request', () => ({
  get: (...args: unknown[]) => getMock(...args),
  post: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
}));

describe('auditLogService 可见范围', () => {
  beforeEach(() => {
    vi.resetModules();
    getMock.mockReset();
  });

  it('管理角色查询不强制覆盖 operatorId', async () => {
    getMock.mockResolvedValueOnce({
      list: [
        {
          id: '1',
          action: 'card.issue',
          userId: 'u-teacher',
          userName: '李老师',
          userRole: 'teacher',
          detail: '会员开卡',
          createdAt: '2026-08-31T00:00:00.000Z',
        },
      ],
      pagination: { page: 1, pageSize: 20, total: 1 },
    });
    const { auditLogService } = await import('@/services/audit-log');
    const res = await auditLogService.query(
      { id: 'u-admin', isManager: true },
      { operatorId: 'u-teacher' },
    );
    expect(getMock).toHaveBeenCalledWith(
      '/audit-logs',
      expect.objectContaining({ userId: 'u-teacher' }),
    );
    expect(res.total).toBe(1);
    expect(res.list[0].operatorName).toBe('李老师');
  });

  it('非管理角色强制用 viewer.id 作为 userId', async () => {
    getMock.mockResolvedValueOnce({
      list: [],
      pagination: { page: 1, pageSize: 20, total: 0 },
    });
    const { auditLogService } = await import('@/services/audit-log');
    await auditLogService.query({ id: 'u-teacher', isManager: false }, { operatorId: 'u-admin' });
    expect(getMock).toHaveBeenCalledWith(
      '/audit-logs',
      expect.objectContaining({ userId: 'u-teacher' }),
    );
  });

  it('isAuditLogManager 判定：admin/principal 为管理角色', async () => {
    const { isAuditLogManager } = await import('@/services/audit-log');
    expect(isAuditLogManager('admin')).toBe(true);
    expect(isAuditLogManager('principal')).toBe(true);
    expect(isAuditLogManager('teacher')).toBe(false);
    expect(isAuditLogManager('assistant')).toBe(false);
    expect(isAuditLogManager('parent')).toBe(false);
  });

  it('record 返回本地合成条目（后端暂无写入）', async () => {
    const { auditLogService } = await import('@/services/audit-log');
    const entry = await auditLogService.record({
      action: 'lesson.edit_hours',
      operatorId: 'u-admin',
      operatorName: '万老师',
      operatorRole: 'admin',
      targetType: 'lesson_record',
      detail: '编辑课时',
    });
    expect(entry.operatorId).toBe('u-admin');
    expect(entry.id).toMatch(/^local-audit-/);
  });
});
