/**
 * 课表页守卫纯函数（L-05）
 *
 * 从 pages/schedule/index.tsx 抽出的无副作用判断逻辑：
 * - canSuspendThisLesson：班级课「停课」资格判断
 * - canSuspendOpenSlot：开放时段「停课」资格判断
 * - canOperateHistoricalLesson：历史课可操作窗口判断（30 天）
 *
 * 全部为纯函数（输入 → 输出），node 环境可直接单测，纳入 vitest 回归防护。
 * 页面调用方传入的结构化对象按最小字段兼容（status/startTime/start_time/lesson_date）。
 */
import dayjs from 'dayjs';

/** 停课判断所需的最小课程卡片字段 */
export interface SuspendEligibleCard {
  status: string;
  startTime: string;
}

/** 停课判断所需的最小开放时段字段 */
export interface SuspendEligibleSlot {
  status: string;
  start_time: string;
  lesson_date: string;
}

/** 解析 'HH:mm' 为当日分钟数；非法输入返回 0 */
export function parseTimeToMinutes(time: string): number {
  const [hour, minute] = time.split(':').map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return 0;
  }
  return hour * 60 + minute;
}

/** 停课：仅「尚未开课」的这一节可临时取消 */
export function canSuspendThisLesson(
  item: SuspendEligibleCard,
  selectedDate: dayjs.Dayjs,
  now: dayjs.Dayjs,
): boolean {
  if (
    item.status === 'cancelled' ||
    item.status === 'done' ||
    item.status === 'ended' ||
    item.status === 'active'
  ) {
    return false;
  }
  if (selectedDate.isBefore(now, 'day')) return false;
  if (selectedDate.isAfter(now, 'day')) return true;
  const startMinutes = parseTimeToMinutes(item.startTime);
  const nowMinutes = now.hour() * 60 + now.minute();
  return nowMinutes < startMinutes;
}

/** 开放时段停课：仅「未开课」且未到开始时间可停 */
export function canSuspendOpenSlot(slot: SuspendEligibleSlot, now: dayjs.Dayjs): boolean {
  if (slot.status === 'rest') return false;
  const lessonDay = dayjs(slot.lesson_date);
  if (lessonDay.isBefore(now, 'day')) return false;
  if (lessonDay.isAfter(now, 'day')) return true;
  const startMinutes = parseTimeToMinutes(slot.start_time);
  const nowMinutes = now.hour() * 60 + now.minute();
  return nowMinutes < startMinutes;
}

/** 历史课可操作窗口：上课日起 30 天内可补录；超时仅可查看 */
export const LESSON_OPERATE_WINDOW_DAYS = 30;

export function canOperateHistoricalLesson(lessonDate: dayjs.Dayjs, now: dayjs.Dayjs): boolean {
  const earliest = now.startOf('day').subtract(LESSON_OPERATE_WINDOW_DAYS, 'day');
  return !lessonDate.startOf('day').isBefore(earliest);
}
