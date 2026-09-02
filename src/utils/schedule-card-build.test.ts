import dayjs from 'dayjs';
import { describe, expect, it } from 'vitest';
import {
  buildScheduleCardsForDate,
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
      trialBookingKeys: new Set(['c3|2026-09-02']),
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
