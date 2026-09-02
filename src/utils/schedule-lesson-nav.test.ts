import dayjs from 'dayjs';
import { describe, expect, it } from 'vitest';
import {
  buildBookingPagePath,
  buildCheckinLessonFormPath,
  buildLessonFormPath,
  buildOpenSlotRollCallPath,
  buildScheduleFormReschedulePath,
  buildSupplementLessonFormPath,
  buildViewOnlyLessonFormPath,
  resolveSchedulePrimaryActionKind,
  validateOpenSlotRollCallNav,
  validateRollCallNav,
  validateSupplementNav,
} from '@/utils/schedule-lesson-nav';

const NOW = dayjs('2026-09-02T10:00:00');

describe('schedule-lesson-nav (Q2-1)', () => {
  it('buildLessonFormPath 拼装 query', () => {
    expect(
      buildLessonFormPath({
        scheduleId: 's1',
        classId: 'c1',
        lessonDate: '2026-09-02',
        hasTrialStudent: true,
        action: 'supplement',
      }),
    ).toBe(
      '/package-course/pages/lesson-form/index?scheduleId=s1&classId=c1&lessonDate=2026-09-02&hasTrialStudent=1&action=supplement',
    );
    expect(
      buildLessonFormPath({
        classId: 'c1',
        lessonDate: '2026-09-02',
        lessonTime: '14:00',
        viewOnly: true,
      }),
    ).toBe(
      '/package-course/pages/lesson-form/index?classId=c1&lessonDate=2026-09-02&lessonTime=14%3A00&viewOnly=1',
    );
  });

  it('validateSupplementNav / RollCall', () => {
    expect(
      validateSupplementNav({ classId: 'c1', status: 'done' }, NOW.subtract(1, 'day'), NOW),
    ).toBeNull();
    expect(
      validateSupplementNav({ classId: '', status: 'done' }, NOW.subtract(1, 'day'), NOW),
    ).toBe('当前课程缺少班级信息');
    expect(
      validateSupplementNav({ classId: 'c1', status: 'cancelled' }, NOW.subtract(1, 'day'), NOW),
    ).toBe('已取消课程无法补录');
    expect(validateSupplementNav({ classId: 'c1', status: 'upcoming' }, NOW, NOW)).toBe(
      '未下课课程请先点名',
    );
    expect(
      validateSupplementNav({ classId: 'c1', status: 'done' }, NOW.subtract(40, 'day'), NOW),
    ).toBe('已超过 30 天补录期限');

    expect(validateRollCallNav({ status: 'cancelled' }, NOW, NOW)).toBe('已取消课程无法点名');
    expect(validateRollCallNav({ status: 'done' }, NOW.subtract(1, 'day'), NOW)).toBe(
      '历史课程请使用补录',
    );
    expect(validateRollCallNav({ status: 'upcoming' }, NOW, NOW)).toBeNull();
  });

  it('validateOpenSlotRollCallNav', () => {
    expect(validateOpenSlotRollCallNav({ status: 'rest', class_id: 'c1' })).toBe(
      '休息时段无法点名',
    );
    expect(validateOpenSlotRollCallNav({ status: 'open' })).toBe('当前时段缺少班级信息');
    expect(validateOpenSlotRollCallNav({ status: 'open', class_id: 'c1' })).toBeNull();
  });

  it('resolveSchedulePrimaryActionKind', () => {
    expect(
      resolveSchedulePrimaryActionKind({ bookingTag: '约', status: 'upcoming' }, NOW, NOW),
    ).toBe('booking');
    expect(resolveSchedulePrimaryActionKind({ status: 'done' }, NOW.subtract(1, 'day'), NOW)).toBe(
      'supplement',
    );
    expect(resolveSchedulePrimaryActionKind({ status: 'done' }, NOW.subtract(40, 'day'), NOW)).toBe(
      'view',
    );
    expect(resolveSchedulePrimaryActionKind({ status: 'upcoming' }, NOW, NOW)).toBe('checkin');
  });

  it('convenience builders', () => {
    const item = {
      id: 's1',
      classId: 'c1',
      status: 'done' as const,
      hasTrialStudent: true,
    };
    expect(buildSupplementLessonFormPath(item, NOW)).toContain('action=supplement');
    expect(buildViewOnlyLessonFormPath(item, NOW)).toContain('viewOnly=1');
    expect(buildCheckinLessonFormPath({ ...item, status: 'upcoming' }, NOW)).not.toContain(
      'action=',
    );
    expect(
      buildOpenSlotRollCallPath({
        class_id: 'c1',
        lesson_date: '2026-09-02',
        start_time: '09:00',
        opened_schedule_id: 'sch',
      }),
    ).toContain('scheduleId=sch');
    expect(buildScheduleFormReschedulePath('s1', '2026-09-02')).toContain('mode=reschedule');
    expect(buildBookingPagePath('2026-09-02')).toContain('/booking/index?date=');
  });
});
