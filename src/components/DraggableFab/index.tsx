/**
 * DraggableFab - 容器内可拖动的圆形加号按钮
 *
 * 使用场景：首页待办 Tab「添加待办」等，样式对齐课包/卡种页 FAB；
 * 支持记忆位置，拖动范围限制在父容器内。
 */
import { View, Text, type ITouchEvent } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Icon from '@/components/Icon';

const FAB_SIZE_RPX = 88;
const FAB_MARGIN_RPX = 24;
const DRAG_THRESHOLD_PX = 6;

interface FabPosition {
  x: number;
  y: number;
}

interface ContainerRect {
  width: number;
  height: number;
}

function normalizeRect(
  rect: Taro.NodesRef.BoundingClientRectCallbackResult | Taro.NodesRef.BoundingClientRectCallbackResult[] | null,
): ContainerRect | null {
  const node = Array.isArray(rect) ? rect[0] : rect;
  if (!node || typeof node.width !== 'number' || typeof node.height !== 'number') {
    return null;
  }
  return { width: node.width, height: node.height };
}

export interface DraggableFabProps {
  /** 容器选择器（须 position:relative） */
  containerSelector: string;
  /** 本地 storage key，记忆 FAB 位置 */
  storageKey: string;
  onClick: () => void;
  /** 容器尺寸变化时重新计算边界（如列表条数变化） */
  layoutKey?: string | number;
  /** 按钮下方文案，默认「添加」 */
  label?: string;
  className?: string;
}

function rpxToPx(rpx: number): number {
  const { windowWidth } = Taro.getWindowInfo();
  return (rpx / 750) * windowWidth;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function readStoredPosition(storageKey: string): FabPosition | null {
  try {
    const stored = Taro.getStorageSync(storageKey) as FabPosition | undefined;
    if (stored && typeof stored.x === 'number' && typeof stored.y === 'number') {
      return stored;
    }
  } catch {
    /* 静默 */
  }
  return null;
}

const DraggableFab: React.FC<DraggableFabProps> = ({
  containerSelector,
  storageKey,
  onClick,
  layoutKey,
  label = '添加',
  className,
}) => {
  const fabSizePx = rpxToPx(FAB_SIZE_RPX);
  const marginPx = rpxToPx(FAB_MARGIN_RPX);
  const [position, setPosition] = useState<FabPosition | null>(null);
  const positionRef = useRef<FabPosition | null>(null);
  const boundsRef = useRef({ width: 0, height: 0 });
  const dragRef = useRef({
    dragging: false,
    moved: false,
    startTouch: { x: 0, y: 0 },
    startPos: { x: 0, y: 0 },
  });

  const applyPosition = useCallback((next: FabPosition) => {
    positionRef.current = next;
    setPosition(next);
  }, []);

  const measureContainer = useCallback(
    (preserveCurrent: boolean) => {
      Taro.createSelectorQuery()
        .select(containerSelector)
        .boundingClientRect((rect) => {
          const bounds = normalizeRect(rect);
          if (!bounds) {
            return;
          }

          boundsRef.current = bounds;
          const maxX = Math.max(0, bounds.width - fabSizePx);
          const maxY = Math.max(0, bounds.height - fabSizePx);
          const defaultPos: FabPosition = {
            x: maxX - marginPx,
            y: maxY - marginPx,
          };

          let next = defaultPos;
          if (preserveCurrent && positionRef.current) {
            next = {
              x: clamp(positionRef.current.x, 0, maxX),
              y: clamp(positionRef.current.y, 0, maxY),
            };
          } else {
            const stored = readStoredPosition(storageKey);
            next = stored
              ? {
                  x: clamp(stored.x, 0, maxX),
                  y: clamp(stored.y, 0, maxY),
                }
              : defaultPos;
          }

          applyPosition(next);
        })
        .exec();
    },
    [applyPosition, containerSelector, fabSizePx, marginPx, storageKey],
  );

  useEffect(() => {
    Taro.nextTick(() => {
      measureContainer(false);
    });
  }, [measureContainer]);

  useEffect(() => {
    if (layoutKey === undefined) return;
    Taro.nextTick(() => {
      measureContainer(true);
    });
  }, [layoutKey, measureContainer]);

  const handleTouchStart = useCallback((event: ITouchEvent) => {
    const touch = event.touches[0];
    if (!touch || !positionRef.current) return;

    dragRef.current = {
      dragging: true,
      moved: false,
      startTouch: { x: touch.clientX, y: touch.clientY },
      startPos: { ...positionRef.current },
    };
  }, []);

  const handleTouchMove = useCallback(
    (event: ITouchEvent) => {
      if (!dragRef.current.dragging) return;

      const touch = event.touches[0];
      if (!touch) return;

      const deltaX = touch.clientX - dragRef.current.startTouch.x;
      const deltaY = touch.clientY - dragRef.current.startTouch.y;
      if (Math.abs(deltaX) > DRAG_THRESHOLD_PX || Math.abs(deltaY) > DRAG_THRESHOLD_PX) {
        dragRef.current.moved = true;
      }

      const maxX = Math.max(0, boundsRef.current.width - fabSizePx);
      const maxY = Math.max(0, boundsRef.current.height - fabSizePx);
      applyPosition({
        x: clamp(dragRef.current.startPos.x + deltaX, 0, maxX),
        y: clamp(dragRef.current.startPos.y + deltaY, 0, maxY),
      });
    },
    [applyPosition, fabSizePx],
  );

  const handleTouchEnd = useCallback(() => {
    if (!dragRef.current.dragging) return;

    const { moved } = dragRef.current;
    dragRef.current.dragging = false;

    if (positionRef.current) {
      try {
        Taro.setStorageSync(storageKey, positionRef.current);
      } catch {
        /* 静默 */
      }
    }

    if (!moved) {
      onClick();
    }
  }, [onClick, storageKey]);

  if (!position) {
    return null;
  }

  return (
    <View
      className={cn('absolute z-20', className)}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${fabSizePx}px`,
        height: `${fabSizePx}px`,
      }}
      catchMove
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <View className="flex h-full w-full flex-col items-center justify-center rounded-full bg-primary shadow-float press-scale">
        <Icon name="mdi-plus" size="md" color="white" />
        <Text className="mt-[2rpx] text-[18rpx] font-medium text-white leading-none">{label}</Text>
      </View>
    </View>
  );
};

export default DraggableFab;
