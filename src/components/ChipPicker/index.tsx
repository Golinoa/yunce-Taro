import { View } from '@tarojs/components';
import cn from 'classnames';
import React from 'react';

/**
 * ChipPicker - 标签选择器组件
 *
 * 对齐设计稿 .method-picker / .method-chip：
 * - flex-wrap, gap 8px(16rpx)
 * - chip: min-h 36px(72rpx), padding 8px 18px(16rpx 36rpx), 圆角 10px(20rpx)
 * - 选中: border-primary, bg-primary-bg, text-primary, font-600
 * - 未选中: border-border, bg-input, text-secondary
 */

export interface ChipPickerOption {
  label: string;
  value: string;
}

export interface ChipPickerProps {
  options: ChipPickerOption[];
  value: string | string[];
  onChange: (value: string | string[]) => void;
  multiple?: boolean;
  className?: string;
}

const ChipPicker: React.FC<ChipPickerProps> = ({
  options,
  value,
  onChange,
  multiple = false,
  className,
}) => {
  const isSelected = (optValue: string): boolean => {
    if (multiple) return Array.isArray(value) && value.includes(optValue);
    return value === optValue;
  };

  const handleClick = (optValue: string) => {
    if (multiple) {
      const current = Array.isArray(value) ? value : [];
      const next = current.includes(optValue)
        ? current.filter((v) => v !== optValue)
        : [...current, optValue];
      onChange(next);
    } else {
      onChange(optValue);
    }
  };

  return (
    <View className={cn('flex flex-row flex-wrap gap-2', className)}>
      {options.map((opt) => {
        const selected = isSelected(opt.value);
        return (
          <View
            key={opt.value}
            className={cn('chip', selected ? 'chip-active' : 'chip-inactive')}
            onClick={() => handleClick(opt.value)}
          >
            {opt.label}
          </View>
        );
      })}
    </View>
  );
};

export default ChipPicker;
