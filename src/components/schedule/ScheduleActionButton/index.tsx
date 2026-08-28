import { View, Text } from '@tarojs/components';
import cn from 'classnames';
import React from 'react';
import type { ITouchEvent } from '@tarojs/components';
import Icon from '@/components/Icon';
import type { IconName } from '@/components/Icon';

export interface ScheduleActionButtonProps {
  label: string;
  variant: 'attend' | 'adjust' | 'edit' | 'warning' | 'danger' | 'neutral';
  onClick?: (e: ITouchEvent) => void;
  wide?: boolean;
  /** 紧凑尺寸（信息行右侧点名） */
  size?: 'md' | 'sm';
  /** 左侧图标（如约试听加号） */
  icon?: IconName;
}

const VARIANT_CLASS_MAP: Record<ScheduleActionButtonProps['variant'], string> = {
  // 点名：今日课表主色 token
  attend: 'bg-schedule-attend text-primary-foreground',
  // 调课等：主题强调色
  adjust: 'bg-schedule-adjust text-primary-foreground',
  edit: 'bg-schedule-edit text-primary-foreground',
  // 补录：淡中性色，不抢主题色
  neutral: 'border border-border/80 bg-muted text-muted-foreground',
  warning: 'border border-warning/25 bg-warning/10 text-warning',
  danger: 'border border-destructive/20 bg-destructive/10 text-destructive',
};

const NEUTRAL_LIKE = new Set<ScheduleActionButtonProps['variant']>([
  'neutral',
  'warning',
  'danger',
]);

const ScheduleActionButton: React.FC<ScheduleActionButtonProps> = ({
  label,
  variant,
  onClick,
  wide = false,
  size = 'md',
  icon,
}) => {
  const compact = size === 'sm';
  const iconColor = NEUTRAL_LIKE.has(variant) ? 'mutedForeground' : 'white';
  return (
    <View
      className={cn(
        'flex items-center justify-center gap-[6rpx] rounded-[12rpx] active:opacity-85',
        compact ? 'h-[56rpx] min-w-[88rpx] px-[18rpx]' : 'h-[76rpx] px-[22rpx]',
        !compact && (wide ? 'min-w-[152rpx]' : 'min-w-[96rpx]'),
        VARIANT_CLASS_MAP[variant],
      )}
      onClick={onClick}
    >
      {icon ? <Icon name={icon} size={compact ? 24 : 28} color={iconColor} /> : null}
      <Text className={cn('font-semibold leading-none', compact ? 'text-[22rpx]' : 'text-[24rpx]')}>
        {label}
      </Text>
    </View>
  );
};

export default ScheduleActionButton;
