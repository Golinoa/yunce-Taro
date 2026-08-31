/**
 * CalendarMonthSheet - 底部月历选择
 *
 * 顶栏对齐 DatePickerSheet；月历主体直接复用课表 CalendarWeekSelector
 *（左右滑切月、年月 Picker、回到今天、日程点样式），保证全局一致。
 */
import { View, Text } from '@tarojs/components';
import cn from 'classnames';
import dayjs from 'dayjs';
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import BottomSheet from '@/components/BottomSheet';
import CalendarWeekSelector, { type CalendarDotType } from '@/components/CalendarWeekSelector';

interface CalendarMonthSheetProps {
  visible: boolean;
  title?: string;
  selectedDate: dayjs.Dayjs;
  onClose: () => void;
  onSelect: (date: dayjs.Dayjs) => void;
  getDateDotType?: (date: dayjs.Dayjs) => CalendarDotType;
  disablePastDates?: boolean;
  /** 多选模式（自由排课选日期） */
  multiSelect?: boolean;
  selectedDates?: string[];
  onSelectMulti?: (dates: string[]) => void;
}

const CalendarMonthSheet: React.FC<CalendarMonthSheetProps> = ({
  visible,
  title,
  selectedDate,
  onClose,
  onSelect,
  getDateDotType,
  disablePastDates = false,
  multiSelect = false,
  selectedDates = [],
  onSelectMulti,
}) => {
  const sheetTitle = title || (multiSelect ? '选择上课日期' : '选择日期');
  const [draftDate, setDraftDate] = useState(selectedDate);
  const [draftDates, setDraftDates] = useState<string[]>(selectedDates);

  useEffect(() => {
    if (!visible) return;
    const anchor =
      multiSelect && selectedDates.length > 0
        ? dayjs(selectedDates[selectedDates.length - 1])
        : selectedDate;
    setDraftDate(anchor.isValid() ? anchor : dayjs());
    setDraftDates(selectedDates);
  }, [multiSelect, selectedDate, selectedDates, visible]);

  const canConfirm = multiSelect ? draftDates.length > 0 : draftDate?.isValid();

  const isDateDisabled = useMemo(() => {
    if (!disablePastDates) return undefined;
    return (date: dayjs.Dayjs) => date.isBefore(dayjs(), 'day');
  }, [disablePastDates]);

  const handleConfirm = useCallback(() => {
    if (multiSelect) {
      if (draftDates.length === 0) return;
      onSelectMulti?.([...draftDates].sort((a, b) => (dayjs(a).isBefore(dayjs(b)) ? -1 : 1)));
      onClose();
      return;
    }
    if (!draftDate?.isValid()) return;
    onSelect(draftDate);
    onClose();
  }, [draftDate, draftDates, multiSelect, onClose, onSelect, onSelectMulti]);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      height="auto"
      maxHeightLimit="88vh"
      scrollable={false}
      className="rounded-t-[32rpx] pb-safe-bar"
    >
      <View className="bg-white">
        <View className="flex items-center justify-between px-[32rpx] pt-[28rpx] pb-[12rpx]">
          <Text
            className="text-[30rpx] text-foreground-secondary active:opacity-70"
            onClick={onClose}
          >
            取消
          </Text>
          <Text className="text-[34rpx] font-medium text-foreground">{sheetTitle}</Text>
          <Text
            className={cn(
              'text-[30rpx] active:opacity-70',
              canConfirm ? 'text-schedule-attend' : 'text-muted-foreground',
            )}
            onClick={handleConfirm}
          >
            {multiSelect && draftDates.length > 0 ? `确认(${draftDates.length})` : '确认'}
          </Text>
        </View>

        <CalendarWeekSelector
          selectedDate={draftDate}
          onChange={setDraftDate}
          getDateDotType={getDateDotType}
          isDateDisabled={isDateDisabled}
          monthOnly
          navigateMonthWithoutSelect
          multiSelect={multiSelect}
          selectedDates={draftDates}
          onSelectedDatesChange={setDraftDates}
          showTodayButton
          showExpandToggle={false}
          className="px-[20rpx] pt-[8rpx]"
        />

        {multiSelect ? (
          <View className="mt-[8rpx] flex items-center justify-between px-[32rpx]">
            <Text className="text-[24rpx] text-muted-foreground">
              {draftDates.length > 0
                ? `已选 ${draftDates.length} 天，左右滑可换月`
                : '点选日期，左右滑换月'}
            </Text>
            {draftDates.length > 0 ? (
              <Text
                className="text-[24rpx] text-primary active:opacity-70"
                onClick={() => setDraftDates([])}
              >
                清空
              </Text>
            ) : null}
          </View>
        ) : (
          <View className="mt-[8rpx] px-[32rpx]">
            <Text className="text-[24rpx] text-muted-foreground">
              已选 {draftDate.format('YYYY-MM-DD')} · 左右滑可换月
            </Text>
          </View>
        )}

        <View className="h-[28rpx]" />
      </View>
    </BottomSheet>
  );
};

export default CalendarMonthSheet;
