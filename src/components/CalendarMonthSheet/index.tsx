import { View, Text } from '@tarojs/components';
import dayjs from 'dayjs';
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import ActionButton from '@/components/ActionButton';
import BottomSheet from '@/components/BottomSheet';
import type { CalendarDotType } from '@/components/CalendarWeekSelector';
import Icon from '@/components/Icon';

interface CalendarMonthSheetProps {
  visible: boolean;
  title?: string;
  selectedDate: dayjs.Dayjs;
  onClose: () => void;
  onSelect: (date: dayjs.Dayjs) => void;
  getDateDotType?: (date: dayjs.Dayjs) => CalendarDotType;
  disablePastDates?: boolean;
}

const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'] as const;

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

const CalendarMonthSheet: React.FC<CalendarMonthSheetProps> = ({
  visible,
  selectedDate,
  onClose,
  onSelect,
  getDateDotType,
  disablePastDates = false,
}) => {
  const [displayMonth, setDisplayMonth] = useState(selectedDate.startOf('month'));
  const [draftDate, setDraftDate] = useState(selectedDate);

  useEffect(() => {
    if (visible) {
      setDisplayMonth(selectedDate.startOf('month'));
      setDraftDate(selectedDate);
    }
  }, [selectedDate, visible]);

  const calendarDates = useMemo(() => buildCalendarDates(displayMonth), [displayMonth]);

  const handleConfirm = useCallback(() => {
    onSelect(draftDate);
    onClose();
  }, [draftDate, onClose, onSelect]);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      maxHeight="85vh"
      scrollable={false}
      className="pb-safe-bar"
    >
      <View className="bg-white px-[24rpx] pb-[20rpx]">
        <View className="rounded-[28rpx] bg-[#f8fafc] px-[18rpx] py-[18rpx]">
          <View className="flex items-center justify-between">
            <View
              className="flex h-[64rpx] w-[64rpx] items-center justify-center rounded-full bg-white"
              onClick={() => setDisplayMonth((prev) => prev.subtract(1, 'month'))}
            >
              <Icon name="mdi-chevron-left" size="sm" color="foregroundSecondary" />
            </View>
            <Text className="text-[32rpx] font-semibold text-foreground">
              {displayMonth.format('YYYY年MM月')}
            </Text>
            <View
              className="flex h-[64rpx] w-[64rpx] items-center justify-center rounded-full bg-white"
              onClick={() => setDisplayMonth((prev) => prev.add(1, 'month'))}
            >
              <Icon name="mdi-chevron-right" size="sm" color="foregroundSecondary" />
            </View>
          </View>
        </View>

        <View className="mt-[20rpx] flex items-center justify-between px-[10rpx]">
          {WEEKDAY_LABELS.map((label) => (
            <View key={label} className="flex w-[88rpx] items-center justify-center py-[8rpx]">
              <Text className="text-[22rpx] font-medium text-muted-foreground">{label}</Text>
            </View>
          ))}
        </View>

        <View className="mt-[4rpx] flex flex-wrap rounded-[28rpx] bg-white">
          {calendarDates.map((date) => {
            const inCurrentMonth = date.isSame(displayMonth, 'month');
            const isSelected = date.isSame(draftDate, 'day');
            const isToday = date.isSame(dayjs(), 'day');
            const dotType = getDateDotType?.(date) || 'none';
            const isDisabled = disablePastDates && date.isBefore(dayjs(), 'day');

            return (
              <View
                key={date.format('YYYY-MM-DD')}
                className="flex w-[14.285%] items-center justify-center py-[10rpx]"
                onClick={() => {
                  if (isDisabled) {
                    return;
                  }
                  setDraftDate(date);
                }}
              >
                <View className="flex items-center">
                  <View
                    className="flex h-[84rpx] w-[84rpx] flex-col items-center justify-center rounded-full"
                    style={{
                      backgroundColor: isDisabled
                        ? 'transparent'
                        : isSelected
                          ? '#ef4444'
                          : isToday
                            ? 'rgba(239, 68, 68, 0.08)'
                            : 'transparent',
                      opacity: isDisabled ? 0.45 : 1,
                    }}
                  >
                    <Text
                      className="text-[28rpx] font-semibold"
                      style={{
                        color: isDisabled
                          ? '#c8ced8'
                          : isSelected
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
                      {!isDisabled && dotType === 'active' ? (
                        <View
                          className="h-[8rpx] w-[8rpx] rounded-full"
                          style={{ backgroundColor: isSelected ? '#ffffff' : '#ef4444' }}
                        />
                      ) : null}
                      {!isDisabled && dotType === 'past' ? (
                        <View className="h-[8rpx] w-[8rpx] rounded-full bg-[#b7bfcc]" />
                      ) : null}
                    </View>
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        <View className="mt-[12rpx]">
          <ActionButton text="确定" fixed={false} onClick={handleConfirm} />
        </View>
      </View>
    </BottomSheet>
  );
};

export default CalendarMonthSheet;
