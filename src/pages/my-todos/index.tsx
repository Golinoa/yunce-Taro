/**
 * MyTodos - 我的待办（单页列表）
 *
 * 使用场景：首页 FAB / 工具栏「我的待办」。
 * 布局：筛选胶囊 + 任务计数 + 排序选择器 + 左色条卡片 + 右下角加号；
 * 四象限筛选短标签：紧急 / 重要 / 优先 / 普通（设计理念见 TODO_QUADRANT_META）。
 */
import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import cn from 'classnames';
import dayjs from 'dayjs';
import React, { useCallback, useMemo, useState } from 'react';
import AddCustomTodoSheet from '@/components/home/AddCustomTodoSheet';
import BottomSheet from '@/components/BottomSheet';
import Empty from '@/components/Empty';
import Icon from '@/components/Icon';
import { homeService } from '@/services/home';
import type { TodoQuadrant } from '@/types/todo-quadrant';
import { TODO_QUADRANT_META, TODO_QUADRANT_ORDER, resolveTodoQuadrant } from '@/types/todo-quadrant';
import { useAuth } from '@/utils/auth';
import {
  sortCustomTodosByMode,
  buildCustomTodoRemindMeta,
  type CustomTodoRecord,
  type CustomTodoSortMode,
} from '@/utils/custom-todos';
import { logError } from '@/utils/logger';
import { withRouteGuard } from '@/utils/route-guard';

type StatusFilter = 'pending' | 'done';
type QuadrantFilter = 'all' | TodoQuadrant;

/**
 * 四象限筛选胶囊：紧急 / 重要 / 优先 / 普通
 * 对应关系见 `TODO_QUADRANT_META.shortLabel` 注释。
 */
const QUADRANT_FILTERS: { key: TodoQuadrant; label: string }[] = TODO_QUADRANT_ORDER.map(
  (key) => ({
    key,
    label: TODO_QUADRANT_META[key].shortLabel,
  }),
);

/** 卡片左侧色条：q2 金 / q4 绿取自四象限看板参考色 */
const QUADRANT_ACCENT_CLASS: Record<TodoQuadrant, string> = {
  q1: 'bg-destructive',
  q2: 'bg-todo-q2',
  q3: 'bg-todo-q3',
  q4: 'bg-todo-q4',
};

const SORT_OPTIONS: { key: CustomTodoSortMode; label: string }[] = [
  { key: 'deadline', label: '按截止日期' },
  { key: 'createdAt', label: '按创建时间' },
  { key: 'priority', label: '按优先级' },
];

const MyTodos: React.FC = () => {
  const { profile } = useAuth();
  const [todos, setTodos] = useState<CustomTodoRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [quadrantFilter, setQuadrantFilter] = useState<QuadrantFilter>('all');
  const [sortMode, setSortMode] = useState<CustomTodoSortMode>('deadline');
  const [sortSheetVisible, setSortSheetVisible] = useState(false);
  const [addSheetVisible, setAddSheetVisible] = useState(false);

  const loadTodos = useCallback(async () => {
    if (!profile?.id) {
      setTodos([]);
      return;
    }
    try {
      const list = await homeService.listCustomTodos(profile.id);
      setTodos(list);
    } catch (err) {
      logError('MyTodos loadTodos', err);
      setTodos([]);
    }
  }, [profile?.id]);

  useDidShow(() => {
    void loadTodos();
  });

  usePullDownRefresh(() => {
    void loadTodos().finally(() => Taro.stopPullDownRefresh());
  });

  const filteredTodos = useMemo(() => {
    const filtered = todos.filter((todo) => {
      const done = Boolean(todo.completedAt);
      if (statusFilter === 'pending' && done) return false;
      if (statusFilter === 'done' && !done) return false;
      if (quadrantFilter === 'all') return true;
      return resolveTodoQuadrant({ quadrant: todo.quadrant }) === quadrantFilter;
    });
    return sortCustomTodosByMode(filtered, sortMode);
  }, [todos, statusFilter, quadrantFilter, sortMode]);

  const sortLabel = useMemo(
    () => SORT_OPTIONS.find((item) => item.key === sortMode)?.label ?? '按截止日期',
    [sortMode],
  );

  const handleToggleQuadrantFilter = useCallback((key: TodoQuadrant) => {
    setQuadrantFilter((prev) => (prev === key ? 'all' : key));
  }, []);

  const handleSelectSort = useCallback((mode: CustomTodoSortMode) => {
    setSortMode(mode);
    setSortSheetVisible(false);
  }, []);

  const handleToggleComplete = useCallback(
    async (todo: CustomTodoRecord) => {
      if (!profile?.id) return;
      try {
        if (todo.completedAt) {
          await homeService.reopenCustomTodo(profile.id, todo.id);
        } else {
          await homeService.completeTodo(todo.id, {
            userId: profile.id,
            userName: profile.nickname || profile.name || '我',
          });
        }
        await loadTodos();
      } catch (err) {
        logError('MyTodos handleToggleComplete', err);
        Taro.showToast({ title: '操作失败', icon: 'none' });
      }
    },
    [loadTodos, profile],
  );

  const handleDelete = useCallback(
    (todo: CustomTodoRecord) => {
      if (!profile?.id) return;
      Taro.showModal({
        title: '删除待办',
        content: '删除后无法恢复，确认删除？',
        success: (result) => {
          if (!result.confirm) return;
          void homeService.removeCustomTodo(profile.id, todo.id).then((ok) => {
            if (!ok) {
              Taro.showToast({ title: '删除失败', icon: 'none' });
              return;
            }
            void loadTodos();
            Taro.showToast({ title: '已删除', icon: 'success' });
          });
        },
      });
    },
    [loadTodos, profile?.id],
  );

  const handleSubmitAdd = useCallback(
    async (payload: {
      title: string;
      note?: string;
      remindEnabled: boolean;
      remindDate?: string;
      remindTime?: string;
      quadrant?: TodoQuadrant;
    }) => {
      if (!profile?.id) return;
      await homeService.addCustomTodo(profile.id, payload);
      setAddSheetVisible(false);
      await loadTodos();
      Taro.showToast({ title: '已保存', icon: 'success' });
    },
    [loadTodos, profile?.id],
  );

  return (
    <View className="relative min-h-screen bg-muted pb-safe-bottom">
      <ScrollView scrollY className="box-border h-screen">
        {/* 筛选条：未完成 / 已完成 + 紧急 / 重要 / 优先 / 普通 */}
        <ScrollView scrollX showScrollbar={false} className="w-full whitespace-nowrap">
          <View className="flex flex-row items-center gap-[16rpx] px-[28rpx] pt-[24rpx] pb-[8rpx]">
            <View
              className={cn(
                'inline-flex shrink-0 items-center justify-center rounded-full px-[28rpx] py-[14rpx] press-scale',
                statusFilter === 'pending' ? 'bg-primary' : 'bg-card',
              )}
              onClick={() => setStatusFilter('pending')}
            >
              <Text
                className={cn(
                  'text-[26rpx] font-medium',
                  statusFilter === 'pending' ? 'text-white' : 'text-muted-foreground',
                )}
              >
                未完成
              </Text>
            </View>
            <View
              className={cn(
                'inline-flex shrink-0 items-center justify-center rounded-full px-[28rpx] py-[14rpx] press-scale',
                statusFilter === 'done' ? 'bg-primary' : 'bg-card',
              )}
              onClick={() => setStatusFilter('done')}
            >
              <Text
                className={cn(
                  'text-[26rpx] font-medium',
                  statusFilter === 'done' ? 'text-white' : 'text-muted-foreground',
                )}
              >
                已完成
              </Text>
            </View>

            {QUADRANT_FILTERS.map((item) => {
              const active = quadrantFilter === item.key;
              return (
                <View
                  key={item.key}
                  className={cn(
                    'inline-flex shrink-0 items-center justify-center rounded-full px-[28rpx] py-[14rpx] press-scale',
                    active ? 'bg-primary' : 'bg-card',
                  )}
                  onClick={() => handleToggleQuadrantFilter(item.key)}
                >
                  <Text
                    className={cn(
                      'text-[26rpx] font-medium',
                      active ? 'text-white' : 'text-muted-foreground',
                    )}
                  >
                    {item.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </ScrollView>

        {/* 计数 + 排序选择器 */}
        <View className="mb-[16rpx] mt-[20rpx] flex flex-row items-center justify-between px-[28rpx]">
          <Text className="text-[28rpx] font-semibold text-foreground">
            共 {filteredTodos.length} 个任务
          </Text>
          <View
            className="flex flex-row items-center gap-[4rpx] press-scale"
            onClick={() => setSortSheetVisible(true)}
          >
            <Text className="text-[24rpx] text-primary">{sortLabel}</Text>
            <Icon name="mdi-chevron-down" size="sm" color="primary" />
          </View>
        </View>

        {filteredTodos.length === 0 ? (
          <View className="px-[28rpx] pt-[48rpx]">
            <Empty
              icon="mdi-clipboard-text"
              description={
                statusFilter === 'done' ? '暂无已完成待办' : '点击右下角加号，快速记待办'
              }
            />
          </View>
        ) : (
          <View className="flex flex-col gap-[20rpx] px-[28rpx] pb-[200rpx]">
            {filteredTodos.map((todo) => {
              const done = Boolean(todo.completedAt);
              const quadrant = resolveTodoQuadrant({ quadrant: todo.quadrant });
              const meta = done
                ? {
                    line: `已完成 · ${dayjs(todo.completedAt).format('YYYY-MM-DD HH:mm')}`,
                    tone: 'normal' as const,
                    isOverdue: false,
                  }
                : buildCustomTodoRemindMeta(todo);

              const accentClass =
                !done && meta?.isOverdue
                  ? 'bg-destructive'
                  : QUADRANT_ACCENT_CLASS[quadrant];

              return (
                <View
                  key={todo.id}
                  className={cn(
                    'relative overflow-hidden rounded-[24rpx] bg-card shadow-card',
                    done && 'opacity-75',
                  )}
                >
                  <View
                    className={cn(
                      'absolute bottom-0 left-0 top-0 w-[8rpx]',
                      accentClass,
                    )}
                  />

                  <View className="flex flex-row items-start gap-[20rpx] py-[28rpx] pl-[28rpx] pr-[20rpx]">
                    <View
                      className="mt-[4rpx] flex h-[44rpx] w-[44rpx] shrink-0 items-center justify-center press-scale"
                      onClick={() => void handleToggleComplete(todo)}
                    >
                      <Icon
                        name={
                          done ? 'mdi-check-circle' : 'mdi-checkbox-blank-circle-outline'
                        }
                        size="md"
                        color={done ? 'success' : 'muted'}
                      />
                    </View>

                    <View className="min-w-0 flex-1">
                      <Text
                        className={cn(
                          'mb-[10rpx] block text-[30rpx] font-semibold leading-snug',
                          done ? 'todo-title-done' : 'text-foreground',
                        )}
                      >
                        {todo.title}
                      </Text>

                      {meta ? (
                        <Text
                          className={cn(
                            'text-[24rpx]',
                            meta.tone === 'overdue' ? 'text-destructive' : 'text-muted-foreground',
                          )}
                        >
                          {meta.line}
                        </Text>
                      ) : (
                        <Text className="text-[24rpx] text-muted-foreground">无提醒</Text>
                      )}
                    </View>

                    <View
                      className="mt-[2rpx] shrink-0 p-[8rpx] press-scale"
                      onClick={() => handleDelete(todo)}
                    >
                      <Icon name="mdi-dots-vertical" size="sm" color="muted" />
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <View
        className="fixed bottom-[calc(48rpx+env(safe-area-inset-bottom))] right-[32rpx] z-50 flex h-[96rpx] w-[96rpx] items-center justify-center rounded-full bg-primary shadow-float press-scale"
        onClick={() => setAddSheetVisible(true)}
      >
        <Icon name="mdi-plus" size="xl" color="white" />
      </View>

      <BottomSheet
        visible={sortSheetVisible}
        title="排序方式"
        height="auto"
        onClose={() => setSortSheetVisible(false)}
      >
        <View className="px-[32rpx] pb-[48rpx]">
          {SORT_OPTIONS.map((option) => {
            const active = sortMode === option.key;
            return (
              <View
                key={option.key}
                className={cn(
                  'mb-[16rpx] flex flex-row items-center justify-between rounded-[20rpx] px-[28rpx] py-[28rpx] press-scale',
                  active ? 'bg-primary-10' : 'bg-muted',
                )}
                onClick={() => handleSelectSort(option.key)}
              >
                <Text
                  className={cn(
                    'text-[30rpx] font-medium',
                    active ? 'text-primary' : 'text-foreground',
                  )}
                >
                  {option.label}
                </Text>
                {active ? <Icon name="mdi-check-circle" size="md" color="primary" /> : null}
              </View>
            );
          })}
        </View>
      </BottomSheet>

      <AddCustomTodoSheet
        visible={addSheetVisible}
        onClose={() => setAddSheetVisible(false)}
        onSubmit={handleSubmitAdd}
      />
    </View>
  );
};

export default withRouteGuard(MyTodos);
