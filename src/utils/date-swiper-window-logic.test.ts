/**
 * 日期 Swiper 窗口纯逻辑单测
 *
 * 重点回归「课表切换日期后卡片显示没课」事故（2026-10-01）：
 * 页号在窗口重排后语义会变，只有校验过的用户手势才允许改选中日 —— 见各 case 注释。
 */
import dayjs from 'dayjs';
import { describe, expect, it } from 'vitest';
import {
  buildDateWindow,
  dateAtWindowIndex,
  findDateIndex,
  readEventIndex,
  resolveSwiperEvent,
  resolveWindowAfterFinish,
  resolveWindowForDate,
} from './date-swiper-window-logic';

const BASE = dayjs('2026-10-01');
const WINDOW_SIZE = 9;

function window9(center = BASE) {
  return buildDateWindow(center, WINDOW_SIZE);
}

describe('窗口基础工具', () => {
  it('buildDateWindow 以中心日展开，中心页号 = 4', () => {
    const list = window9();
    expect(list).toHaveLength(9);
    expect(list[4].format('YYYY-MM-DD')).toBe('2026-10-01');
    expect(list[0].format('YYYY-MM-DD')).toBe('2026-09-27');
    expect(list[8].format('YYYY-MM-DD')).toBe('2026-10-05');
  });

  it('readEventIndex 只接受有限数，其余视为无页号', () => {
    expect(readEventIndex({ current: 3 })).toBe(3);
    expect(readEventIndex({ current: undefined })).toBeNull();
    expect(readEventIndex({})).toBeNull();
    expect(readEventIndex(undefined)).toBeNull();
    expect(readEventIndex({ current: Number.NaN })).toBeNull();
    expect(readEventIndex({ current: Number.POSITIVE_INFINITY })).toBeNull();
  });

  it('dateAtWindowIndex 越界返回 null', () => {
    const list = window9();
    expect(dateAtWindowIndex(list, -1)).toBeNull();
    expect(dateAtWindowIndex(list, 9)).toBeNull();
    expect(findDateIndex(list, BASE)).toBe(4);
    expect(findDateIndex(list, BASE.add(30, 'day'))).toBe(-1);
  });
});

describe('resolveSwiperEvent：只有校验过的用户手势才能改选中日', () => {
  it('用户划到相邻一页（touch）→ user-swipe，日期取的是窗口里那一页', () => {
    const windowDates = window9();
    const outcome = resolveSwiperEvent({
      index: 5,
      windowDates,
      currentIndex: 4,
      selectedDate: BASE,
      source: 'touch',
    });
    expect(outcome.type).toBe('user-swipe');
    if (outcome.type === 'user-swipe') {
      expect(outcome.date.format('YYYY-MM-DD')).toBe('2026-10-02');
    }
  });

  it('平台不给 source 时，几何校验（只走一页 + 差一天）仍认手势', () => {
    const outcome = resolveSwiperEvent({
      index: 3,
      windowDates: window9(),
      currentIndex: 4,
      selectedDate: BASE,
    });
    expect(outcome.type).toBe('user-swipe');
  });

  it('回归：窗口前插 4 天后的迟到事件（旧编号）不再被当成手势，而是判漂移', () => {
    // 用户从 index 2 继续往前划 ⇒ 窗口前插 4 天（13 页），native 物理位置仍是 2。
    const landedWindow = window9();
    const landedIndex = 2;
    const selected = landedWindow[landedIndex];
    const after = resolveWindowAfterFinish({
      windowDates: landedWindow,
      index: landedIndex,
      windowSize: WINDOW_SIZE,
      preloadThreshold: 2,
      extendCount: 4,
    });
    const outcome = resolveSwiperEvent({
      index: landedIndex, // 旧编号
      windowDates: after.windowDates,
      currentIndex: after.index,
      selectedDate: selected,
    });
    // 旧实现：直接 onDateChange(windowDates[2]) ⇒ 选中日跳到「差 4 天」的星期几（多数没课）
    expect(outcome.type).toBe('reconcile');
    if (outcome.type === 'reconcile') {
      expect(outcome.date.format('YYYY-MM-DD')).toBe('2026-09-25');
      expect(selected.format('YYYY-MM-DD')).toBe('2026-09-29');
    }
  });

  it('回归：自报页号与选中日一致（窗口重排后的确认事件）→ 只对齐、不改日期', () => {
    const windowDates = buildDateWindow(BASE.subtract(2, 'day'), 13);
    const outcome = resolveSwiperEvent({
      index: 6, // 新编号里仍是 9-29
      windowDates,
      currentIndex: 6,
      selectedDate: BASE.subtract(2, 'day'),
      source: '',
    });
    expect(outcome).toEqual({ type: 'ignore', reason: 'aligned' });
  });

  it('程序化命令在途时，动画中间页不判漂移', () => {
    const outcome = resolveSwiperEvent({
      index: 5,
      windowDates: window9(),
      currentIndex: 6,
      selectedDate: BASE.add(2, 'day'),
      source: '',
      pendingIndex: 6,
      pendingActive: true,
    });
    expect(outcome).toEqual({ type: 'ignore', reason: 'command-in-flight' });
  });

  it('同一手势的第二个事件（页号重复）被去重', () => {
    const outcome = resolveSwiperEvent({
      index: 5,
      windowDates: window9(),
      currentIndex: 5,
      selectedDate: BASE.add(1, 'day'),
      recentlyHandledIndex: 5,
    });
    expect(outcome).toEqual({ type: 'ignore', reason: 'duplicate' });
  });

  it('autoplay 不算手势', () => {
    const outcome = resolveSwiperEvent({
      index: 5,
      windowDates: window9(),
      currentIndex: 4,
      selectedDate: BASE,
      source: 'autoplay',
    });
    expect(outcome.type).toBe('reconcile');
  });

  it('无页号 / 越界事件一律忽略', () => {
    expect(
      resolveSwiperEvent({
        index: null,
        windowDates: window9(),
        currentIndex: 4,
        selectedDate: BASE,
      }),
    ).toEqual({ type: 'ignore', reason: 'no-index' });
    expect(
      resolveSwiperEvent({
        index: 99,
        windowDates: window9(),
        currentIndex: 4,
        selectedDate: BASE,
      }),
    ).toEqual({ type: 'ignore', reason: 'out-of-window' });
  });

  it('touch 但落点差 2 天（不该出现的多页手势）不认，判漂移', () => {
    const outcome = resolveSwiperEvent({
      index: 6,
      windowDates: window9(),
      currentIndex: 4,
      selectedDate: BASE,
      source: 'touch',
    });
    expect(outcome.type).toBe('reconcile');
  });
});

describe('resolveWindowAfterFinish：扩窗只改数组，尽量不动编号', () => {
  it('靠近左边缘 ⇒ 前插 4 天并重编号（需要重挂载）', () => {
    const windowDates = window9();
    const next = resolveWindowAfterFinish({
      windowDates,
      index: 2,
      windowSize: WINDOW_SIZE,
      preloadThreshold: 2,
      extendCount: 4,
    });
    expect(next.renumbered).toBe(true);
    expect(next.windowDates).toHaveLength(13);
    expect(next.index).toBe(6);
    // 编号变了，但 view 停留的那一天不变（这正是「必须重挂载」的原因）
    expect(next.windowDates[next.index].format('YYYY-MM-DD')).toBe(
      windowDates[2].format('YYYY-MM-DD'),
    );
  });

  it('靠近右边缘 ⇒ 追加 4 天，编号不变（无需重挂载）', () => {
    const windowDates = window9();
    const next = resolveWindowAfterFinish({
      windowDates,
      index: 7,
      windowSize: WINDOW_SIZE,
      preloadThreshold: 2,
      extendCount: 4,
    });
    expect(next.renumbered).toBe(false);
    expect(next.windowDates).toHaveLength(13);
    expect(next.index).toBe(7);
    expect(next.windowDates[7].format('YYYY-MM-DD')).toBe(windowDates[7].format('YYYY-MM-DD'));
  });

  it('中间页不动窗口', () => {
    const windowDates = window9();
    const next = resolveWindowAfterFinish({
      windowDates,
      index: 4,
      windowSize: WINDOW_SIZE,
      preloadThreshold: 2,
      extendCount: 4,
    });
    expect(next).toEqual({ windowDates, index: 4, renumbered: false });
  });

  it('再扩就超上限 ⇒ 以当前日为中心重排（防无限增长）', () => {
    const windowDates = buildDateWindow(BASE, 17); // 9 → 13 → 17 已到上限
    const next = resolveWindowAfterFinish({
      windowDates,
      index: 5,
      windowSize: WINDOW_SIZE,
      preloadThreshold: 2,
      extendCount: 4,
    });
    expect(next.renumbered).toBe(true);
    expect(next.windowDates).toHaveLength(9);
    expect(next.index).toBe(4);
    expect(next.windowDates[4].format('YYYY-MM-DD')).toBe(windowDates[5].format('YYYY-MM-DD'));
  });
});

describe('resolveWindowForDate：日历点选的目标日 → 窗口 + 页号', () => {
  it('在窗口内 ⇒ 原窗口原页号', () => {
    const windowDates = window9();
    const next = resolveWindowForDate({
      date: BASE.add(2, 'day'),
      windowDates,
      windowSize: WINDOW_SIZE,
    });
    expect(next).toEqual({ windowDates, index: 6, renumbered: false });
  });

  it('在窗口外 ⇒ 以该日为中心重建（编号变了，需要重挂载）', () => {
    const windowDates = window9();
    const target = BASE.add(7, 'day');
    const next = resolveWindowForDate({ date: target, windowDates, windowSize: WINDOW_SIZE });
    expect(next.renumbered).toBe(true);
    expect(next.index).toBe(4);
    expect(next.windowDates).toHaveLength(9);
    expect(next.windowDates[4].isSame(target, 'day')).toBe(true);
  });
});
