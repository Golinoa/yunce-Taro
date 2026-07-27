/**
 * SwappableScheduleCard - 可左滑露出操作按钮的卡片容器
 *
 * 用于排课列表等场景：左滑显示编辑/取消/恢复等快捷操作，
 * 点击卡片主体触发点名等主流程跳转。
 *
 * 手势分区设计：
 * - 卡片右侧固定宽度的"滑动触发条"负责左滑显示 / 右滑隐藏按钮；
 * - 触发条宽度动态计算：收起时为固定宽度，打开时为"固定宽度 + 按钮总宽度"；
 * - 触发条内水平滑动时调用 stopPropagation 阻止外层 Swiper 切换日期；
 * - 触发条外区域不拦截 touchmove，保证 ScrollView 上下滚动和 Swiper 左右切换日期丝滑；
 * - 按钮点击加入滑动保护期，避免右滑收起时误触按钮操作；
 * - 支持卡片互斥：传入 cardId/openCardId/onOpenChange 后，同一时间只能打开一张卡片的按钮。
 *
 * 注意：微信小程序中 style 属性不支持 rpx 单位，
 * 因此 translateX 使用 px 值。操作按钮宽度也使用 px。
 */
import { View, Text, type ITouchEvent } from '@tarojs/components';
import cn from 'classnames';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/** 操作按钮单个宽度（px） */
const ACTION_ITEM_WIDTH_PX = 65;
/** 右侧固定触发区宽度（px）：收起状态下只在该窄条内左滑才打开按钮 */
const SWIPE_TRIGGER_WIDTH_PX = 60;
/** 滑动触发阈值（px） */
const MOVE_THRESHOLD = 4;
/** 滑动后忽略按钮点击的保护时长（ms），避免右滑收起时误触按钮 */
const SWIPE_CLICK_GUARD_MS = 300;

export interface SwappableScheduleCardAction {
  /** 按钮文案 */
  label: string;
  /** 点击回调 */
  onClick: () => void;
  /** 是否禁用 */
  disabled?: boolean;
  /** 按钮语义色 */
  variant?: 'default' | 'danger' | 'warning';
}

export interface SwappableScheduleCardProps {
  /** 卡片内容（通常为 ScheduleCard） */
  children: React.ReactNode;
  /** 左滑露出的操作按钮，建议 2 个 */
  actions: SwappableScheduleCardAction[];
  /** 卡片点击回调（非滑动时触发） */
  onClick?: () => void;
  /** 外层容器类名 */
  className?: string;
  /** 卡片圆角类名，同时作用于外层容器与内容层，确保左滑露出的按钮层圆角与卡片一致 */
  radiusClassName?: string;
  /** 当前卡片唯一标识，用于互斥管理 */
  cardId?: string;
  /** 当前处于打开状态的卡片 ID */
  openCardId?: string | null;
  /** 打开状态变化回调 */
  onOpenChange?: (cardId: string | null) => void;
}

const SwappableScheduleCard: React.FC<SwappableScheduleCardProps> = ({
  children,
  actions,
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
  const startYTranslateRef = useRef(0);
  const isSwipingRef = useRef(false);
  const directionLockedRef = useRef<'h' | 'v' | null>(null);
  const lastSwipeTimeRef = useRef(0);

  /** 按钮总宽度，根据 actions 数量动态计算 */
  const actionTotalWidth = useMemo(() => actions.length * ACTION_ITEM_WIDTH_PX, [actions.length]);

  /** 触发条动态宽度：收起时固定窄条，打开时覆盖固定区 + 按钮区 */
  const triggerWidth = isOpen ? SWIPE_TRIGGER_WIDTH_PX + actionTotalWidth : SWIPE_TRIGGER_WIDTH_PX;

  /** 互斥：当其他卡片被打开时，自动收起当前卡片 */
  useEffect(() => {
    if (isOpen && cardId !== undefined && openCardId !== undefined && openCardId !== cardId) {
      setTranslateX(0);
      setIsOpen(false);
    }
  }, [isOpen, cardId, openCardId]);

  const handleTouchStart = useCallback(
    (e: ITouchEvent) => {
      startXRef.current = e.touches?.[0]?.clientX ?? 0;
      startYRef.current = e.touches?.[0]?.clientY ?? 0;
      startYTranslateRef.current = translateX;
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

      // 方向锁定：首次超过阈值时确定方向，之后不再切换
      if (!directionLockedRef.current) {
        if (Math.abs(deltaX) > MOVE_THRESHOLD || Math.abs(deltaY) > MOVE_THRESHOLD) {
          directionLockedRef.current = Math.abs(deltaX) > Math.abs(deltaY) ? 'h' : 'v';
        } else {
          return;
        }
      }

      // 垂直滑动时不处理，交由 ScrollView 滚动
      if (directionLockedRef.current === 'v') {
        return;
      }

      // 水平滑动：阻止 touchmove 冒泡到外层 Swiper，避免与日期切换冲突
      e.stopPropagation?.();

      if (Math.abs(deltaX) > MOVE_THRESHOLD) {
        isSwipingRef.current = true;
      }

      let next = startYTranslateRef.current + deltaX;
      if (next < -actionTotalWidth) next = -actionTotalWidth;
      if (next > 0) next = 0;
      setTranslateX(next);
    },
    [actionTotalWidth],
  );

  const handleTouchEnd = useCallback(() => {
    if (!isSwipingRef.current) {
      // 未发生有效滑动，不拦截 tap，让事件冒泡给按钮或内容层
      directionLockedRef.current = null;
      return;
    }

    lastSwipeTimeRef.current = Date.now();

    if (translateX < -actionTotalWidth / 2) {
      setTranslateX(-actionTotalWidth);
      setIsOpen(true);
      onOpenChange?.(cardId ?? null);
    } else {
      setTranslateX(0);
      setIsOpen(false);
      onOpenChange?.(null);
    }
    isSwipingRef.current = false;
    directionLockedRef.current = null;
  }, [actionTotalWidth, cardId, onOpenChange, translateX]);

  const handleTouchCancel = useCallback(() => {
    isSwipingRef.current = false;
    directionLockedRef.current = null;
  }, []);

  const handleActionClick = useCallback(
    (action: SwappableScheduleCardAction, e?: { stopPropagation?: () => void }) => {
      e?.stopPropagation?.();
      if (action.disabled) return;
      // 滑动保护：避免右滑收起时误触按钮
      if (Date.now() - lastSwipeTimeRef.current < SWIPE_CLICK_GUARD_MS) return;
      setTranslateX(0);
      setIsOpen(false);
      onOpenChange?.(null);
      // 延迟执行，等待关闭动画结束
      setTimeout(action.onClick, 150);
    },
    [onOpenChange],
  );

  const handleClick = useCallback(() => {
    if (isOpen) {
      setTranslateX(0);
      setIsOpen(false);
      onOpenChange?.(null);
      return;
    }
    onClick?.();
  }, [isOpen, onClick, onOpenChange]);

  const getActionClassName = (
    variant?: SwappableScheduleCardAction['variant'],
    disabled?: boolean,
  ) => {
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

  return (
    <View className={cn('relative overflow-hidden', radiusClassName, className)}>
      {/* 操作按钮层：绝对定位在卡片右侧，不参与正常文档流；
          外层 overflow-hidden + 圆角保证收起时不会露出直角底色 */}
      <View
        className="absolute right-0 top-0 z-0 flex h-full items-stretch"
        style={{ width: `${actionTotalWidth}px` }}
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

      {/* 内容层：滑动时向左位移，覆盖在按钮层之上；
          应用默认圆角，确保圆角与外层一致，收起时不会露出按钮底色 */}
      <View
        className={cn('relative z-10', radiusClassName)}
        style={{
          transform: `translateX(${translateX}px)`,
          transition: 'transform 0.2s ease',
        }}
        onClick={handleClick}
      >
        {children}
      </View>

      {/* 右侧滑动触发条：动态宽度，覆盖按钮区域；
          只在该区域内左滑/右滑控制按钮显示/隐藏，其余区域事件冒泡；
          使用 catchMove 才能阻止原生 Swiper 切换日期（stopPropagation 对原生组件无效） */}
      <View
        className="absolute right-0 top-0 z-20 h-full"
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

export default SwappableScheduleCard;
