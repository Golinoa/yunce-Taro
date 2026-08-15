/**
 * TimeSelector - 时间选择器组件
 * 原版：大号月份选择器，白底圆角，带下拉箭头
 */
import { View, Text, Picker } from '@tarojs/components';
import React from 'react';
import Icon from '@/components/Icon';

export interface MonthOption {
  label: string;
  year: number;
  month: number;
}

interface TimeSelectorProps {
  year: number;
  month: number;
  monthOptions: MonthOption[];
  monthIndex: number;
  filterMode?: 'month' | 'quarter' | 'year' | 'custom';
  onMonthChange: (year: number, month: number) => void;
}

const TimeSelector: React.FC<TimeSelectorProps> = ({
  year,
  month,
  monthOptions,
  monthIndex,
  filterMode = 'month',
  onMonthChange,
}) => {
  const displayText =
    filterMode === 'year'
      ? `${year}年全年`
      : filterMode === 'quarter'
        ? `${year}年 Q${month}`
        : `${year}年${month}月`;

  return (
    <Picker
      mode="selector"
      range={monthOptions.map((o) => o.label)}
      value={monthIndex >= 0 ? monthIndex : 0}
      onChange={(e) => {
        const idx = Number(e.detail.value);
        const opt = monthOptions[idx];
        if (opt) onMonthChange(opt.year, opt.month);
      }}
    >
      <View className="bg-card rounded-2xl px-5 py-3 flex items-center justify-between mb-4 border border-solid border-border-light">
        <Text className="text-foreground text-lg font-semibold">{displayText}</Text>
        <Icon name="mdi-chevron-down" size="sm" color="muted" />
      </View>
    </Picker>
  );
};

export default TimeSelector;
