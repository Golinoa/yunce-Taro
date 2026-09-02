import dayjs from 'dayjs';
import { describe, expect, it } from 'vitest';
import {
  ensureMinDurationEnd,
  formatMinutesToTime,
  getNextDateByDayOfWeek,
  MIN_DURATION_MINUTES,
  parseTimeToMinutes,
} from './time';

describe('schedule-form time helpers (Q2-3)', () => {
  it('parseTimeToMinutes / formatMinutesToTime', () => {
    expect(parseTimeToMinutes('09:30')).toBe(570);
    expect(formatMinutesToTime(570)).toBe('09:30');
    expect(formatMinutesToTime(-1)).toBe('00:00');
  });

  it('getNextDateByDayOfWeek 含当日与下周', () => {
    const wed = dayjs('2026-09-02'); // Wednesday = 3
    expect(getNextDateByDayOfWeek(3, wed).format('YYYY-MM-DD')).toBe('2026-09-02');
    expect(getNextDateByDayOfWeek(4, wed).format('YYYY-MM-DD')).toBe('2026-09-03');
    expect(getNextDateByDayOfWeek(2, wed).format('YYYY-MM-DD')).toBe('2026-09-08');
  });

  it('ensureMinDurationEnd 钳制最短时长', () => {
    expect(MIN_DURATION_MINUTES).toBe(30);
    expect(ensureMinDurationEnd('10:00', '10:45')).toBe('10:45');
    expect(ensureMinDurationEnd('10:00', '10:10')).toBe('10:30');
  });
});
