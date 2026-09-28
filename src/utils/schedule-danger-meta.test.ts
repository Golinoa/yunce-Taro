/**
 * 课表危险操作文案测试（Q2-1）
 *
 * 2026-09-28 收口：`cancel` / `delete` / `pause-rule` / `resume-rule` / `stop-rule` 与其文案
 * 已随课表卡片左滑一并移除，现存唯一入口是批量「解散班级」。
 */
import { describe, expect, it } from 'vitest';
import {
  buildDangerActionMeta,
  buildDissolveClassNotifyContent,
  buildRestoreLessonConfirmContent,
  buildResumeClassConfirmContent,
  buildSuspendNotifyCopy,
  buildSuspendOpenSlotConfirmContent,
  formatLessonChangeTime,
} from '@/utils/schedule-danger-meta';

describe('schedule-danger-meta (Q2-1)', () => {
  it('buildDangerActionMeta：仅剩批量解散班级', () => {
    expect(buildDangerActionMeta({ type: 'batch-delete', batchCount: 3 })).toMatchObject({
      title: '删除提示',
      confirmText: '确认删除',
      tone: 'danger',
    });
    expect(buildDangerActionMeta({ type: null, batchCount: 0 })).toBeNull();
  });

  it('confirm / notify copy builders', () => {
    expect(
      buildRestoreLessonConfirmContent({
        className: 'A',
        lessonDate: '2026-09-02',
        startTime: '10:00',
        endTime: '11:00',
      }).confirmText,
    ).toBe('恢复');
    expect(
      buildSuspendOpenSlotConfirmContent({
        displayName: 'A',
        changeTime: '2026-09-02 10:00-11:00',
      }).title,
    ).toBe('停课确认');
    expect(buildResumeClassConfirmContent('A').confirmText).toBe('恢复上课');
    expect(buildSuspendNotifyCopy({ className: 'A', changeTime: 't' }).changeReason).toBe(
      '本节课临时停课',
    );
    expect(buildDissolveClassNotifyContent('班').title).toBe('班级解散通知');
    expect(
      formatLessonChangeTime({
        lessonDate: '2026-09-02',
        startTime: '10:00',
        endTime: '11:00',
      }),
    ).toBe('2026-09-02 10:00-11:00');
  });
});
