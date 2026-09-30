/**
 * 课节身份口径单测（唯一真源：`@/utils/lesson-identity`）
 *
 * ⚠️ 这批用例与后端 `yunce-back/yunce-backend/src/utils/__tests__/lesson-identity.test.ts`
 * **逐字一致**（同一份口径的两端）。改口径必须同时改两边，否则口径会漂。
 */
import { describe, expect, it } from 'vitest';
import {
  isBookingOfLesson,
  isRecordOfLesson,
  isSameLessonOwner,
  isSameLessonSchedule,
  isSameLessonStartTime,
  normalizeLessonDate,
  normalizeLessonStartTime,
  parseLessonStartTime,
  type LessonBookingIdentityLike,
  type LessonRecordIdentityLike,
  type LessonScopeTarget,
} from '@/utils/lesson-identity';

const DATE = '2026-10-05';
const S1 = 'sched-0900';
const S2 = 'sched-1400';
const C1 = 'class-1';

describe('normalize 归一', () => {
  it('normalizeLessonDate 兼容 Date 与 datetime', () => {
    expect(normalizeLessonDate('2026-10-05')).toBe('2026-10-05');
    expect(normalizeLessonDate('2026-10-05T00:00:00.000Z')).toBe('2026-10-05');
    expect(normalizeLessonDate(null)).toBe('');
  });

  it('normalizeLessonStartTime 兼容 09:00:00 与 09:00', () => {
    expect(normalizeLessonStartTime('09:00:00')).toBe('09:00');
    expect(normalizeLessonStartTime('09:00')).toBe('09:00');
    expect(normalizeLessonStartTime(undefined)).toBe('');
  });

  it('parseLessonStartTime 取开始时段', () => {
    expect(parseLessonStartTime('14:00-15:30')).toBe('14:00');
    expect(parseLessonStartTime('')).toBe('');
  });
});

describe('isSameLessonSchedule 只比排课编号，任一侧缺失即不区分', () => {
  it.each([
    ['目标缺失 → 不区分', undefined, S1, true],
    ['记录缺失 → 不区分', S1, undefined, true],
    ['两边都缺失 → 不区分', undefined, undefined, true],
    ['编号相同 → 同一节', S1, S1, true],
    ['编号不同 → 不同节', S1, S2, false],
  ])('%s', (_name, itemId, targetId, expected) => {
    expect(isSameLessonSchedule(itemId, targetId)).toBe(expected);
  });
});

describe('isRecordOfLesson 记录侧（没有时段列 ⇒ 缺编号就"不区分"）', () => {
  const base: LessonRecordIdentityLike = { class_id: C1, lesson_date: DATE, schedule_id: S1 };

  it.each([
    ['两边都有编号且相同 → 属于', base, { classId: C1, lessonDate: DATE, scheduleId: S1 }, true],
    ['两边都有编号但不同 → 不属于', base, { classId: C1, lessonDate: DATE, scheduleId: S2 }, false],
    [
      '目标有编号、记录没有 → 不区分（不能吞记录）',
      { ...base, schedule_id: null },
      { classId: C1, lessonDate: DATE, scheduleId: S1 },
      true,
    ],
    [
      '目标无编号（班级列表入口）、记录有 → 不区分',
      base,
      { classId: C1, lessonDate: DATE, scheduleId: null },
      true,
    ],
    ['班级不同 → 不属于', base, { classId: 'class-2', lessonDate: DATE, scheduleId: S1 }, false],
    ['日期不同 → 不属于', base, { classId: C1, lessonDate: '2026-10-06', scheduleId: S1 }, false],
  ])('%s', (_name, record, target, expected) => {
    expect(isRecordOfLesson(record, target as LessonScopeTarget)).toBe(expected);
  });

  it('私教按 studentId 归属', () => {
    const record: LessonRecordIdentityLike = {
      class_id: null,
      student_id: 'stu-1',
      lesson_date: DATE,
      schedule_id: S1,
    };
    expect(isRecordOfLesson(record, { studentId: 'stu-1', lessonDate: DATE, scheduleId: S1 })).toBe(
      true,
    );
    expect(isRecordOfLesson(record, { studentId: 'stu-2', lessonDate: DATE, scheduleId: S1 })).toBe(
      false,
    );
  });

  it('两边都没有归属 → 不属于（不相干的数据不能互命中）', () => {
    expect(
      isRecordOfLesson({ class_id: null, lesson_date: DATE }, { lessonDate: DATE, scheduleId: S1 }),
    ).toBe(false);
  });
});

describe('isBookingOfLesson 预约侧（编号优先，时段兜底）', () => {
  const booking: LessonBookingIdentityLike = {
    class_id: C1,
    lesson_date: DATE,
    schedule_id: S1,
    start_time: '09:00',
  };

  it.each([
    [
      '编号相同 → 属于（即使时段不同：同日调课后仍要认得）',
      booking,
      { classId: C1, lessonDate: DATE, scheduleId: S1, startTime: '11:00' },
      true,
    ],
    [
      '编号不同 → 不属于（同班同天另一节，不串）',
      booking,
      { classId: C1, lessonDate: DATE, scheduleId: S2, startTime: '14:00' },
      false,
    ],
    [
      '目标有编号、预约无编号 → 回落时段；时段相同 → 属于',
      { ...booking, schedule_id: null },
      { classId: C1, lessonDate: DATE, scheduleId: S1, startTime: '09:00' },
      true,
    ],
    [
      '目标有编号、预约无编号 → 回落时段；时段不同 → 不属于',
      { ...booking, schedule_id: null },
      { classId: C1, lessonDate: DATE, scheduleId: S1, startTime: '11:00' },
      false,
    ],
    [
      '目标无编号（班级列表入口）→ 回落时段；时段相同 → 属于',
      booking,
      { classId: C1, lessonDate: DATE, scheduleId: null, startTime: '09:00' },
      true,
    ],
    [
      '编号不同但时段相同（同日调课撞时段）→ 仍不属于：编号优先于时段',
      booking,
      { classId: C1, lessonDate: DATE, scheduleId: S2, startTime: '09:00' },
      false,
    ],
    [
      '都无编号 + 目标无时段 → 不区分（宁可多显示，不能吞学员）',
      { ...booking, schedule_id: null },
      { classId: C1, lessonDate: DATE, scheduleId: null, startTime: null },
      true,
    ],
    [
      '都无编号 + 预约无时段（老数据）→ 不区分',
      { ...booking, schedule_id: null, start_time: null },
      { classId: C1, lessonDate: DATE, scheduleId: null, startTime: '14:00' },
      true,
    ],
    [
      '班级不同 → 不属于',
      booking,
      { classId: 'class-2', lessonDate: DATE, scheduleId: S1, startTime: '09:00' },
      false,
    ],
    [
      '日期不同 → 不属于',
      booking,
      { classId: C1, lessonDate: '2026-10-06', scheduleId: S1, startTime: '09:00' },
      false,
    ],
  ])('%s', (_name, bk, target, expected) => {
    expect(isBookingOfLesson(bk, target as LessonScopeTarget)).toBe(expected);
  });
});

describe('isSameLessonOwner 归属对象', () => {
  it('班课比 classId；私教比 studentId', () => {
    expect(isSameLessonOwner({ classId: C1 }, { class_id: C1 })).toBe(true);
    expect(isSameLessonOwner({ classId: C1 }, { class_id: 'class-2' })).toBe(false);
    expect(isSameLessonOwner({ studentId: 'stu-1' }, { student_id: 'stu-1' })).toBe(true);
    expect(isSameLessonOwner({}, { class_id: C1 })).toBe(false);
  });
});

describe('isSameLessonStartTime 旧口径（只比时段，迁移期保留）', () => {
  it.each([
    ['目标无时段 → 不过滤', '09:00', null, true],
    ['时段相同 → 属于', '09:00', '09:00', true],
    ['时段不同 → 不属于', '09:00', '11:00', false],
    ['预约无时段 → 不属于', null, '09:00', false],
  ])('%s', (_name, bk, target, expected) => {
    expect(isSameLessonStartTime(bk, target)).toBe(expected);
  });
});
