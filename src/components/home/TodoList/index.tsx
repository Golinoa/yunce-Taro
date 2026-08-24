import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import dayjs from 'dayjs';
import React, { useMemo } from 'react';
import Icon from '@/components/Icon';
import TodoQuadrantIcon from '@/components/TodoQuadrantIcon';
import type { TodoItem } from '@/types/home-todo';
import { resolveTodoQuadrant } from '@/types/todo-quadrant';
import {
  buildTimelineEntries,
  formatTimelineClock,
  resolveTimelineAt,
  shouldShowNowMarker,
} from '@/utils/todo-timeline';

export type { TodoItem };

export interface TodoListProps {
  items: TodoItem[];
  /** 指定日期 YYYY-MM-DD（日历页）；默认今天 */
  targetDate?: string;
  /** 点勾选完成 */
  onComplete?: (item: TodoItem) => void;
}

function hasDisplayTime(item: TodoItem): boolean {
  return Boolean(item.remindAt || item.pushedAt);
}

function formatRemindLabel(value: dayjs.Dayjs): string {
  return value.format('MM/DD HH:mm');
}

/**
 * TodoList - 首页待办时间轴（自下而上，实时蓝线分割）
 *
 * 仅展示今日待办：下方为较早时刻，向上靠近 Tab；已完成项沉至实时线下方。
 */
const TodoList: React.FC<TodoListProps> = ({ items, targetDate, onComplete }) => {
  const now = dayjs();
  const nowLabel = now.format('HH:mm');
  const isTodayView = !targetDate || targetDate === now.format('YYYY-MM-DD');

  const entries = useMemo(
    () => buildTimelineEntries(items, now, targetDate),
    [items, now, targetDate],
  );
  const showNowMarker = useMemo(
    () => isTodayView && shouldShowNowMarker(entries),
    [entries, now, isTodayView],
  );

  const handleCardClick = (item: TodoItem) => {
    if (item.url) {
      Taro.navigateTo({ url: item.url });
    }
  };

  const handleToggleComplete = (item: TodoItem, event: { stopPropagation?: () => void }) => {
    event.stopPropagation?.();
    if (item.completed || item.completion || !onComplete) return;
    onComplete(item);
  };

  if (items.length === 0) {
    return (
      <View className="bg-card rounded-[28rpx] shadow-card px-[28rpx] py-[60rpx] text-center">
        <Text className="text-muted-foreground text-[28rpx]">今日暂无待办</Text>
        <Text className="text-muted-foreground text-[24rpx] mt-[12rpx] block">
          点击右下角加号，记待办或查看日历
        </Text>
      </View>
    );
  }

  const renderNowLine = (key: string) => (
    <View key={key} className="relative -ml-[52rpx] my-[20rpx] flex items-center">
      <View className="absolute left-[28rpx] z-10 rounded-full bg-primary px-[12rpx] py-[4rpx]">
        <Text className="text-[20rpx] font-medium text-white">{nowLabel}</Text>
      </View>
      <View className="ml-[12rpx] h-[2rpx] flex-1 todo-timeline-now-dash" />
    </View>
  );

  const rows: React.ReactNode[] = [];
  let nowInserted = false;

  entries.forEach((entry, index) => {
    const prev = entries[index - 1];
    if (
      !nowInserted &&
      showNowMarker &&
      entry.segment === 'future' &&
      prev &&
      (prev.segment === 'past' || prev.segment === 'completed')
    ) {
      rows.push(renderNowLine('now-between'));
      nowInserted = true;
    }

    const { item } = entry;
    const timelineAt = resolveTimelineAt(item, now);
    const timeLabel = hasDisplayTime(item) ? formatTimelineClock(timelineAt) : '--:--';
    const isDone = Boolean(item.completed || item.completion);
    const quadrant = resolveTodoQuadrant({ quadrant: item.quadrant, level: item.level });

    rows.push(
      <View key={item.id} className="relative mb-[20rpx]">
        <Text className="absolute -left-[88rpx] top-[28rpx] w-[64rpx] text-right text-[22rpx] text-muted-foreground">
          {timeLabel}
        </Text>

        <View
          className={cn(
            'relative rounded-[24rpx] bg-card border border-border shadow-card px-[24rpx] py-[22rpx] press-scale',
            isDone && 'todo-card-done',
          )}
          onClick={() => handleCardClick(item)}
        >
          <View className="absolute right-[16rpx] top-[16rpx]">
            <TodoQuadrantIcon quadrant={quadrant} size="sm" />
          </View>

          <View className="flex items-start gap-[16rpx] pr-[56rpx]">
            <View
              className={cn(
                'mt-[6rpx] h-[36rpx] w-[36rpx] shrink-0 rounded-full center',
                isDone ? 'todo-check-done-soft' : 'todo-check-pending',
              )}
              onClick={(event) => handleToggleComplete(item, event)}
            >
              {isDone && <Icon name="mdi-check" size="xs" color="success" />}
            </View>

            <View className="min-w-0 flex-1">
              <Text
                className={cn(
                  'text-[30rpx] leading-snug block',
                  isDone ? 'todo-title-done' : 'text-foreground font-semibold',
                )}
              >
                {item.title}
              </Text>

              {hasDisplayTime(item) && (
                <View className="mt-[10rpx] flex flex-row items-center gap-[8rpx] flex-wrap">
                  <Icon name="mdi-calendar-clock" size="xs" color="mutedForeground" />
                  <Text className="text-[22rpx] text-muted-foreground">
                    {formatRemindLabel(timelineAt)}
                  </Text>
                  {item.sourceType === 'note' && (
                    <Text className="text-[20rpx] text-muted-foreground">笔记</Text>
                  )}
                </View>
              )}

              {(item.note || item.desc) && (
                <Text className="mt-[10rpx] text-[24rpx] text-muted-foreground line-clamp-2 block">
                  {item.note || item.desc}
                </Text>
              )}

              {item.completion && (
                <Text className="mt-[10rpx] text-[22rpx] text-muted-foreground block">
                  {item.completion.completedByName} 已完成
                  {item.completion.note ? ` · ${item.completion.note}` : ''}
                </Text>
              )}
            </View>
          </View>
        </View>
      </View>,
    );
  });

  if (showNowMarker && !nowInserted) {
    rows.push(renderNowLine('now-tail'));
  }

  return (
    <View className="px-[8rpx]">
      <View className="relative flex flex-col-reverse pl-[88rpx]">
        <View className="absolute left-[36rpx] top-[8rpx] bottom-[8rpx] w-[2rpx] todo-timeline-line" />
        {rows}
      </View>
    </View>
  );
};

export default TodoList;
