/**
 * 待办时间轴工具
 *
 * 使用场景：首页待办 Tab 时间轴排序、系统待办跨天展示、今日过滤。
 */
import dayjs, { type Dayjs } from 'dayjs';
import type { TodoItem } from '@/types/home-todo';

/** 系统待办无明确提醒时，最长顺延 1 天（24h 内同刻展示） */
export const SYSTEM_TODO_ROLLOVER_DAYS = 1;

export type TimelineSegment = 'future' | 'now' | 'past' | 'completed';

export interface TimelineEntry {
  item: TodoItem;
  segment: TimelineSegment;
  /** 时间轴上的时刻（用于排序与展示） */
  timelineAt: Dayjs;
}

/** 解析待办在时间轴上的展示时刻 */
export function resolveTimelineAt(item: TodoItem, now: Dayjs = dayjs()): Dayjs {
  if (item.remindAt && dayjs(item.remindAt).isValid()) {
    return dayjs(item.remindAt);
  }
  if (item.pushedAt && dayjs(item.pushedAt).isValid()) {
    return resolveSystemTodoTimelineAt(
      item.pushedAt,
      item.displayDay,
      item.completion?.completedAt,
      now,
    );
  }
  return now.endOf('day');
}

/** 系统待办：按推送时刻 + 展示日锚定到当天 HH:mm */
export function resolveSystemTodoTimelineAt(
  pushedAt: string,
  displayDay?: string,
  completedAt?: string,
  now: Dayjs = dayjs(),
): Dayjs {
  const pushed = dayjs(pushedAt);
  const anchorDay = displayDay || resolveSystemTodoDisplayDay(pushedAt, completedAt, now);
  return dayjs(anchorDay)
    .hour(pushed.hour())
    .minute(pushed.minute())
    .second(0)
    .millisecond(0);
}

/**
 * 系统待办展示日（日历/历史锚点，不重复多天同时展示）
 *
 * - 推送当天未完成 → 次日同刻仍展示，锚定次日
 * - 完成后锚定完成日
 * - 次日仍未完成 → 锚定次日（历史固定在这一天）
 */
export function resolveSystemTodoDisplayDay(
  pushedAt: string,
  completedAt?: string,
  now: Dayjs = dayjs(),
): string {
  if (completedAt && dayjs(completedAt).isValid()) {
    return dayjs(completedAt).format('YYYY-MM-DD');
  }

  const pushed = dayjs(pushedAt);
  const pushDay = pushed.startOf('day');
  const today = now.startOf('day');
  const daysSincePush = today.diff(pushDay, 'day');

  if (daysSincePush <= 0) {
    return pushDay.format('YYYY-MM-DD');
  }
  if (daysSincePush === 1) {
    return today.format('YYYY-MM-DD');
  }
  return pushDay.add(SYSTEM_TODO_ROLLOVER_DAYS, 'day').format('YYYY-MM-DD');
}

/** 系统待办是否应在指定日期展示（日历红点 / 当日列表） */
export function isSystemTodoVisibleOnDate(
  pushedAt: string,
  date: string,
  completedAt?: string,
  now: Dayjs = dayjs(),
): boolean {
  const displayDay = resolveSystemTodoDisplayDay(pushedAt, completedAt, now);
  return displayDay === date;
}

/** 首页时间轴 / 日历：指定日期是否展示该待办 */
export function isTodoVisibleOnDate(
  item: TodoItem,
  date: string,
  now: Dayjs = dayjs(),
): boolean {
  if (item.displayDay) {
    return item.displayDay === date;
  }

  if (item.pushedAt) {
    return isSystemTodoVisibleOnDate(item.pushedAt, date, item.completion?.completedAt, now);
  }

  if (item.remindAt && dayjs(item.remindAt).isValid()) {
    return dayjs(item.remindAt).format('YYYY-MM-DD') === date;
  }

  return false;
}

/** 首页时间轴：仅展示「今天」的待办 */
export function isTodoVisibleOnTimelineToday(item: TodoItem, now: Dayjs = dayjs()): boolean {
  return isTodoVisibleOnDate(item, now.format('YYYY-MM-DD'), now);
}

/** 构建时间轴条目并分段（自下而上：完成 → 过去 → 现在线 → 未来） */
export function buildTimelineEntries(
  items: TodoItem[],
  now: Dayjs = dayjs(),
  targetDate?: string,
): TimelineEntry[] {
  const dateKey = targetDate || now.format('YYYY-MM-DD');
  const dayItems = items.filter((item) => isTodoVisibleOnDate(item, dateKey, now));

  const entries: TimelineEntry[] = dayItems.map((item) => {
    const timelineAt = resolveTimelineAt(item, now);
    const isCompleted = Boolean(item.completed || item.completion);
    let segment: TimelineSegment = 'past';

    if (isCompleted) {
      segment = 'completed';
    } else if (timelineAt.isAfter(now)) {
      segment = 'future';
    }

    return { item, segment, timelineAt };
  });

  const completed = entries
    .filter((e) => e.segment === 'completed')
    .sort((a, b) => a.timelineAt.valueOf() - b.timelineAt.valueOf());

  const past = entries
    .filter((e) => e.segment === 'past')
    .sort((a, b) => a.timelineAt.valueOf() - b.timelineAt.valueOf());

  const future = entries
    .filter((e) => e.segment === 'future')
    .sort((a, b) => a.timelineAt.valueOf() - b.timelineAt.valueOf());

  return [...completed, ...past, ...future];
}

/** 是否应在 future 与 past 之间插入「当前时刻」标线 */
export function shouldShowNowMarker(entries: TimelineEntry[]): boolean {
  const hasFuture = entries.some((e) => e.segment === 'future');
  const hasPastOrDone = entries.some((e) => e.segment === 'past' || e.segment === 'completed');
  return hasFuture || hasPastOrDone;
}

export function formatTimelineClock(value: Dayjs): string {
  return value.format('HH:mm');
}

/** 收集待办涉及的日期（日历红点） */
export function collectTodoDateKeys(items: TodoItem[]): Set<string> {
  const dates = new Set<string>();
  items.forEach((item) => {
    if (item.displayDay) {
      dates.add(item.displayDay);
      return;
    }
    if (item.remindAt && dayjs(item.remindAt).isValid()) {
      dates.add(dayjs(item.remindAt).format('YYYY-MM-DD'));
      return;
    }
    if (item.pushedAt) {
      dates.add(resolveSystemTodoDisplayDay(item.pushedAt, item.completion?.completedAt));
    }
  });
  return dates;
}

/** 按日期过滤待办 */
export function filterTodosByDate(items: TodoItem[], date: string, now: Dayjs = dayjs()): TodoItem[] {
  return items.filter((item) => isTodoVisibleOnDate(item, date, now));
}
