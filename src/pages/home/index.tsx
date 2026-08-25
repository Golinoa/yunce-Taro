import { View, Text, ScrollView, Image, PageMeta } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import cn from 'classnames';
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import HomeCampusCard from '@/components/home/campus-card';
import CampusSelectSheet from '@/components/home/CampusSelectSheet';
import KingKongSection from '@/components/home/KingKongSection';
import TodayScheduleCard from '@/components/home/TodayScheduleCard';
import TodoList from '@/components/home/TodoList';
import TodoToolbar, { type TodoViewMode } from '@/components/home/TodoToolbar';
import TodoQuadrantBoard from '@/components/home/TodoQuadrantBoard';
import CompleteTodoSheet from '@/components/home/CompleteTodoSheet';
import type { TodoItem } from '@/types/home-todo';
import type { TodoQuadrant } from '@/types/todo-quadrant';
import AddCustomTodoSheet from '@/components/home/AddCustomTodoSheet';
import ExpandableFabMenu from '@/components/home/ExpandableFabMenu';
import Icon from '@/components/Icon';
import LessonConsumptionList, {
  buildLessonConsumptionSections,
  pickHomeRecentLessonRecords,
} from '@/components/lesson/LessonConsumptionList';
import RoleSwitchSheet from '@/components/RoleSwitchSheet';
import { lessonRecordService } from '@/services';
import { homeService } from '@/services/home';
import type { QuickEntry } from '@/services/home';
import { useCampusStore } from '@/stores/campus';
import { useThemeStore } from '@/stores/theme';
import type { CampusUIModel } from '@/types/campus';
import type { LessonRecord } from '@/types/lesson-record';
import type { Schedule } from '@/types/schedule';
import { isPrincipalOrAbove, isStaffRole, useAuth } from '@/utils/auth';
import { getTodoShowTabBadge } from '@/utils/todo-settings';
import { parseBusinessHours, isCampusOpen } from '@/utils/campus';
import { logError } from '@/utils/logger';
import { withRouteGuard } from '@/utils/route-guard';
import { isTodoVisibleOnTimelineToday } from '@/utils/todo-timeline';
import { hasPushedUnattended, pushUnattendedReminder } from '@/utils/subscribe-message';
import { useNavSafeHeight } from '@/utils/use-nav-safe-height';

/** Tab 类型 */
type HomeTab = 'schedule' | 'todo' | 'recent';

const ORG_COVER_IMAGE = '/assets/images/2.jpg';
/** FAB 距屏幕底的安全边距（rpx），与 ExpandableFabMenu 对齐 */
const FAB_REVEAL_BOTTOM_OFFSET_RPX = 48;
/** Tab 标签行下方禁区（rpx）：视口底到 Tab 底不足该高度时不显示 FAB */
const FAB_REVEAL_TAB_GAP_RPX = 300;
/** FAB 菜单收起后，再触发工具栏同款视图切换（毫秒） */
const FAB_VIEW_TOGGLE_DELAY_MS = 220;
/** 待办空状态 Tab 面板兜底高度（rpx @375） */
const TODO_EMPTY_PANEL_MIN_HEIGHT_RPX = 520;

/**
 * Home - 机构端首页
 *
 * 对齐设计稿：
 * - 机构图片背景头部 + 校区切换卡片
 * - 金刚区快捷入口
 * - Tab 切换：今日课表 / 待办事项 / 最近消课
 */
const Home: React.FC = () => {
  const { profile, currentRole, currentIdentity } = useAuth();
  const { campuses, currentCampusId, lastVisitedCampusId, setCurrentCampusId, fetchCampuses } =
    useCampusStore();
  const { activeTheme } = useThemeStore();
  const [roleSheetVisible, setRoleSheetVisible] = useState(false);
  const [showCampusSheet, setShowCampusSheet] = useState(false);
  const navSafeHeight = useNavSafeHeight();

  const currentCampus = useMemo<CampusUIModel | null>(() => {
    const byId = campuses.find((c) => c.id === currentCampusId);
    return byId || campuses.find((c) => c.isMain) || campuses[0] || null;
  }, [campuses, currentCampusId]);

  const businessTime = useMemo(() => {
    const parsed = parseBusinessHours(currentCampus?.businessHours);
    if (!parsed) return '';
    return `${parsed.start}-${parsed.end}`;
  }, [currentCampus?.businessHours]);

  const isOpen = useMemo(
    () => isCampusOpen(currentCampus?.businessHours),
    [currentCampus?.businessHours],
  );

  // ---- 教师端状态 ----
  const [schedules, setSchedules] = useState<Schedule[]>([]);

  // ---- 快捷入口 ----
  const [quickEntries, setQuickEntries] = useState<QuickEntry[]>([]);

  // ---- Tab 状态 ----
  const [activeTab, setActiveTab] = useState<HomeTab>('schedule');

  // ---- 待办事项 ----
  const [todoItems, setTodoItems] = useState<TodoItem[]>([]);
  const [addTodoSheetVisible, setAddTodoSheetVisible] = useState(false);
  const [addTodoDefaultQuadrant, setAddTodoDefaultQuadrant] = useState<TodoQuadrant | undefined>();
  const [todoViewMode, setTodoViewMode] = useState<TodoViewMode>('timeline');
  const [completeSheetItem, setCompleteSheetItem] = useState<TodoItem | null>(null);
  const [completeSheetVisible, setCompleteSheetVisible] = useState(false);

  // ---- 最近消课 ----
  const [recentRecords, setRecentRecords] = useState<LessonRecord[]>([]);

  // ---- 未读消息数 ----
  const [unreadCount, setUnreadCount] = useState(0);
  // ---- 公共状态 ----
  const isFirstMount = useRef(true);
  const [fabMenuExpanded, setFabMenuExpanded] = useState(false);
  const [fabVisible, setFabVisible] = useState(false);
  /** 四象限拖动中锁定首页滚动，避免抢手势 */
  const [quadrantDragging, setQuadrantDragging] = useState(false);
  const savedScrollTopRef = useRef(0);
  /** 仅 FAB 展开等场景短暂受控 scrollTop；为 null 时不传 prop，避免误重置滚动 */
  const [scrollTopPin, setScrollTopPin] = useState<number | null>(null);
  const todoViewModeRef = useRef<TodoViewMode>('timeline');
  /** 待办 Tab 内是否发生过滚动（防止仅点 Tab 未滑就误显） */
  const todoTabScrollEngagedRef = useRef(false);
  const fabVisibilityRafRef = useRef(0);

  useEffect(() => {
    todoViewModeRef.current = todoViewMode;
  }, [todoViewMode]);

  const updateFabVisibility = useCallback(() => {
    if (fabMenuExpanded) {
      return;
    }
    if (activeTab !== 'todo' || !isStaffRole(currentRole) || !todoTabScrollEngagedRef.current) {
      setFabVisible(false);
      return;
    }

    Taro.createSelectorQuery()
      .select('#home-scroll-view')
      .boundingClientRect()
      .select('#home-todo-fab-anchor')
      .boundingClientRect()
      .exec((res) => {
        const scrollViewRect = res[0];
        const anchorRect = res[1];
        if (
          !scrollViewRect ||
          !anchorRect ||
          Array.isArray(scrollViewRect) ||
          Array.isArray(anchorRect)
        ) {
          setFabVisible(false);
          return;
        }

        const { windowWidth } = Taro.getWindowInfo();
        const bottomOffsetPx = (FAB_REVEAL_BOTTOM_OFFSET_RPX * windowWidth) / 750;
        const tabGapPx = (FAB_REVEAL_TAB_GAP_RPX * windowWidth) / 750;
        const scrollViewportBottom = scrollViewRect.top + scrollViewRect.height - bottomOffsetPx;
        const gapBelowTab = scrollViewportBottom - anchorRect.bottom;

        setFabVisible(gapBelowTab > tabGapPx);
      });
  }, [activeTab, currentRole, fabMenuExpanded]);

  const scheduleFabVisibilityUpdate = useCallback(() => {
    if (fabVisibilityRafRef.current) return;
    fabVisibilityRafRef.current = requestAnimationFrame(() => {
      fabVisibilityRafRef.current = 0;
      updateFabVisibility();
    });
  }, [updateFabVisibility]);

  const handleScroll = useCallback(
    (event: { detail: { scrollTop: number } }) => {
      savedScrollTopRef.current = event.detail.scrollTop;
      if (activeTab !== 'todo') return;
      if (fabMenuExpanded) return;
      todoTabScrollEngagedRef.current = true;
      scheduleFabVisibilityUpdate();
    },
    [activeTab, fabMenuExpanded, scheduleFabVisibilityUpdate],
  );

  const handleFabToggle = useCallback((expanded: boolean) => {
    setFabMenuExpanded(expanded);
    if (expanded) {
      setScrollTopPin(savedScrollTopRef.current);
      return;
    }
    setScrollTopPin(null);
  }, []);

  const handleTodoViewModeChange = useCallback((mode: TodoViewMode) => {
    setTodoViewMode(mode);
  }, []);

  /** FAB「卡片/列表视图」：菜单先收起（ExpandableFabMenu 内已关），再延迟走工具栏同款切换 */
  const handleFabViewModeToggle = useCallback(() => {
    const next = todoViewModeRef.current === 'timeline' ? 'quadrant' : 'timeline';
    setTimeout(() => {
      handleTodoViewModeChange(next);
    }, FAB_VIEW_TOGGLE_DELAY_MS);
  }, [handleTodoViewModeChange]);

  useEffect(() => {
    if (activeTab !== 'todo') {
      todoTabScrollEngagedRef.current = false;
      setFabVisible(false);
      return;
    }
    todoTabScrollEngagedRef.current = false;
    setFabVisible(false);
  }, [activeTab, todoItems.length]);

  useEffect(
    () => () => {
      if (fabVisibilityRafRef.current) {
        cancelAnimationFrame(fabVisibilityRafRef.current);
      }
    },
    [],
  );

  // ============================================
  // 校区切换
  // ============================================
  const managedCampusIds = useMemo(() => {
    if (isPrincipalOrAbove(currentRole)) {
      return currentIdentity?.campusIds || [];
    }
    return [];
  }, [currentRole, currentIdentity]);

  const handleOpenCampusSheet = useCallback(() => {
    if (campuses.length === 0) {
      Taro.showToast({ title: '暂无校区', icon: 'none' });
      return;
    }
    setShowCampusSheet(true);
  }, [campuses.length]);

  const handleCloseCampusSheet = useCallback(() => {
    setShowCampusSheet(false);
  }, []);

  const handleConfirmCampus = useCallback(
    (campus: CampusUIModel) => {
      setCurrentCampusId(campus.id);
      setShowCampusSheet(false);
    },
    [setCurrentCampusId],
  );

  // ============================================
  // 教师端数据加载
  // ============================================
  const loadData = useCallback(
    async (campusId?: string) => {
      if (!profile?.id) return;

      if (!isStaffRole(currentRole)) {
        try {
          const unread = await homeService.getUnreadCount(profile.id, currentRole);
          setUnreadCount(unread);
        } catch (err) {
          logError('Home loadUnreadCount', err);
        }
        return;
      }

      try {
        const teacherData = await homeService.getTeacher(profile.id, currentRole);
        if (!teacherData) {
          return;
        }

        const recentLessonRequest =
          currentRole === 'teacher'
            ? lessonRecordService.getByTeacher(teacherData.id, campusId)
            : lessonRecordService.getAll();

        const userName = profile.nickname || profile.name || '我';
        const [scheduleList, unread, todoList, lessonRecords] = await Promise.all([
          homeService.getTodaySchedules(teacherData.id, currentRole, campusId),
          homeService.getUnreadCount(profile.id, currentRole),
          homeService.getTodoItems(teacherData.id, currentRole, campusId, profile.id, userName),
          recentLessonRequest,
        ]);
        setSchedules(scheduleList);
        setUnreadCount(unread);
        setTodoItems(todoList);
        setRecentRecords(lessonRecords);

        // 未点名提醒（用户口径 2026-08-23）：当天 20:00 后，今日课表存在下课未点名 → 微信订阅消息提醒补点名
        const now = new Date();
        if (now.getHours() >= 20) {
          const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
          const unattended = scheduleList.find((s) => s.status === 'unattended');
          if (unattended && !hasPushedUnattended(todayStr)) {
            void pushUnattendedReminder(
              {
                className: unattended.class_info?.name || '未点名课程',
                startTime: unattended.start_time,
                scheduleId: unattended.id,
              },
              todayStr,
            );
          }
        }
      } catch (err) {
        logError('Home loadData', err);
      }
    },
    [profile, currentRole],
  );

  // ============================================
  // 初始化
  // ============================================
  useEffect(() => {
    setQuickEntries(homeService.getQuickEntries(currentRole));
    fetchCampuses();
  }, [currentRole, fetchCampuses]);

  useEffect(() => {
    loadData(currentCampusId);
  }, [profile, currentRole, currentCampusId, loadData]);

  useDidShow(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    loadData(currentCampusId);
  });

  /** 首页待办 Tab：只展示今日（含逾期滚入）；其余进「我的待办」 */
  const todayTodoItems = useMemo(
    () => todoItems.filter((item) => isTodoVisibleOnTimelineToday(item)),
    [todoItems],
  );

  const otherTodoCount = useMemo(
    () => Math.max(todoItems.length - todayTodoItems.length, 0),
    [todoItems.length, todayTodoItems.length],
  );

  const activeTodoCount = useMemo(
    () => todayTodoItems.filter((item) => !item.completed && !item.completion).length,
    [todayTodoItems],
  );

  const handleOpenMyTodos = useCallback(() => {
    Taro.navigateTo({ url: '/pages/my-todos/index' });
  }, []);

  // Tab 配置（待办 badge：仅数量 > 0 且设置开启时显示）
  const showTodoBadge = getTodoShowTabBadge();
  const TAB_OPTIONS: { key: HomeTab; label: string; badge?: number }[] = [
    { key: 'schedule', label: '今日课表' },
    {
      key: 'todo',
      label: '待办事项',
      ...(showTodoBadge && activeTodoCount > 0 ? { badge: activeTodoCount } : {}),
    },
    { key: 'recent', label: '最近消课' },
  ];

  const recentSections = useMemo(
    () => buildLessonConsumptionSections(pickHomeRecentLessonRecords(recentRecords)),
    [recentRecords],
  );

  // ---- Tab 切换（用户口径 2026-08-23：条件渲染替代 Swiper 固定高度，高度自然撑开）----
  const handleHomeTabChange = useCallback(
    (tab: HomeTab) => {
      if (tab === activeTab) return;

      if (activeTab === 'todo') {
        setFabMenuExpanded(false);
        setFabVisible(false);
        setScrollTopPin(null);
        todoTabScrollEngagedRef.current = false;
      }

      if (tab === 'todo') {
        todoTabScrollEngagedRef.current = false;
        setFabVisible(false);
      }

      setActiveTab(tab);
    },
    [activeTab],
  );

  const handleCompleteTodo = useCallback(
    (item: TodoItem) => {
      if (item.sharedScope === 'campus_ops') {
        setCompleteSheetItem(item);
        setCompleteSheetVisible(true);
        return;
      }
      if (!profile?.id) return;
      const userName = profile.nickname || profile.name || '我';
      void homeService
        .completeTodo(item.id, { userId: profile.id, userName })
        .then(() => loadData(currentCampusId))
        .catch((err) => logError('Home completeTodo', err));
    },
    [profile, currentCampusId, loadData],
  );

  const handleSubmitCompleteTodo = useCallback(
    async (note: string) => {
      if (!profile?.id || !completeSheetItem) return;
      const userName = profile.nickname || profile.name || '我';
      await homeService.completeTodo(completeSheetItem.id, {
        userId: profile.id,
        userName,
        note,
      });
      setCompleteSheetVisible(false);
      setCompleteSheetItem(null);
      await loadData(currentCampusId);
    },
    [profile, completeSheetItem, currentCampusId, loadData],
  );

  const handleOpenAddTodoSheet = useCallback((quadrant?: TodoQuadrant) => {
    setAddTodoDefaultQuadrant(quadrant);
    setAddTodoSheetVisible(true);
  }, []);

  const handleCloseAddTodoSheet = useCallback(() => {
    setAddTodoSheetVisible(false);
    setAddTodoDefaultQuadrant(undefined);
  }, []);

  const handleQuadrantChange = useCallback(
    async (item: TodoItem, quadrant: TodoQuadrant) => {
      if (!profile?.id) return;
      const ok = await homeService.updateTodoQuadrant(profile.id, item.id, quadrant);
      if (!ok) {
        Taro.showToast({ title: '调整失败', icon: 'none' });
        return;
      }
      setTodoItems((prev) =>
        prev.map((todo) => (todo.id === item.id ? { ...todo, quadrant } : todo)),
      );
    },
    [profile?.id],
  );

  const handleQuadrantDragActiveChange = useCallback((active: boolean) => {
    setQuadrantDragging(active);
  }, []);

  const handleSubmitCustomTodo = useCallback(
    async (payload: {
      title: string;
      note?: string;
      remindEnabled: boolean;
      remindDate?: string;
      remindTime?: string;
      quadrant?: import('@/types/todo-quadrant').TodoQuadrant;
    }) => {
      if (!profile?.id) return;
      const item = await homeService.addCustomTodo(profile.id, payload);
      setTodoItems((prev) => [item, ...prev]);
      Taro.showToast({ title: '已保存', icon: 'success' });
    },
    [profile?.id],
  );

  const fabActions = useMemo(
    () => [
      {
        key: 'add-todo',
        label: '记待办',
        icon: 'mdi-pencil',
        onClick: () => {
          handleOpenAddTodoSheet();
        },
      },
      {
        key: 'view-toggle',
        label: todoViewMode === 'timeline' ? '卡片视图' : '列表视图',
        icon: todoViewMode === 'timeline' ? 'mdi-view-grid-outline' : 'mdi-format-list-bulleted',
        onClick: handleFabViewModeToggle,
      },
      {
        key: 'my-todos',
        label: '我的待办',
        icon: 'mdi-clipboard-text-outline',
        onClick: () => {
          Taro.navigateTo({ url: '/pages/my-todos/index' });
        },
      },
    ],
    [handleOpenAddTodoSheet, handleFabViewModeToggle, todoViewMode],
  );

  const renderHeader = () => {
    if (!isStaffRole(currentRole)) {
      return (
        <View className="mx-[32rpx] mt-[32rpx] p-[40rpx] rounded-[32rpx] bg-card shadow-soft flex flex-col items-center">
          <Icon name="school" size={80} className="text-primary mb-[24rpx]" />
          <Text className="text-[32rpx] font-bold text-foreground mb-[12rpx]">家长端首页</Text>
          <Text className="text-[26rpx] text-muted-foreground text-center leading-normal">
            当前联调阶段先展示通用运营内容{'\n'}
            可从消息通知和个人中心继续使用家长侧能力
          </Text>
          <View className="mt-[24rpx] flex gap-[16rpx] w-full">
            <View
              className="flex-1 rounded-full bg-primary px-[24rpx] py-[18rpx] flex items-center justify-center"
              onClick={() => Taro.navigateTo({ url: '/pages/notifications/index' })}
            >
              <Text className="text-[24rpx] font-medium text-white">消息通知</Text>
            </View>
            <View
              className="flex-1 rounded-full border border-primary px-[24rpx] py-[18rpx] flex items-center justify-center"
              onClick={() => Taro.switchTab({ url: '/pages/profile/index' })}
            >
              <Text className="text-[24rpx] font-medium text-primary">个人中心</Text>
            </View>
          </View>
        </View>
      );
    }

    return (
      <>
        {/* 机构背景图 */}
        <View className="relative h-[480rpx] overflow-hidden">
          <Image
            src={ORG_COVER_IMAGE}
            className="absolute inset-0 w-full h-full"
            mode="aspectFill"
          />
          <View className="absolute inset-0 bg-black/35" />

          {/* 通知铃铛 */}
          <View
            className="absolute right-[24rpx] z-10"
            style={{ top: `${navSafeHeight - 4}px` }}
            onClick={() => Taro.navigateTo({ url: '/pages/notifications/index' })}
          >
            <View className="relative w-[80rpx] h-[80rpx] flex items-center justify-center">
              <Icon name="mdi-bell-outline" size={44} color="white" />
              {unreadCount > 0 && (
                <View className="absolute top-[10rpx] right-[10rpx] w-[18rpx] h-[18rpx] bg-destructive rounded-full border-[2rpx] border-primary" />
              )}
            </View>
          </View>
        </View>

        {/* 校区卡片 */}
        <View className="relative z-30 -mt-[90rpx] mx-[28rpx]">
          <HomeCampusCard
            campus={currentCampus}
            businessTime={businessTime}
            isOpen={isOpen}
            onSwitch={handleOpenCampusSheet}
            className="shadow-campus"
          />
        </View>
      </>
    );
  };

  return (
    <>
      <PageMeta pageStyle={fabMenuExpanded || quadrantDragging ? 'overflow: hidden;' : ''} />
      <View className={cn(`theme-${activeTheme}`, 'h-screen overflow-x-hidden bg-background')}>
        <ScrollView
          id="home-scroll-view"
          scrollY={!fabMenuExpanded && !quadrantDragging}
          scrollWithAnimation={false}
          showScrollbar={false}
          className="h-full overflow-x-hidden no-scrollbar"
          {...(scrollTopPin !== null ? { scrollTop: scrollTopPin } : {})}
          onScroll={handleScroll}
        >
          <View id="home-scroll-inner" className="min-h-full">
            {renderHeader()}

            {/* 内容区：校区卡片压住上半部分 */}
            <View className="relative z-10 bg-transparent mx-[28rpx] pt-[0] pb-[100rpx]">
              {isStaffRole(currentRole) && <KingKongSection entries={quickEntries} />}

              {isStaffRole(currentRole) && (
                <>
                  <View className="px-[24rpx]">
                    <View className="relative flex flex-row items-center gap-[24rpx] overflow-x-hidden py-[24rpx]">
                      {TAB_OPTIONS.map((tab) => {
                        const badgeCount =
                          typeof tab.badge === 'number' && tab.badge > 0 ? tab.badge : 0;
                        return (
                          <View
                            key={tab.key}
                            className={
                              activeTab === tab.key ? 'tab-item-v14 active' : 'tab-item-v14'
                            }
                            onClick={() => handleHomeTabChange(tab.key)}
                          >
                            <Text className="tab-item-v14__label">{tab.label}</Text>
                            {badgeCount > 0 && (
                              <View className="tab-badge-v14">
                                <Text className="tab-badge-v14__text">
                                  {badgeCount > 99 ? '99+' : badgeCount}
                                </Text>
                              </View>
                            )}
                          </View>
                        );
                      })}
                      <View
                        id="home-todo-fab-anchor"
                        className="pointer-events-none absolute bottom-0 left-0 h-[1rpx] w-full"
                      />
                    </View>

                    <View className="home-tab-panels relative min-h-[400rpx]">
                      {activeTab === 'schedule' && (
                        <View id="home-tab-panel-schedule">
                          <TodayScheduleCard schedules={schedules} title="" />
                        </View>
                      )}

                      {activeTab === 'todo' && (
                        <View
                          id="home-tab-panel-todo"
                          className="relative pt-[24rpx] pb-[48rpx]"
                          style={
                            todoViewMode === 'timeline' && todayTodoItems.length === 0
                              ? { minHeight: `${TODO_EMPTY_PANEL_MIN_HEIGHT_RPX}rpx` }
                              : undefined
                          }
                        >
                          <TodoToolbar
                            viewMode={todoViewMode}
                            onMyTodosClick={handleOpenMyTodos}
                            onViewModeChange={handleTodoViewModeChange}
                            onAddTodoClick={() => handleOpenAddTodoSheet()}
                          />
                          {todoViewMode === 'timeline' ? (
                            <TodoList items={todayTodoItems} onComplete={handleCompleteTodo} />
                          ) : (
                            <TodoQuadrantBoard
                              items={todayTodoItems}
                              onAddQuadrant={handleOpenAddTodoSheet}
                              onComplete={handleCompleteTodo}
                              onQuadrantChange={handleQuadrantChange}
                              onDragActiveChange={handleQuadrantDragActiveChange}
                            />
                          )}

                          {/* 历史 / 未来待办入口：进入「我的待办」看全部（按截止日期等排序） */}
                          <View
                            className="mx-[8rpx] mt-[28rpx] flex flex-row items-center justify-center gap-[8rpx] rounded-[24rpx] bg-card px-[24rpx] py-[24rpx] shadow-card press-scale"
                            onClick={handleOpenMyTodos}
                          >
                            <Text className="text-[26rpx] text-primary font-medium">查看更多</Text>
                            {otherTodoCount > 0 ? (
                              <Text className="text-[22rpx] text-muted-foreground">
                                还有 {otherTodoCount} 条
                              </Text>
                            ) : null}
                            <Icon name="mdi-chevron-right" size="sm" color="primary" />
                          </View>
                        </View>
                      )}

                      {activeTab === 'recent' && (
                        <View id="home-tab-panel-recent" className="pt-[24rpx]">
                          <LessonConsumptionList
                            sections={recentSections}
                            emptyText="暂无消课记录"
                            footerText="查看更多"
                            onFooterClick={() =>
                              Taro.navigateTo({
                                url: '/package-teacher/pages/attendance/index',
                              })
                            }
                          />
                        </View>
                      )}
                    </View>
                  </View>
                </>
              )}
            </View>
          </View>
        </ScrollView>
      </View>

      {/* 校区切换 Sheet */}
      {isStaffRole(currentRole) && (
        <CampusSelectSheet
          visible={showCampusSheet}
          currentId={currentCampusId}
          currentRole={currentRole}
          campuses={campuses}
          managedCampusIds={managedCampusIds}
          lastVisitedId={lastVisitedCampusId}
          onClose={handleCloseCampusSheet}
          onConfirm={handleConfirmCampus}
        />
      )}

      {/* 身份切换 Sheet */}
      <RoleSwitchSheet visible={roleSheetVisible} onClose={() => setRoleSheetVisible(false)} />

      <AddCustomTodoSheet
        visible={addTodoSheetVisible}
        defaultQuadrant={addTodoDefaultQuadrant}
        onClose={handleCloseAddTodoSheet}
        onSubmit={handleSubmitCustomTodo}
      />

      <CompleteTodoSheet
        visible={completeSheetVisible}
        item={completeSheetItem}
        onClose={() => {
          setCompleteSheetVisible(false);
          setCompleteSheetItem(null);
        }}
        onSubmit={handleSubmitCompleteTodo}
      />

      {isStaffRole(currentRole) && (
        <ExpandableFabMenu
          visible={activeTab === 'todo' && fabVisible}
          actions={fabActions}
          onToggle={handleFabToggle}
        />
      )}
    </>
  );
};

export default withRouteGuard(Home);
