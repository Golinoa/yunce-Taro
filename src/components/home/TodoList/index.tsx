import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import dayjs from 'dayjs';
import React, { useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import TodoQuadrantIcon from '@/components/TodoQuadrantIcon';
import type { TodoItem } from '@/types/home-todo';
import type { TodoQuadrant } from '@/types/todo-quadrant';
import { resolveTodoQuadrant } from '@/types/todo-quadrant';

export type { TodoItem };

export interface TodoListProps {
  items: TodoItem[];
  /** 手动点「已读」/「完成」回调 */
  onMarkRead?: (todoId: string) => void;
}

const TAG_CLASS: Record<TodoQuadrant, string> = {
  q1: 'todo-card-tag-warning',
  q2: 'todo-card-tag-primary',
  q3: 'todo-card-tag-accent',
  q4: 'todo-card-tag-default',
};

function hasRemind(item: TodoItem): boolean {
  return item.remindEnabled !== false && Boolean(item.remindAt);
}

function resolveRemindAt(item: TodoItem): dayjs.Dayjs {
  if (item.remindAt && dayjs(item.remindAt).isValid()) {
    return dayjs(item.remindAt);
  }
  return dayjs().endOf('day');
}

function formatTimelineTime(value: dayjs.Dayjs): string {
  return value.format('HH:mm');
}

function formatRemindLabel(value: dayjs.Dayjs): string {
  return value.format('MM/DD HH:mm');
}

function formatRelativeMinutes(value: dayjs.Dayjs): string | null {
  const diffMin = value.diff(dayjs(), 'minute');
  if (diffMin <= 0) return null;
  if (diffMin <= 60) return `${diffMin}分钟后`;
  return null;
}

/**
 * TodoList - 首页待办时间轴列表
 *
 * 参考检查单时间轴布局：左侧时刻 + 竖线，当前时间虚线，卡片含勾选圈、标题、提醒时间与分类角标。
 */
const TodoList: React.FC<TodoListProps> = ({ items, onMarkRead }) => {
  const [expanded, setExpanded] = useState(false);
  const MAX_COLLAPSED = 6;

  const sortedItems = useMemo(() => {
    return [...items].sort((left, right) => {
      const leftDone = left.completed ? 1 : 0;
      const rightDone = right.completed ? 1 : 0;
      if (leftDone !== rightDone) return leftDone - rightDone;
      return resolveRemindAt(left).valueOf() - resolveRemindAt(right).valueOf();
    });
  }, [items]);

  const collapsed = sortedItems.length > MAX_COLLAPSED;
  const visibleItems = collapsed && !expanded ? sortedItems.slice(0, MAX_COLLAPSED) : sortedItems;
  const now = dayjs();
  const nowLabel = now.format('HH:mm');

  const handleCardClick = (item: TodoItem) => {
    if (item.url) {
      Taro.navigateTo({ url: item.url });
    }
  };

  const handleToggleComplete = (item: TodoItem, event: { stopPropagation?: () => void }) => {
    event.stopPropagation?.();
    if (item.completed || !onMarkRead) return;
    onMarkRead(item.id);
  };

  if (items.length === 0) {
    return (
      <View className="bg-card rounded-[28rpx] shadow-card px-[28rpx] py-[60rpx] text-center">
        <Text className="text-muted-foreground text-[28rpx]">暂无待办事项</Text>
        <Text className="text-muted-foreground text-[24rpx] mt-[12rpx] block">
          点击右下角加号，记待办或查看日历
        </Text>
      </View>
    );
  }

  return (
    <View className="px-[8rpx]">
      <View className="relative pl-[88rpx]">
        <View className="absolute left-[36rpx] top-[8rpx] bottom-[8rpx] w-[2rpx] todo-timeline-line" />

        {visibleItems.map((item, index) => {
          const remindAt = resolveRemindAt(item);
          const timeLabel = hasRemind(item) ? formatTimelineTime(remindAt) : '--:--';
          const relativeLabel = hasRemind(item) ? formatRelativeMinutes(remindAt) : null;
          const quadrant = resolveTodoQuadrant({ quadrant: item.quadrant, level: item.level });
          const showNowLine = index > 0 && remindAt.isAfter(now) && resolveRemindAt(visibleItems[index - 1]).isBefore(now);

          return (
            <React.Fragment key={item.id}>
              {showNowLine && (
                <View className="relative -ml-[52rpx] mb-[24rpx] flex items-center">
                  <View className="absolute left-[28rpx] z-10 rounded-full bg-primary px-[12rpx] py-[4rpx]">
                    <Text className="text-[20rpx] font-medium text-white">{nowLabel}</Text>
                  </View>
                  <View className="ml-[12rpx] h-[2rpx] flex-1 todo-timeline-now-dash" />
                </View>
              )}

              <View className="relative mb-[24rpx]">
                <Text className="absolute -left-[88rpx] top-[28rpx] w-[64rpx] text-right text-[22rpx] text-muted-foreground">
                  {timeLabel}
                </Text>

                <View
                  className={cn(
                    'relative rounded-[24rpx] bg-card border border-border shadow-card px-[24rpx] py-[22rpx] press-scale',
                    item.completed && 'opacity-80',
                  )}
                  onClick={() => handleCardClick(item)}
                >
                  <View
                    className={cn(
                      'absolute right-[16rpx] top-[16rpx] rounded-[10rpx] px-[8rpx] py-[6rpx]',
                      TAG_CLASS[quadrant],
                    )}
                  >
                    <TodoQuadrantIcon quadrant={quadrant} size="sm" />
                  </View>

                  <View className="flex items-start gap-[16rpx] pr-[56rpx]">
                    <View
                      className={cn(
                        'mt-[6rpx] h-[36rpx] w-[36rpx] shrink-0 rounded-full center',
                        item.completed ? 'todo-check-done' : 'todo-check-pending',
                      )}
                      onClick={(event) => handleToggleComplete(item, event)}
                    >
                      {item.completed && <Icon name="mdi-check" size="xs" color="white" />}
                    </View>

                    <View className="min-w-0 flex-1">
                      <Text
                        className={cn(
                          'text-[30rpx] font-semibold leading-snug block',
                          item.completed ? 'text-success line-through' : 'text-foreground',
                        )}
                      >
                        {item.title}
                      </Text>

                      {hasRemind(item) && (
                        <View className="mt-[10rpx] flex flex-row items-center gap-[8rpx] flex-wrap">
                          <Icon name="mdi-calendar-clock" size="xs" color="destructive" />
                          <Text className="text-[22rpx] text-muted-foreground">
                            {formatRemindLabel(remindAt)}
                          </Text>
                          {relativeLabel && !item.completed && (
                            <Text className="text-[22rpx] text-warning">{relativeLabel}</Text>
                          )}
                        </View>
                      )}

                      {(item.note || item.desc) && (
                        <Text className="mt-[10rpx] text-[24rpx] text-muted-foreground line-clamp-2 block">
                          {item.note || item.desc}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
              </View>
            </React.Fragment>
          );
        })}

        {!visibleItems.some((item) => resolveRemindAt(item).isAfter(now)) && (
          <View className="relative -ml-[52rpx] mb-[8rpx] flex items-center">
            <View className="absolute left-[28rpx] z-10 rounded-full bg-primary px-[12rpx] py-[4rpx]">
              <Text className="text-[20rpx] font-medium text-white">{nowLabel}</Text>
            </View>
            <View className="ml-[12rpx] h-[2rpx] flex-1 todo-timeline-now-dash" />
          </View>
        )}
      </View>

      {collapsed && (
        <View
          className="flex items-center justify-center py-[16rpx] press-scale"
          onClick={() => setExpanded((prev) => !prev)}
        >
          <Text className="text-[26rpx] font-medium text-primary">
            {expanded ? '收起' : `展开全部（${sortedItems.length}）`}
          </Text>
        </View>
      )}
    </View>
  );
};

export default TodoList;
