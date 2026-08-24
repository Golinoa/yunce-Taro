/**
 * TodoQuadrantBoard - 待办四象限静态看板
 *
 * 使用场景：首页待办 Tab 视图切换；2×2 网格按象限归类展示今日待办。
 */
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useMemo } from 'react';
import TodoQuadrantIcon from '@/components/TodoQuadrantIcon';
import type { TodoItem } from '@/types/home-todo';
import { TODO_QUADRANT_META, TODO_QUADRANT_ORDER, resolveTodoQuadrant } from '@/types/todo-quadrant';
import { buildTimelineEntries, formatTimelineClock, resolveTimelineAt } from '@/utils/todo-timeline';

export interface TodoQuadrantBoardProps {
  items: TodoItem[];
  onItemClick?: (item: TodoItem) => void;
}

const TodoQuadrantBoard: React.FC<TodoQuadrantBoardProps> = ({ items, onItemClick }) => {
  const grouped = useMemo(() => {
    const entries = buildTimelineEntries(items);
    const map: Record<string, typeof entries> = {
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

  return (
    <View className="grid grid-cols-2 gap-[16rpx]">
      {TODO_QUADRANT_ORDER.map((quadrant) => {
        const meta = TODO_QUADRANT_META[quadrant];
        const list = grouped[quadrant];
        return (
          <View
            key={quadrant}
            className="min-h-[280rpx] rounded-[24rpx] border border-border bg-card p-[16rpx] shadow-card"
          >
            <View className="mb-[12rpx] flex flex-row items-center gap-[8rpx]">
              <TodoQuadrantIcon quadrant={quadrant} size="sm" />
              <Text className="text-[24rpx] font-medium text-foreground">{meta.label}</Text>
            </View>
            {list.length === 0 ? (
              <Text className="text-[22rpx] text-muted-foreground">暂无</Text>
            ) : (
              list.map(({ item }) => {
                const timelineAt = resolveTimelineAt(item);
                const isDone = Boolean(item.completed || item.completion);
                return (
                  <View
                    key={item.id}
                    className={cn(
                      'mb-[10rpx] rounded-[16rpx] bg-muted px-[14rpx] py-[12rpx] press-scale',
                      isDone && 'opacity-70',
                    )}
                    onClick={() => {
                      if (item.url) {
                        Taro.navigateTo({ url: item.url });
                        return;
                      }
                      onItemClick?.(item);
                    }}
                  >
                    <Text
                      className={cn(
                        'text-[24rpx] leading-snug block',
                        isDone ? 'text-muted-foreground line-through' : 'text-foreground',
                      )}
                    >
                      {item.title}
                    </Text>
                    <Text className="text-[20rpx] text-muted-foreground mt-[4rpx] block">
                      {formatTimelineClock(timelineAt)}
                      {item.sourceType === 'note' ? ' · 笔记' : ''}
                    </Text>
                  </View>
                );
              })
            )}
          </View>
        );
      })}
    </View>
  );
};

export default TodoQuadrantBoard;
