/**
 * 「哪一节」选节次判定单测
 *
 * 钉住的是块 4 的底线：
 * - 该班当天 **≥2 节且没选** ⇒ 必须拦提交（否则记录会落成"没有节次"，多节互相串）
 * - 该班当天只有 **1 节** ⇒ 自动带，不打扰老师
 * - 拿不到课次（0 节 / 不是本人排的课）⇒ 退回"不区分"的老行为，**不能吞记录**
 */
import { describe, expect, it } from 'vitest';
import type { ScheduleDayLesson } from '@/services/schedule';
import { resolveLessonSelection } from './class-day-lesson-logic';

const less = (scheduleId: string, startTime: string, endTime: string): ScheduleDayLesson => ({
  scheduleId,
  classId: 'c1',
  className: '钢琴班',
  startTime,
  endTime,
  checkedCount: 0,
  totalCount: 0,
});

const L9 = less('s1', '09:00', '10:00');
const L14 = less('s2', '14:00', '15:00');
const L11 = less('s3', '11:00', '12:00');

describe('resolveLessonSelection', () => {
  it('URL 已经带了排课编号（卡片入口）⇒ 直接用，不需要选', () => {
    const r = resolveLessonSelection({
      scheduleIdParam: 's9',
      pickedScheduleId: '',
      classLessons: [L9, L14],
      needLookup: false,
    });
    expect(r.effectiveScheduleId).toBe('s9');
    expect(r.needsPick).toBe(false);
    // 时段沿用 URL 的 lessonTime，不由这里给
    expect(r.effectiveLessonTime).toBe('');
  });

  it('当天只有 1 节 ⇒ 自动带，不打扰老师', () => {
    const r = resolveLessonSelection({
      scheduleIdParam: '',
      pickedScheduleId: '',
      classLessons: [L14],
      needLookup: true,
    });
    expect(r.effectiveScheduleId).toBe('s2');
    expect(r.effectiveLessonTime).toBe('14:00-15:00');
    expect(r.needsPick).toBe(false);
  });

  it('当天 ≥2 节且未选 ⇒ 必须拦提交', () => {
    const r = resolveLessonSelection({
      scheduleIdParam: '',
      pickedScheduleId: '',
      classLessons: [L9, L14],
      needLookup: true,
    });
    expect(r.needsPick).toBe(true);
    expect(r.effectiveScheduleId).toBe('');
    expect(r.effectiveLessonTime).toBe('');
  });

  it('当天 ≥2 节且已手选 ⇒ 用选中的那一节（时段也跟着它）', () => {
    const r = resolveLessonSelection({
      scheduleIdParam: '',
      pickedScheduleId: 's2',
      classLessons: [L9, L14],
      needLookup: true,
    });
    expect(r.needsPick).toBe(false);
    expect(r.effectiveScheduleId).toBe('s2');
    expect(r.effectiveLessonTime).toBe('14:00-15:00');
  });

  it('当天 0 节（不是本人排的课 / 跨校区）⇒ 退回不区分，不拦提交', () => {
    const r = resolveLessonSelection({
      scheduleIdParam: '',
      pickedScheduleId: '',
      classLessons: [],
      needLookup: true,
    });
    expect(r.effectiveScheduleId).toBe('');
    expect(r.effectiveLessonTime).toBe('');
    expect(r.needsPick).toBe(false);
  });

  it('不需要补节次（单人消课）⇒ 即使有课次也不拦', () => {
    const r = resolveLessonSelection({
      scheduleIdParam: '',
      pickedScheduleId: '',
      classLessons: [L9, L14],
      needLookup: false,
    });
    expect(r.needsPick).toBe(false);
    expect(r.effectiveScheduleId).toBe('');
  });

  it('三节课时选了中间那节，只认选中那节（不会误带别的）', () => {
    const r = resolveLessonSelection({
      scheduleIdParam: '',
      pickedScheduleId: 's3',
      classLessons: [L9, L11, L14],
      needLookup: true,
    });
    expect(r.effectiveScheduleId).toBe('s3');
    expect(r.effectiveLessonTime).toBe('11:00-12:00');
  });
});
