/**
 * 日期 Swiper 窗口纯逻辑（供 use-date-swiper-window 与单测共用）
 * 使用场景：页号↔日期映射、原生事件分类、扩窗/重排、视图漂移判定 —— 无 React / 无副作用。
 *
 * 背景（2026-10-01 课表「有选中态但没课」复盘）：
 * weapp 的 `<Swiper current>` 是**数字页码**，而窗口数组会在运行中被扩窗/重排，
 * 同一个页码在不同窗口里是**不同日期**。于是只要 native 页号与 JS 状态曾经错开
 * （程序化跳页被丢掉/被前一次手势惯性打断、窗口重排后 `current` 数值没变而不再下发、
 * 事件里的页号还是重排前的编号），视图就会停在一个「别的日期」上，
 * 而日历选中态来自 JS 状态 —— 表现正是「选中日期有选中态，卡片却显示没课」。
 *
 * 因此本模块的口径（唯一真源）：
 * 1. 页号只是「视图当前位置」，**日期一律由窗口数组解析**（`dateAtWindowIndex`）；
 * 2. **只有通过校验的用户手势**（落点日期与选中日差 1 天 + 只走一页）才允许改选中日；
 * 3. 其余原生事件一律不改选中日，只做「对齐」或「判为视图漂移 → 让调用方重挂载对齐」；
 * 4. 扩窗只改数组、尽量不动编号；编号变了由调用方重挂载 Swiper（见 hook 的 `swiperSyncKey`）。
 */
import type { Dayjs } from 'dayjs';

/** 原生 Swiper 事件 detail（weapp：`{ current, source, currentItemId }`） */
export interface DateSwiperEventDetail {
  /** 视图报出的当前页号 */
  current?: number;
  /**
   * 变更来源：`touch` 用户划动 / `autoplay` 自动播放 / `''` 其它（含程序化 setData）。
   * 平台不给该字段时为 undefined —— 此时退化为「只走一页 + 日期只差一天」的几何校验。
   */
  source?: string;
}

/** 以 centerDate 为中心构造长度为 windowSize 的日期窗口。 */
export function buildDateWindow(centerDate: Dayjs, windowSize: number): Dayjs[] {
  const half = Math.floor(windowSize / 2);
  return Array.from({ length: windowSize }, (_, index) => centerDate.add(index - half, 'day'));
}

/** 目标日期在窗口中的页号；不在窗口内返回 -1。 */
export function findDateIndex(list: Dayjs[], target: Dayjs): number {
  return list.findIndex((item) => item.isSame(target, 'day'));
}

/** 安全读取事件页号：非有限数一律视为「没有页号信息」。 */
export function readEventIndex(detail?: DateSwiperEventDetail): number | null {
  const current = detail?.current;
  if (typeof current !== 'number' || !Number.isFinite(current)) return null;
  return Math.trunc(current);
}

/** 页号 → 日期；越界返回 null。 */
export function dateAtWindowIndex(windowDates: Dayjs[], index: number): Dayjs | null {
  if (index < 0 || index >= windowDates.length) return null;
  return windowDates[index] ?? null;
}

export type SwiperEventIgnoreReason =
  | 'no-index'
  | 'out-of-window'
  | 'duplicate'
  | 'aligned'
  | 'command-in-flight';

export interface ResolveSwiperEventInput {
  /** 事件页号（null = 事件没带页号） */
  index: number | null;
  /** 当前窗口（调用方须传入**最新**数组，不要用事件发生那一帧的闭包） */
  windowDates: Dayjs[];
  /** JS 认为 native 当前停在哪一页 */
  currentIndex: number;
  /** 当前选中日（含刚刚口头宣布给父级、父级还没回传的那一次） */
  selectedDate: Dayjs;
  /** 原生事件来源 */
  source?: string;
  /** 有在途程序化命令时为该命令的目标页号，否则 null */
  pendingIndex?: number | null;
  /** 在途命令是否仍在保护期内 */
  pendingActive?: boolean;
  /**
   * 刚刚按用户手势处理过的页号（去重同一手势的 change + animationfinish 双事件；
   * 首事件可能已经重排窗口，第二事件若再按新编号解析会得到「差 4 天」的假漂移）。
   */
  recentlyHandledIndex?: number | null;
}

export type SwiperEventOutcome =
  /** 什么都不做（已对齐 / 无信息 / 越界 / 重复事件 / 命令在途） */
  | { type: 'ignore'; reason: SwiperEventIgnoreReason }
  /** 用户划动：唯一可以改选中日的分支 */
  | { type: 'user-swipe'; date: Dayjs; index: number }
  /** 视图漂移：native 停在「不是选中日」的页上且不是用户手势 → 调用方重挂载对齐 */
  | { type: 'reconcile'; index: number; date: Dayjs };

/**
 * 判定一次原生 Swiper 事件该如何处理。
 *
 * 关键不变式：**只有 `user-swipe` 才能改选中日**。
 * 因此「程序化跳页的残留事件」「窗口重排前编号的迟到事件」都不会再改日期，
 * 只会被识别为漂移并触发重挂载对齐 —— 视图与选中日不会再各说各话。
 */
export function resolveSwiperEvent(input: ResolveSwiperEventInput): SwiperEventOutcome {
  const {
    index,
    windowDates,
    currentIndex,
    selectedDate,
    source,
    pendingIndex = null,
    pendingActive = false,
    recentlyHandledIndex = null,
  } = input;

  if (index === null) return { type: 'ignore', reason: 'no-index' };
  const date = dateAtWindowIndex(windowDates, index);
  if (!date) return { type: 'ignore', reason: 'out-of-window' };
  if (recentlyHandledIndex !== null && recentlyHandledIndex === index) {
    return { type: 'ignore', reason: 'duplicate' };
  }

  if (date.isSame(selectedDate, 'day')) {
    return { type: 'ignore', reason: 'aligned' };
  }

  const isTouch = source === 'touch';
  // 程序化命令在途时，动画中间页会陆续上报 —— 这些都是「我们自己的动作」，不判漂移
  if (pendingActive && !isTouch) {
    return { type: 'ignore', reason: 'command-in-flight' };
  }

  const isSelfCommand = pendingIndex !== null && pendingIndex === index;
  const adjacentPage = Math.abs(index - currentIndex) === 1;
  const dayDelta = Math.abs(date.diff(selectedDate, 'day'));
  /**
   * 用户手势的充分条件（两者都要求 dayDelta === 1 —— 手势永远只走一天）：
   * - 原生明确标了 touch（权威）；或
   * - 几何上像一次手势：页号只走一页、不是我们自己下发的命令、不在命令保护期、来源非 autoplay。
   */
  const looksLikeGesture =
    dayDelta === 1 && adjacentPage && !isSelfCommand && !pendingActive && source !== 'autoplay';
  if (isTouch ? dayDelta === 1 : looksLikeGesture) {
    return { type: 'user-swipe', date, index };
  }

  // 既不是手势，落点又不是选中日 ⇒ native 停错页了
  return { type: 'reconcile', index, date };
}

export interface ResolveWindowResult {
  windowDates: Dayjs[];
  /** 视图该停的页号（在返回的 windowDates 里） */
  index: number;
  /**
   * 页号语义是否变了（整体前移/重排）。
   * 为 true 时调用方**必须重挂载 Swiper** —— 否则 native 仍按旧编号停在那一页，
   * 而那一页在新数组里已经是另一个日期。
   */
  renumbered: boolean;
}

export interface ResolveWindowAfterFinishInput {
  windowDates: Dayjs[];
  /** 确认后视图停留的页号 */
  index: number;
  windowSize: number;
  preloadThreshold: number;
  extendCount: number;
}

/**
 * 手势落定后维护窗口：
 * - 靠近左边缘 ⇒ 前插 extendCount 天（编号整体 +extendCount，需重挂载对齐）；
 * - 靠近右边缘 ⇒ 后追加 extendCount 天（编号不变，无需重挂载）；
 * - 再扩就要超上限 ⇒ 以视图当前停留日为中心重排（防窗口无限增长；编号变化，需重挂载）。
 */
export function resolveWindowAfterFinish(
  input: ResolveWindowAfterFinishInput,
): ResolveWindowResult {
  const { windowDates, index, windowSize, preloadThreshold, extendCount } = input;

  const maxWindowSize = windowSize + extendCount * 2;
  if (windowDates.length + extendCount > maxWindowSize) {
    const centerDate = windowDates[index];
    if (centerDate) {
      return {
        windowDates: buildDateWindow(centerDate, windowSize),
        index: Math.floor(windowSize / 2),
        renumbered: true,
      };
    }
  }

  if (index <= preloadThreshold) {
    const firstDate = windowDates[0];
    if (!firstDate) return { windowDates, index, renumbered: false };
    const prependDates = Array.from({ length: extendCount }, (_, i) =>
      firstDate.subtract(extendCount - i, 'day'),
    );
    return {
      windowDates: [...prependDates, ...windowDates],
      index: index + extendCount,
      renumbered: true,
    };
  }

  if (index >= windowDates.length - 1 - preloadThreshold) {
    const lastDate = windowDates[windowDates.length - 1];
    if (!lastDate) return { windowDates, index, renumbered: false };
    const appendDates = Array.from({ length: extendCount }, (_, i) => lastDate.add(i + 1, 'day'));
    return { windowDates: [...windowDates, ...appendDates], index, renumbered: false };
  }

  return { windowDates, index, renumbered: false };
}

export interface ResolveWindowForDateInput {
  date: Dayjs;
  windowDates: Dayjs[];
  windowSize: number;
}

/**
 * 把「某个日期」映射成「窗口 + 页号」：
 * 在窗口内 ⇒ 原样返回该页号；不在窗口内 ⇒ 以该日期为中心重建窗口（编号变化，需重挂载）。
 */
export function resolveWindowForDate(input: ResolveWindowForDateInput): ResolveWindowResult {
  const { date, windowDates, windowSize } = input;
  const index = findDateIndex(windowDates, date);
  if (index >= 0) {
    return { windowDates, index, renumbered: false };
  }
  return {
    windowDates: buildDateWindow(date, windowSize),
    index: Math.floor(windowSize / 2),
    renumbered: true,
  };
}
