import { View, Text } from '@tarojs/components';
import cn from 'classnames';
import dayjs from 'dayjs';
import React, { useMemo } from 'react';
import TodoCard from '@/components/TodoCard';
import type { TodoItem } from '@/types/home-todo';
import {
  buildTimelineEntries,
  formatTimelineClock,
  resolveTimelineAt,
  shouldShowNowMarker,
  TODO_TIMELINE_EMBEDDED_LAYOUT,
} from '@/utils/todo-timeline';
import { hasTodoDisplayTime, shouldShowTodoCardScheduleRow, buildTodoCardDomId } from '@/utils/todo-card-meta';

export type { TodoItem };

export interface TodoListProps {
  items: TodoItem[];
  /** 指定日期 YYYY-MM-DD（日历页）；默认今天 */
  targetDate?: string;
  /** 点勾选完成（仅未完成时触发） */
  onComplete?: (item: TodoItem) => void;
  /** 点勾选（完成/重开，我的待办用） */
  onToggleComplete?: (item: TodoItem) => void;
  /** 我的待办嵌入日期分组：左对齐时刻 + 轴线与首页同比例 */
  embedded?: boolean;
  /** embedded 时由父级绘制竖线，组内不再重复 */
  hideAxis?: boolean;
  /** embedded 非今日：按时刻正序自上而下（历史日期更自然） */
  chronological?: boolean;
  /** embedded 时竖线向上延伸（rpx），接到日期标题下方 */
  axisExtendTop?: number;
  /** 跳过滤日期，直接渲染传入 items（无提醒分组） */
  plainList?: boolean;
}

const EMBED = TODO_TIMELINE_EMBEDDED_LAYOUT;
const EMBED_AXIS_CENTER = EMBED.axisLeft + 1;
const EMBED_GAP_TO_CARD = EMBED.cardInset - EMBED.timeWidth;

/**
 * TodoList - 首页待办时间轴（自下而上，实时蓝线分割）
 *
 * 仅展示今日待办：下方为较早时刻，向上靠近 Tab；已完成项沉至实时线下方。
 */
const TodoList: React.FC<TodoListProps> = ({
  items,
  targetDate,
  onComplete,
  onToggleComplete,
  embedded = false,
  hideAxis = false,
  chronological = false,
  axisExtendTop = 0,
  plainList = false,
}) => {
  const now = dayjs();
  const nowLabel = now.format('HH:mm');
  const isTodayView = !targetDate || targetDate === now.format('YYYY-MM-DD');

  const entries = useMemo(() => {
    if (plainList) {
      return buildTimelineEntries(items, now, targetDate, { skipDateFilter: true });
    }
    return buildTimelineEntries(items, now, targetDate);
  }, [items, now, targetDate, plainList]);

  const displayEntries = useMemo(() => {
    if (!embedded || !chronological) return entries;
    return [...entries].sort((a, b) => a.timelineAt.valueOf() - b.timelineAt.valueOf());
  }, [entries, embedded, chronological]);

  const showNowMarker = useMemo(
    () => isTodayView && !chronological && shouldShowNowMarker(displayEntries),
    [displayEntries, isTodayView, chronological],
  );

  const handleToggleComplete = (item: TodoItem) => {
    if (onToggleComplete) {
      onToggleComplete(item);
      return;
    }
    if (item.completed || item.completion || !onComplete) return;
    onComplete(item);
  };

  const toggleHandler = onToggleComplete || onComplete ? handleToggleComplete : undefined;

  if (displayEntries.length === 0) {
    return (
      <View className="bg-card rounded-[28rpx] shadow-card px-[28rpx] py-[60rpx] text-center">
        <Text className="text-muted-foreground text-[28rpx]">今日暂无待办</Text>
        <Text className="text-muted-foreground text-[24rpx] mt-[12rpx] block">
          点击下方查看更多，或点右下角加号记待办
        </Text>
      </View>
    );
  }

  const renderNowLine = (key: string) => {
    if (embedded) {
      return (
        <View key={key} className="relative mb-[20rpx] flex flex-row items-center">
          <View
            className="relative shrink-0"
            style={{ width: `${EMBED.cardInset}rpx`, height: '40rpx' }}
          >
            <View
              className="absolute top-1/2 z-10 -translate-y-1/2 rounded-full bg-primary px-[12rpx] py-[4rpx]"
              style={{ left: `${EMBED_AXIS_CENTER - 20}rpx` }}
            >
              <Text className="text-[20rpx] font-medium text-white">{nowLabel}</Text>
            </View>
          </View>
          <View className="min-w-0 flex-1 h-[2rpx] todo-timeline-now-dash" />
        </View>
      );
    }

    return (
      <View key={key} className="relative -ml-[52rpx] my-[20rpx] flex items-center">
        <View className="absolute left-[28rpx] z-10 rounded-full bg-primary px-[12rpx] py-[4rpx]">
          <Text className="text-[20rpx] font-medium text-white">{nowLabel}</Text>
        </View>
        <View className="ml-[12rpx] h-[2rpx] flex-1 todo-timeline-now-dash" />
      </View>
    );
  };

  const renderEmbeddedRow = (item: TodoItem, timeLabel: string) => (
    <View key={item.id} id={buildTodoCardDomId(item.id)} className="mb-[16rpx] flex flex-row">
      <Text
        className="shrink-0 text-left text-[22rpx] leading-none tabular-nums text-muted-foreground"
        style={{
          width: `${EMBED.timeWidth}rpx`,
          paddingTop: `${EMBED.timePaddingTop}rpx`,
        }}
      >
        {timeLabel}
      </Text>
      <View className="shrink-0" style={{ width: `${EMBED_GAP_TO_CARD}rpx` }} />
      <View className="min-w-0 flex-1">
        <TodoCard
          item={item}
          hideScheduleRow={!shouldShowTodoCardScheduleRow(item)}
          onToggleComplete={toggleHandler}
        />
      </View>
    </View>
  );

  const renderDefaultRow = (item: TodoItem, timeLabel: string) => (
    <View key={item.id} id={buildTodoCardDomId(item.id)} className="relative mb-[16rpx]">
      <Text className="absolute top-[28rpx] -left-[88rpx] w-[64rpx] text-right text-[22rpx] tabular-nums text-muted-foreground">
        {timeLabel}
      </Text>
      <TodoCard
        item={item}
        hideScheduleRow={!shouldShowTodoCardScheduleRow(item)}
        onToggleComplete={toggleHandler}
      />
    </View>
  );

  const rows: React.ReactNode[] = [];
  let nowInserted = false;

  displayEntries.forEach((entry, index) => {
    const prev = displayEntries[index - 1];
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
    const timeLabel = hasTodoDisplayTime(item) ? formatTimelineClock(timelineAt) : '--:--';

    rows.push(embedded ? renderEmbeddedRow(item, timeLabel) : renderDefaultRow(item, timeLabel));
  });

  if (showNowMarker && !nowInserted) {
    rows.push(renderNowLine('now-tail'));
  }

  if (embedded) {
    return (
      <View className="relative">
        {!hideAxis ? (
          <View
            className="absolute bottom-[8rpx] w-[2rpx] todo-timeline-line"
            style={{
              left: `${EMBED.axisLeft}rpx`,
              top: axisExtendTop > 0 ? `-${axisExtendTop}rpx` : 0,
            }}
          />
        ) : null}
        <View
          className={cn('relative flex', chronological ? 'flex-col' : 'flex-col-reverse')}
        >
          {rows}
        </View>
      </View>
    );
  }

  return (
    <View className="px-[8rpx]">
      <View className="relative flex flex-col-reverse pl-[88rpx]">
        <View className="absolute top-0 bottom-[8rpx] left-[36rpx] w-[2rpx] todo-timeline-line" />
        {rows}
      </View>
    </View>
  );
};

export default TodoList;
