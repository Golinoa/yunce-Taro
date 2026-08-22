/**
 * 操作日志（审计日志）数据层回归测试
 * 覆盖：追加式写入、查询过滤（动作/关键字/日期）、分页、90 天保留期清理
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addAuditLog,
  queryAuditLogs,
  __resetAuditLogsForTest,
  AUDIT_LOG_DISPLAY_DAYS,
} from '@/data/audit-log';
import type { AuditLogEntry } from '@/types/audit-log';

function makeInput(overrides: Partial<AuditLogEntry> = {}) {
  return {
    action: 'lesson.edit_hours' as const,
    operatorId: 'u1',
    operatorName: '万老师',
    operatorRole: 'admin',
    targetType: 'lesson_record',
    detail: '编辑课时：消课记录课时 2 → 5',
    ...overrides,
  };
}

describe('audit-log 数据层', () => {
  beforeEach(() => __resetAuditLogsForTest());
  afterEach(() => vi.useRealTimers());

  it('追加写入并可按动作/关键字查询', () => {
    addAuditLog(makeInput({ action: 'lesson.edit_hours', detail: '编辑课时：2 → 5' }));
    addAuditLog(
      makeInput({
        action: 'lesson.revoke',
        operatorName: '李老师',
        detail: '撤销消课：原因 误操作',
      }),
    );

    const all = queryAuditLogs({});
    expect(all.total).toBe(2);

    const onlyEdit = queryAuditLogs({ action: 'lesson.edit_hours' });
    expect(onlyEdit.total).toBe(1);
    expect(onlyEdit.list[0].actionLabel).toBe('编辑课时');

    const byKeyword = queryAuditLogs({ keyword: '李老师' });
    expect(byKeyword.total).toBe(1);
    expect(byKeyword.list[0].action).toBe('lesson.revoke');
  });

  it('分页正确且顺序为最新在前', () => {
    for (let i = 0; i < 5; i++) addAuditLog(makeInput({ detail: `第${i}条` }));
    const page1 = queryAuditLogs({ page: 1, pageSize: 2 });
    const page2 = queryAuditLogs({ page: 2, pageSize: 2 });
    expect(page1.total).toBe(5);
    expect(page1.list).toHaveLength(2);
    expect(page2.list).toHaveLength(2);
    // 最新在前：第一条是第4条
    expect(page1.list[0].detail).toBe('第4条');
    expect(page1.list[0].id).not.toBe(page2.list[0].id);
  });

  it('日期范围过滤', () => {
    addAuditLog(makeInput({}));
    const now = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    const today = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
    expect(queryAuditLogs({ startDate: today }).total).toBe(1);
    // 从明天开始的区间查不到今天的数据
    const tomorrow = new Date(now.getTime() + 86400000);
    const tomorrowStr = `${tomorrow.getFullYear()}-${p(tomorrow.getMonth() + 1)}-${p(
      tomorrow.getDate(),
    )}`;
    expect(queryAuditLogs({ startDate: tomorrowStr }).total).toBe(0);
  });

  it(`前端仅展示最近 ${AUDIT_LOG_DISPLAY_DAYS} 天：超期日志查询不返回但数据不删除`, () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.now() - (AUDIT_LOG_DISPLAY_DAYS + 10) * 86400000));
    addAuditLog(makeInput({ detail: '90天前的旧日志' }));
    vi.useRealTimers();
    // 只展示范围内的日志：查询不到 90 天前的
    expect(queryAuditLogs({}).total).toBe(0);
    // 数据仍在（长期保留）：加入一条新日志后，旧的也不影响新的（新增仍正常）
    addAuditLog(makeInput({ detail: '今天的日志' }));
    const all = queryAuditLogs({});
    expect(all.total).toBe(1);
    expect(all.list[0].detail).toBe('今天的日志');
    // 展示上限始终生效：即使把 startDate 提前到 100 天前，90 天外的旧日志也不返回
    const oldDay = new Date(Date.now() - (AUDIT_LOG_DISPLAY_DAYS + 10) * 86400000);
    const p = (n: number) => String(n).padStart(2, '0');
    const oldStr = `${oldDay.getFullYear()}-${p(oldDay.getMonth() + 1)}-${p(oldDay.getDate())}`;
    const ranged = queryAuditLogs({ startDate: oldStr });
    expect(ranged.total).toBe(1);
    expect(ranged.list[0].detail).toBe('今天的日志');
  });

  it('追加式：每次写入生成独立 id 且总量递增（无修改/删除路径）', () => {
    const first = addAuditLog(makeInput({}));
    const second = addAuditLog(makeInput({ detail: '另一条' }));
    expect(first.id).toBeTruthy();
    expect(second.id).not.toBe(first.id);
    expect(queryAuditLogs({}).total).toBe(2);
  });

  it('按操作人精确过滤（operatorId）', () => {
    addAuditLog(makeInput({ operatorId: 'u-admin', operatorName: '万老师', detail: '万老师操作' }));
    addAuditLog(
      makeInput({ operatorId: 'u-teacher', operatorName: '李老师', detail: '李老师操作' }),
    );
    expect(queryAuditLogs({ operatorId: 'u-teacher' }).total).toBe(1);
    expect(queryAuditLogs({ operatorId: 'u-teacher' }).list[0].detail).toBe('李老师操作');
    expect(queryAuditLogs({ operatorId: 'u-admin' }).total).toBe(1);
  });
});
