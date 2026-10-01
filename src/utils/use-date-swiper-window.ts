import dayjs from 'dayjs';
import { useCallback, useEffect, useRef, useState } from 'react';
import { logWarn } from '@/utils/logger';
import {
  buildDateWindow,
  findDateIndex,
  readEventIndex,
  resolveSwiperEvent,
  resolveWindowAfterFinish,
  resolveWindowForDate,
  type DateSwiperEventDetail,
} from './date-swiper-window-logic';

export interface UseDateSwiperWindowOptions {
  selectedDate: dayjs.Dayjs;
  onDateChange: (date: dayjs.Dayjs) => void;
  windowSize?: number;
  preloadThreshold?: number;
  extendCount?: number;
  /** 程序化命令保护期：期内到达的非 touch 事件不当作用户手势（默认 600ms > Swiper 动画 260ms） */
  commandGuardMs?: number;
  /** 命令确认超时：超时仍未确认视图落点则重挂载对齐（默认 1200ms） */
  commandConfirmMs?: number;
}

export interface UseDateSwiperWindowResult {
  dateWindow: dayjs.Dayjs[];
  swiperCurrent: number;
  /**
   * ⚠️ 消费方**必须**接到 `<Swiper key={swiperSyncKey}>`。
   *
   * `current` 只是数字页码，同一个数字在重排后的窗口里是**另一个日期**；
   * 而 Taro/React 只在值变化时才下发 `current`，一旦 native 页号与 JS 状态错开
   * （程序化跳页被丢掉/被打断、编号重排后数值没变），靠 setData 永远拉不回来。
   * 编号语义变化或检测到漂移时用重挂载把 native 落到正确页 —— 这是唯一确定的对齐手段。
   */
  swiperSyncKey: string;
  handleCalendarChange: (date: dayjs.Dayjs) => void;
  handleSwiperChange: (event: { detail?: DateSwiperEventDetail }) => void;
  handleSwiperAnimationFinish: (event: { detail?: DateSwiperEventDetail }) => void;
}

interface DateWindowState {
  windowDates: dayjs.Dayjs[];
  index: number;
}

/**
 * 日期窗口 + Swiper 页号管理。
 *
 * 口径：**日期是唯一真源，页号只是 native 的当前位置**。
 * - 只有通过校验的用户手势（`source==='touch'`，或「只走一页 + 日期只差一天」）才允许改选中日；
 * - 命令 native 跳页后若未确认落点 ⇒ 重挂载对齐（watchdog）；
 * - 视图落在「不是选中日」的页上 ⇒ 判为漂移，重挂载拉回（并打 warn 便于真机取证）；
 * - 扩窗/重排改了页号语义 ⇒ 重挂载（`swiperSyncKey`）。
 * 详细口径与事故背景见 `date-swiper-window-logic.ts` 顶部注释。
 */
export function useDateSwiperWindow(
  options: UseDateSwiperWindowOptions,
): UseDateSwiperWindowResult {
  const {
    selectedDate,
    onDateChange,
    windowSize = 9,
    preloadThreshold = 2,
    extendCount = 4,
    commandGuardMs = 600,
    commandConfirmMs = 1200,
  } = options;

  const [state, setState] = useState<DateWindowState>(() => ({
    windowDates: buildDateWindow(selectedDate, windowSize),
    index: Math.floor(windowSize / 2),
  }));
  const [syncToken, setSyncToken] = useState(0);

  /**
   * 最新状态镜像：原生事件可能在本帧提交之前到达。
   * 事件回调若直接读闭包里的 state，会拿上一帧的窗口去解析页号 —— 那就是「差 4 天」的来源。
   */
  const stateRef = useRef(state);
  const dateRef = useRef(selectedDate);
  const onDateChangeRef = useRef(onDateChange);
  /** 在途程序化命令（等 native 确认落点） */
  const pendingRef = useRef<{ index: number; at: number } | null>(null);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 刚按手势处理过的页号：去重同一手势的 change + animationfinish 双事件 */
  const handledRef = useRef<{ index: number; at: number } | null>(null);

  stateRef.current = state;
  dateRef.current = selectedDate;
  onDateChangeRef.current = onDateChange;

  const clearConfirmTimer = useCallback(() => {
    if (confirmTimerRef.current) {
      clearTimeout(confirmTimerRef.current);
      confirmTimerRef.current = null;
    }
  }, []);

  const clearPending = useCallback(() => {
    pendingRef.current = null;
    clearConfirmTimer();
  }, [clearConfirmTimer]);

  const commit = useCallback((next: DateWindowState, renumbered: boolean) => {
    stateRef.current = next;
    setState(next);
    if (renumbered) {
      setSyncToken((token) => token + 1);
    }
  }, []);

  /** 不看页号，直接把 native 拉回「选中日那一页」 */
  const reconcile = useCallback(() => {
    const { windowDates } = stateRef.current;
    const index = findDateIndex(windowDates, dateRef.current);
    clearPending();
    if (index < 0) return;
    commit({ windowDates, index }, true);
  }, [clearPending, commit]);
  const reconcileRef = useRef(reconcile);
  reconcileRef.current = reconcile;

  /**
   * 下发一次对齐命令；未重挂载时挂看门狗：
   * native 回来确认（事件页号命中目标页）才算成功，否则重挂载兜底。
   */
  const command = useCallback(
    (next: DateWindowState, renumbered: boolean) => {
      commit(next, renumbered);
      if (renumbered) {
        clearPending();
        return;
      }
      pendingRef.current = { index: next.index, at: Date.now() };
      clearConfirmTimer();
      confirmTimerRef.current = setTimeout(() => {
        confirmTimerRef.current = null;
        if (!pendingRef.current) return;
        pendingRef.current = null;
        logWarn('useDateSwiperWindow:command-unconfirmed', { index: next.index });
        reconcileRef.current();
      }, commandConfirmMs);
    },
    [clearConfirmTimer, clearPending, commit, commandConfirmMs],
  );

  const handleSwiperEvent = useCallback(
    (event?: { detail?: DateSwiperEventDetail }) => {
      const index = readEventIndex(event?.detail);
      const { windowDates, index: currentIndex } = stateRef.current;
      const pending = pendingRef.current;
      const handled = handledRef.current;
      const now = Date.now();

      const outcome = resolveSwiperEvent({
        index,
        windowDates,
        currentIndex,
        selectedDate: dateRef.current,
        source: event?.detail?.source,
        pendingIndex: pending ? pending.index : null,
        pendingActive: Boolean(pending) && now - pending!.at < commandGuardMs,
        recentlyHandledIndex: handled && now - handled.at < commandGuardMs ? handled.index : null,
      });

      if (outcome.type === 'ignore') {
        // 命令目标页被 native 确认 ⇒ 结束在途状态
        if (pending && index !== null && pending.index === index) {
          clearPending();
        }
        return;
      }

      if (outcome.type === 'reconcile') {
        // 取证线索：真机上出现该 warn 即代表「视图停在了别的日期」，也说明修复动作已触发
        logWarn('useDateSwiperWindow:view-drift', {
          landedIndex: outcome.index,
          landedDate: outcome.date.format('YYYY-MM-DD'),
          expectedDate: dateRef.current.format('YYYY-MM-DD'),
        });
        reconcileRef.current();
        return;
      }

      // 用户划动：唯一允许改选中日的分支
      clearPending();
      handledRef.current = { index: outcome.index, at: now };
      // 先写镜像：父级 setState 回传之前，本帧后续事件也按新选中日判定
      dateRef.current = outcome.date;
      onDateChangeRef.current(outcome.date);

      const next = resolveWindowAfterFinish({
        windowDates,
        index: outcome.index,
        windowSize,
        preloadThreshold,
        extendCount,
      });
      if (next.renumbered) {
        command({ windowDates: next.windowDates, index: next.index }, true);
        return;
      }
      commit({ windowDates: next.windowDates, index: next.index }, false);
    },
    [clearPending, command, commit, commandGuardMs, extendCount, preloadThreshold, windowSize],
  );

  const handleCalendarChange = useCallback(
    (date: dayjs.Dayjs) => {
      const { windowDates, index: currentIndex } = stateRef.current;
      dateRef.current = date;
      onDateChangeRef.current(date);

      const next = resolveWindowForDate({ date, windowDates, windowSize });
      if (!next.renumbered && next.index === currentIndex) {
        clearPending();
        return;
      }
      command({ windowDates: next.windowDates, index: next.index }, next.renumbered);
    },
    [clearPending, command, windowSize],
  );

  /** 外部（父级 / 回到今天等）改选中日：把视图对齐到该日 */
  useEffect(() => {
    const { windowDates, index: currentIndex } = stateRef.current;
    const index = findDateIndex(windowDates, selectedDate);
    if (index >= 0) {
      if (index === currentIndex) return;
      command({ windowDates, index }, false);
      return;
    }
    const next = resolveWindowForDate({ date: selectedDate, windowDates, windowSize });
    command({ windowDates: next.windowDates, index: next.index }, true);
  }, [command, selectedDate, windowSize]);

  useEffect(() => clearConfirmTimer, [clearConfirmTimer]);

  return {
    dateWindow: state.windowDates,
    swiperCurrent: state.index,
    swiperSyncKey: `date-window-${syncToken}`,
    handleCalendarChange,
    handleSwiperChange: handleSwiperEvent,
    handleSwiperAnimationFinish: handleSwiperEvent,
  };
}
