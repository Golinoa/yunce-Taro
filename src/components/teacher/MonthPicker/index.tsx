import { View, Text } from '@tarojs/components';
import cn from 'classnames';
import dayjs from 'dayjs';
import React, { useState, useMemo } from 'react';

interface MonthPickerProps {
  visible: boolean;
  currentYear: number;
  currentMonth: number; // 1-12
  onSelect: (year: number, month: number) => void;
  onClose: () => void;
}

const MONTH_LABELS = [
  '1月',
  '2月',
  '3月',
  '4月',
  '5月',
  '6月',
  '7月',
  '8月',
  '9月',
  '10月',
  '11月',
  '12月',
];

const MonthPicker: React.FC<MonthPickerProps> = ({
  visible,
  currentYear,
  currentMonth,
  onSelect,
  onClose,
}) => {
  const [pickerYear, setPickerYear] = useState(currentYear);

  const now = useMemo(() => dayjs(), []);
  const currentYearNow = now.year();
  const currentMonthNow = now.month() + 1;

  const handleYearChange = (delta: number) => {
    setPickerYear((y) => y + delta);
  };

  const handleMonthSelect = (month: number) => {
    // 禁止选择未来月份
    if (pickerYear > currentYearNow) return;
    if (pickerYear === currentYearNow && month > currentMonthNow) return;
    onSelect(pickerYear, month);
  };

  const isDisabled = (month: number) => {
    if (pickerYear > currentYearNow) return true;
    if (pickerYear === currentYearNow && month > currentMonthNow) return true;
    return false;
  };

  const isSelected = (month: number) => pickerYear === currentYear && month === currentMonth;

  if (!visible) return null;

  return (
    <View className="fixed inset-0 z-50" onClick={onClose}>
      <View className="absolute inset-0 bg-black/30" />
      <View
        className="absolute bg-card rounded-b-2xl shadow-lg p-4 animate-dropIn"
        style={{ top: '88px', left: '50%', transform: 'translateX(-50%)', width: '320px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 年份切换 */}
        <View className="flex items-center justify-between mb-3">
          <View
            className="w-8 h-8 flex items-center justify-center rounded-full active:bg-muted"
            onClick={() => handleYearChange(-1)}
          >
            <Text className="text-muted-foreground text-lg">‹</Text>
          </View>
          <Text className="text-base font-bold text-foreground">{pickerYear}年</Text>
          <View
            className="w-8 h-8 flex items-center justify-center rounded-full active:bg-muted"
            onClick={() => handleYearChange(1)}
          >
            <Text className="text-muted-foreground text-lg">›</Text>
          </View>
        </View>

        {/* 月份网格 */}
        <View className="grid grid-cols-4 gap-2">
          {MONTH_LABELS.map((label, i) => {
            const month = i + 1;
            const disabled = isDisabled(month);
            const selected = isSelected(month);
            return (
              <View
                key={month}
                className={cn(
                  'py-2 rounded-xl text-center text-sm font-medium transition-colors',
                  selected && 'bg-amber text-white',
                  !selected && !disabled && 'bg-muted text-foreground active:bg-amber-10',
                  disabled && 'bg-muted/50 text-muted-foreground/40',
                )}
                onClick={() => !disabled && handleMonthSelect(month)}
              >
                {label}
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
};

export default MonthPicker;
