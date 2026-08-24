/**
 * TodoCalendar - 待办日历页
 *
 * 使用场景：首页待办工具栏日历入口；复用课表日历组件，有数据日期可点并标红点。
 */
import { View, Text } from '@tarojs/components';
import { useDidShow } from '@tarojs/taro';
import dayjs from 'dayjs';
import React, { useCallback, useMemo, useState } from 'react';
import CalendarWeekSelector, { type CalendarDotType } from '@/components/CalendarWeekSelector';
import TodoList from '@/components/home/TodoList';
import PageContainer from '@/components/PageContainer';
import { homeService } from '@/services/home';
import type { TodoItem } from '@/types/home-todo';
import { isStaffRole, useAuth } from '@/utils/auth';
import { logError } from '@/utils/logger';
import { collectTodoDateKeys, filterTodosByDate } from '@/utils/todo-timeline';
import { withRouteGuard } from '@/utils/route-guard';
import { useCampusStore } from '@/stores/campus';

const TodoCalendarPage: React.FC = () => {
  const { profile, currentRole } = useAuth();
  const { currentCampusId } = useCampusStore();
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [todoItems, setTodoItems] = useState<TodoItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTodos = useCallback(async () => {
    if (!profile?.id || !isStaffRole(currentRole)) {
      setTodoItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const teacherData = await homeService.getTeacher(profile.id, currentRole);
      if (!teacherData) return;
      const userName = profile.nickname || profile.name || '我';
      const list = await homeService.getTodoItems(
        teacherData.id,
        currentRole,
        currentCampusId,
        profile.id,
        userName,
      );
      setTodoItems(list);
    } catch (err) {
      logError('TodoCalendar loadTodos', err);
    } finally {
      setLoading(false);
    }
  }, [profile, currentRole, currentCampusId]);

  useDidShow(() => {
    void loadTodos();
  });

  const dateKeys = useMemo(() => collectTodoDateKeys(todoItems), [todoItems]);

  const getDateDotType = useCallback(
    (date: dayjs.Dayjs): CalendarDotType => {
      const key = date.format('YYYY-MM-DD');
      if (!dateKeys.has(key)) return 'none';
      return date.isBefore(dayjs(), 'day') ? 'past' : 'active';
    },
    [dateKeys],
  );

  const isDateDisabled = useCallback(
    (date: dayjs.Dayjs) => !dateKeys.has(date.format('YYYY-MM-DD')),
    [dateKeys],
  );

  const dayTodos = useMemo(
    () => filterTodosByDate(todoItems, selectedDate.format('YYYY-MM-DD')),
    [todoItems, selectedDate],
  );

  const handleComplete = useCallback(
    async (item: TodoItem) => {
      if (!profile?.id) return;
      const userName = profile.nickname || profile.name || '我';
      await homeService.completeTodo(item.id, { userId: profile.id, userName });
      await loadTodos();
    },
    [profile, loadTodos],
  );

  return (
    <PageContainer className="bg-background min-h-screen">
      <View className="px-[24rpx] pt-[16rpx] pb-[48rpx]">
        {loading ? (
          <View className="py-[80rpx] center">
            <Text className="text-[26rpx] text-muted-foreground">加载中…</Text>
          </View>
        ) : (
          <>
        <CalendarWeekSelector
          selectedDate={selectedDate}
          onChange={setSelectedDate}
          getDateDotType={getDateDotType}
          isDateDisabled={isDateDisabled}
        />

        <View className="mt-[24rpx]">
          <Text className="text-[28rpx] font-semibold text-foreground block mb-[16rpx]">
            {selectedDate.format('M月D日')} 待办
          </Text>
          {dayTodos.length === 0 ? (
            <View className="rounded-[24rpx] bg-card border border-border px-[28rpx] py-[48rpx] text-center">
              <Text className="text-[26rpx] text-muted-foreground">该日暂无待办记录</Text>
            </View>
          ) : (
            <TodoList
              items={dayTodos}
              targetDate={selectedDate.format('YYYY-MM-DD')}
              onComplete={handleComplete}
            />
          )}
        </View>
          </>
        )}
      </View>
    </PageContainer>
  );
};

export default withRouteGuard(TodoCalendarPage);
