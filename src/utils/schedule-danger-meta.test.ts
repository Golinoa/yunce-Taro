import { describe, expect, it } from 'vitest';
import {
  buildCancelLessonNotifyCopy,
  buildDangerActionMeta,
  buildDissolveClassNotifyContent,
  buildRestoreLessonConfirmContent,
  buildResumeClassConfirmContent,
  buildSuspendLessonConfirmContent,
  buildSuspendNotifyCopy,
  formatLessonChangeTime,
} from '@/utils/schedule-danger-meta';

describe('schedule-danger-meta (Q2-1)', () => {
  it('buildDangerActionMeta：cancel / batch-delete / delete', () => {
    expect(
      buildDangerActionMeta({
        type: 'batch-delete',
        lessonDate: '2026-09-02',
        batchCount: 3,
      }),
    ).toMatchObject({
      title: '删除提示',
      confirmText: '确认删除',
      tone: 'danger',
    });

    expect(
      buildDangerActionMeta({
        type: 'cancel',
        lessonDate: '2026-09-02',
        batchCount: 0,
        item: { className: '钢琴一班', startTime: '10:00', endTime: '11:00' },
      })?.description,
    ).toContain('钢琴一班');

    expect(
      buildDangerActionMeta({
        type: 'delete',
        lessonDate: '2026-09-02',
        batchCount: 0,
        item: { className: 'x', startTime: '10:00', endTime: '11:00' },
      })?.tone,
    ).toBe('danger');

    expect(
      buildDangerActionMeta({ type: null, lessonDate: '2026-09-02', batchCount: 0 }),
    ).toBeNull();
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
      buildSuspendLessonConfirmContent({
        className: 'A',
        lessonDate: '2026-09-02',
        startTime: '10:00',
        endTime: '11:00',
      }).title,
    ).toBe('停课确认');
    expect(buildResumeClassConfirmContent('A').confirmText).toBe('恢复上课');
    expect(buildSuspendNotifyCopy({ className: 'A', changeTime: 't' }).changeReason).toBe(
      '本节课临时停课',
    );
    expect(
      buildCancelLessonNotifyCopy({
        className: 'A',
        lessonDate: '2026-09-02',
        startTime: '10:00',
        endTime: '11:00',
      }).title,
    ).toBe('A已取消');
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
