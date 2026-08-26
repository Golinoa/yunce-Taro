/**
 * MyTodos - 我的待办
 *
 * 使用场景：首页 FAB / 工具栏「我的待办」。
 * 数据：todoService.getList({ view: 'all' })，与首页 view=home 同一接口。
 * 布局：导航内今日/全部分段 → 分类 Tab（加号跟随/钉住）→ 状态下拉 + 四象限 Chip → 列表。
 */
import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AddCustomTodoPopover from '@/components/my-todos/AddCustomTodoPopover';
import Empty from '@/components/Empty';
import Icon from '@/components/Icon';
import Loading from '@/components/Loading';
import MyTodoDateGroups from '@/components/my-todos/MyTodoDateGroups';
import AddTodoCategorySheet from '@/components/my-todos/AddTodoCategorySheet';
import MonthPickerSheet from '@/components/teacher/MonthPickerSheet';
import { homeService, todoService } from '@/services';
import { useCampusStore } from '@/stores';
import type { TodoItem } from '@/types/home-todo';
import type { TodoCollaborationMode } from '@/types/home-todo';
import type { TodoQuadrant } from '@/types/todo-quadrant';
import {
  TODO_QUADRANT_META,
  TODO_QUADRANT_ORDER,
  resolveTodoQuadrant,
} from '@/types/todo-quadrant';
import { useAuth } from '@/utils/auth';
import { sortHomeTodosByMode, type CustomTodoSortMode } from '@/utils/custom-todos';
import { buildTodoCardDomId } from '@/utils/todo-card-meta';
import { logError } from '@/utils/logger';
import { withRouteGuard } from '@/utils/route-guard';
import {
  TODO_CATEGORY_ALL_ID,
  addTodoCategory,
  listTodoCategoryTabs,
  matchHomeTodoCategoryTab,
  type TodoCategoryTab,
} from '@/utils/todo-categories';
import { consumeTodoCollaboratorResult, type CollaboratorSummary } from '@/utils/todo-collaborator-select';
import {
  buildDefaultExpandedTodoDates,
  formatTodoMonthLabel,
  isTodoVisibleOnTimelineToday,
  resolveTodoGroupDateKey,
} from '@/utils/todo-timeline';
import { useNavSafeHeight } from '@/utils/use-nav-safe-height';
import dayjs from 'dayjs';

type ScopeFilter = 'today' | 'all';
type StatusFilter = 'pending' | 'done';

const QUADRANT_FILTERS: { key: TodoQuadrant; label: string }[] = TODO_QUADRANT_ORDER.map((key) => ({
  key,
  label: TODO_QUADRANT_META[key].shortLabel,
}));

const SORT_OPTIONS: { key: CustomTodoSortMode; label: string }[] = [
  { key: 'deadline', label: '按截止日期' },
  { key: 'createdAt', label: '按创建时间' },
  { key: 'priority', label: '按优先级' },
];

const STATUS_OPTIONS: { key: StatusFilter; label: string }[] = [
  { key: 'pending', label: '未完成' },
  { key: 'done', label: '已完成' },
];

/** 分类加号宽度（px @375 → 约 28px），用于测量是否需要钉在右侧 */
const CATEGORY_PLUS_SLOT_PX = 36;

const MyTodos: React.FC = () => {
  const { profile, currentRole } = useAuth();
  const currentCampusId = useCampusStore((state) => state.currentCampusId);
  const navSafeHeight = useNavSafeHeight();
  const userName = profile?.nickname || profile?.name || '我';

  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [categoryTabs, setCategoryTabs] = useState<TodoCategoryTab[]>(() =>
    listTodoCategoryTabs(''),
  );
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('all');
  const [categoryTabId, setCategoryTabId] = useState(TODO_CATEGORY_ALL_ID);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  /** 空数组 = 不按象限过滤；有值则多选命中任一即展示 */
  const [quadrantKeys, setQuadrantKeys] = useState<TodoQuadrant[]>([]);
  const [sortMode, setSortMode] = useState<CustomTodoSortMode>('deadline');
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [addPopoverVisible, setAddPopoverVisible] = useState(false);
  const [addCollaboratorIds, setAddCollaboratorIds] = useState<string[]>([]);
  const [addCollaboratorSummaries, setAddCollaboratorSummaries] = useState<CollaboratorSummary[]>([]);
  const [addCategoryVisible, setAddCategoryVisible] = useState(false);
  /** 分类过多时把加号钉在右侧；否则跟在最后一个分类后面 */
  const [pinCategoryPlus, setPinCategoryPlus] = useState(false);
  /** 横向滚动锚定到刚添加/选中的分类 */
  const [categoryScrollIntoView, setCategoryScrollIntoView] = useState('');
  const [expandedDates, setExpandedDates] = useState<Set<string>>(() =>
    buildDefaultExpandedTodoDates(dayjs().format('YYYY-MM')),
  );
  const [monthFilter, setMonthFilter] = useState(() => dayjs().format('YYYY-MM'));
  const [monthPickerVisible, setMonthPickerVisible] = useState(false);
  const [listScrollIntoView, setListScrollIntoView] = useState('');
  const teacherIdRef = useRef<string | null>(null);
  const isFirstMount = useRef(true);
  const loadSeqRef = useRef(0);
  const todosCountRef = useRef(0);

  todosCountRef.current = todos.length;

  const loadCategories = useCallback(() => {
    if (!profile?.id) {
      setCategoryTabs(listTodoCategoryTabs(''));
      return;
    }
    setCategoryTabs(listTodoCategoryTabs(profile.id));
  }, [profile?.id]);

  const resetListFilters = useCallback(() => {
    const currentMonth = dayjs().format('YYYY-MM');
    setScopeFilter('all');
    setCategoryTabId(TODO_CATEGORY_ALL_ID);
    setStatusFilter('pending');
    setQuadrantKeys([]);
    setStatusMenuOpen(false);
    setSortMenuOpen(false);
    setMonthFilter(currentMonth);
    setExpandedDates(buildDefaultExpandedTodoDates(currentMonth));
  }, []);

  const loadTodos = useCallback(async () => {
    const seq = ++loadSeqRef.current;

    if (!profile?.id) {
      setTodos([]);
      setListLoading(false);
      return;
    }

    const showBlockingLoader = todosCountRef.current === 0;
    if (showBlockingLoader) {
      setListLoading(true);
    }

    try {
      const teacher = await homeService.getTeacher(profile.id, currentRole);
      if (seq !== loadSeqRef.current) return;

      teacherIdRef.current = teacher?.id || null;
      const list = await todoService.getList({
        view: 'all',
        teacherId: teacher?.id || '',
        role: currentRole,
        campusId: currentCampusId || undefined,
        userId: profile.id,
        userName,
        month: monthFilter,
      });
      if (seq !== loadSeqRef.current) return;

      setTodos(list);
    } catch (err) {
      if (seq !== loadSeqRef.current) return;
      logError('MyTodos loadTodos', err);
      setTodos([]);
      Taro.showToast({ title: '待办加载失败', icon: 'none' });
    } finally {
      if (seq === loadSeqRef.current) {
        setListLoading(false);
      }
    }
  }, [profile?.id, currentRole, currentCampusId, userName, monthFilter]);

  const measureCategoryPlusPin = useCallback(() => {
    Taro.nextTick(() => {
      Taro.createSelectorQuery()
        .select('#my-todo-cat-row')
        .boundingClientRect()
        .select('#my-todo-cat-tabs')
        .boundingClientRect()
        .exec((res) => {
          const row = res[0];
          const tabs = res[1];
          if (!row || !tabs || Array.isArray(row) || Array.isArray(tabs)) return;
          const needPin = tabs.width + CATEGORY_PLUS_SLOT_PX > row.width - 4;
          setPinCategoryPlus(needPin);
        });
    });
  }, []);

  const refreshPage = useCallback(async () => {
    resetListFilters();
    loadCategories();
    await loadTodos();
  }, [loadCategories, loadTodos, resetListFilters]);

  const reloadTodos = useCallback(async () => {
    loadCategories();
    await loadTodos();
  }, [loadCategories, loadTodos]);

  /** 首载与身份/校区变化：不依赖 useDidShow（自定义导航页 onShow 可能晚于首帧） */
  useEffect(() => {
    loadCategories();
    void loadTodos();
  }, [profile?.id, currentRole, currentCampusId, loadCategories, loadTodos]);

  useDidShow(() => {
    const collaboratorResult = consumeTodoCollaboratorResult();
    if (collaboratorResult !== null) {
      setAddCollaboratorIds(collaboratorResult.ids);
      setAddCollaboratorSummaries(collaboratorResult.summaries);
    }
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    void refreshPage();
  });

  usePullDownRefresh(() => {
    void reloadTodos().finally(() => Taro.stopPullDownRefresh());
  });

  useEffect(() => {
    measureCategoryPlusPin();
  }, [categoryTabs, measureCategoryPlusPin]);

  const filteredTodos = useMemo(() => {
    const filtered = todos.filter((todo) => {
      if (scopeFilter === 'today' && !isTodoVisibleOnTimelineToday(todo)) {
        return false;
      }

      if (!matchHomeTodoCategoryTab(todo, categoryTabId)) {
        return false;
      }

      const done = Boolean(todo.completed || todo.completion);
      if (statusFilter === 'pending' && done) return false;
      if (statusFilter === 'done' && !done) return false;

      if (quadrantKeys.length > 0) {
        const q = resolveTodoQuadrant({ quadrant: todo.quadrant, level: todo.level });
        if (!quadrantKeys.includes(q)) return false;
      }

      return true;
    });
    return sortHomeTodosByMode(filtered, sortMode);
  }, [todos, scopeFilter, categoryTabId, statusFilter, quadrantKeys, sortMode]);

  const emptyDescription = useMemo(() => {
    if (listLoading && todos.length === 0) return '';
    if (todos.length > 0 && filteredTodos.length === 0) {
      if (quadrantKeys.length > 0) {
        return '当前象限筛选无匹配，请取消象限或切换状态';
      }
      if (statusFilter === 'done') return '暂无已完成待办';
      if (scopeFilter === 'today') return '今日暂无待办，可切换到「全部」查看';
      if (categoryTabId !== TODO_CATEGORY_ALL_ID) {
        return '当前分类下暂无待办，可切换到「全部」';
      }
      return '当前筛选下暂无待办';
    }
    return statusFilter === 'done' ? '暂无已完成待办' : '点击右下角加号，快速记待办';
  }, [
    listLoading,
    todos.length,
    filteredTodos.length,
    quadrantKeys.length,
    statusFilter,
    scopeFilter,
    categoryTabId,
  ]);

  const sortLabel = useMemo(
    () => SORT_OPTIONS.find((item) => item.key === sortMode)?.label ?? '按截止日期',
    [sortMode],
  );

  const monthLabel = useMemo(() => formatTodoMonthLabel(monthFilter), [monthFilter]);

  const statusLabel = useMemo(
    () => STATUS_OPTIONS.find((item) => item.key === statusFilter)?.label ?? '未完成',
    [statusFilter],
  );

  const handleToggleQuadrant = useCallback((key: TodoQuadrant) => {
    setQuadrantKeys((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key],
    );
  }, []);

  const handleToggleDateSection = useCallback((dateKey: string) => {
    setExpandedDates((prev) => {
      const next = new Set(prev);
      if (next.has(dateKey)) {
        next.delete(dateKey);
      } else {
        next.add(dateKey);
      }
      return next;
    });
  }, []);

  const handleSelectSort = useCallback((mode: CustomTodoSortMode) => {
    setSortMode(mode);
    setSortMenuOpen(false);
  }, []);

  const handleSelectMonth = useCallback((month: string) => {
    setMonthFilter(month);
    setExpandedDates(buildDefaultExpandedTodoDates(month));
    setMonthPickerVisible(false);
  }, []);

  const handleBack = useCallback(() => {
    Taro.navigateBack({ delta: 1 }).catch(() => {
      Taro.switchTab({ url: '/pages/home/index' });
    });
  }, []);

  const handleSelectCategory = useCallback((tabId: string) => {
    setCategoryTabId(tabId);
    setCategoryScrollIntoView('');
    Taro.nextTick(() => {
      setCategoryScrollIntoView(`cat-tab-${tabId}`);
    });
  }, []);

  const handleAddCategory = useCallback(
    async (name: string) => {
      if (!profile?.id) return;
      const created = addTodoCategory(profile.id, name);
      if (!created) {
        Taro.showToast({ title: '分类已存在或无效', icon: 'none' });
        return;
      }
      loadCategories();
      setCategoryTabId(created.id);
      setCategoryScrollIntoView('');
      Taro.nextTick(() => {
        measureCategoryPlusPin();
        setCategoryScrollIntoView(`cat-tab-${created.id}`);
      });
      Taro.showToast({ title: '已添加', icon: 'success' });
    },
    [loadCategories, measureCategoryPlusPin, profile?.id],
  );

  const handleToggleComplete = useCallback(
    async (todo: TodoItem) => {
      if (!profile?.id) return;
      try {
        const done = Boolean(todo.completed || todo.completion);
        if (done) {
          await todoService.reopen(profile.id, todo.id);
        } else {
          await todoService.complete(todo.id, {
            userId: profile.id,
            userName,
            memberId: teacherIdRef.current || profile.id,
          });
        }
        await loadTodos();
      } catch (err) {
        logError('MyTodos handleToggleComplete', err);
        Taro.showToast({ title: '操作失败', icon: 'none' });
      }
    },
    [loadTodos, profile, userName],
  );

  const handleCreateCategoryFromPopover = useCallback(
    async (name: string) => {
      if (!profile?.id) return null;
      const created = addTodoCategory(profile.id, name);
      if (!created) {
        Taro.showToast({ title: '分类已存在或无效', icon: 'none' });
        return null;
      }
      loadCategories();
      Taro.showToast({ title: '已添加', icon: 'success' });
      return created.id;
    },
    [loadCategories, profile?.id],
  );

  const handleSubmitAdd = useCallback(
    async (payload: {
      title: string;
      note?: string;
      remindEnabled: boolean;
      remindDate?: string;
      remindTime?: string;
      quadrant?: TodoQuadrant;
      categoryId?: string;
      collaboratorIds?: string[];
      collaborationMode?: TodoCollaborationMode;
    }) => {
      if (!profile?.id) return;
      const created = await todoService.add(profile.id, payload);
      setAddPopoverVisible(false);
      const now = dayjs();
      const dateKey = resolveTodoGroupDateKey(created, now);
      setExpandedDates((prev) => new Set([...prev, dateKey]));
      if (payload.remindDate) {
        setMonthFilter(dayjs(payload.remindDate).format('YYYY-MM'));
      }
      await loadTodos();
      const domId = buildTodoCardDomId(created.id);
      setTimeout(() => {
        setListScrollIntoView(domId);
        setTimeout(() => setListScrollIntoView(''), 500);
      }, 150);
      Taro.showToast({ title: '已保存', icon: 'success' });
    },
    [loadTodos, profile?.id],
  );

  const renderCategoryPlus = (pinned: boolean) => (
    <View
      className={cn(
        'flex h-[64rpx] w-[56rpx] shrink-0 items-center justify-center press-scale',
        pinned ? 'ml-[4rpx]' : 'ml-[4rpx]',
      )}
      onClick={() => setAddCategoryVisible(true)}
    >
      <Icon name="mdi-plus" size="md" color="muted" />
    </View>
  );

  return (
    <>
      <View className="flex h-screen flex-col bg-muted pb-safe-bottom">
      {/* 自定义导航：渐变仅覆盖导航栏高度（同我的页） */}
      <View
        className="relative shrink-0 overflow-hidden bg-gradient-diffuse-custom-nav"
        style={{ height: `${navSafeHeight}px` }}
      >
        <View className="relative flex h-full flex-row items-end px-[12rpx] pb-[12rpx]">
          <View className="z-10 flex min-w-0 flex-1 flex-row items-center">
            <View
              className="mr-[8rpx] flex h-[56rpx] w-[56rpx] shrink-0 items-center justify-center rounded-full border border-white/60 bg-white/90 shadow-soft press-scale"
              onClick={handleBack}
            >
              <Icon name="mdi-chevron-left" size="lg" color="foreground" />
            </View>
            <View className="flex shrink-0 flex-row items-center rounded-full border border-white/60 bg-white/90 p-[4rpx] shadow-soft">
              {(
                [
                  { key: 'today' as const, label: '今日' },
                  { key: 'all' as const, label: '全部' },
                ] as const
              ).map((item) => {
                const active = scopeFilter === item.key;
                return (
                  <View
                    key={item.key}
                    className={cn(
                      'rounded-full px-[20rpx] py-[8rpx] press-scale',
                      active ? 'bg-primary' : 'bg-transparent',
                    )}
                    onClick={() => setScopeFilter(item.key)}
                  >
                    <Text
                      className={cn(
                        'text-[24rpx] font-semibold',
                        active ? 'text-white' : 'text-foreground-secondary',
                      )}
                    >
                      {item.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
          <View className="pointer-events-none absolute inset-x-0 bottom-[12rpx] flex h-[56rpx] items-center justify-center">
            <Text className="text-[34rpx] font-semibold text-foreground">我的待办</Text>
          </View>
          <View className="w-[180rpx] shrink-0" />
        </View>
      </View>

      {/* 分类：加号默认跟在末尾；超出最大宽度后钉在右侧；溢出可横滑并 scroll-into-view */}
      <View
        id="my-todo-cat-row"
        className="flex shrink-0 flex-row items-center bg-muted px-[24rpx] pt-[8rpx] pb-[4rpx]"
      >
        <ScrollView
          scrollX
          enhanced
          enableFlex
          showScrollbar={false}
          scrollWithAnimation
          scrollIntoView={categoryScrollIntoView}
          className="h-[72rpx] min-w-0 flex-1 overflow-hidden"
        >
          <View className="inline-flex h-[72rpx] flex-row items-center whitespace-nowrap">
            <View id="my-todo-cat-tabs" className="inline-flex flex-row items-center">
              {categoryTabs.map((tab) => (
                <View
                  key={tab.id}
                  id={`cat-tab-${tab.id}`}
                  className={cn(
                    'mr-[8rpx] shrink-0',
                    categoryTabId === tab.id ? 'tab-item-v14 active' : 'tab-item-v14',
                  )}
                  onClick={() => handleSelectCategory(tab.id)}
                >
                  <Text className="tab-item-v14__label">{tab.name}</Text>
                </View>
              ))}
            </View>
            {!pinCategoryPlus ? renderCategoryPlus(false) : null}
          </View>
        </ScrollView>
        {pinCategoryPlus ? renderCategoryPlus(true) : null}
      </View>

      {/* 状态下拉 + 四象限多选 */}
      <View className="relative z-30 flex shrink-0 flex-row flex-nowrap items-center gap-[10rpx] px-[24rpx] pt-[8rpx] pb-[8rpx]">
        <View className="relative shrink-0">
          <View
            className="flex flex-row items-center gap-[4rpx] rounded-full bg-card px-[18rpx] py-[12rpx] press-scale"
            onClick={() => setStatusMenuOpen((open) => !open)}
          >
            <Text className="text-[24rpx] font-medium text-foreground">{statusLabel}</Text>
            <Icon
              name={statusMenuOpen ? 'mdi-chevron-up' : 'mdi-chevron-down'}
              size="sm"
              color="muted"
            />
          </View>
          {statusMenuOpen ? (
            <>
              <View
                className="fixed inset-0 z-40"
                onClick={() => setStatusMenuOpen(false)}
                catchMove
              />
              <View className="absolute left-0 top-full z-50 mt-[8rpx] min-w-[200rpx] overflow-hidden rounded-[16rpx] border border-border bg-card shadow-float">
                {STATUS_OPTIONS.map((option) => {
                  const active = statusFilter === option.key;
                  return (
                    <View
                      key={option.key}
                      className={cn(
                        'flex flex-row items-center justify-between px-[24rpx] py-[20rpx] press-bg',
                        active && 'bg-primary-10',
                      )}
                      onClick={() => {
                        setStatusFilter(option.key);
                        setStatusMenuOpen(false);
                      }}
                    >
                      <Text
                        className={cn(
                          'text-[28rpx]',
                          active ? 'font-semibold text-primary' : 'text-foreground',
                        )}
                      >
                        {option.label}
                      </Text>
                      {active ? <Icon name="mdi-check" size="sm" color="primary" /> : null}
                    </View>
                  );
                })}
              </View>
            </>
          ) : null}
        </View>

        {QUADRANT_FILTERS.map((item) => {
          const active = quadrantKeys.includes(item.key);
          return (
            <View
              key={item.key}
              className={cn(
                'min-w-0 flex-1 flex items-center justify-center rounded-full px-[8rpx] py-[12rpx] press-scale',
                active ? 'bg-primary' : 'bg-card',
              )}
              onClick={() => handleToggleQuadrant(item.key)}
            >
              <Text
                className={cn(
                  'text-[24rpx] leading-none',
                  active ? 'font-semibold text-white' : 'font-medium text-muted-foreground',
                )}
              >
                {item.label}
              </Text>
            </View>
          );
        })}
      </View>

      <View className="flex shrink-0 flex-row items-center justify-between border-t border-border bg-muted px-[24rpx] py-[14rpx]">
        <View className="flex min-w-0 flex-1 flex-row items-center gap-[12rpx]">
          <Text className="shrink-0 text-[24rpx] text-muted-foreground">
            {filteredTodos.length} 个待办
          </Text>
          <View className="h-[20rpx] w-[2rpx] shrink-0 bg-border" />
          <View
            className="flex min-w-0 flex-row items-center gap-[4rpx] press-scale"
            onClick={() => setMonthPickerVisible(true)}
          >
            <Text className="text-[24rpx] font-medium text-foreground">{monthLabel}</Text>
            <Icon name="mdi-chevron-down" size="sm" color="muted" />
          </View>
        </View>
        <View className="relative shrink-0">
          <View
            className="ml-[12rpx] flex shrink-0 flex-row items-center gap-[4rpx] press-scale"
            onClick={() => setSortMenuOpen((open) => !open)}
          >
            <Text className="text-[24rpx] text-primary">{sortLabel}</Text>
            <Icon
              name={sortMenuOpen ? 'mdi-chevron-up' : 'mdi-chevron-down'}
              size="sm"
              color="primary"
            />
          </View>
          {sortMenuOpen ? (
            <>
              <View
                className="fixed inset-0 z-40"
                onClick={() => setSortMenuOpen(false)}
                catchMove
              />
              <View className="absolute right-0 top-full z-50 mt-[8rpx] min-w-[240rpx] overflow-hidden rounded-[16rpx] border border-border bg-card shadow-float">
                {SORT_OPTIONS.map((option) => {
                  const active = sortMode === option.key;
                  return (
                    <View
                      key={option.key}
                      className={cn(
                        'flex flex-row items-center justify-between px-[24rpx] py-[20rpx] press-bg',
                        active && 'bg-primary-10',
                      )}
                      onClick={() => handleSelectSort(option.key)}
                    >
                      <Text
                        className={cn(
                          'text-[26rpx]',
                          active ? 'font-semibold text-primary' : 'text-foreground',
                        )}
                      >
                        {option.label}
                      </Text>
                      {active ? <Icon name="mdi-check" size="sm" color="primary" /> : null}
                    </View>
                  );
                })}
              </View>
            </>
          ) : null}
        </View>
      </View>

      <ScrollView
        scrollY
        scrollWithAnimation
        scrollIntoView={listScrollIntoView}
        className="box-border min-h-0 flex-1 bg-muted"
      >
        {listLoading && todos.length === 0 ? (
          <View className="flex items-center justify-center pt-[120rpx]">
            <Loading size="small" delayMs={0} title="加载待办" text="正在同步待办列表" />
          </View>
        ) : filteredTodos.length === 0 ? (
          <View className="px-[24rpx] pt-[48rpx]">
            <Empty icon="mdi-clipboard-text" description={emptyDescription} />
          </View>
        ) : (
          <View className="px-[24rpx] pb-[32rpx] pt-[8rpx]">
            <MyTodoDateGroups
              items={filteredTodos}
              scope={scopeFilter}
              expandedDates={expandedDates}
              onToggleDate={handleToggleDateSection}
              onToggleComplete={(item) => void handleToggleComplete(item)}
            />
          </View>
        )}
      </ScrollView>
      </View>

      <View
        className="fixed bottom-[calc(32rpx+env(safe-area-inset-bottom))] right-[32rpx] z-[100] flex h-[96rpx] w-[96rpx] items-center justify-center rounded-full bg-primary shadow-float press-scale"
        onClick={() => {
          setAddCollaboratorIds([]);
          setAddCollaboratorSummaries([]);
          setAddPopoverVisible(true);
        }}
      >
        <Icon name="mdi-plus" size="xl" color="white" />
      </View>

      <AddTodoCategorySheet
        visible={addCategoryVisible}
        onClose={() => setAddCategoryVisible(false)}
        onSubmit={handleAddCategory}
      />

      <AddCustomTodoPopover
        visible={addPopoverVisible}
        categoryTabs={categoryTabs}
        defaultCategoryId={categoryTabId}
        collaboratorIds={addCollaboratorIds}
        collaboratorSummaries={addCollaboratorSummaries}
        onClose={() => setAddPopoverVisible(false)}
        onCreateCategory={handleCreateCategoryFromPopover}
        onSubmit={handleSubmitAdd}
      />

      <MonthPickerSheet
        visible={monthPickerVisible}
        value={monthFilter}
        onConfirm={handleSelectMonth}
        onClose={() => setMonthPickerVisible(false)}
      />
    </>
  );
};

export default withRouteGuard(MyTodos);
