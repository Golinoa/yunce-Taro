import { View, Text, ScrollView, Image, PageMeta } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import cn from 'classnames';
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import HomeCampusCard from '@/components/home/campus-card';
import CampusSelectSheet from '@/components/home/CampusSelectSheet';
import KingKongSection from '@/components/home/KingKongSection';
import TodayScheduleCard from '@/components/home/TodayScheduleCard';
import TodoList from '@/components/home/TodoList';
import type { TodoItem } from '@/types/home-todo';
import AddCustomTodoSheet from '@/components/home/AddCustomTodoSheet';
import AddNoteSheet from '@/components/home/AddNoteSheet';
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
import { hasPushedUnattended, pushUnattendedReminder } from '@/utils/subscribe-message';
import { useNavSafeHeight } from '@/utils/use-nav-safe-height';
import type { ITouchEvent } from '@tarojs/components';

/** Tab 类型 */
type HomeTab = 'schedule' | 'todo' | 'recent';

const HOME_TAB_ORDER: HomeTab[] = ['schedule', 'todo', 'recent'];
const ORG_COVER_IMAGE = '/assets/images/2.jpg';
/** 待办列表进入视口后，距底部约 2 张卡片高度时显示 FAB（rpx @375） */
const FAB_REVEAL_BOTTOM_OFFSET_RPX = 320;

const getHomeTabIndex = (tab: HomeTab): number => HOME_TAB_ORDER.indexOf(tab);

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
  const [addNoteSheetVisible, setAddNoteSheetVisible] = useState(false);

  // ---- 最近消课 ----
  const [recentRecords, setRecentRecords] = useState<LessonRecord[]>([]);

  // ---- 未读消息数 ----
  const [unreadCount, setUnreadCount] = useState(0);
  // ---- 公共状态 ----
  const isFirstMount = useRef(true);
  const [fabMenuExpanded, setFabMenuExpanded] = useState(false);
  const [fabVisible, setFabVisible] = useState(false);
  const savedScrollTopRef = useRef(0);
  /** 仅 FAB 展开等场景短暂受控 scrollTop；为 null 时不传 prop，避免误重置滚动 */
  const [scrollTopPin, setScrollTopPin] = useState<number | null>(null);
  const fabQueryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 待办 FAB 锚点在滚动内容中的 top（px），切换 Tab 后测量一次 */
  const todoFabAnchorTopRef = useRef(0);
  /** Tab 内容区历史最大高度（px），切换时占位防止滚动跳动 */
  const tabAreaMinHeightRef = useRef(0);
  const [tabAreaMinHeight, setTabAreaMinHeight] = useState(0);

  const measureTabAreaHeight = useCallback(() => {
    Taro.createSelectorQuery()
      .select(`#home-tab-panel-${activeTab}`)
      .boundingClientRect()
      .exec((res) => {
        const rect = res[0];
        if (!rect || Array.isArray(rect) || rect.height <= 0) return;

        const nextMin = Math.max(tabAreaMinHeightRef.current, rect.height);
        if (nextMin === tabAreaMinHeightRef.current) return;

        tabAreaMinHeightRef.current = nextMin;
        setTabAreaMinHeight(nextMin);
      });
  }, [activeTab]);

  const updateFabVisibilityFromScroll = useCallback(
    (scrollTop: number) => {
      if (activeTab !== 'todo' || !isStaffRole(currentRole)) {
        setFabVisible(false);
        return;
      }
      const { windowHeight, windowWidth } = Taro.getWindowInfo();
      const bottomOffsetPx = (FAB_REVEAL_BOTTOM_OFFSET_RPX * windowWidth) / 750;
      const revealLine = scrollTop + windowHeight - bottomOffsetPx;
      setFabVisible(revealLine > todoFabAnchorTopRef.current);
    },
    [activeTab, currentRole],
  );

  const measureTodoFabAnchor = useCallback(() => {
    if (activeTab !== 'todo' || !isStaffRole(currentRole)) return;

    Taro.createSelectorQuery()
      .select('#home-todo-fab-anchor')
      .boundingClientRect()
      .select('#home-scroll-inner')
      .boundingClientRect()
      .exec((res) => {
        const anchorRect = res[0];
        const innerRect = res[1];
        if (!anchorRect || !innerRect || Array.isArray(anchorRect) || Array.isArray(innerRect)) {
          return;
        }
        todoFabAnchorTopRef.current =
          savedScrollTopRef.current + anchorRect.top - innerRect.top;
        updateFabVisibilityFromScroll(savedScrollTopRef.current);
      });
  }, [activeTab, currentRole, updateFabVisibilityFromScroll]);

  const handleScroll = useCallback(
    (event: { detail: { scrollTop: number } }) => {
      const scrollTop = event.detail.scrollTop;
      savedScrollTopRef.current = scrollTop;
      if (activeTab !== 'todo') return;
      if (fabQueryTimerRef.current) return;
      fabQueryTimerRef.current = setTimeout(() => {
        fabQueryTimerRef.current = null;
        updateFabVisibilityFromScroll(scrollTop);
      }, 50);
    },
    [activeTab, updateFabVisibilityFromScroll],
  );

  const handleFabToggle = useCallback((expanded: boolean) => {
    setFabMenuExpanded(expanded);
    if (expanded) {
      setScrollTopPin(savedScrollTopRef.current);
      return;
    }
    // 释放受控：不传 scrollTop prop，保持当前物理滚动位置
    setScrollTopPin(null);
  }, []);

  useEffect(() => {
    if (activeTab !== 'todo') {
      setFabVisible(false);
      return;
    }
    Taro.nextTick(() => {
      measureTodoFabAnchor();
    });
  }, [activeTab, todoItems.length, measureTodoFabAnchor]);

  useEffect(() => {
    Taro.nextTick(() => {
      measureTabAreaHeight();
    });
    const timer = setTimeout(measureTabAreaHeight, 100);
    return () => clearTimeout(timer);
  }, [activeTab, schedules.length, todoItems.length, recentRecords.length, measureTabAreaHeight]);

  useEffect(
    () => () => {
      if (fabQueryTimerRef.current) clearTimeout(fabQueryTimerRef.current);
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

        const [scheduleList, unread, todoList, lessonRecords] = await Promise.all([
          homeService.getTodaySchedules(teacherData.id, currentRole, campusId),
          homeService.getUnreadCount(profile.id, currentRole),
          homeService.getTodoItems(teacherData.id, currentRole, campusId, profile.id),
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

  // Tab 配置（待办 badge：仅数量 > 0 且设置开启时显示）
  const showTodoBadge = getTodoShowTabBadge();
  const TAB_OPTIONS: { key: HomeTab; label: string; badge?: number }[] = [
    { key: 'schedule', label: '今日课表' },
    {
      key: 'todo',
      label: '待办事项',
      ...(showTodoBadge && todoItems.length > 0 ? { badge: todoItems.length } : {}),
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
        // 禁止 setScrollTopPin(undefined)：受控 ScrollView 会把 undefined 当成滚回顶部
        setScrollTopPin(null);
      }

      setActiveTab(tab);
    },
    [activeTab],
  );

  /** 手动点「已读」/「完成」：记录后从待办列表移除 */
  const handleMarkTodoRead = useCallback(
    (todoId: string) => {
      if (!profile?.id) return;
      void homeService
        .markTodoRead(todoId, profile.id)
        .then(() => {
          setTodoItems((prev) => prev.filter((item) => item.id !== todoId));
        })
        .catch((err) => {
          logError('Home markTodoRead', err);
        });
    },
    [profile?.id],
  );

  const handleCloseAddTodoSheet = useCallback(() => {
    setAddTodoSheetVisible(false);
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

  const handleSubmitNote = useCallback(
    async (payload: { content: string; folder?: string; tagColor?: import('@/utils/user-notes').NoteTagColor }) => {
      if (!profile?.id) return;
      await homeService.addUserNote(profile.id, payload);
      Taro.showToast({ title: '笔记已保存', icon: 'success' });
    },
    [profile?.id],
  );

  const fabActions = useMemo(
    () => [
      {
        key: 'calendar',
        label: '日历视图',
        icon: 'mdi-calendar-outline',
        onClick: () => {
          Taro.switchTab({ url: '/pages/schedule/index' });
        },
      },
      {
        key: 'my-notes',
        label: '我的笔记',
        icon: 'mdi-notebook-edit-outline',
        onClick: () => {
          Taro.navigateTo({ url: '/pages/my-notes/index' });
        },
      },
      {
        key: 'add-note',
        label: '记笔记',
        icon: 'mdi-pencil',
        onClick: () => {
          setAddNoteSheetVisible(true);
        },
      },
      {
        key: 'add-todo',
        label: '记待办',
        icon: 'mdi-clipboard-text-outline',
        onClick: () => {
          setAddTodoSheetVisible(true);
        },
      },
    ],
    [],
  );

  // ---- 横滑切换 Tab（替代 Swiper 的滑动手势）----
  const tabTouchStartRef = useRef({ x: 0, y: 0 });
  const handleTabTouchStart = useCallback((e: ITouchEvent) => {
    const touch = e.touches?.[0];
    if (touch) {
      tabTouchStartRef.current = { x: touch.clientX, y: touch.clientY };
    }
  }, []);
  const handleTabTouchEnd = useCallback(
    (e: ITouchEvent) => {
      const touch = e.changedTouches?.[0];
      if (!touch) return;
      const deltaX = touch.clientX - tabTouchStartRef.current.x;
      const deltaY = touch.clientY - tabTouchStartRef.current.y;
      // 横向位移 > 60px 且明显大于纵向（避免与页面纵向滚动冲突）
      if (Math.abs(deltaX) > 60 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
        const idx = getHomeTabIndex(activeTab);
        const nextIdx = deltaX < 0 ? idx + 1 : idx - 1;
        if (nextIdx >= 0 && nextIdx < HOME_TAB_ORDER.length) {
          handleHomeTabChange(HOME_TAB_ORDER[nextIdx]);
        }
      }
    },
    [activeTab, handleHomeTabChange],
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
      <PageMeta pageStyle={fabMenuExpanded ? 'overflow: hidden;' : ''} />
      <View className={cn(`theme-${activeTheme}`, 'h-screen overflow-x-hidden bg-background')}>
        <ScrollView
          scrollY={!fabMenuExpanded}
          showScrollbar={false}
          className="h-full overflow-x-hidden no-scrollbar"
          {...(scrollTopPin !== null ? { scrollTop: scrollTopPin } : {})}
          onScroll={handleScroll}
        >
          <View id="home-scroll-inner" className="min-h-full">
            {renderHeader()}

            {/* 内容区：校区卡片压住上半部分 */}
            <View className="relative z-10 bg-transparent mx-[28rpx] pt-[0] pb-[100rpx]">
              {/* 金刚区 */}
              {isStaffRole(currentRole) && <KingKongSection entries={quickEntries} />}

              {/* Tab 内容区 */}
              <View className="px-[24rpx]">
                {isStaffRole(currentRole) && (
                  <>
                    <View className="flex flex-row items-center gap-[24rpx] overflow-x-hidden py-[24rpx]">
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
                            {/* 空待办不显示 0：仅 badge>0 时渲染圆形数字 */}
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
                    </View>

                    {/* 用户口径（2026-08-23）：Tab 内容改条件渲染，高度自然撑开（不裁切/不空白/无跳动）；
                        支持横滑切换（替代 Swiper）；空数据保持最低高度 */}
                    <View
                      className="home-tab-panels relative min-h-[400rpx]"
                      style={tabAreaMinHeight > 0 ? { minHeight: `${tabAreaMinHeight}px` } : undefined}
                      onTouchStart={handleTabTouchStart}
                      onTouchEnd={handleTabTouchEnd}
                    >
                      {activeTab === 'schedule' && (
                        <View id="home-tab-panel-schedule">
                          <TodayScheduleCard schedules={schedules} title="" />
                        </View>
                      )}

                      {activeTab === 'todo' && (
                        <View
                          id="home-tab-panel-todo"
                          className="relative pt-[24rpx] pb-[48rpx]"
                        >
                          <View id="home-todo-fab-anchor" className="h-[2rpx] w-full" />
                          <TodoList items={todoItems} onMarkRead={handleMarkTodoRead} />
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
                  </>
                )}
              </View>
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
        onClose={handleCloseAddTodoSheet}
        onSubmit={handleSubmitCustomTodo}
      />

      <AddNoteSheet
        visible={addNoteSheetVisible}
        onClose={() => setAddNoteSheetVisible(false)}
        onSubmit={handleSubmitNote}
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
