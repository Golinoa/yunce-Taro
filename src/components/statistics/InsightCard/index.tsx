/**
 * InsightCard - 洞察卡片组件
 * 支持左滑显示操作按钮：已读 / 不再提示
 * 最多5条，权重排序，乐观在上悲观在下
 */
import { View, Text } from '@tarojs/components';
import React, { useState, useCallback, useRef } from 'react';
import Icon from '@/components/Icon';

/** 洞察类型 */
export type InsightType = 'success' | 'info' | 'warning';

/** 洞察数据项 */
export interface InsightItem {
  /** 唯一标识（用于已读/不再提示） */
  id: string;
  /** 洞察类型 */
  type: InsightType;
  /** 权重（1-3，3最高） */
  weight: number;
  /** 标题（不超过15字） */
  title: string;
  /** 描述（不超过40字） */
  desc: string;
}

/** 类型配置映射 */
const INSIGHT_CONFIG: Record<InsightType, { icon: string; color: string; bgClass: string }> = {
  success: { icon: 'mdi-trending-up', color: 'primary', bgClass: 'bg-primary/10' },
  info: { icon: 'mdi-lightbulb-outline', color: 'accent', bgClass: 'bg-accent/10' },
  warning: { icon: 'mdi-alert-outline', color: 'warning', bgClass: 'bg-warning/10' },
};

/** 操作按钮宽度（rpx） */
const ACTION_WIDTH = 160;

interface InsightCardProps {
  item: InsightItem;
  onRead?: (id: string) => void;
  onDismiss?: (id: string) => void;
  onSwipeStateChange?: (swiping: boolean) => void;
}

const TOUCH_ACTIVATION_DISTANCE = 12;
const TOUCH_DIRECTION_RATIO = 1.1;

const InsightCard: React.FC<InsightCardProps> = ({
  item,
  onRead,
  onDismiss,
  onSwipeStateChange,
}) => {
  const config = INSIGHT_CONFIG[item.type] || INSIGHT_CONFIG.info;
  const [offsetX, setOffsetX] = useState(0);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchStartOffset = useRef(0);
  const gestureModeRef = useRef<'idle' | 'horizontal' | 'vertical'>('idle');

  /** 触摸开始 */
  const handleTouchStart = useCallback(
    (e) => {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
      touchStartOffset.current = offsetX;
      gestureModeRef.current = 'idle';
      onSwipeStateChange?.(true);
    },
    [offsetX, onSwipeStateChange],
  );

  /** 触摸移动 */
  const handleTouchMove = useCallback(
    (e) => {
      const deltaX = e.touches[0].clientX - touchStartX.current;
      const deltaY = e.touches[0].clientY - touchStartY.current;
      const absDeltaX = Math.abs(deltaX);
      const absDeltaY = Math.abs(deltaY);

      if (gestureModeRef.current === 'idle') {
        if (
          absDeltaX < TOUCH_ACTIVATION_DISTANCE &&
          absDeltaY < TOUCH_ACTIVATION_DISTANCE
        ) {
          return;
        }

        if (absDeltaX > absDeltaY * TOUCH_DIRECTION_RATIO) {
          gestureModeRef.current = 'horizontal';
        } else {
          gestureModeRef.current = 'vertical';
          onSwipeStateChange?.(false);
          return;
        }
      }

      if (gestureModeRef.current !== 'horizontal') {
        return;
      }

      const newOffset = Math.min(
        0,
        Math.max(-ACTION_WIDTH * 2, touchStartOffset.current + deltaX * 2),
      );
      setOffsetX(newOffset);
    },
    [onSwipeStateChange],
  );

  /** 触摸结束 - 自动吸附 */
  const handleTouchEnd = useCallback(() => {
    if (gestureModeRef.current !== 'horizontal') {
      gestureModeRef.current = 'idle';
      onSwipeStateChange?.(false);
      return;
    }

    // 滑动超过一半则展开，否则回弹
    if (offsetX < -ACTION_WIDTH) {
      setOffsetX(-ACTION_WIDTH * 2);
    } else {
      setOffsetX(0);
    }
    gestureModeRef.current = 'idle';
    onSwipeStateChange?.(false);
  }, [offsetX, onSwipeStateChange]);

  const handleTouchCancel = useCallback(() => {
    gestureModeRef.current = 'idle';
    onSwipeStateChange?.(false);
  }, [onSwipeStateChange]);

  const handleRead = useCallback(() => {
    onRead?.(item.id);
    setOffsetX(0);
    onSwipeStateChange?.(false);
  }, [item.id, onRead]);

  const handleDismiss = useCallback(() => {
    onDismiss?.(item.id);
    setOffsetX(0);
    onSwipeStateChange?.(false);
  }, [item.id, onDismiss]);

  return (
    <View className="relative overflow-hidden rounded-[24rpx]">
      {/* 操作按钮区（底层，左滑露出） */}
      <View className="absolute right-0 top-0 bottom-0 flex">
        <View
          className="w-[160rpx] h-full bg-primary flex items-center justify-center"
          onClick={handleRead}
        >
          <Text className="text-[24rpx] text-white font-medium">已读</Text>
        </View>
        <View
          className="w-[160rpx] h-full bg-muted-foreground flex items-center justify-center"
          onClick={handleDismiss}
        >
          <Text className="text-[24rpx] text-white font-medium">不再提示</Text>
        </View>
      </View>

      {/* 卡片主体（可滑动层） */}
      <View
        className="bg-white rounded-[24rpx] p-[24rpx] border-[2rpx] border-solid border-border-light flex items-start gap-[24rpx] shadow-card transition-transform"
        style={{ transform: `translateX(${offsetX}rpx)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
      >
        {/* 图标 */}
        <View
          className={`w-[72rpx] h-[72rpx] rounded-[16rpx] flex items-center justify-center flex-shrink-0 ${config.bgClass}`}
        >
          <Icon name={config.icon} size="sm" color={config.color} />
        </View>
        {/* 文本 */}
        <View className="flex-1 min-w-0">
          <Text className="text-[28rpx] font-medium text-foreground block truncate">
            {item.title}
          </Text>
          <Text className="text-[24rpx] text-foreground-secondary block mt-[4rpx] line-clamp-2">
            {item.desc}
          </Text>
        </View>
      </View>
    </View>
  );
};

export default InsightCard;
