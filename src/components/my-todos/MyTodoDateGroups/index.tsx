/**
 * MyTodoDateGroups - 我的待办按日期折叠分组
 *
 * 使用场景：我的待办「全部」视图按日收起/展开；「今日」视图仅当天时间轴。
 * 日期与时刻左对齐，组级竖线贯穿标题与条目，历史日期按时刻正序展示。
 */
import { View, Text } from '@tarojs/components';
import cn from 'classnames';
import dayjs from 'dayjs';
import React, { useMemo } from 'react';
import TodoList from '@/components/home/TodoList';
import Icon from '@/components/Icon';
import type { TodoItem } from '@/types/home-todo';
import {
  formatTodoGroupDateParts,
  resolveTodoGroupDateKey,
  sortTodoGroupDateKeys,
  TODO_TIMELINE_EMBEDDED_LAYOUT,
} from '@/utils/todo-timeline';

export interface MyTodoDateGroupsProps {
  items: TodoItem[];
  /** today=仅今天时间轴；all=按日期分组 */
  scope: 'today' | 'all';
  expandedDates: Set<string>;
  onToggleDate: (dateKey: string) => void;
  onToggleComplete: (item: TodoItem) => void;
  /** 点击卡片打开详情 */
  onPress?: (item: TodoItem) => void;
}

const EMBED = TODO_TIMELINE_EMBEDDED_LAYOUT;

const MyTodoDateGroups: React.FC<MyTodoDateGroupsProps> = ({
  items,
  scope,
  expandedDates,
  onToggleDate,
  onToggleComplete,
  onPress,
}) => {
  const now = dayjs();
  const todayKey = now.format('YYYY-MM-DD');

  const dateGroups = useMemo(() => {
    const map = new Map<string, TodoItem[]>();
    items.forEach((item) => {
      const key = resolveTodoGroupDateKey(item, now);
      const list = map.get(key) || [];
      list.push(item);
      map.set(key, list);
    });
    const keys = sortTodoGroupDateKeys([...map.keys()]);
    return keys.map((dateKey) => ({
      dateKey,
      parts: formatTodoGroupDateParts(dateKey, now),
      items: map.get(dateKey) || [],
    }));
  }, [items, now]);

  if (scope === 'today') {
    return (
      <TodoList
        items={items}
        targetDate={todayKey}
        onToggleComplete={onToggleComplete}
        onPress={onPress}
        embedded
      />
    );
  }

  return (
    <View className="flex flex-col">
      {dateGroups.map((group, index) => {
        const expanded = expandedDates.has(group.dateKey);
        const isLast = index === dateGroups.length - 1;
        const isInbox = group.dateKey === 'inbox';
        const isTodayGroup = group.dateKey === todayKey;
        const showAxis = expanded && group.items.length > 0;

        return (
          <View key={group.dateKey} className={cn('relative', isLast ? '' : 'mb-[36rpx]')}>
            {showAxis ? (
              <View
                className="absolute bottom-0 w-[2rpx] todo-timeline-line"
                style={{
                  left: `${EMBED.axisLeft}rpx`,
                  top: '44rpx',
                }}
              />
            ) : null}

            <View
              className="relative flex flex-row items-center justify-between py-[10rpx] press-scale"
              onClick={() => onToggleDate(group.dateKey)}
            >
              <View className="flex min-w-0 flex-1 flex-row items-baseline gap-[8rpx]">
                {group.parts.prefix === '今日' && group.parts.date ? (
                  <>
                    <Text className="shrink-0 text-[26rpx] font-semibold text-primary">今日</Text>
                    <Text className="shrink-0 text-[26rpx] font-medium tabular-nums text-foreground">
                      {group.parts.date}
                    </Text>
                  </>
                ) : group.parts.date ? (
                  <Text className="text-[26rpx] font-medium tabular-nums text-foreground">
                    {group.parts.date}
                  </Text>
                ) : (
                  <Text className="text-[26rpx] font-medium text-foreground">{group.parts.prefix}</Text>
                )}
                <Text className="text-[22rpx] text-muted-foreground">{group.items.length} 项</Text>
              </View>
              <Icon
                name={expanded ? 'mdi-chevron-up' : 'mdi-chevron-down'}
                size="sm"
                color="muted"
              />
            </View>

            {expanded ? (
              <View className="pt-[4rpx]">
                {group.items.length === 0 ? (
                  <Text className="py-[12rpx] text-[24rpx] text-muted-foreground">暂无待办</Text>
                ) : (
                  <TodoList
                    items={group.items}
                    targetDate={isInbox ? undefined : group.dateKey}
                    plainList={isInbox}
                    onToggleComplete={onToggleComplete}
                    onPress={onPress}
                    embedded
                    hideAxis
                    chronological={!isTodayGroup}
                  />
                )}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
};

export default MyTodoDateGroups;
