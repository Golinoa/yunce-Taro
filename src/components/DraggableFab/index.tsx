/**
 * DraggableFab - 容器内可拖动的悬浮按钮
 *
 * 使用场景：课表「排课」、首页待办「添加」等；
 * 支持记忆位置，拖动范围限制在父容器内。
 *
 * 跟手策略：微信端用 MovableView（原生层拖动，不经 React setData）；
 * 拖动期间跳过重渲染，避免受控 x/y 把按钮拽回旧坐标；
 * 其它端用 touch + rAF 节流更新 transform。
 */
import { MovableArea, MovableView, View, Text, type ITouchEvent } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Icon from '@/components/Icon';

const DEFAULT_SIZE_RPX = 88;
const FAB_MARGIN_RPX = 24;
const DRAG_THRESHOLD_PX = 8;

/** 拖动中禁止父级重渲染打到 MovableView（否则受控坐标会回弹） */
const draggingKeys = new Set<string>();

interface FabPosition {
  x: number;
  y: number;
}

interface ContainerRect {
  width: number;
  height: number;
}

function normalizeRect(
  rect:
    | Taro.NodesRef.BoundingClientRectCallbackResult
    | Taro.NodesRef.BoundingClientRectCallbackResult[]
    | null,
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
  /** 按钮文案，默认「添加」 */
  label?: string;
  /** circle=圆形加号；pill=横条图标+文案（课表排课） */
  variant?: 'circle' | 'pill';
  /** 自定义宽高（rpx）；不传则按 variant 默认 */
  widthRpx?: number;
  heightRpx?: number;
  /** 无记忆位置时距底边（rpx） */
  defaultBottomRpx?: number;
  /** 无记忆位置时距右边（rpx） */
  defaultRightRpx?: number;
  className?: string;
  /** 按钮本体额外样式 */
  buttonClassName?: string;
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

function persistPosition(storageKey: string, pos: FabPosition) {
  try {
    Taro.setStorageSync(storageKey, pos);
  } catch {
    /* 静默 */
  }
}

function useIsWeapp(): boolean {
  return useMemo(() => {
    try {
      return Taro.getEnv() === Taro.ENV_TYPE.WEAPP;
    } catch {
      return false;
    }
  }, []);
}

const FabFace: React.FC<{
  variant: 'circle' | 'pill';
  label: string;
  buttonClassName?: string;
}> = React.memo(({ variant, label, buttonClassName }) => {
  if (variant === 'pill') {
    return (
      <View
        className={cn(
          'flex h-full w-full items-center justify-center rounded-full bg-schedule-attend shadow-schedule-fab gap-[8rpx] px-[8rpx]',
          buttonClassName,
        )}
      >
        <Icon name="mdi-plus" size="md" color="hsl(var(--primary-foreground))" />
        <Text className="text-[26rpx] font-medium text-primary-foreground">{label}</Text>
      </View>
    );
  }
  return (
    <View
      className={cn(
        'flex h-full w-full flex-col items-center justify-center rounded-full bg-primary shadow-float',
        buttonClassName,
      )}
    >
      <Icon name="mdi-plus" size="md" color="white" />
      <Text className="mt-[2rpx] text-[18rpx] font-medium text-white leading-none">{label}</Text>
    </View>
  );
});
FabFace.displayName = 'FabFace';

const DraggableFab: React.FC<DraggableFabProps> = ({
  containerSelector,
  storageKey,
  onClick,
  layoutKey,
  label = '添加',
  variant = 'circle',
  widthRpx,
  heightRpx,
  defaultBottomRpx = FAB_MARGIN_RPX,
  defaultRightRpx = FAB_MARGIN_RPX,
  className,
  buttonClassName,
}) => {
  const isWeapp = useIsWeapp();
  const size = useMemo(() => {
    if (variant === 'pill') {
      return {
        width: rpxToPx(widthRpx ?? 168),
        height: rpxToPx(heightRpx ?? 80),
      };
    }
    const side = rpxToPx(widthRpx ?? heightRpx ?? DEFAULT_SIZE_RPX);
    return { width: side, height: side };
  }, [heightRpx, variant, widthRpx]);

  const defaultBottomPx = rpxToPx(defaultBottomRpx);
  const defaultRightPx = rpxToPx(defaultRightRpx);

  const [bounds, setBounds] = useState<ContainerRect | null>(null);
  const [position, setPosition] = useState<FabPosition | null>(null);
  const positionRef = useRef<FabPosition | null>(null);
  const boundsRef = useRef<ContainerRect>({ width: 0, height: 0 });
  const onClickRef = useRef(onClick);
  onClickRef.current = onClick;
  const storageKeyRef = useRef(storageKey);
  storageKeyRef.current = storageKey;

  const dragRef = useRef({
    dragging: false,
    moved: false,
    startTouch: { x: 0, y: 0 },
    startPos: { x: 0, y: 0 },
  });
  const rafRef = useRef<number | null>(null);
  const touchStartPosRef = useRef<FabPosition | null>(null);

  const applyPosition = useCallback((next: FabPosition) => {
    positionRef.current = next;
    setPosition(next);
  }, []);

  const measureContainer = useCallback(
    (preserveCurrent: boolean) => {
      if (draggingKeys.has(storageKey)) return;

      Taro.createSelectorQuery()
        .select(containerSelector)
        .boundingClientRect((rect) => {
          if (draggingKeys.has(storageKey)) return;

          const nextBounds = normalizeRect(rect);
          if (!nextBounds) {
            return;
          }

          boundsRef.current = nextBounds;
          setBounds(nextBounds);

          const maxX = Math.max(0, nextBounds.width - size.width);
          const maxY = Math.max(0, nextBounds.height - size.height);
          const defaultPos: FabPosition = {
            x: Math.max(0, maxX - defaultRightPx),
            y: Math.max(0, maxY - defaultBottomPx),
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
    [applyPosition, containerSelector, defaultBottomPx, defaultRightPx, size.height, size.width, storageKey],
  );

  useEffect(() => {
    positionRef.current = null;
    setPosition(null);
    Taro.nextTick(() => {
      measureContainer(false);
    });
  }, [measureContainer, storageKey]);

  useEffect(() => {
    if (layoutKey === undefined) return;
    Taro.nextTick(() => {
      measureContainer(true);
    });
  }, [layoutKey, measureContainer]);

  useEffect(
    () => () => {
      draggingKeys.delete(storageKeyRef.current);
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
      }
    },
    [],
  );

  const finishInteraction = useCallback(
    (moved: boolean) => {
      draggingKeys.delete(storageKey);
      dragRef.current.dragging = false;

      if (positionRef.current) {
        persistPosition(storageKey, positionRef.current);
        setPosition({ ...positionRef.current });
      }
      if (!moved) {
        onClickRef.current();
      }
    },
    [storageKey],
  );

  /* ---------- 微信：MovableView 原生跟手 ---------- */
  const handleMovableChange = useCallback(
    (event: { detail?: { x?: number; y?: number; source?: string } }) => {
      const detail = event.detail;
      if (!detail || typeof detail.x !== 'number' || typeof detail.y !== 'number') return;

      const next = { x: detail.x, y: detail.y };
      positionRef.current = next;

      if (detail.source === 'touch' || detail.source === 'touch-out-of-bounds') {
        const start = touchStartPosRef.current;
        if (
          start &&
          (Math.abs(next.x - start.x) > DRAG_THRESHOLD_PX ||
            Math.abs(next.y - start.y) > DRAG_THRESHOLD_PX)
        ) {
          dragRef.current.moved = true;
        }
      }
    },
    [],
  );

  const handleMovableTouchStart = useCallback(() => {
    draggingKeys.add(storageKey);
    dragRef.current.moved = false;
    touchStartPosRef.current = positionRef.current ? { ...positionRef.current } : null;
  }, [storageKey]);

  const handleMovableTouchEnd = useCallback(() => {
    finishInteraction(dragRef.current.moved);
  }, [finishInteraction]);

  /* ---------- H5 等：rAF 节流 + transform ---------- */
  const handleTouchStart = useCallback(
    (event: ITouchEvent) => {
      const touch = event.touches[0];
      if (!touch || !positionRef.current) return;

      draggingKeys.add(storageKey);
      dragRef.current = {
        dragging: true,
        moved: false,
        startTouch: { x: touch.clientX, y: touch.clientY },
        startPos: { ...positionRef.current },
      };
    },
    [storageKey],
  );

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

      const maxX = Math.max(0, boundsRef.current.width - size.width);
      const maxY = Math.max(0, boundsRef.current.height - size.height);
      const next = {
        x: clamp(dragRef.current.startPos.x + deltaX, 0, maxX),
        y: clamp(dragRef.current.startPos.y + deltaY, 0, maxY),
      };
      positionRef.current = next;

      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        if (positionRef.current) {
          setPosition({ ...positionRef.current });
        }
      });
    },
    [size.height, size.width],
  );

  const handleTouchEnd = useCallback(() => {
    if (!dragRef.current.dragging && !draggingKeys.has(storageKey)) return;
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    finishInteraction(dragRef.current.moved);
  }, [finishInteraction, storageKey]);

  if (!position || !bounds) {
    return null;
  }

  const face = (
    <FabFace variant={variant} label={label} buttonClassName={buttonClassName} />
  );

  if (isWeapp) {
    return (
      <MovableArea
        className={cn('pointer-events-none absolute left-0 top-0 z-200 overflow-hidden', className)}
        style={{
          width: `${bounds.width}px`,
          height: `${bounds.height}px`,
        }}
      >
        <MovableView
          className="pointer-events-auto"
          direction="all"
          inertia={false}
          outOfBounds={false}
          animation={false}
          x={position.x}
          y={position.y}
          style={{
            width: `${size.width}px`,
            height: `${size.height}px`,
          }}
          onChange={handleMovableChange}
          onTouchStart={handleMovableTouchStart}
          onTouchEnd={handleMovableTouchEnd}
          onTouchCancel={handleMovableTouchEnd}
        >
          {face}
        </MovableView>
      </MovableArea>
    );
  }

  return (
    <View
      className={cn('absolute z-200 will-change-transform', className)}
      style={{
        left: 0,
        top: 0,
        width: `${size.width}px`,
        height: `${size.height}px`,
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
      }}
      catchMove
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {face}
    </View>
  );
};

function fabPropsEqual(prev: DraggableFabProps, next: DraggableFabProps): boolean {
  if (draggingKeys.has(prev.storageKey) || draggingKeys.has(next.storageKey)) {
    return true;
  }
  return (
    prev.containerSelector === next.containerSelector &&
    prev.storageKey === next.storageKey &&
    prev.onClick === next.onClick &&
    prev.layoutKey === next.layoutKey &&
    prev.label === next.label &&
    prev.variant === next.variant &&
    prev.widthRpx === next.widthRpx &&
    prev.heightRpx === next.heightRpx &&
    prev.defaultBottomRpx === next.defaultBottomRpx &&
    prev.defaultRightRpx === next.defaultRightRpx &&
    prev.className === next.className &&
    prev.buttonClassName === next.buttonClassName
  );
}

export default React.memo(DraggableFab, fabPropsEqual);
