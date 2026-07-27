import { View, Text, Picker, Swiper, SwiperItem } from '@tarojs/components';
import cn from 'classnames';
import dayjs from 'dayjs';
import React, { useCallback, useMemo, useState, useEffect } from 'react';
import Icon from '@/components/Icon';

export type CalendarDotType = 'none' | 'active' | 'past';

export interface CalendarWeekSelectorProps {
  /** 当前选中日期 */
  selectedDate: dayjs.Dayjs;
  /** 日期切换回调 */
  onChange: (date: dayjs.Dayjs) => void;
  /** 日期下方红点/灰点状态 */
  getDateDotType?: (date: dayjs.Dayjs) => CalendarDotType;
  /** 是否展示“返回今日” */
  showTodayButton?: boolean;
  /** 是否展示展开/收起月历入口 */
  showExpandToggle?: boolean;
  /** 额外容器类名 */
  className?: string;
}

const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'];
const SWIPER_DURATION = 260;
const WEEK_WINDOW_SIZE = 9;
const MONTH_WINDOW_SIZE = 9;
const WINDOW_PRELOAD_THRESHOLD = 2;
const WINDOW_EXTEND_COUNT = 4;

function getWeekStart(date: dayjs.Dayjs): dayjs.Dayjs {
  const offset = (date.day() + 6) % 7;
  return date.subtract(offset, 'day');
}

function buildNextDate(date: dayjs.Dayjs, nextYear: number, nextMonth: number): dayjs.Dayjs {
  const maxDay = dayjs().year(nextYear).month(nextMonth).daysInMonth();
  const nextDay = Math.min(date.date(), maxDay);
  return dayjs().year(nextYear).month(nextMonth).date(nextDay);
}

function buildCalendarDates(currentMonth: dayjs.Dayjs): dayjs.Dayjs[] {
  const monthStart = currentMonth.startOf('month');
  const monthEnd = currentMonth.endOf('month');
  const startOffset = (monthStart.day() + 6) % 7;
  const gridStart = monthStart.subtract(startOffset, 'day');
  const endOffset = 6 - ((monthEnd.day() + 6) % 7);
  const gridEnd = monthEnd.add(endOffset, 'day');
  const totalDays = gridEnd.diff(gridStart, 'day') + 1;

  return Array.from({ length: totalDays }, (_, index) => gridStart.add(index, 'day'));
}

function getDefaultDateForMonth(month: dayjs.Dayjs): dayjs.Dayjs {
  const today = dayjs();
  if (month.isSame(today, 'month')) {
    return today;
  }
  return month.startOf('month');
}

function buildWeekWindow(centerWeekStart: dayjs.Dayjs): dayjs.Dayjs[] {
  const half = Math.floor(WEEK_WINDOW_SIZE / 2);
  return Array.from({ length: WEEK_WINDOW_SIZE }, (_, index) =>
    centerWeekStart.add(index - half, 'week'),
  );
}

function buildMonthWindow(centerMonth: dayjs.Dayjs): dayjs.Dayjs[] {
  const half = Math.floor(MONTH_WINDOW_SIZE / 2);
  return Array.from({ length: MONTH_WINDOW_SIZE }, (_, index) =>
    centerMonth.add(index - half, 'month').startOf('month'),
  );
}

function findDateIndex(list: dayjs.Dayjs[], target: dayjs.Dayjs, unit: dayjs.OpUnitType): number {
  return list.findIndex((item) => item.isSame(target, unit));
}

const CalendarWeekSelector: React.FC<CalendarWeekSelectorProps> = ({
  selectedDate,
  onChange,
  getDateDotType,
  showTodayButton = true,
  showExpandToggle = true,
  className,
}) => {
  const [displaySelectedDate, setDisplaySelectedDate] = useState(selectedDate);
  const [isMonthViewExpanded, setIsMonthViewExpanded] = useState(false);
  const [weekWindow, setWeekWindow] = useState(() => buildWeekWindow(getWeekStart(selectedDate)));
  const [monthWindow, setMonthWindow] = useState(() =>
    buildMonthWindow(selectedDate.startOf('month')),
  );
  const [weekSwiperCurrent, setWeekSwiperCurrent] = useState(() =>
    Math.floor(WEEK_WINDOW_SIZE / 2),
  );
  const [monthSwiperCurrent, setMonthSwiperCurrent] = useState(() =>
    Math.floor(MONTH_WINDOW_SIZE / 2),
  );

  const currentYear = dayjs().year();
  const yearOptions = useMemo(() => {
    const startYear = Math.min(currentYear - 5, displaySelectedDate.year() - 2);
    const endYear = Math.max(currentYear + 5, displaySelectedDate.year() + 2);
    return Array.from({ length: endYear - startYear + 1 }, (_, index) => startYear + index);
  }, [currentYear, displaySelectedDate]);
  const yearIndex = useMemo(
    () =>
      Math.max(
        0,
        yearOptions.findIndex((year) => year === displaySelectedDate.year()),
      ),
    [displaySelectedDate, yearOptions],
  );
  const monthOptions = useMemo(() => Array.from({ length: 12 }, (_, index) => index + 1), []);
  const monthIndex = displaySelectedDate.month();

  useEffect(() => {
    if (!selectedDate.isSame(displaySelectedDate, 'day')) {
      setDisplaySelectedDate(selectedDate);
    }
  }, [displaySelectedDate, selectedDate]);

  useEffect(() => {
    const targetWeekStart = getWeekStart(displaySelectedDate);
    setWeekWindow((prev) => {
      const index = findDateIndex(prev, targetWeekStart, 'day');
      if (index >= 0) {
        setWeekSwiperCurrent(index);
        return prev;
      }
      setWeekSwiperCurrent(Math.floor(WEEK_WINDOW_SIZE / 2));
      return buildWeekWindow(targetWeekStart);
    });
  }, [displaySelectedDate]);

  useEffect(() => {
    const targetMonth = displaySelectedDate.startOf('month');
    setMonthWindow((prev) => {
      const index = findDateIndex(prev, targetMonth, 'month');
      if (index >= 0) {
        setMonthSwiperCurrent(index);
        return prev;
      }
      setMonthSwiperCurrent(Math.floor(MONTH_WINDOW_SIZE / 2));
      return buildMonthWindow(targetMonth);
    });
  }, [displaySelectedDate]);

  const commitDateChange = useCallback(
    (date: dayjs.Dayjs) => {
      setDisplaySelectedDate(date);
      // 即使日期与当前相同也触发 onChange，让父组件可以在点击"回到今天"等场景下主动刷新数据
      onChange(date);
    },
    [onChange],
  );

  // 周视图 Swiper 变更
  const handleWeekSwiperChange = useCallback((event: { detail?: { current?: number } }) => {
    setWeekSwiperCurrent(event.detail?.current ?? 1);
  }, []);

  // 周视图 Swiper 动画完成
  const handleWeekSwiperFinish = useCallback(
    (event: { detail?: { current?: number } }) => {
      const currentIndex = event.detail?.current ?? weekSwiperCurrent;
      const currentWeekStart = weekWindow[currentIndex];
      if (!currentWeekStart) {
        return;
      }

      // 切换周时保持当前选中的星期几，避免“回到今天”等场景下选中周一而非目标日
      const dayOfWeek = displaySelectedDate.day();
      const offset = (dayOfWeek + 6) % 7;
      const newDate = currentWeekStart.add(offset, 'day');
      commitDateChange(newDate);

      if (currentIndex <= WINDOW_PRELOAD_THRESHOLD) {
        const firstWeek = weekWindow[0];
        const prependWeeks = Array.from({ length: WINDOW_EXTEND_COUNT }, (_, index) =>
          firstWeek.subtract(WINDOW_EXTEND_COUNT - index, 'week'),
        );
        setWeekWindow([...prependWeeks, ...weekWindow]);
        setWeekSwiperCurrent(currentIndex + WINDOW_EXTEND_COUNT);
        return;
      }

      if (currentIndex >= weekWindow.length - 1 - WINDOW_PRELOAD_THRESHOLD) {
        const lastWeek = weekWindow[weekWindow.length - 1];
        const appendWeeks = Array.from({ length: WINDOW_EXTEND_COUNT }, (_, index) =>
          lastWeek.add(index + 1, 'week'),
        );
        setWeekWindow([...weekWindow, ...appendWeeks]);
      }
    },
    [commitDateChange, displaySelectedDate, weekSwiperCurrent, weekWindow],
  );

  // 月视图 Swiper 变更
  const handleMonthSwiperChange = useCallback((event: { detail?: { current?: number } }) => {
    setMonthSwiperCurrent(event.detail?.current ?? 1);
  }, []);

  // 月视图 Swiper 动画完成
  const handleMonthSwiperFinish = useCallback(
    (event: { detail?: { current?: number } }) => {
      const currentIndex = event.detail?.current ?? monthSwiperCurrent;
      const nextMonth = monthWindow[currentIndex];
      if (!nextMonth) {
        return;
      }

      const nextDate = getDefaultDateForMonth(nextMonth);
      commitDateChange(nextDate);

      if (currentIndex <= WINDOW_PRELOAD_THRESHOLD) {
        const firstMonth = monthWindow[0];
        const prependMonths = Array.from({ length: WINDOW_EXTEND_COUNT }, (_, index) =>
          firstMonth.subtract(WINDOW_EXTEND_COUNT - index, 'month').startOf('month'),
        );
        setMonthWindow([...prependMonths, ...monthWindow]);
        setMonthSwiperCurrent(currentIndex + WINDOW_EXTEND_COUNT);
        return;
      }

      if (currentIndex >= monthWindow.length - 1 - WINDOW_PRELOAD_THRESHOLD) {
        const lastMonth = monthWindow[monthWindow.length - 1];
        const appendMonths = Array.from({ length: WINDOW_EXTEND_COUNT }, (_, index) =>
          lastMonth.add(index + 1, 'month').startOf('month'),
        );
        setMonthWindow([...monthWindow, ...appendMonths]);
      }
    },
    [commitDateChange, monthSwiperCurrent, monthWindow],
  );

  const toggleMonthView = useCallback(() => {
    setIsMonthViewExpanded(!isMonthViewExpanded);
  }, [isMonthViewExpanded]);

  const renderWeekDayItem = (date: dayjs.Dayjs, index: number) => {
    const selected = date.isSame(displaySelectedDate, 'day');
    const today = date.isSame(dayjs(), 'day');
    const dotType = getDateDotType?.(date) || 'none';

    return (
      <View
        key={date.format('YYYY-MM-DD')}
        className="flex w-[90rpx] flex-col items-center"
        onClick={() => commitDateChange(date)}
      >
        <Text
          className={cn(
            'text-[28rpx] leading-[40rpx]',
            selected ? 'text-destructive font-bold' : 'text-muted-foreground',
          )}
        >
          {WEEKDAY_LABELS[index]}
        </Text>
        <View
          className={cn(
            'mt-[8rpx] flex h-[64rpx] w-[64rpx] items-center justify-center rounded-full',
          )}
          style={{
            backgroundColor: selected
              ? '#ef4444'
              : today
                ? 'rgba(239, 68, 68, 0.12)'
                : 'transparent',
          }}
        >
          <Text
            className={cn(
              'text-[28rpx] font-semibold',
              selected ? 'text-white' : today ? 'text-destructive' : 'text-foreground',
            )}
          >
            {date.date()}
          </Text>
        </View>
        <View className="mt-[10rpx] h-[8rpx] w-[8rpx] rounded-full">
          {dotType === 'active' ? (
            <View className="h-[8rpx] w-[8rpx] rounded-full bg-destructive" />
          ) : null}
          {dotType === 'past' ? (
            <View className="h-[8rpx] w-[8rpx] rounded-full bg-muted-foreground" />
          ) : null}
        </View>
      </View>
    );
  };

  const renderMonthDayItem = (date: dayjs.Dayjs, monthToShow: dayjs.Dayjs) => {
    const inCurrentMonth = date.isSame(monthToShow, 'month');
    const isSelected = date.isSame(displaySelectedDate, 'day');
    const isToday = date.isSame(dayjs(), 'day');
    const dotType = getDateDotType?.(date) || 'none';

    return (
      <View
        key={date.format('YYYY-MM-DD')}
        className="flex w-[14.285%] items-center justify-center py-[10rpx]"
        onClick={() => commitDateChange(date)}
      >
        <View className="flex items-center">
          <View
            className="flex h-[84rpx] w-[84rpx] flex-col items-center justify-center rounded-full"
            style={{
              backgroundColor: isSelected
                ? '#ef4444'
                : isToday
                  ? 'rgba(239, 68, 68, 0.12)'
                  : 'transparent',
            }}
          >
            <Text
              className="text-[28rpx] font-semibold"
              style={{
                color: isSelected
                  ? '#ffffff'
                  : inCurrentMonth
                    ? isToday
                      ? '#ef4444'
                      : '#111827'
                    : '#c8ced8',
              }}
            >
              {date.date()}
            </Text>
            <View className="mt-[6rpx] h-[8rpx] w-[8rpx] rounded-full">
              {dotType === 'active' ? (
                <View
                  className="h-[8rpx] w-[8rpx] rounded-full"
                  style={{ backgroundColor: isSelected ? '#ffffff' : '#ef4444' }}
                />
              ) : null}
              {dotType === 'past' ? (
                <View className="h-[8rpx] w-[8rpx] rounded-full bg-[#b7bfcc]" />
              ) : null}
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View className={cn('px-[24rpx] pt-[26rpx]', className)}>
      <View className="flex items-center justify-between">
        <Picker
          mode="selector"
          range={yearOptions.map((year) => `${year}年`)}
          value={yearIndex}
          onChange={(event) => {
            const nextYear =
              yearOptions[Number(event.detail.value || 0)] || displaySelectedDate.year();
            commitDateChange(
              buildNextDate(displaySelectedDate, nextYear, displaySelectedDate.month()),
            );
          }}
        >
          <View className="flex min-w-[180rpx] items-center gap-[8rpx]">
            <Text className="text-[32rpx] font-semibold text-foreground leading-[40rpx]">
              {displaySelectedDate.format('YYYY年')}
            </Text>
            <Icon name="mdi-chevron-down" size={20} color="mutedForeground" />
          </View>
        </Picker>

        {showTodayButton ? (
          <View
            className="flex h-[64rpx] items-center justify-center gap-[8rpx] rounded-full border border-destructive/12 bg-destructive/8 px-[22rpx] shadow-[0_8rpx_20rpx_rgba(239,68,68,0.08)]"
            onClick={() => commitDateChange(dayjs())}
          >
            <Icon name="mdi-calendar-check-outline" size="xs" color="destructive" />
            <Text className="text-[24rpx] font-semibold text-destructive">回到今天</Text>
          </View>
        ) : (
          <View />
        )}

        <Picker
          mode="selector"
          range={monthOptions.map((month) => `${month.toString().padStart(2, '0')}月`)}
          value={monthIndex}
          onChange={(event) => {
            const nextMonth = Number(event.detail.value || 0);
            commitDateChange(
              buildNextDate(displaySelectedDate, displaySelectedDate.year(), nextMonth),
            );
          }}
        >
          <View className="flex min-w-[128rpx] items-center justify-end gap-[8rpx]">
            <Text className="text-[32rpx] font-semibold text-foreground leading-[40rpx]">
              {displaySelectedDate.format('MM月')}
            </Text>
            <Icon name="mdi-chevron-down" size={20} color="mutedForeground" />
          </View>
        </Picker>
      </View>

      {!isMonthViewExpanded ? (
        <View className="mt-[20rpx]">
          <Swiper
            className="h-[150rpx]"
            current={weekSwiperCurrent}
            duration={SWIPER_DURATION}
            easingFunction="easeOutCubic"
            skipHiddenItemLayout
            onChange={handleWeekSwiperChange}
            onAnimationFinish={handleWeekSwiperFinish}
          >
            {weekWindow.map((weekStart) => (
              <SwiperItem
                key={weekStart.format('YYYY-MM-DD')}
                itemId={weekStart.format('YYYY-MM-DD')}
              >
                <View className="w-full h-full flex items-start justify-between">
                  {Array.from({ length: 7 }, (_, index) =>
                    renderWeekDayItem(weekStart.add(index, 'day'), index),
                  )}
                </View>
              </SwiperItem>
            ))}
          </Swiper>
        </View>
      ) : (
        <View className="mt-[20rpx]">
          <View className="flex items-center justify-between px-[10rpx]">
            {WEEKDAY_LABELS.map((label) => (
              <View key={label} className="flex w-[88rpx] items-center justify-center py-[8rpx]">
                <Text className="text-[22rpx] font-medium text-muted-foreground">{label}</Text>
              </View>
            ))}
          </View>

          <Swiper
            className="h-[520rpx]"
            current={monthSwiperCurrent}
            duration={SWIPER_DURATION}
            easingFunction="easeOutCubic"
            skipHiddenItemLayout
            onChange={handleMonthSwiperChange}
            onAnimationFinish={handleMonthSwiperFinish}
          >
            {monthWindow.map((month) => (
              <SwiperItem key={month.format('YYYY-MM')} itemId={month.format('YYYY-MM')}>
                <View className="w-full h-full flex flex-wrap">
                  {buildCalendarDates(month).map((date) => renderMonthDayItem(date, month))}
                </View>
              </SwiperItem>
            ))}
          </Swiper>
        </View>
      )}

      {showExpandToggle ? (
        <View className="mt-[8rpx] flex justify-center pb-[8rpx]">
          <View
            className="flex h-[48rpx] w-[80rpx] items-center justify-center rounded-full bg-muted/60"
            onClick={toggleMonthView}
          >
            <Icon
              name={isMonthViewExpanded ? 'mdi-chevron-up' : 'mdi-chevron-down'}
              size="sm"
              color="destructive"
            />
          </View>
        </View>
      ) : null}
    </View>
  );
};

export default CalendarWeekSelector;
