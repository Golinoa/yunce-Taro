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

/** 解析待办在时间轴上的展示时刻：有提醒用提醒时间，无提醒用创建时间 */
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
  if (item.createdAt && dayjs(item.createdAt).isValid()) {
    return dayjs(item.createdAt);
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

/** 待办是否已完成 */
function isTodoCompleted(item: TodoItem): boolean {
  return Boolean(item.completed || item.completion);
}

/** 解析待办锚定日（提醒日 / 展示日 / 推送日） */
export function resolveTodoAnchorDay(item: TodoItem, now: Dayjs = dayjs()): string | null {
  if (item.remindAt && dayjs(item.remindAt).isValid()) {
    return dayjs(item.remindAt).format('YYYY-MM-DD');
  }
  if (item.displayDay && dayjs(item.displayDay).isValid()) {
    return dayjs(item.displayDay).format('YYYY-MM-DD');
  }
  if (item.pushedAt && dayjs(item.pushedAt).isValid()) {
    return resolveSystemTodoDisplayDay(item.pushedAt, item.completion?.completedAt, now);
  }
  return null;
}

/**
 * 首页时间轴：今日待办
 *
 * - 锚定日为今天的待办
 * - 未完成且已逾期的待办滚入今日（取消「按日历看其它日期」后，避免逾期项在首页消失）
 */
export function isTodoVisibleOnTimelineToday(item: TodoItem, now: Dayjs = dayjs()): boolean {
  const today = now.format('YYYY-MM-DD');
  if (isTodoVisibleOnDate(item, today, now)) return true;

  if (isTodoCompleted(item)) return false;

  const anchorDay = resolveTodoAnchorDay(item, now);
  if (!anchorDay) return false;
  return dayjs(anchorDay).isBefore(dayjs(today), 'day');
}

/** 构建时间轴条目并分段（自下而上：完成 → 过去 → 现在线 → 未来） */
export function buildTimelineEntries(
  items: TodoItem[],
  now: Dayjs = dayjs(),
  targetDate?: string,
  options?: { skipDateFilter?: boolean },
): TimelineEntry[] {
  const today = now.format('YYYY-MM-DD');
  const dateKey = targetDate || today;
  const dayItems = options?.skipDateFilter
    ? items
    : items.filter((item) =>
        dateKey === today
          ? isTodoVisibleOnTimelineToday(item, now)
          : isTodoVisibleOnDate(item, dateKey, now),
      );

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

/** 我的待办 embedded 时间轴几何（与首页轴线比例一致，无外层 px-[8rpx]） */
export const TODO_TIMELINE_EMBEDDED_LAYOUT = {
  /** 时刻列宽 */
  timeWidth: 64,
  /** 轴线 left（2rpx 宽，中心 = axisLeft + 1） */
  axisLeft: 36,
  /** 卡片区左缩进 */
  cardInset: 88,
  /** 时刻与卡片首行垂直对齐 */
  timePaddingTop: 28,
} as const;

/** 我的待办列表分组键：YYYY-MM-DD；无锚定日归入 inbox */
export function resolveTodoGroupDateKey(item: TodoItem, now: Dayjs = dayjs()): string {
  return resolveTodoAnchorDay(item, now) ?? item.displayDay ?? 'inbox';
}

/** 分组标题排序：按日期降序，无提醒置底 */
export function sortTodoGroupDateKeys(keys: string[]): string[] {
  const dated = keys.filter((key) => key !== 'inbox').sort().reverse();
  if (keys.includes('inbox')) dated.push('inbox');
  return dated;
}

/** 待办是否落在指定月份（YYYY-MM） */
export function isTodoInMonth(item: TodoItem, month: string, now: Dayjs = dayjs()): boolean {
  const dateKey = resolveTodoGroupDateKey(item, now);
  if (dateKey === 'inbox') {
    const fallbackAt = item.createdAt || item.pushedAt || item.completion?.completedAt;
    const anchorMonth = fallbackAt ? dayjs(fallbackAt).format('YYYY-MM') : now.format('YYYY-MM');
    return anchorMonth === month;
  }
  return dateKey.startsWith(month);
}

/** 月份筛选展示文案：2026年8月 */
export function formatTodoMonthLabel(month: string): string {
  const [yearText, monthText] = month.split('-');
  const year = Number(yearText);
  const monthNum = Number(monthText);
  if (!year || !monthNum) return month;
  return `${year}年${monthNum}月`;
}

/** 我的待办默认展开：当月内「今天及以前」展开，今天之后收起 */
export function buildDefaultExpandedTodoDates(month: string, now: Dayjs = dayjs()): Set<string> {
  const today = now.format('YYYY-MM-DD');
  const monthStart = dayjs(`${month}-01`);
  if (!monthStart.isValid()) return new Set([today]);

  const expanded = new Set<string>();
  const monthEnd = monthStart.endOf('month');
  let cursor = monthStart.startOf('day');

  while (cursor.isBefore(monthEnd) || cursor.isSame(monthEnd, 'day')) {
    const key = cursor.format('YYYY-MM-DD');
    if (key <= today) {
      expanded.add(key);
    }
    cursor = cursor.add(1, 'day');
  }

  return expanded;
}

/** 我的待办日期分组标题结构 */
export interface TodoGroupDateParts {
  /** 仅「今日」有前缀 */
  prefix: string | null;
  /** YYYY-MM-DD，无提醒时为 null */
  date: string | null;
}

/** 解析日期分组标题（仅今日带前缀 + ISO 日期） */
export function formatTodoGroupDateParts(
  dateKey: string,
  now: Dayjs = dayjs(),
): TodoGroupDateParts {
  if (dateKey === 'inbox') return { prefix: '无提醒', date: null };
  const target = dayjs(dateKey);
  if (!target.isValid()) return { prefix: null, date: dateKey };
  const isoDate = target.format('YYYY-MM-DD');
  const today = now.format('YYYY-MM-DD');
  if (dateKey === today) return { prefix: '今日', date: isoDate };
  return { prefix: null, date: isoDate };
}

/** 我的待办日期分组标题：今日 + YYYY-MM-DD，其余仅 YYYY-MM-DD */
export function formatTodoGroupDateLabel(dateKey: string, now: Dayjs = dayjs()): string {
  const parts = formatTodoGroupDateParts(dateKey, now);
  if (parts.prefix === '无提醒') return '无提醒';
  if (parts.prefix && parts.date) return `${parts.prefix} ${parts.date}`;
  return parts.date ?? dateKey;
}
