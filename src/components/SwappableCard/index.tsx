/**
 * SwappableCard - 可滑动露出操作按钮的卡片容器
 *
 * 支持左滑（右侧按钮）和右滑（左侧按钮）两种方向，用于列表项快捷操作。
 *
 * 核心布局：
 * - 操作按钮层初始位于卡片可视区之外（被外层 overflow-hidden 裁剪），因此收起时不可见；
 * - 滑动过程中按钮层与内容层同步位移，左滑时从右侧进入可视区；
 * - 内容层与按钮层之间无需通过 z-index 切换，避免半透明卡片透出按钮底色。
 *
 * 手势分区设计：
 * - 卡片边缘固定宽度的"滑动触发条"负责控制按钮显示/隐藏；
 * - 触发条宽度动态计算：收起时为固定宽度，打开时为"固定宽度 + 按钮总宽度"；
 * - 触发条内水平滑动时阻止事件冒泡，避免与外层 Swiper/ScrollView 冲突；
 * - 按钮点击与内容点击均加入滑动保护期，避免滑动收起时误触；
 * - 支持卡片互斥：传入 cardId/openCardId/onOpenChange 后，同一时间只能打开一张卡片的按钮。
 */
import { View, Text, type ITouchEvent } from '@tarojs/components';
import cn from 'classnames';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/** 操作按钮单个宽度（px） */
const ACTION_ITEM_WIDTH_PX = 65;
/** 边缘固定触发区宽度（px） */
const SWIPE_TRIGGER_WIDTH_PX = 60;
/** 滑动触发阈值（px） */
const MOVE_THRESHOLD = 4;
/** 滑动后忽略点击的保护时长（ms） */
const SWIPE_CLICK_GUARD_MS = 300;

export interface SwappableCardAction {
  /** 按钮文案 */
  label: string;
  /** 点击回调 */
  onClick: () => void;
  /** 是否禁用 */
  disabled?: boolean;
  /** 按钮语义色 */
  variant?: 'default' | 'danger' | 'warning';
}

export interface SwappableCardProps {
  /** 卡片内容 */
  children: React.ReactNode;
  /** 滑动露出的操作按钮，建议 1-2 个 */
  actions: SwappableCardAction[];
  /** 滑动方向：left=左滑露出右侧按钮；right=右滑露出左侧按钮 */
  direction?: 'left' | 'right';
  /** 卡片点击回调（非滑动时触发） */
  onClick?: () => void;
  /** 外层容器类名 */
  className?: string;
  /** 卡片圆角类名 */
  radiusClassName?: string;
  /** 当前卡片唯一标识，用于互斥管理 */
  cardId?: string;
  /** 当前处于打开状态的卡片 ID */
  openCardId?: string | null;
  /** 打开状态变化回调 */
  onOpenChange?: (cardId: string | null) => void;
}

const SwappableCard: React.FC<SwappableCardProps> = ({
  children,
  actions,
  direction = 'left',
  onClick,
  className,
  radiusClassName = 'rounded-[14rpx]',
  cardId,
  openCardId,
  onOpenChange,
}) => {
  const [translateX, setTranslateX] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const startTranslateRef = useRef(0);
  const isSwipingRef = useRef(false);
  const directionLockedRef = useRef<'h' | 'v' | null>(null);
  const lastSwipeTimeRef = useRef(0);

  const isRight = direction === 'right';
  const actionTotalWidth = useMemo(() => actions.length * ACTION_ITEM_WIDTH_PX, [actions.length]);
  const maxTranslate = isRight ? actionTotalWidth : -actionTotalWidth;

  /** 触发条动态宽度 */
  const triggerWidth = isOpen ? SWIPE_TRIGGER_WIDTH_PX + actionTotalWidth : SWIPE_TRIGGER_WIDTH_PX;

  /** 互斥：其他卡片打开时收起当前卡片 */
  useEffect(() => {
    if (isOpen && cardId !== undefined && openCardId !== undefined && openCardId !== cardId) {
      setTranslateX(0);
      setIsOpen(false);
    }
  }, [isOpen, cardId, openCardId]);

  const isInClickGuard = useCallback(() => {
    return Date.now() - lastSwipeTimeRef.current < SWIPE_CLICK_GUARD_MS;
  }, []);

  const handleTouchStart = useCallback(
    (e: ITouchEvent) => {
      startXRef.current = e.touches?.[0]?.clientX ?? 0;
      startYRef.current = e.touches?.[0]?.clientY ?? 0;
      startTranslateRef.current = translateX;
      isSwipingRef.current = false;
      directionLockedRef.current = null;
    },
    [translateX],
  );

  const handleTouchMove = useCallback(
    (e: ITouchEvent) => {
      const clientX = e.touches?.[0]?.clientX ?? 0;
      const clientY = e.touches?.[0]?.clientY ?? 0;
      const deltaX = clientX - startXRef.current;
      const deltaY = clientY - startYRef.current;

      if (!directionLockedRef.current) {
        if (Math.abs(deltaX) > MOVE_THRESHOLD || Math.abs(deltaY) > MOVE_THRESHOLD) {
          directionLockedRef.current = Math.abs(deltaX) > Math.abs(deltaY) ? 'h' : 'v';
        } else {
          return;
        }
      }

      if (directionLockedRef.current === 'v') {
        return;
      }

      e.stopPropagation?.();

      if (Math.abs(deltaX) > MOVE_THRESHOLD) {
        isSwipingRef.current = true;
      }

      let next = startTranslateRef.current + deltaX;
      if (isRight) {
        if (next > actionTotalWidth) next = actionTotalWidth;
        if (next < 0) next = 0;
      } else {
        if (next < -actionTotalWidth) next = -actionTotalWidth;
        if (next > 0) next = 0;
      }
      setTranslateX(next);
    },
    [actionTotalWidth, isRight],
  );

  const handleTouchEnd = useCallback(() => {
    if (!isSwipingRef.current) {
      directionLockedRef.current = null;
      return;
    }

    lastSwipeTimeRef.current = Date.now();

    const threshold = actionTotalWidth / 2;
    if (isRight ? translateX > threshold : translateX < -threshold) {
      setTranslateX(maxTranslate);
      setIsOpen(true);
      onOpenChange?.(cardId ?? null);
    } else {
      setTranslateX(0);
      setIsOpen(false);
      onOpenChange?.(null);
    }
    isSwipingRef.current = false;
    directionLockedRef.current = null;
  }, [actionTotalWidth, cardId, isRight, maxTranslate, onOpenChange, translateX]);

  const handleTouchCancel = useCallback(() => {
    isSwipingRef.current = false;
    directionLockedRef.current = null;
  }, []);

  const handleActionClick = useCallback(
    (action: SwappableCardAction, e?: { stopPropagation?: () => void }) => {
      e?.stopPropagation?.();
      if (action.disabled) return;
      if (isInClickGuard()) return;
      setTranslateX(0);
      setIsOpen(false);
      onOpenChange?.(null);
      setTimeout(action.onClick, 150);
    },
    [isInClickGuard, onOpenChange],
  );

  const handleClick = useCallback(() => {
    // 滑动保护：避免右滑收起时触发卡片主点击
    if (isInClickGuard()) return;

    if (isOpen) {
      setTranslateX(0);
      setIsOpen(false);
      onOpenChange?.(null);
      return;
    }
    onClick?.();
  }, [isInClickGuard, isOpen, onClick, onOpenChange]);

  const getActionClassName = (variant?: SwappableCardAction['variant'], disabled?: boolean) => {
    if (disabled) {
      return 'bg-muted';
    }
    switch (variant) {
      case 'danger':
        return 'bg-destructive active:opacity-80';
      case 'warning':
        return 'bg-warning active:opacity-80';
      case 'default':
      default:
        return 'bg-foreground-secondary active:opacity-80';
    }
  };

  // 按钮层跟随内容层同步位移：收起时位于可视区外，滑动时进入可视区
  const actionLayerTranslateX = isRight
    ? translateX - actionTotalWidth
    : translateX + actionTotalWidth;

  return (
    <View className={cn('relative overflow-hidden', radiusClassName, className)}>
      {/* 操作按钮层：初始位于卡片可视区之外，被 overflow-hidden 裁剪；
          滑动时与内容层同步位移，从边缘进入可视区；
          z-index 高于内容层，避免半透明卡片透出按钮底色 */}
      <View
        className={cn(
          'absolute top-0 flex h-full items-stretch z-30',
          isRight ? 'left-0' : 'right-0',
        )}
        style={{
          width: `${actionTotalWidth}px`,
          transform: `translateX(${actionLayerTranslateX}px)`,
          transition: 'transform 0.2s ease',
        }}
      >
        {actions.map((action, index) => (
          <View
            key={index}
            className={cn('center', getActionClassName(action.variant, action.disabled))}
            style={{ width: `${ACTION_ITEM_WIDTH_PX}px` }}
            onClick={(e) => handleActionClick(action, e)}
          >
            <Text className="text-[26rpx] font-medium text-white">{action.label}</Text>
          </View>
        ))}
      </View>

      {/* 内容层 */}
      <View
        className="relative z-20 w-full"
        style={{
          transform: `translateX(${translateX}px)`,
          transition: 'transform 0.2s ease',
        }}
        onClick={handleClick}
      >
        {children}
      </View>

      {/* 滑动触发条：z-index 低于按钮层，按钮层仅接收 click 事件，
          因此触发条仍可处理按钮区域内的滑动收起 */}
      <View
        className={cn('absolute top-0 z-20 h-full', isRight ? 'left-0' : 'right-0')}
        style={{ width: `${triggerWidth}px` }}
        catchMove
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
      />
    </View>
  );
};

export default SwappableCard;
