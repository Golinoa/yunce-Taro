import { View, Text } from '@tarojs/components';
import cn from 'classnames';
import React from 'react';
import type { ITouchEvent } from '@tarojs/components';

export interface ScheduleActionButtonProps {
  label: string;
  variant: 'attend' | 'adjust' | 'edit' | 'warning' | 'danger';
  onClick?: (e: ITouchEvent) => void;
  wide?: boolean;
}

const VARIANT_CLASS_MAP: Record<ScheduleActionButtonProps['variant'], string> = {
  attend: 'bg-schedule-attend text-white',
  adjust: 'bg-schedule-adjust text-white',
  edit: 'bg-schedule-edit text-white',
  warning: 'border border-warning/25 bg-warning/10 text-warning',
  danger: 'border border-destructive/20 bg-destructive/10 text-destructive',
};

const ScheduleActionButton: React.FC<ScheduleActionButtonProps> = ({
  label,
  variant,
  onClick,
  wide = false,
}) => {
  return (
    <View
      className={cn(
        'h-[76rpx] rounded-[12rpx] px-[22rpx] flex items-center justify-center active:opacity-85',
        wide ? 'min-w-[152rpx]' : 'min-w-[96rpx]',
        VARIANT_CLASS_MAP[variant],
      )}
      onClick={onClick}
    >
      <Text className="text-[24rpx] font-semibold leading-none">{label}</Text>
    </View>
  );
};

export default ScheduleActionButton;
