import { View, Text } from '@tarojs/components';
import cn from 'classnames';
import React from 'react';

/**
 * CardHeader - 卡片标题行组件
 *
 * 对齐设计稿：
 * - flex, gap 8px(16rpx), mb 16px(32rpx), pb 12px(24rpx)
 * - 底部 0.5px border-light 分割线
 * - 圆点 8px(16rpx), 标题 14px(28rpx) font-600, 副标题 11px(22rpx) text-tertiary
 */

const DOT_COLORS: Record<string, string> = {
  primary: '#5EC8A8',
  info: '#6BB5D4',
  warning: '#E8C468',
  accent: '#E89BB8',
  muted: 'rgba(0,0,0,0.35)',
  destructive: '#D94040',
};

export interface CardHeaderProps {
  title: string;
  subtitle?: string;
  dotColor?: string;
  className?: string;
}

const CardHeader: React.FC<CardHeaderProps> = ({
  title,
  subtitle,
  dotColor = 'primary',
  className,
}) => {
  const resolvedColor = DOT_COLORS[dotColor] || dotColor;

  return (
    <View
      className={cn(
        'flex flex-row items-center gap-2 mb-4 pb-3 border-b border-border/50',
        className,
      )}
    >
      <View className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: resolvedColor }} />
      <Text className="text-base font-semibold text-foreground flex-1">{title}</Text>
      {subtitle && <Text className="text-xs text-muted-foreground/60">{subtitle}</Text>}
    </View>
  );
};

export default CardHeader;
