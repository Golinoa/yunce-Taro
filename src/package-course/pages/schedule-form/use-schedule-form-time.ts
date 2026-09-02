/**
 * 排课表单时间段 / 自由日期 / 滚动恢复（Q2-3）
 */
import Taro from '@tarojs/taro';
import dayjs from 'dayjs';
import { useCallback, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { formatMinutesToTime, parseTimeToMinutes } from './time';
import type { SchedulingMode, TimeSlotPair } from './schedule-form-constants';

export interface UseScheduleFormTimeParams {
  schedulingMode: SchedulingMode;
  repeatMode: string;
  timeSlots: TimeSlotPair[];
  setTimeSlots: Dispatch<SetStateAction<TimeSlotPair[]>>;
  freeDates: string[];
  setFreeDates: Dispatch<SetStateAction<string[]>>;
  startDate: string;
  setFreeCalendarVisible: Dispatch<SetStateAction<boolean>>;
}

export function useScheduleFormTime({
  schedulingMode,
  repeatMode,
  timeSlots,
  setTimeSlots,
  freeDates,
  setFreeDates,
  startDate,
  setFreeCalendarVisible,
}: UseScheduleFormTimeParams) {
  const [scrollTop, setScrollTop] = useState(0);
  const savedScrollTopRef = useRef(0);
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [timePickerTitle, setTimePickerTitle] = useState('选择开始时间');
  const [timePickerValue, setTimePickerValue] = useState('09:00');
  const [timePickerPhase, setTimePickerPhase] = useState<'start' | 'end'>('start');
  const [draftStartTime, setDraftStartTime] = useState('09:00');
  const [editingSlotId, setEditingSlotId] = useState<number | null>(null);
  const chainingTimePickerRef = useRef(false);

  const allowMultiTimeSlots = !(schedulingMode === 'rule' && repeatMode === 'alternate');
  const hasRealTimeSlots = timeSlots.length > 0;

  const timeDisplayDateLabel = useMemo(() => {
    const raw = schedulingMode === 'free' && freeDates.length > 0 ? freeDates[0] : startDate;
    if (!raw || !dayjs(raw).isValid()) return '请选择日期';
    const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
    const d = dayjs(raw);
    return `${d.format('YYYY-MM-DD')} 星期${WEEK[d.day()]}`;
  }, [freeDates, schedulingMode, startDate]);

  const restoreScrollAfterSheet = useCallback(() => {
    const y = savedScrollTopRef.current;
    // 微小偏移强制 ScrollView 应用 scrollTop，防止 BottomSheet 关闭后回顶
    setTimeout(() => {
      setScrollTop(y + 0.01);
    }, 80);
    setTimeout(() => {
      setScrollTop(y);
    }, 160);
  }, []);

  const openFreeCalendar = useCallback(() => {
    setFreeCalendarVisible(true);
  }, [setFreeCalendarVisible]);

  const closeFreeCalendar = useCallback(() => {
    setFreeCalendarVisible(false);
    restoreScrollAfterSheet();
  }, [restoreScrollAfterSheet, setFreeCalendarVisible]);

  const openTimePickerFlow = useCallback(
    (slotId?: number) => {
      if (slotId == null && !allowMultiTimeSlots && timeSlots.length >= 1) {
        Taro.showToast({ title: '隔天排课仅支持一组时间', icon: 'none' });
        return;
      }
      setEditingSlotId(slotId ?? null);
      setTimePickerPhase('start');
      setTimePickerTitle('选择开始时间');
      const existing = slotId != null ? timeSlots.find((t) => t.id === slotId) : null;
      const start = existing?.start || '09:00';
      setDraftStartTime(start);
      setTimePickerValue(start);
      setTimePickerVisible(true);
    },
    [allowMultiTimeSlots, timeSlots],
  );

  const handleTimePickerConfirm = useCallback(
    (time: string) => {
      if (timePickerPhase === 'start') {
        setDraftStartTime(time);
        setTimePickerPhase('end');
        setTimePickerTitle('选择结束时间');
        const existing =
          editingSlotId != null ? timeSlots.find((t) => t.id === editingSlotId) : null;
        const defaultEnd =
          existing?.end && existing.end > time
            ? existing.end
            : formatMinutesToTime(parseTimeToMinutes(time) + 60);
        setTimePickerValue(defaultEnd);
        chainingTimePickerRef.current = true;
        // TimePickerSheet 确认后会 onClose，下一帧再打开结束时间选择
        setTimeout(() => {
          setTimePickerVisible(true);
          chainingTimePickerRef.current = false;
        }, 80);
        return;
      }

      if (time <= draftStartTime) {
        Taro.showToast({ title: '结束时间需晚于开始时间', icon: 'none' });
        chainingTimePickerRef.current = true;
        setTimeout(() => {
          setTimePickerVisible(true);
          chainingTimePickerRef.current = false;
        }, 80);
        return;
      }

      if (editingSlotId != null) {
        setTimeSlots((prev) =>
          prev.map((ts) =>
            ts.id === editingSlotId ? { ...ts, start: draftStartTime, end: time } : ts,
          ),
        );
      } else {
        setTimeSlots((prev) => [...prev, { id: Date.now(), start: draftStartTime, end: time }]);
      }
      setEditingSlotId(null);
      setTimePickerPhase('start');
      // 仅恢复原滚动位置，不主动滚到时间区（避免弹窗关闭后滚动条跳动）
      restoreScrollAfterSheet();
    },
    [
      draftStartTime,
      editingSlotId,
      restoreScrollAfterSheet,
      setTimeSlots,
      timePickerPhase,
      timeSlots,
    ],
  );

  const closeTimePicker = useCallback(() => {
    setTimePickerVisible(false);
    if (chainingTimePickerRef.current) return;
    setTimePickerPhase('start');
    setEditingSlotId(null);
    restoreScrollAfterSheet();
  }, [restoreScrollAfterSheet]);

  const removeTimeSlot = useCallback(
    (id: number) => {
      setTimeSlots((prev) => prev.filter((ts) => ts.id !== id));
    },
    [setTimeSlots],
  );

  const removeFreeDate = useCallback(
    (date: string) => {
      setFreeDates((prev) => prev.filter((d) => d !== date));
    },
    [setFreeDates],
  );

  const handleFreeDatesConfirm = useCallback(
    (dates: string[]) => {
      setFreeDates(dates);
      restoreScrollAfterSheet();
    },
    [restoreScrollAfterSheet, setFreeDates],
  );

  const onScrollCapture = useCallback((top: number) => {
    if (Number.isFinite(top)) {
      savedScrollTopRef.current = top;
    }
  }, []);

  return {
    scrollTop,
    timePickerVisible,
    timePickerTitle,
    timePickerValue,
    allowMultiTimeSlots,
    hasRealTimeSlots,
    timeDisplayDateLabel,
    restoreScrollAfterSheet,
    openFreeCalendar,
    closeFreeCalendar,
    openTimePickerFlow,
    handleTimePickerConfirm,
    closeTimePicker,
    removeTimeSlot,
    removeFreeDate,
    handleFreeDatesConfirm,
    onScrollCapture,
  };
}
