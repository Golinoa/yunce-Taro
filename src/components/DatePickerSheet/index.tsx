/**
 * DatePickerSheet - 底部日期选择弹窗
 *
 * 使用原生 PickerView 实现年/月/日三列选择。
 */
import { View, Text, PickerView, PickerViewColumn } from '@tarojs/components';
import cn from 'classnames';
import dayjs from 'dayjs';
import React, { useEffect, useMemo, useState } from 'react';
import BottomSheet from '@/components/BottomSheet';

interface DatePickerSheetProps {
  visible: boolean;
  value?: string; // YYYY-MM-DD
  title?: string;
  onClose: () => void;
  onConfirm: (date: string) => void;
}

const YEARS = Array.from({ length: 11 }, (_, i) => (dayjs().year() - 5 + i).toString());
const MONTHS = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
const DAYS = Array.from({ length: 31 }, (_, i) => (i + 1).toString().padStart(2, '0'));

const DatePickerSheet: React.FC<DatePickerSheetProps> = ({
  visible,
  value,
  title = '选择日期',
  onClose,
  onConfirm,
}) => {
  const current = useMemo(() => (value ? dayjs(value) : dayjs()), [value]);
  const [selected, setSelected] = useState([
    YEARS.indexOf(current.year().toString()),
    current.month(),
    current.date() - 1,
  ]);

  useEffect(() => {
    if (visible && value) {
      const d = dayjs(value);
      setSelected([Math.max(0, YEARS.indexOf(d.year().toString())), d.month(), d.date() - 1]);
    }
  }, [visible, value]);

  const handleChange = (e: { detail: { value: number[] } }) => {
    setSelected(e.detail.value);
  };

  const selectedDate = dayjs(`${YEARS[selected[0]]}-${MONTHS[selected[1]]}-${DAYS[selected[2]]}`);
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
              isValid ? 'text-schedule-attend' : 'text-muted-foreground',
            )}
            onClick={handleConfirm}
          >
            确认
          </Text>
        </View>

        <PickerView
          className="h-[480rpx]"
          indicatorStyle="height: 96rpx; line-height: 96rpx;"
          value={selected}
          onChange={handleChange}
        >
          <PickerViewColumn>
            {YEARS.map((y) => (
              <View key={y} className="center h-[96rpx]">
                <Text className="text-[34rpx] text-foreground">{y}</Text>
              </View>
            ))}
          </PickerViewColumn>
          <PickerViewColumn>
            {MONTHS.map((m) => (
              <View key={m} className="center h-[96rpx]">
                <Text className="text-[34rpx] text-foreground">{m}</Text>
              </View>
            ))}
          </PickerViewColumn>
          <PickerViewColumn>
            {DAYS.map((d) => (
              <View key={d} className="center h-[96rpx]">
                <Text className="text-[34rpx] text-foreground">{d}</Text>
              </View>
            ))}
          </PickerViewColumn>
        </PickerView>
      </View>
    </BottomSheet>
  );
};

export default DatePickerSheet;
