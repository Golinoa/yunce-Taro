/**
 * 操作日志 Service 层可见范围测试
 * 覆盖用户口径（2026-08-22）：
 * - 每个人只能看到自己的操作日志
 * - 管理者（admin/principal）可查看下属（全部）员工的日志
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { __resetAuditLogsForTest } from '@/data/audit-log';
import { auditLogService, isAuditLogManager } from '@/services/audit-log';
import type { AuditLogEntry } from '@/types/audit-log';

function makeInput(overrides: Partial<AuditLogEntry> = {}) {
  return {
    action: 'lesson.edit_hours' as const,
    operatorId: 'u-admin',
    operatorName: '万老师',
    operatorRole: 'admin',
    targetType: 'lesson_record',
    detail: '编辑课时：2 → 5',
    ...overrides,
  };
}

async function seed() {
  await auditLogService.record(makeInput({ operatorId: 'u-admin', operatorName: '万老师' }));
  await auditLogService.record(
    makeInput({
      action: 'card.issue',
      operatorId: 'u-teacher',
      operatorName: '李老师',
      operatorRole: 'teacher',
      detail: '会员开卡',
    }),
  );
}

describe('auditLogService 可见范围', () => {
  beforeEach(() => __resetAuditLogsForTest());

  it('管理角色（admin/principal）可查看全部员工日志', async () => {
    await seed();
    const res = await auditLogService.query({ id: 'u-admin', isManager: true });
    expect(res.total).toBe(2);
  });

  it('管理角色可定向查看某员工的日志', async () => {
    await seed();
    const res = await auditLogService.query(
      { id: 'u-admin', isManager: true },
      { operatorId: 'u-teacher' },
    );
    expect(res.total).toBe(1);
    expect(res.list[0].operatorName).toBe('李老师');
  });

  it('非管理角色只能看到自己的日志（传入他人 operatorId 也被强制覆盖）', async () => {
    await seed();
    // 即使恶意传 operatorId=u-admin，也只能查到自己的
    const res = await auditLogService.query(
      { id: 'u-teacher', isManager: false },
      { operatorId: 'u-admin' },
    );
    expect(res.total).toBe(1);
    expect(res.list[0].operatorName).toBe('李老师');
  });

  it('isAuditLogManager 判定：admin/principal 为管理角色', () => {
    expect(isAuditLogManager('admin')).toBe(true);
    expect(isAuditLogManager('principal')).toBe(true);
    expect(isAuditLogManager('teacher')).toBe(false);
    expect(isAuditLogManager('assistant')).toBe(false);
    expect(isAuditLogManager('parent')).toBe(false);
  });
});
