import { View } from '@tarojs/components';
import cn from 'classnames';
import React from 'react';

/**
 * SegmentedControl - 分段选择器组件
 *
 * 对齐设计稿 .type-selector：
 * - 容器: bg-muted, 圆角 12px(24rpx), padding 3px(6rpx), gap 3px(6rpx)
 * - 选项: flex-1, padding 8px 0(16rpx), 圆角 10px(20rpx)
 * - 选中: bg-white, text-primary, font-600, shadow
 * - 未选中: text-secondary
 */

export interface SegmentedControlOption {
  label: string;
  value: string;
}

export interface SegmentedControlProps {
  options: SegmentedControlOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

const SegmentedControl: React.FC<SegmentedControlProps> = ({
  options,
  value,
  onChange,
  className,
}) => {
  return (
    <View className={cn('segment-wrap', className)}>
      {options.map((opt) => {
        const isSelected = opt.value === value;
        return (
          <View
            key={opt.value}
            className={cn('segment-item', isSelected ? 'segment-active' : 'segment-inactive')}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </View>
        );
      })}
    </View>
  );
};

export default SegmentedControl;
