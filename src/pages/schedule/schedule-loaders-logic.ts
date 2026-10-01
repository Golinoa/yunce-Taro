/**
 * 课表加载纯逻辑（供 use-schedule-loaders 与单测共用）
 * 使用场景：开放时段缓存跳过、月度区间、试听 key、开放班过滤——无 React / 无 IO。
 */
import type { Class } from '@/types/class';
import { buildTrialLessonKey, buildTrialLessonScheduleKey } from '@/utils/schedule-card-build';
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
  /** 本节课时段；缺它就无法区分「同一天的第几节课」 */
  start_time?: string | null;
  /**
   * 「哪一节」的排课编号（试听预约的 `reference_schedule_id`）。
   * 有了它就按编号定位课节 —— 同日调课改了时段也不会失配。
   */
  schedule_id?: string | null;
  status?: string | null;
}

/**
 * 试听标签 key 集合（仅 pending/confirmed）。
 *
 * 每条预约**同时**产出两个键（编号键 + 时段键）：
 * - 编号键 `#scheduleId|classId|lessonDate` —— 命中即属于这一节，调课改时段也认得；
 * - 时段键 `classId|lessonDate|startTime` —— 兜底（老预约没存编号）。
 *
 * 键的口径定义在 `@/utils/schedule-card-build`（与课表卡片判定、点名名单过滤共用同一真源）。
 */
export function buildTrialBookingKeys(bookings: TrialBookingLike[]): Set<string> {
  const keys = new Set<string>();
  bookings
    .filter(
      (b) =>
        Boolean(b.class_id) &&
        Boolean(b.lesson_date) &&
        (b.status === 'pending' || b.status === 'confirmed'),
    )
    .forEach((b) => {
      keys.add(buildTrialLessonKey(b.class_id, b.lesson_date, b.start_time));
      if (b.schedule_id) {
        keys.add(buildTrialLessonScheduleKey(b.class_id, b.lesson_date, b.schedule_id));
      }
    });
  return keys;
}
