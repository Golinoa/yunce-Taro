/**
 * 排课表单时间工具（Q2-3，从 schedule-form 抽出）
 */
import dayjs from 'dayjs';
import type { DayOfWeek } from '@/types/schedule';
import { parseTimeToMinutes } from '@/utils/schedule-guard';

export { parseTimeToMinutes };

/** 单节最短时长（分钟） */
export const MIN_DURATION_MINUTES = 30;

/** 从基准日起推下一个（含当日）指定星期 */
export function getNextDateByDayOfWeek(dayOfWeek: DayOfWeek, baseDate = dayjs()): dayjs.Dayjs {
  const currentDate = baseDate.startOf('day');
  const currentWeekday = (currentDate.day() || 7) as DayOfWeek;
  const diff = dayOfWeek - currentWeekday;
  return currentDate.add(diff >= 0 ? diff : diff + 7, 'day');
}

/** 分钟数 → HH:mm（钳制在当日 0..1439） */
export function formatMinutesToTime(m: number): string {
  const s = Math.max(0, Math.min(24 * 60 - 1, m));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** 保证 end 至少比 start 晚 MIN_DURATION_MINUTES */
export function ensureMinDurationEnd(start: string, end: string): string {
  if (parseTimeToMinutes(end) - parseTimeToMinutes(start) >= MIN_DURATION_MINUTES) {
    return end;
  }
  return formatMinutesToTime(parseTimeToMinutes(start) + MIN_DURATION_MINUTES);
}
