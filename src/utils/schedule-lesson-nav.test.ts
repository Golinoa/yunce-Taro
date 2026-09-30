import dayjs from 'dayjs';
import { describe, expect, it } from 'vitest';
import {
  buildBatchRescheduleSelectPath,
  buildBookingPagePath,
  buildCheckinLessonFormPath,
  buildLessonFormPath,
  buildOpenSlotRollCallPath,
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
    expect(buildBookingPagePath('2026-09-02')).toContain('/booking/index?date=');
  });

  it('带上「本节课」的排课时间（改排课规则后详情页时间跟着变）', () => {
    const item = {
      id: 's1',
      classId: 'c1',
      status: 'upcoming' as const,
      startTime: '14:00',
      endTime: '15:00',
    };
    // 关键回归点：详情页此前优先用班级时间（班级时间是默认值，一个班有多节课且时间不同），
    // 导致改排课规则后详情页时间不变。必须把本节排课时间带过去。
    expect(buildCheckinLessonFormPath(item, NOW)).toContain('lessonTime=14%3A00-15%3A00');
    expect(buildSupplementLessonFormPath(item, NOW)).toContain('lessonTime=14%3A00-15%3A00');
    expect(buildViewOnlyLessonFormPath(item, NOW)).toContain('lessonTime=14%3A00-15%3A00');
  });

  it('排课时间缺一端时不拼 lessonTime（交详情页按班级时间兜底）', () => {
    const item = { id: 's1', classId: 'c1', status: 'upcoming' as const, startTime: '14:00' };
    expect(buildCheckinLessonFormPath(item, NOW)).not.toContain('lessonTime=');
    expect(buildCheckinLessonFormPath({ ...item, startTime: '' }, NOW)).not.toContain(
      'lessonTime=',
    );
  });

  it('批量调课入口：带源日期与预选班级（点名页与卡片共用）', () => {
    const url = buildBatchRescheduleSelectPath('2026-09-28', 'cls-1');
    expect(url).toContain('/package-course/pages/batch-reschedule-select/index');
    expect(url).toContain('date=2026-09-28');
    expect(url).toContain('classId=cls-1');
  });

  it('节假日停课：holidaySuspended 随卡片带入详情页（三个入口一致）', () => {
    const item = {
      id: 's1',
      classId: 'c1',
      status: 'upcoming' as const,
      holidaySuspended: true,
    };
    // 与课表卡片「放假停课」角标同源：点名/补录/仅查看三条路都必须带过去，
    // 详情页据此挂「放假停课」态并把停课按钮换成「恢复」。
    expect(buildCheckinLessonFormPath(item, NOW)).toContain('holidaySuspended=1');
    expect(buildSupplementLessonFormPath(item, NOW)).toContain('holidaySuspended=1');
    expect(buildViewOnlyLessonFormPath(item, NOW)).toContain('holidaySuspended=1');
    // 未停课的课不带该参数，详情页不误挂停课态
    expect(buildCheckinLessonFormPath({ ...item, holidaySuspended: undefined }, NOW)).not.toContain(
      'holidaySuspended=',
    );
  });
});
