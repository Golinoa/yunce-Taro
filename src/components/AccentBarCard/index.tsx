import { View, Text } from '@tarojs/components';
import cn from 'classnames';
import React from 'react';

/** 待办事态等级（左侧色条颜色） */
export type TodoLevel = 'urgent' | 'high' | 'normal' | 'low';

/** 等级 → 色条颜色（对齐课程管理左侧色条，使用 Token） */
export const TODO_LEVEL_BAR_COLOR: Record<TodoLevel, string> = {
  urgent: 'hsl(var(--destructive))',
  high: 'hsl(var(--warning))',
  normal: 'hsl(var(--primary))',
  low: 'hsl(var(--info))',
};

export interface AccentBarCardProps {
  /** 主标题 */
  title: string;
  /** 副标题 / 描述 */
  desc?: string;
  /** 事态等级，决定左侧色条颜色 */
  level?: TodoLevel;
  /** 整卡点击 */
  onClick?: () => void;
  /** 右侧文字操作（如「已读」） */
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

/**
 * AccentBarCard - 左侧色条 + 纯文字信息卡
 *
 * 使用场景：首页待办列表、与课程管理班课卡片色条风格统一的简约列表项。
 * 无图标、无 emoji，仅文字 + 等级色条。
 */
const AccentBarCard: React.FC<AccentBarCardProps> = ({
  title,
  desc,
  level = 'normal',
  onClick,
  actionLabel,
  onAction,
  className,
}) => {
  const barColor = TODO_LEVEL_BAR_COLOR[level];

  return (
    <View
      className={cn(
        'bg-card rounded-[24rpx] px-[32rpx] py-[28rpx] flex flex-row items-center gap-[20rpx] shadow-card press-bg',
        onClick && 'active:opacity-90',
        className,
      )}
      onClick={onClick}
    >
      <View
        className="w-[16rpx] min-h-[60rpx] self-stretch rounded-full shrink-0"
        style={{ backgroundColor: barColor }}
      />
      <View className="flex-1 min-w-0">
        <Text className="text-[28rpx] font-medium text-foreground block truncate">{title}</Text>
        {desc ? (
          <Text className="mt-[6rpx] block text-[22rpx] text-muted-foreground leading-relaxed line-clamp-2">
            {desc}
          </Text>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <View
          className="shrink-0 px-[20rpx] py-[10rpx] rounded-full bg-muted active:opacity-70 press-scale"
          onClick={(e) => {
            e.stopPropagation?.();
            onAction();
          }}
        >
          <Text className="text-[24rpx] text-muted-foreground">{actionLabel}</Text>
        </View>
      ) : null}
    </View>
  );
};

export default AccentBarCard;
