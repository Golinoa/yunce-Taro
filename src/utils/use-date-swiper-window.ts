import dayjs from 'dayjs';
import { useCallback, useEffect, useMemo, useState } from 'react';

export interface DateSwiperDetail {
  current?: number;
}

export interface UseDateSwiperWindowOptions {
  selectedDate: dayjs.Dayjs;
  onDateChange: (date: dayjs.Dayjs) => void;
  windowSize?: number;
  preloadThreshold?: number;
  extendCount?: number;
}

export interface UseDateSwiperWindowResult {
  dateWindow: dayjs.Dayjs[];
  swiperCurrent: number;
  handleCalendarChange: (date: dayjs.Dayjs) => void;
  handleSwiperChange: (event: { detail?: DateSwiperDetail }) => void;
  handleSwiperAnimationFinish: (event: { detail?: DateSwiperDetail }) => void;
}

function buildDateWindow(centerDate: dayjs.Dayjs, windowSize: number): dayjs.Dayjs[] {
  const half = Math.floor(windowSize / 2);
  return Array.from({ length: windowSize }, (_, index) => centerDate.add(index - half, 'day'));
}

function findDateIndex(list: dayjs.Dayjs[], target: dayjs.Dayjs): number {
  return list.findIndex((item) => item.isSame(target, 'day'));
}

export function useDateSwiperWindow(
  options: UseDateSwiperWindowOptions,
): UseDateSwiperWindowResult {
  const {
    selectedDate,
    onDateChange,
    windowSize = 9,
    preloadThreshold = 2,
    extendCount = 4,
  } = options;

  const initialIndex = useMemo(() => Math.floor(windowSize / 2), [windowSize]);
  const [dateWindow, setDateWindow] = useState<dayjs.Dayjs[]>(() =>
    buildDateWindow(selectedDate, windowSize),
  );
  const [swiperCurrent, setSwiperCurrent] = useState(initialIndex);

  useEffect(() => {
    setDateWindow((prev) => {
      const index = findDateIndex(prev, selectedDate);
      if (index >= 0) {
        setSwiperCurrent(index);
        return prev;
      }

      setSwiperCurrent(initialIndex);
      return buildDateWindow(selectedDate, windowSize);
    });
  }, [initialIndex, selectedDate, windowSize]);

  const handleCalendarChange = useCallback(
    (date: dayjs.Dayjs) => {
      onDateChange(date);
      const index = findDateIndex(dateWindow, date);
      if (index >= 0) {
        setSwiperCurrent(index);
        return;
      }

      setDateWindow(buildDateWindow(date, windowSize));
      setSwiperCurrent(initialIndex);
    },
    [dateWindow, initialIndex, onDateChange, windowSize],
  );

  const handleSwiperChange = useCallback(
    (event: { detail?: DateSwiperDetail }) => {
      setSwiperCurrent(event.detail?.current ?? initialIndex);
    },
    [initialIndex],
  );

  const handleSwiperAnimationFinish = useCallback(
    (event: { detail?: DateSwiperDetail }) => {
      const currentIndex = event.detail?.current ?? swiperCurrent;
      const currentDate = dateWindow[currentIndex];
      if (!currentDate) {
        return;
      }

      if (!currentDate.isSame(selectedDate, 'day')) {
        onDateChange(currentDate);
      }

      if (currentIndex <= preloadThreshold) {
        const firstDate = dateWindow[0];
        const prependDates = Array.from({ length: extendCount }, (_, index) =>
          firstDate.subtract(extendCount - index, 'day'),
        );
        setDateWindow([...prependDates, ...dateWindow]);
        setSwiperCurrent(currentIndex + extendCount);
        return;
      }

      if (currentIndex >= dateWindow.length - 1 - preloadThreshold) {
        const lastDate = dateWindow[dateWindow.length - 1];
        const appendDates = Array.from({ length: extendCount }, (_, index) =>
          lastDate.add(index + 1, 'day'),
        );
        setDateWindow([...dateWindow, ...appendDates]);
      }
    },
    [dateWindow, extendCount, onDateChange, preloadThreshold, selectedDate, swiperCurrent],
  );

  return {
    dateWindow,
    swiperCurrent,
    handleCalendarChange,
    handleSwiperChange,
    handleSwiperAnimationFinish,
  };
}
