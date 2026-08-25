/**
 * TodoQuadrantBoard - 待办四象限 2×2 看板
 *
 * 使用场景：首页待办 Tab 四象限视图；上二下二网格，卡片有最大高度，
 * 内部待办过多时在卡片内滚动；长按未完成待办（系统/自定义/笔记）拖拽换象限，
 * 经 homeService.updateTodoQuadrant 持久化事态等级。
 */
import { View, Text, ScrollView } from '@tarojs/components';
import type { ITouchEvent } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Icon from '@/components/Icon';
import TodoQuadrantIcon from '@/components/TodoQuadrantIcon';
import type { TodoItem } from '@/types/home-todo';
import { buildRemindMetaFromAt } from '@/utils/custom-todos';
import type { TodoQuadrant } from '@/types/todo-quadrant';
import { TODO_QUADRANT_META, TODO_QUADRANT_ORDER, resolveTodoQuadrant } from '@/types/todo-quadrant';
import { useThemeStore } from '@/stores/theme';
import { getThemeHexColors } from '@/theme';
import { buildTimelineEntries } from '@/utils/todo-timeline';

export interface TodoQuadrantBoardProps {
  items: TodoItem[];
  onAddQuadrant?: (quadrant: TodoQuadrant) => void;
  onComplete?: (item: TodoItem) => void;
  onQuadrantChange?: (item: TodoItem, quadrant: TodoQuadrant) => void;
  /** 拖动激活/结束时回调，用于锁定外层页面滚动 */
  onDragActiveChange?: (active: boolean) => void;
}

const QUADRANT_TITLE_CLASS: Record<TodoQuadrant, string> = {
  q1: 'todo-quadrant-title--q1',
  q2: 'todo-quadrant-title--q2',
  q3: 'todo-quadrant-title--q3',
  q4: 'todo-quadrant-title--q4',
};

const QUADRANT_HEADER_CLASS: Record<TodoQuadrant, string> = {
  q1: 'todo-quadrant-header--q1',
  q2: 'todo-quadrant-header--q2',
  q3: 'todo-quadrant-header--q3',
  q4: 'todo-quadrant-header--q4',
};

/** 卡片网格间距（rpx @375） */
const CARD_GAP_RPX = 16;
/** 列表区固定高度（rpx @375），卡片整体高度见 app.scss `.todo-quadrant-card` */
const CARD_BODY_HEIGHT_RPX = 420;
const LONG_PRESS_MS = 380;
/** 长按判定期间允许的手指抖动；超过则取消拖动（视为滚动/点击滑动） */
const LONG_PRESS_MOVE_CANCEL_PX = 12;

type RowTouchEvent = Pick<ITouchEvent, 'touches' | 'changedTouches'>;

type CardRect = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
};

interface DragState {
  item: TodoItem;
  fromQuadrant: TodoQuadrant;
  x: number;
  y: number;
  width: number;
  height: number;
  originLeft: number;
  originTop: number;
  dragStartX: number;
  dragStartY: number;
}

interface TouchSession {
  item: TodoItem;
  fromQuadrant: TodoQuadrant;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  originLeft: number | null;
  originTop: number | null;
  width: number;
  height: number;
  timerId: ReturnType<typeof setTimeout> | null;
  dragging: boolean;
  moved: boolean;
}

function hasScheduledReminder(item: TodoItem): boolean {
  return Boolean(item.remindAt && item.remindEnabled !== false && dayjs(item.remindAt).isValid());
}

function findQuadrantAtPoint(
  x: number,
  y: number,
  rects: Array<{ quadrant: TodoQuadrant; rect: CardRect | null }>,
): TodoQuadrant | null {
  for (const { quadrant, rect } of rects) {
    if (!rect) continue;
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return quadrant;
    }
  }
  return null;
}

const TodoQuadrantBoard: React.FC<TodoQuadrantBoardProps> = ({
  items,
  onAddQuadrant,
  onComplete,
  onQuadrantChange,
  onDragActiveChange,
}) => {
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [dropTarget, setDropTarget] = useState<TodoQuadrant | null>(null);

  const draggingRef = useRef<DragState | null>(null);
  const sessionRef = useRef<TouchSession | null>(null);
  const cardRectsRef = useRef<Array<{ quadrant: TodoQuadrant; rect: CardRect | null }>>([]);
  const moveRafRef = useRef(0);
  const pendingPosRef = useRef<{ x: number; y: number } | null>(null);
  const suppressClickRef = useRef(false);
  const { activeTheme } = useThemeStore();

  const quadrantPlusColor = useMemo(() => {
    const hex = getThemeHexColors(activeTheme);
    return {
      q1: hex.destructive,
      q2: hex.todoQ2,
      q3: hex.todoQ3,
      q4: hex.todoQ4,
    };
  }, [activeTheme]);

  useEffect(
    () => () => {
      if (moveRafRef.current) cancelAnimationFrame(moveRafRef.current);
      const session = sessionRef.current;
      if (session?.timerId) clearTimeout(session.timerId);
    },
    [],
  );

  const grouped = useMemo(() => {
    const entries = buildTimelineEntries(items);
    const map: Record<TodoQuadrant, typeof entries> = {
      q1: [],
      q2: [],
      q3: [],
      q4: [],
    };
    entries.forEach((entry) => {
      const quadrant = resolveTodoQuadrant({
        quadrant: entry.item.quadrant,
        level: entry.item.level,
      });
      map[quadrant].push(entry);
    });
    return map;
  }, [items]);

  const queryCardRects = useCallback((): Promise<
    Array<{ quadrant: TodoQuadrant; rect: CardRect | null }>
  > => {
    return new Promise((resolve) => {
      const query = Taro.createSelectorQuery();
      TODO_QUADRANT_ORDER.forEach((quadrant) => {
        query.select(`#todo-quadrant-card-${quadrant}`).boundingClientRect();
      });
      query.exec((res) => {
        const mapped = TODO_QUADRANT_ORDER.map((quadrant, index) => {
          const raw = res[index] as Taro.NodesRef.BoundingClientRectCallbackResult | null;
          if (!raw) return { quadrant, rect: null };
          return {
            quadrant,
            rect: {
              left: raw.left,
              right: raw.right,
              top: raw.top,
              bottom: raw.bottom,
              width: raw.width,
              height: raw.height,
            },
          };
        });
        cardRectsRef.current = mapped;
        resolve(mapped);
      });
    });
  }, []);

  const measureTaskRect = useCallback((itemId: string): Promise<CardRect | null> => {
    return new Promise((resolve) => {
      Taro.createSelectorQuery()
        .select(`#todo-quadrant-task-${itemId}`)
        .boundingClientRect()
        .exec((res) => {
          const raw = res[0] as Taro.NodesRef.BoundingClientRectCallbackResult | null;
          if (!raw) {
            resolve(null);
            return;
          }
          resolve({
            left: raw.left,
            right: raw.right,
            top: raw.top,
            bottom: raw.bottom,
            width: raw.width,
            height: raw.height,
          });
        });
    });
  }, []);

  const flushDragPosition = useCallback(() => {
    moveRafRef.current = 0;
    const pos = pendingPosRef.current;
    const current = draggingRef.current;
    if (!pos || !current) return;

    const dx = pos.x - current.dragStartX;
    const dy = pos.y - current.dragStartY;
    const next: DragState = {
      ...current,
      x: current.originLeft + dx,
      y: current.originTop + dy,
    };
    draggingRef.current = next;
    setDragging(next);
    setDropTarget(findQuadrantAtPoint(pos.x, pos.y, cardRectsRef.current));
  }, []);

  const updateDragPosition = useCallback(
    (x: number, y: number) => {
      pendingPosRef.current = { x, y };
      if (!moveRafRef.current) {
        moveRafRef.current = requestAnimationFrame(flushDragPosition);
      }
    },
    [flushDragPosition],
  );

  const beginDrag = useCallback(
    (session: TouchSession, fingerX: number, fingerY: number) => {
      if (session.dragging) return;
      session.dragging = true;
      session.moved = true;
      suppressClickRef.current = true;

      const originLeft = session.originLeft ?? fingerX - session.width / 2;
      const originTop = session.originTop ?? fingerY - session.height / 2;

      const next: DragState = {
        item: session.item,
        fromQuadrant: session.fromQuadrant,
        x: originLeft,
        y: originTop,
        width: session.width,
        height: session.height,
        originLeft,
        originTop,
        dragStartX: fingerX,
        dragStartY: fingerY,
      };
      draggingRef.current = next;
      setDragging(next);
      setDropTarget(session.fromQuadrant);
      onDragActiveChange?.(true);
      void queryCardRects();
      // 同一次触摸立刻跟手，避免浮起后停住等二次滑动
      updateDragPosition(fingerX, fingerY);
    },
    [onDragActiveChange, queryCardRects, updateDragPosition],
  );

  const clearSession = useCallback(() => {
    const session = sessionRef.current;
    if (session?.timerId) clearTimeout(session.timerId);
    sessionRef.current = null;
  }, []);

  const handleRowTouchStart = useCallback(
    (item: TodoItem, fromQuadrant: TodoQuadrant, event: RowTouchEvent) => {
      if (item.completed || item.completion) return;

      const touch = event.touches[0];
      if (!touch) return;

      clearSession();

      const { windowWidth } = Taro.getWindowInfo();
      const session: TouchSession = {
        item,
        fromQuadrant,
        startX: touch.clientX,
        startY: touch.clientY,
        lastX: touch.clientX,
        lastY: touch.clientY,
        originLeft: null,
        originTop: null,
        width: Math.min(windowWidth * 0.42, 280),
        height: 64,
        timerId: null,
        dragging: false,
        moved: false,
      };

      session.timerId = setTimeout(() => {
        const active = sessionRef.current;
        if (!active || active.item.id !== item.id || active.dragging) return;
        beginDrag(active, active.lastX, active.lastY);
      }, LONG_PRESS_MS);

      sessionRef.current = session;

      void measureTaskRect(item.id).then((rect) => {
        if (!rect || sessionRef.current?.item.id !== item.id) return;
        sessionRef.current.width = rect.width;
        sessionRef.current.height = rect.height;
        sessionRef.current.originLeft = rect.left;
        sessionRef.current.originTop = rect.top;
      });
    },
    [beginDrag, clearSession, measureTaskRect],
  );

  const handleRowTouchMove = useCallback(
    (item: TodoItem, event: RowTouchEvent) => {
      const session = sessionRef.current;
      if (!session || session.item.id !== item.id) return;

      const touch = event.touches[0];
      if (!touch) return;

      session.lastX = touch.clientX;
      session.lastY = touch.clientY;

      const dx = touch.clientX - session.startX;
      const dy = touch.clientY - session.startY;

      if (!session.dragging) {
        // 仅长按启动拖动；移动过大则取消长按，避免轻点/滑动误触
        if (Math.hypot(dx, dy) >= LONG_PRESS_MOVE_CANCEL_PX) {
          if (session.timerId) {
            clearTimeout(session.timerId);
            session.timerId = null;
          }
          session.moved = true;
        }
        return;
      }

      updateDragPosition(touch.clientX, touch.clientY);
    },
    [updateDragPosition],
  );

  const handleRowTouchEnd = useCallback(
    async (item: TodoItem, event: RowTouchEvent) => {
      const session = sessionRef.current;
      if (!session || session.item.id !== item.id) {
        clearSession();
        return;
      }

      if (session.timerId) clearTimeout(session.timerId);

      if (!session.dragging) {
        sessionRef.current = null;
        return;
      }

      const touch = event.changedTouches[0];
      const x = touch?.clientX ?? draggingRef.current?.x ?? session.startX;
      const y = touch?.clientY ?? draggingRef.current?.y ?? session.startY;

      if (cardRectsRef.current.length === 0) {
        await queryCardRects();
      }
      const target = findQuadrantAtPoint(x, y, cardRectsRef.current);
      const from = session.fromQuadrant;
      const movedItem = session.item;

      draggingRef.current = null;
      pendingPosRef.current = null;
      if (moveRafRef.current) {
        cancelAnimationFrame(moveRafRef.current);
        moveRafRef.current = 0;
      }
      setDragging(null);
      setDropTarget(null);
      sessionRef.current = null;
      onDragActiveChange?.(false);

      if (target && target !== from) {
        onQuadrantChange?.(movedItem, target);
      }

      setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    },
    [clearSession, onDragActiveChange, onQuadrantChange, queryCardRects],
  );

  const handleToggleComplete = useCallback(
    (item: TodoItem, event: { stopPropagation?: () => void }) => {
      event.stopPropagation?.();
      if (item.completed || item.completion || !onComplete) return;
      onComplete(item);
    },
    [onComplete],
  );

  const handleCardNavigate = useCallback((item: TodoItem) => {
    if (suppressClickRef.current) return;
    if (item.url) {
      Taro.navigateTo({ url: item.url });
    }
  }, []);

  const renderTaskRow = (item: TodoItem, quadrant: TodoQuadrant) => {
    const isDone = Boolean(item.completed || item.completion);
    const remindMeta =
      hasScheduledReminder(item) && item.remindAt
        ? buildRemindMetaFromAt(item.remindAt)
        : null;
    const isDraggingThis = dragging?.item.id === item.id;
    const canDrag = !isDone;

    return (
      <View
        key={item.id}
        id={`todo-quadrant-task-${item.id}`}
        className={cn(
          'mb-[12rpx] flex flex-row items-start gap-[12rpx] rounded-[16rpx] bg-muted/40 px-[12rpx] py-[12rpx]',
          isDraggingThis && 'opacity-30',
        )}
        catchMove={canDrag}
        onClick={() => handleCardNavigate(item)}
        onTouchStart={(event) => handleRowTouchStart(item, quadrant, event as unknown as RowTouchEvent)}
        onTouchMove={(event) => handleRowTouchMove(item, event as unknown as RowTouchEvent)}
        onTouchEnd={(event) => void handleRowTouchEnd(item, event as unknown as RowTouchEvent)}
        onTouchCancel={(event) => void handleRowTouchEnd(item, event as unknown as RowTouchEvent)}
      >
        <View
          className={cn(
            'mt-[2rpx] h-[36rpx] w-[36rpx] shrink-0 rounded-full center',
            isDone ? 'todo-check-done-soft' : 'todo-check-pending',
          )}
          onClick={(event) => handleToggleComplete(item, event)}
        >
          {isDone && <Icon name="mdi-check" size="xs" color="success" />}
        </View>

        <View className="min-w-0 flex-1">
          <Text
            className={cn(
              'text-[26rpx] leading-snug block',
              isDone ? 'todo-title-done' : 'text-foreground',
            )}
          >
            {item.title}
          </Text>
          {remindMeta && (
            <View className="mt-[6rpx] flex flex-row items-center gap-[6rpx]">
              <Icon
                name="mdi-alarm"
                size="xs"
                color={remindMeta.isOverdue ? 'destructive' : 'warning'}
              />
              <Text
                className={cn(
                  'text-[22rpx]',
                  remindMeta.tone === 'overdue' ? 'text-destructive' : 'text-muted-foreground',
                )}
              >
                {remindMeta.line}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const isDragging = Boolean(dragging);

  return (
    <View className="relative">
      <View className="grid grid-cols-2" style={{ gap: `${CARD_GAP_RPX}rpx` }}>
        {TODO_QUADRANT_ORDER.map((quadrant) => {
          const meta = TODO_QUADRANT_META[quadrant];
          const list = grouped[quadrant];
          const isDropHighlight = dropTarget === quadrant && isDragging;

          return (
            <View
              key={quadrant}
              id={`todo-quadrant-card-${quadrant}`}
              className={cn(
                'todo-quadrant-card flex min-h-0 flex-col overflow-hidden rounded-[24rpx] border border-border bg-card shadow-card',
                isDropHighlight && 'todo-quadrant-card--drop-target',
              )}
            >
              <View
                className={cn(
                  'todo-quadrant-header flex flex-row items-center justify-between',
                  QUADRANT_HEADER_CLASS[quadrant],
                )}
              >
                <View className="flex min-w-0 flex-1 flex-row items-center gap-[8rpx] pr-[8rpx]">
                  <TodoQuadrantIcon quadrant={quadrant} size="sm" />
                  <Text
                    className={cn(
                      'truncate text-[24rpx] font-semibold',
                      QUADRANT_TITLE_CLASS[quadrant],
                    )}
                  >
                    {meta.label}
                  </Text>
                </View>
                <View
                  className="flex h-[52rpx] w-[52rpx] shrink-0 items-center justify-center press-scale"
                  onClick={() => onAddQuadrant?.(quadrant)}
                >
                  <Icon
                    name="mdi-plus"
                    size="lg"
                    color={quadrantPlusColor[quadrant]}
                  />
                </View>
              </View>

              <View className="flex min-h-0 flex-1 flex-col px-[12rpx] pb-[12rpx]">
                <ScrollView
                  scrollY={!isDragging}
                  enhanced
                  showScrollbar
                  className="min-h-0 flex-1"
                  style={{ height: `${CARD_BODY_HEIGHT_RPX}rpx`, maxHeight: `${CARD_BODY_HEIGHT_RPX}rpx` }}
                >
                  {list.length === 0 ? (
                    <Text className="text-[22rpx] text-muted-foreground">暂无待办</Text>
                  ) : (
                    list.map(({ item }) => renderTaskRow(item, quadrant))
                  )}
                </ScrollView>
              </View>
            </View>
          );
        })}
      </View>

      {dragging && (
        <View
          className="pointer-events-none fixed z-310 rounded-[16rpx] border border-primary/30 bg-card px-[12rpx] py-[12rpx] shadow-float"
          style={{
            left: `${dragging.x}px`,
            top: `${dragging.y}px`,
            width: `${dragging.width}px`,
            minHeight: `${dragging.height}px`,
            transform: 'translate3d(0, 0, 0)',
            opacity: 1,
          }}
        >
          <View className="flex flex-row items-start gap-[12rpx]">
            <View className="mt-[4rpx] h-[32rpx] w-[32rpx] shrink-0 rounded-full todo-check-pending" />
            <Text className="text-[26rpx] text-foreground line-clamp-2">{dragging.item.title}</Text>
          </View>
        </View>
      )}
    </View>
  );
};

export default TodoQuadrantBoard;
