/**
 * 课表加载纯逻辑（供 use-schedule-loaders 与单测共用）
 * 使用场景：开放时段缓存跳过、月度区间、试听 key、开放班过滤——无 React / 无 IO。
 */
import type { Class } from '@/types/class';
import type { Dayjs } from 'dayjs';

/** 过滤开放预约班级。 */
export function filterOpenClasses(classes: Class[]): Class[] {
  return classes.filter((item) => item.schedule_mode === 'open');
}

export interface ShouldSkipOpenSlotLoadParams {
  viewMode: 'schedule' | 'booking';
  scheduleSubMode: 'fixed' | 'open';
  dateStr: string;
  force: boolean;
  loadingDates: Set<string>;
  cachedDates: Record<string, unknown>;
  errorDates: Set<string>;
}

/**
 * 是否跳过开放时段请求：非 open 视图 / 加载中 / 已缓存且非错误且非 force。
 */
export function shouldSkipOpenSlotLoad(params: ShouldSkipOpenSlotLoadParams): boolean {
  const { viewMode, scheduleSubMode, dateStr, force, loadingDates, cachedDates, errorDates } =
    params;
  if (viewMode !== 'schedule' || scheduleSubMode !== 'open') {
    return true;
  }
  if (loadingDates.has(dateStr)) {
    return true;
  }
  if (
    !force &&
    Object.prototype.hasOwnProperty.call(cachedDates, dateStr) &&
    !errorDates.has(dateStr)
  ) {
    return true;
  }
  return false;
}

export interface MonthRangeStrings {
  startDate: string;
  endDate: string;
}

/** 消课/临调拉取区间：所选月 ±7 天。 */
export function buildMonthAuxDateRange(selectedDate: Dayjs): MonthRangeStrings {
  return {
    startDate: selectedDate.startOf('month').subtract(7, 'day').format('YYYY-MM-DD'),
    endDate: selectedDate.endOf('month').add(7, 'day').format('YYYY-MM-DD'),
  };
}

export interface TrialBookingLike {
  class_id?: string | null;
  lesson_date?: string | null;
  status?: string | null;
}

/** 试听标签 key：`classId|lessonDate`，仅 pending/confirmed。 */
export function buildTrialBookingKeys(bookings: TrialBookingLike[]): Set<string> {
  return new Set<string>(
    bookings
      .filter(
        (b) =>
          Boolean(b.class_id) &&
          Boolean(b.lesson_date) &&
          (b.status === 'pending' || b.status === 'confirmed'),
      )
      .map((b) => `${b.class_id}|${b.lesson_date}`),
  );
}
