/**
 * DatePickerSheet - 底部日期选择弹窗
 *
 * 使用原生 PickerView 实现年/月/日三列选择（与系统 Picker mode=date 弹层区分）。
 *
 * 注意：不要在模块顶层导出/持有可变数组常量再配合 useState 数组解构——
 * Taro weapp ModuleConcatenation 可能撞名导致白屏（同 package-form 历史问题）。
 */
import { View, Text, PickerView, PickerViewColumn } from '@tarojs/components';
import cn from 'classnames';
import dayjs from 'dayjs';
import React, { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import BottomSheet from '@/components/BottomSheet';
import {
  datePickerYearIndex,
  getDatePickerDays,
  getDatePickerMonths,
  getDatePickerYears,
} from './date-picker-utils';

interface DatePickerSheetProps {
  visible: boolean;
  value?: string; // YYYY-MM-DD
  title?: string;
  onClose: () => void;
  onConfirm: (date: string) => void;
}

function useStatePair<T>(initial: T | (() => T)): [T, Dispatch<SetStateAction<T>>] {
  const pair = useState(initial);
  return [pair[0], pair[1]];
}

const DatePickerSheet: React.FC<DatePickerSheetProps> = ({
  visible,
  value,
  title = '选择日期',
  onClose,
  onConfirm,
}) => {
  const years = useMemo(() => getDatePickerYears(), []);
  const months = useMemo(() => getDatePickerMonths(), []);
  const days = useMemo(() => getDatePickerDays(), []);

  const current = useMemo(() => (value ? dayjs(value) : dayjs()), [value]);
  const selectedPair = useStatePair([
    datePickerYearIndex(current.year(), years),
    current.month(),
    current.date() - 1,
  ]);
  const selected = selectedPair[0];
  const setSelected = selectedPair[1];

  useEffect(() => {
    if (!visible) return;
    const d = value ? dayjs(value) : dayjs();
    const safe = d.isValid() ? d : dayjs();
    setSelected([
      datePickerYearIndex(safe.year(), years),
      safe.month(),
      Math.max(0, safe.date() - 1),
    ]);
  }, [visible, value, years, setSelected]);

  const handleChange = (e: { detail: { value: number[] } }) => {
    setSelected(e.detail.value);
  };

  const y = years[selected[0]] || years[0];
  const m = months[selected[1]] || '01';
  const dayNum = Math.min(selected[2] + 1, dayjs(`${y}-${m}-01`).daysInMonth());
  const selectedDate = dayjs(`${y}-${m}-${String(dayNum).padStart(2, '0')}`);
  const isValid = selectedDate.isValid();

  const handleConfirm = () => {
    if (!isValid) return;
    onConfirm(selectedDate.format('YYYY-MM-DD'));
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      height="auto"
      scrollable={false}
      className="rounded-t-[32rpx]"
    >
      <View className="bg-white">
        <View className="flex items-center justify-between px-[32rpx] py-[24rpx]">
          <Text
            className="text-[32rpx] text-foreground-secondary active:opacity-70"
            onClick={onClose}
          >
            取消
          </Text>
          <Text className="text-[34rpx] font-medium text-foreground">{title}</Text>
          <Text
            className={cn(
              'text-[32rpx] active:opacity-70',
              isValid ? 'text-primary' : 'text-muted-foreground',
            )}
            onClick={handleConfirm}
          >
            确认
          </Text>
        </View>

        {/* 微信：PickerView indicator 高度禁用 rpx（会被忽略退回 34px），须用 px，与 item 96rpx@375=48px 对齐 */}
        <PickerView
          className="h-[480rpx]"
          indicatorStyle="height: 48px; line-height: 48px;"
          value={selected}
          onChange={handleChange}
        >
          <PickerViewColumn>
            {years.map((year) => (
              <View key={year} className="center">
                <Text className="text-[34rpx] text-foreground">{year}</Text>
              </View>
            ))}
          </PickerViewColumn>
          <PickerViewColumn>
            {months.map((month) => (
              <View key={month} className="center">
                <Text className="text-[34rpx] text-foreground">{month}</Text>
              </View>
            ))}
          </PickerViewColumn>
          <PickerViewColumn>
            {days.map((day) => (
              <View key={day} className="center">
                <Text className="text-[34rpx] text-foreground">{day}</Text>
              </View>
            ))}
          </PickerViewColumn>
        </PickerView>
      </View>
    </BottomSheet>
  );
};

export default DatePickerSheet;
