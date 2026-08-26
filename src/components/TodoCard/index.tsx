/**
 * TodoCard - 待办卡片（首页时间轴 / 我的待办列表共用）
 *
 * 使用场景：与首页 TodoList 单卡完全一致；内容区统一为「标题 → 内容 → 提醒时间 @人员」。
 */
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import dayjs from 'dayjs';
import React, { useMemo } from 'react';
import Icon from '@/components/Icon';
import TodoQuadrantIcon from '@/components/TodoQuadrantIcon';
import { useTeacherNames } from '@/hooks/useTeacherNames';
import type { TodoItem } from '@/types/home-todo';
import { resolveTodoQuadrant } from '@/types/todo-quadrant';
import { buildRemindMetaFromAt } from '@/utils/custom-todos';
import {
  hasTodoDisplayTime,
  resolveTodoCardAccentClass,
} from '@/utils/todo-card-meta';
import { resolveTimelineAt } from '@/utils/todo-timeline';

export interface TodoCardProps {
  item: TodoItem;
  /** 左侧象限色条（逾期红色，默认开启，首页与我的待办一致） */
  accentBar?: boolean;
  /** 右上角四象限图标（默认 true，与首页一致） */
  showQuadrantIcon?: boolean;
  className?: string;
  /** 点击卡片（默认跳转 item.url） */
  onPress?: (item: TodoItem) => void;
  /** 点击勾选区 */
  onToggleComplete?: (item: TodoItem) => void;
  /** 时间轴模式隐藏卡片内时刻行（左侧已展示时刻） */
  hideScheduleRow?: boolean;
}

function formatRemindLabel(value: dayjs.Dayjs): string {
  return value.format('MM/DD HH:mm');
}

const TodoCard: React.FC<TodoCardProps> = ({
  item,
  accentBar = true,
  showQuadrantIcon = true,
  className,
  onPress,
  onToggleComplete,
  hideScheduleRow = false,
}) => {
  const isDone = Boolean(item.completed || item.completion);
  const quadrant = resolveTodoQuadrant({ quadrant: item.quadrant, level: item.level });
  const accentClass = useMemo(() => resolveTodoCardAccentClass(item), [item]);
  const timelineAt = useMemo(() => resolveTimelineAt(item, dayjs()), [item]);
  const remindMeta = useMemo(
    () => (!isDone && item.remindAt ? buildRemindMetaFromAt(item.remindAt) : null),
    [isDone, item.remindAt],
  );
  const collaboratorNames = useTeacherNames(item.assigneeTeacherIds);
  const contentText = item.note || item.desc;
  const showScheduleRow = hasTodoDisplayTime(item) && !hideScheduleRow;
  const showMetaRow = showScheduleRow || collaboratorNames.length > 0;

  const handlePress = () => {
    if (onPress) {
      onPress(item);
      return;
    }
    if (item.url) {
      void Taro.navigateTo({ url: item.url });
    }
  };

  const handleToggleComplete = (event: { stopPropagation?: () => void }) => {
    event.stopPropagation?.();
    onToggleComplete?.(item);
  };

  return (
    <View
      className={cn(
        'relative overflow-hidden rounded-[24rpx] bg-card border border-border shadow-card px-[24rpx] py-[22rpx] press-scale',
        isDone && 'todo-card-done',
        className,
      )}
      onClick={handlePress}
    >
      {accentBar ? (
        <View className={cn('absolute bottom-0 left-0 top-0 w-[8rpx]', accentClass)} />
      ) : null}

      {showQuadrantIcon ? (
        <View className="absolute right-[16rpx] top-[16rpx]">
          <TodoQuadrantIcon quadrant={quadrant} size="sm" />
        </View>
      ) : null}

      <View className="flex items-start gap-[16rpx] pr-[56rpx]">
        <View
          className={cn(
            'mt-[4rpx] h-[40rpx] w-[40rpx] shrink-0 rounded-full center',
            isDone ? 'todo-check-done-soft' : 'todo-check-pending',
          )}
          onClick={handleToggleComplete}
        >
          {isDone ? <Icon name="mdi-check" size="xs" color="success" /> : null}
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

          {contentText ? (
            <Text className="mt-[8rpx] block text-[24rpx] leading-snug text-muted-foreground line-clamp-2">
              {contentText}
            </Text>
          ) : null}

          {showMetaRow ? (
            <View className="mt-[10rpx] flex flex-row flex-wrap items-center gap-x-[12rpx] gap-y-[4rpx]">
              {showScheduleRow ? (
                <View className="flex shrink-0 flex-row items-center gap-[6rpx]">
                  <Icon
                    name="mdi-calendar-clock"
                    size="xs"
                    color={remindMeta?.isOverdue ? 'destructive' : 'mutedForeground'}
                  />
                  <Text
                    className={cn(
                      'text-[22rpx]',
                      remindMeta?.tone === 'overdue' ? 'text-destructive' : 'text-muted-foreground',
                    )}
                  >
                    {remindMeta?.isOverdue ? remindMeta.line : formatRemindLabel(timelineAt)}
                  </Text>
                </View>
              ) : null}
              {collaboratorNames.map((name, index) => (
                <Text
                  key={`${item.id}-collab-${item.assigneeTeacherIds?.[index] ?? index}`}
                  className="text-[22rpx] font-medium text-primary"
                >
                  @{name}
                </Text>
              ))}
            </View>
          ) : null}

          {item.completion ? (
            <Text className="mt-[10rpx] block text-[22rpx] text-muted-foreground">
              {item.completion.completedByName} 已完成
              {item.completion.note ? ` · ${item.completion.note}` : ''}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
};

export default TodoCard;
