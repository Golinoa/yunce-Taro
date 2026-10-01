import dayjs from 'dayjs';
import { describe, expect, it } from 'vitest';
import { buildVisibleSchedulesForDate } from '@/utils/visible-schedules';

/** 2026-10-01 与 2026-10-08 都是周四（day_of_week=4） */
const THU = 4;

const baseRule = {
  id: 's1',
  day_of_week: THU,
  start_time: '14:00',
  end_time: '15:00',
  class_id: 'c1',
  teacher_id: 't1',
  created_at: '',
  updated_at: '',
};

describe('buildVisibleSchedulesForDate（当天可见课次）', () => {
  it('已删除/停止的规则：停止日及更早可见，之后不可见（与课表卡片同口径）', () => {
    const stopped = {
      ...baseRule,
      rule_status: 'STOPPED' as const,
      stopped_at: '2026-10-01T09:30:00.000Z',
    };

    expect(
      buildVisibleSchedulesForDate({
        date: dayjs('2026-09-24'),
        schedules: [stopped] as never[],
        temporaryReschedules: [],
      }).map((item) => item.id),
    ).toEqual(['s1']);

    expect(
      buildVisibleSchedulesForDate({
        date: dayjs('2026-10-08'),
        schedules: [stopped] as never[],
        temporaryReschedules: [],
      }),
    ).toEqual([]);
  });

  it('ACTIVE 规则不受影响', () => {
    const active = { ...baseRule, rule_status: 'ACTIVE' as const };
    expect(
      buildVisibleSchedulesForDate({
        date: dayjs('2026-10-08'),
        schedules: [active] as never[],
        temporaryReschedules: [],
      }).map((item) => item.id),
    ).toEqual(['s1']);
  });
});
