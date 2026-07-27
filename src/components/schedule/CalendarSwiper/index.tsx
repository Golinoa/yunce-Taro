/**
 * CalendarSwiper - 日历 + Swiper 日期切换容器
 *
 * 统一排课页、约课页等需要"顶部日历 + 左右滑动切换日期"的页面结构。
 * 内部封装 CalendarWeekSelector 与 useDateSwiperWindow，外部只需关注按日期渲染内容。
 */
import { Swiper, SwiperItem, ScrollView, View } from '@tarojs/components';
import cn from 'classnames';
import dayjs from 'dayjs';
import React from 'react';
import CalendarWeekSelector, { type CalendarDotType } from '@/components/CalendarWeekSelector';
import { useDateSwiperWindow } from '@/utils/use-date-swiper-window';

const SWIPER_DURATION = 260;

export interface CalendarSwiperProps {
  /** 当前选中日期 */
  selectedDate: dayjs.Dayjs;
  /** 日期切换回调（点击日历或滑动 Swiper 都会触发） */
  onDateChange: (date: dayjs.Dayjs) => void;
  /** 日期下方红点/灰点状态 */
  getDateDotType?: (date: dayjs.Dayjs) => CalendarDotType;
  /** 按日期渲染内容的 render prop */
  children: (date: dayjs.Dayjs) => React.ReactNode;
  /** 日历下方、Swiper 上方的工具栏/Tab 区域 */
  toolbar?: React.ReactNode;
  /** 外层容器类名 */
  className?: string;
  /** ScrollView 类名 */
  scrollViewClassName?: string;
  /** 内容区包裹层类名 */
  contentClassName?: string;
  /** ScrollView 滚动回调，可用于收起卡片操作按钮 */
  onScroll?: () => void;
}

const CalendarSwiper: React.FC<CalendarSwiperProps> = ({
  selectedDate,
  onDateChange,
  getDateDotType,
  children,
  toolbar,
  className,
  scrollViewClassName,
  contentClassName,
  onScroll,
}) => {
  const {
    dateWindow,
    swiperCurrent,
    handleCalendarChange,
    handleSwiperChange,
    handleSwiperAnimationFinish,
  } = useDateSwiperWindow({
    selectedDate,
    onDateChange,
  });

  return (
    <View className={cn('flex h-full flex-col overflow-hidden', className)}>
      <View className="flex-shrink-0 bg-schedule-page">
        <CalendarWeekSelector
          selectedDate={selectedDate}
          onChange={handleCalendarChange}
          getDateDotType={getDateDotType}
          showTodayButton
        />
      </View>

      {toolbar && <View className="flex-shrink-0 bg-schedule-page">{toolbar}</View>}

      <Swiper
        className="bg-schedule-page"
        style={{ flex: 1, minHeight: 0 }}
        current={swiperCurrent}
        duration={SWIPER_DURATION}
        easingFunction="easeOutCubic"
        skipHiddenItemLayout
        onChange={handleSwiperChange}
        onAnimationFinish={handleSwiperAnimationFinish}
      >
        {dateWindow.map((date) => (
          <SwiperItem key={date.format('YYYY-MM-DD')} itemId={date.format('YYYY-MM-DD')}>
            <ScrollView
              scrollY
              enhanced
              showScrollbar={false}
              className={cn('h-full', scrollViewClassName)}
              onScroll={onScroll}
            >
              <View className={cn('pb-[160rpx]', contentClassName)}>{children(date)}</View>
            </ScrollView>
          </SwiperItem>
        ))}
      </Swiper>
    </View>
  );
};

export default CalendarSwiper;
