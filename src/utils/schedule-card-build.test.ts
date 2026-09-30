import dayjs from 'dayjs';
import { describe, expect, it } from 'vitest';
import {
  buildScheduleCardsForDate,
  buildTrialLessonKey,
  hasTrialBookingForLesson,
  summarizeScheduleCards,
} from '@/utils/schedule-card-build';

const NOW = dayjs('2026-09-02T09:00:00');

describe('schedule-card-build (Q2-1)', () => {
  it('按星期与调课移动构建卡片，并按状态排序', () => {
    const cards = buildScheduleCardsForDate({
      date: NOW,
      now: NOW,
      filteredSchedules: [
        {
          id: 's1',
          day_of_week: 3,
          start_time: '14:00',
          end_time: '15:00',
          class_id: 'c1',
          teacher_id: 't1',
          created_at: '',
          updated_at: '',
        },
        {
          id: 's2',
          day_of_week: 2,
          start_time: '10:00',
          end_time: '11:00',
          class_id: 'c2',
          teacher_id: 't1',
          created_at: '',
          updated_at: '',
        },
      ] as never[],
      scheduleById: {
        s3: {
          id: 's3',
          day_of_week: 1,
          start_time: '08:00',
          end_time: '09:00',
          class_id: 'c3',
          teacher_id: 't1',
          created_at: '',
          updated_at: '',
          note: '调入',
        },
      } as never,
      temporaryReschedules: [
        {
          schedule_id: 's1',
          source_date: '2026-09-02',
          target_date: '2026-09-03',
          start_time: '14:00',
          end_time: '15:00',
          class_id: 'c1',
          updated_at: '',
        },
        {
          schedule_id: 's3',
          source_date: '2026-09-01',
          target_date: '2026-09-02',
          start_time: '16:00',
          end_time: '17:00',
          class_id: 'c3',
          updated_at: '',
        },
      ] as never[],
      lessonRecords: [],
      selectedClassId: '',
      classById: {
        c3: {
          id: 'c3',
          name: '调入班',
          teacher_id: 't1',
          created_at: '',
          updated_at: '',
          type: 'limited',
          status: 'active',
          used_lessons: 0,
          color: 'primary',
          student_count: 2,
        },
      } as never,
      teacherById: {},
      classStudentAvatars: {},
      trialBookingKeys: new Set([buildTrialLessonKey('c3', '2026-09-02', '16:00')]),
      currentTeacherName: '老师',
    });

    expect(cards.map((c) => c.id)).toEqual(['s3']);
    expect(cards[0]?.startTime).toBe('16:00');
    expect(cards[0]?.isTemporaryAdjusted).toBe(true);
    expect(cards[0]?.hasTrialStudent).toBe(true);
    expect(cards[0]?.className).toBe('调入班');
  });

  it('summarizeScheduleCards', () => {
    expect(
      summarizeScheduleCards([
        { checkedCount: 1 } as never,
        { checkedCount: 0 } as never,
        { checkedCount: 2 } as never,
      ]),
    ).toEqual({ total: 3, checked: 2, unchecked: 1 });
  });
});

describe('试听角标只作用于「那一节课」', () => {
  it('同班同一天多节课：只标记被预约的时段', () => {
    const keys = [buildTrialLessonKey('c1', '2026-10-05', '09:00')];
    expect(hasTrialBookingForLesson(new Set(keys), 'c1', '2026-10-05', '09:00')).toBe(true);
    // 同一天 14:00 那节课不能因为 09:00 有预约就被标成试听
    expect(hasTrialBookingForLesson(new Set(keys), 'c1', '2026-10-05', '14:00')).toBe(false);
    // 别的日期当然不标
    expect(hasTrialBookingForLesson(new Set(keys), 'c1', '2026-10-12', '09:00')).toBe(false);
    // 别的班级不标
    expect(hasTrialBookingForLesson(new Set(keys), 'c2', '2026-10-05', '09:00')).toBe(false);
  });

  it('时段写法差异（09:00:00 / 09:00）视为同一节', () => {
    const keys = [buildTrialLessonKey('c1', '2026-10-05', '09:00:00')];
    expect(hasTrialBookingForLesson(new Set(keys), 'c1', '2026-10-05', '09:00')).toBe(true);
  });

  it('历史预约缺时段时按整日兜底，不掉角标', () => {
    const keys = [buildTrialLessonKey('c1', '2026-10-05', '')];
    expect(hasTrialBookingForLesson(new Set(keys), 'c1', '2026-10-05', '14:00')).toBe(true);
  });
});
