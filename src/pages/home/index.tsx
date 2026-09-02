import { View, ScrollView, PageMeta } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import cn from 'classnames';
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { hasShownCampusGuide } from '@/components/home/HomeCampusGuideDialog';
import KingKongSection from '@/components/home/KingKongSection';
import ParentHoursSection from '@/components/home/ParentHoursSection';
import ParentScheduleSection from '@/components/home/ParentScheduleSection';
import type { TodoViewMode } from '@/components/home/TodoToolbar';
import {
  buildLessonConsumptionSections,
  pickHomeRecentLessonRecords,
} from '@/components/lesson/LessonConsumptionList';
import { useOverlayScrollFreeze } from '@/hooks/useOverlayScrollFreeze';
import EmailBindReminder from '@/package-auth/components/EmailBindReminder';
import WechatBindReminder from '@/package-auth/components/WechatBindReminder';
import { lessonRecordService, todoService } from '@/services';
import { listParentStorefronts, switchAuthContext } from '@/services/auth';
import { homeService } from '@/services/home';
import type { QuickEntry, ParentHomePackageCard } from '@/services/home';
import { leadService } from '@/services/lead';
import {
  consumePendingRelation,
  organizationService,
  type PendingRelation,
} from '@/services/organization';
import { venueBookingService } from '@/services/venue-booking';
import { useCampusStore } from '@/stores/campus';
import { useThemeStore } from '@/stores/theme';
import type { CampusUIModel } from '@/types/campus';
import type { TodoItem } from '@/types/home-todo';
import type { LessonRecord } from '@/types/lesson-record';
import type { Schedule } from '@/types/schedule';
import type { ParentStorefrontItem } from '@/types/storefront';
import type { TodoQuadrant } from '@/types/todo-quadrant';
import { isParentRole, isPrincipalOrAbove, isStaffRole, useAuth } from '@/utils/auth';
import { parseBusinessHours, isCampusOpen } from '@/utils/campus';
import { logError } from '@/utils/logger';
import { storefrontKey } from '@/utils/parent-storefront';
import { isWithinRefetchTtl } from '@/utils/refetch-ttl';
import { withRouteGuard } from '@/utils/route-guard';
import { scrollIntoViewProps } from '@/utils/scroll-view-props';
import { hasPushedUnattended, pushUnattendedReminder } from '@/utils/subscribe-message';
import { syncTabBarByProfile } from '@/utils/tab-bar';
import { listTodoCategoryTabs, type TodoCategoryTab } from '@/utils/todo-categories';
import {
  consumeTodoCollaboratorResult,
  type CollaboratorSummary,
} from '@/utils/todo-collaborator-select';
import { getTodoShowTabBadge } from '@/utils/todo-settings';
import { useNavSafeHeight } from '@/utils/use-nav-safe-height';
import { todayDateKey } from './home-date-logic';
import { fabViewToggleIcon, fabViewToggleLabel } from './home-fab-logic';
import { RELATION_DISMISS_KEY, isRelationDismissedToday } from './home-relation-logic';
import {
  buildHomeTabOptions,
  countActiveTodoItems,
  countOtherTodoItems,
  filterTodayTodoItems,
  type HomeTab,
} from './home-todo-derived';
import HomePageHeader from './HomePageHeader';
import HomePageOverlays from './HomePageOverlays';
import HomeStaffTabPanels from './HomeStaffTabPanels';
import { useHomeFab } from './use-home-fab';
import { useHomeTodoActions } from './use-home-todo-actions';

/**
 * Home - 机构端首页
 *
 * 对齐设计稿：
 * - 机构封面头部（F 风格主题渐变品牌托底）+ 校区切换卡片
 * - 金刚区快捷入口
 * - Tab 切换：今日课表 / 待办事项 / 最近消课
 */
const Home: React.FC = () => {
  /** 构建期常量：生产构建恒为 false，DCE 整棵移除 MockIdentitySwitcher（P-05/B-02） */
  const isDebugBuild = process.env.TARO_ENABLE_LOCAL_DEBUG === 'true';
  const { profile, currentRole, currentIdentity, applyAuthPayload } = useAuth();
  const {
    campuses,
    currentCampusId,
    lastVisitedCampusId,
    setCurrentCampusId,
    setCurrentOrganizationId,
    setOrgName,
    setAllowedCampusIds,
    fetchCampuses,
  } = useCampusStore();
  const { activeTheme } = useThemeStore();
  const [roleSheetVisible, setRoleSheetVisible] = useState(false);
  const [showCampusSheet, setShowCampusSheet] = useState(false);
  const [parentStorefronts, setParentStorefronts] = useState<ParentStorefrontItem[]>([]);
  const [campusConfirming, setCampusConfirming] = useState(false);
  const navSafeHeight = useNavSafeHeight();

  // ---- 关系确认弹窗（R11）：绑定/归属完成后进入首页弹一次 ----
  const [pendingRelation, setPendingRelation] = useState<PendingRelation | null>(null);
  const [relationSheetVisible, setRelationSheetVisible] = useState(false);

  // ---- 新校长校区配置引导弹窗（M1）：机构无校区且未展示过时弹一次 ----
  const [campusGuideVisible, setCampusGuideVisible] = useState(false);
  const isManagerRole = currentRole === 'principal' || currentRole === 'admin';

  useEffect(() => {
    if (!isManagerRole || campuses.length > 0 || hasShownCampusGuide()) {
      return;
    }
    // 延迟一小段，避免与其他首屏弹窗（关系确认）同时弹出
    const timer = setTimeout(() => {
      setCampusGuideVisible(true);
    }, 600);
    return () => clearTimeout(timer);
  }, [isManagerRole, campuses.length]);

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

  // ---- 教师端 / 家长端 / 快捷入口 / Tab ----
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [parentSchedules, setParentSchedules] = useState<Schedule[]>([]);
  const [parentPackages, setParentPackages] = useState<ParentHomePackageCard[]>([]);
  const [parentFallbackStudentId, setParentFallbackStudentId] = useState('');
  const [quickEntries, setQuickEntries] = useState<QuickEntry[]>([]);
  const [activeTab, setActiveTab] = useState<HomeTab>('schedule');

  // ---- 待办事项 ----
  const [todoItems, setTodoItems] = useState<TodoItem[]>([]);
  const [addPopoverVisible, setAddPopoverVisible] = useState(false);
  const [addTodoDefaultQuadrant, setAddTodoDefaultQuadrant] = useState<TodoQuadrant | undefined>();
  const [addCollaboratorIds, setAddCollaboratorIds] = useState<string[]>([]);
  const [addCollaboratorSummaries, setAddCollaboratorSummaries] = useState<CollaboratorSummary[]>(
    [],
  );
  const [categoryTabs, setCategoryTabs] = useState<TodoCategoryTab[]>(() =>
    listTodoCategoryTabs(''),
  );
  const [todoViewMode, setTodoViewMode] = useState<TodoViewMode>('timeline');
  const [completeSheetItem, setCompleteSheetItem] = useState<TodoItem | null>(null);
  const [completeSheetVisible, setCompleteSheetVisible] = useState(false);
  const [detailItem, setDetailItem] = useState<TodoItem | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailCollaboratorIds, setDetailCollaboratorIds] = useState<string[]>([]);
  const [detailCollaboratorSummaries, setDetailCollaboratorSummaries] = useState<
    CollaboratorSummary[]
  >([]);
  const detailItemRef = useRef<TodoItem | null>(null);
  detailItemRef.current = detailItem;

  const [recentRecords, setRecentRecords] = useState<LessonRecord[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const isFirstMount = useRef(true);
  const lastHomeFetchAtRef = useRef<number>(0);
  /** 四象限拖动中锁定首页滚动，避免抢手势 */
  const [quadrantDragging, setQuadrantDragging] = useState(false);
  const {
    onScroll: onOverlayScrollTrack,
    freeze: freezeHomeScroll,
    unfreeze: unfreezeHomeScroll,
    unfreezeNow: unfreezeHomeScrollNow,
    freezeProps: homeScrollFreezeProps,
  } = useOverlayScrollFreeze('#home-scroll-view');
  const todoViewModeRef = useRef<TodoViewMode>('timeline');
  const [homeScrollIntoView, setHomeScrollIntoView] = useState('');

  useEffect(() => {
    todoViewModeRef.current = todoViewMode;
  }, [todoViewMode]);

  const handleTodoViewModeChange = useCallback((mode: TodoViewMode) => {
    setTodoViewMode(mode);
  }, []);

  const {
    fabMenuExpanded,
    fabVisible,
    handleFabToggle,
    handleFabViewModeToggle,
    markTodoTabScrolled,
    resetFabOnTabLeave,
    prepareFabForTodoTab,
  } = useHomeFab({
    activeTab,
    currentRole,
    todoItemsLength: todoItems.length,
    freezeHomeScroll,
    unfreezeHomeScrollNow,
    onTodoViewModeChange: handleTodoViewModeChange,
    todoViewModeRef,
  });

  const handleScroll = useCallback(
    (event: { detail: { scrollTop: number } }) => {
      onOverlayScrollTrack(event);
      if (activeTab !== 'todo' || fabMenuExpanded) return;
      markTodoTabScrolled();
    },
    [activeTab, fabMenuExpanded, onOverlayScrollTrack, markTodoTabScrolled],
  );

  const managedCampusIds = useMemo(() => {
    if (isPrincipalOrAbove(currentRole)) {
      return currentIdentity?.campusIds || [];
    }
    return [];
  }, [currentRole, currentIdentity]);

  const currentStorefrontKey = useMemo(() => {
    const orgId = profile?.currentContext?.organizationId || '';
    const campusId = currentCampusId || profile?.currentContext?.campusId || '';
    if (!orgId || !campusId) return '';
    return storefrontKey(orgId, campusId);
  }, [profile?.currentContext?.organizationId, profile?.currentContext?.campusId, currentCampusId]);

  const handleOpenCampusSheet = useCallback(async () => {
    if (isParentRole(currentRole)) {
      Taro.showLoading({ title: '加载中', mask: true });
      try {
        const result = await listParentStorefronts();
        if (result.error) {
          Taro.showToast({ title: result.error.message, icon: 'none' });
          return;
        }
        if (result.list.length === 0) {
          Taro.showToast({ title: '暂无门店', icon: 'none' });
          return;
        }
        setParentStorefronts(result.list);
        setShowCampusSheet(true);
      } catch (err) {
        logError('Home openParentStorefronts', err);
        Taro.showToast({ title: '门店列表加载失败', icon: 'none' });
      } finally {
        Taro.hideLoading();
      }
      return;
    }

    if (campuses.length === 0) {
      Taro.showToast({ title: '暂无校区', icon: 'none' });
      return;
    }
    setShowCampusSheet(true);
  }, [campuses.length, currentRole]);

  const handleCloseCampusSheet = useCallback(() => {
    if (campusConfirming) return;
    setShowCampusSheet(false);
  }, [campusConfirming]);

  const handleConfirmCampus = useCallback(
    (campus: CampusUIModel) => {
      setCurrentCampusId(campus.id);
      setShowCampusSheet(false);
    },
    [setCurrentCampusId],
  );

  const loadCategories = useCallback(() => {
    if (!profile?.id) {
      setCategoryTabs(listTodoCategoryTabs(''));
      return;
    }
    setCategoryTabs(listTodoCategoryTabs(profile.id));
  }, [profile?.id]);

  const loadData = useCallback(
    async (campusId?: string) => {
      if (!profile?.id) return;

      if (isParentRole(currentRole)) {
        try {
          const [parentData, unread] = await Promise.all([
            homeService.getParent(profile.id, campusId),
            homeService.getUnreadCount(profile.id, currentRole),
          ]);
          setUnreadCount(unread || parentData?.unreadCount || 0);
          setParentSchedules(parentData?.todaySchedules || []);
          setParentPackages(parentData?.packages || []);
          setParentFallbackStudentId(parentData?.students?.[0]?.id || '');
          lastHomeFetchAtRef.current = Date.now();
        } catch (err) {
          logError('Home loadParentData', err);
        }
        return;
      }

      if (!isStaffRole(currentRole)) {
        try {
          const unread = await homeService.getUnreadCount(profile.id, currentRole);
          setUnreadCount(unread);
          lastHomeFetchAtRef.current = Date.now();
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
          todoService.getList({
            view: 'home',
            teacherId: teacherData.id,
            role: currentRole,
            campusId,
            userId: profile.id,
            userName,
          }),
          recentLessonRequest,
        ]);
        setSchedules(scheduleList);
        setUnreadCount(unread);
        setTodoItems(todoList);
        setRecentRecords(lessonRecords);
        lastHomeFetchAtRef.current = Date.now();

        // 未点名提醒（用户口径 2026-08-23）：当天 20:00 后，今日课表存在下课未点名 → 微信订阅消息提醒补点名
        const now = new Date();
        if (now.getHours() >= 20) {
          const todayStr = todayDateKey(now);
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

  const handleConfirmStorefront = useCallback(
    async (item: ParentStorefrontItem) => {
      if (campusConfirming) return;
      setCampusConfirming(true);
      try {
        const switched = await switchAuthContext({
          organizationId: item.organizationId,
          campusId: item.campusId,
        });
        if (switched.error || !switched.session || !switched.profile) {
          Taro.showToast({
            title: switched.error?.message || '切换失败',
            icon: 'none',
          });
          return;
        }

        // 先落会话与目标校区，再 await，避免 effect 用新 JWT + 旧 campusId
        applyAuthPayload({ session: switched.session, profile: switched.profile });
        if (item.organizationName) {
          setOrgName(item.organizationName);
        }
        setCurrentOrganizationId(item.organizationId);
        setCurrentCampusId(item.campusId);
        setAllowedCampusIds([item.campusId]);

        await fetchCampuses();
        const nextCampuses = useCampusStore.getState().campuses;
        if (nextCampuses.length > 0) {
          setAllowedCampusIds(nextCampuses.map((c) => c.id));
          setCurrentCampusId(item.campusId);
        }

        setShowCampusSheet(false);
        await loadData(item.campusId);
      } catch (err) {
        logError('Home confirmStorefront', err);
        Taro.showToast({
          title: err instanceof Error ? err.message : '切换失败',
          icon: 'none',
        });
      } finally {
        setCampusConfirming(false);
      }
    },
    [
      applyAuthPayload,
      campusConfirming,
      fetchCampuses,
      loadData,
      setAllowedCampusIds,
      setCurrentCampusId,
      setCurrentOrganizationId,
      setOrgName,
    ],
  );

  const handlePrivateCheckIn = useCallback(
    async (bookingId: string) => {
      const result = await leadService.checkInPrivateLeadBooking(bookingId);
      if (!result) {
        Taro.showToast({ title: '签到失败', icon: 'none' });
        return;
      }
      Taro.showToast({ title: '签到成功', icon: 'success' });
      await loadData(currentCampusId);
    },
    [currentCampusId, loadData],
  );

  const handleVenueCheckIn = useCallback(
    async (venueBookingId: string) => {
      const result = await venueBookingService.checkInBooking(venueBookingId);
      if (!result) {
        Taro.showToast({ title: '确认失败', icon: 'none' });
        return;
      }
      Taro.showToast({ title: '已确认到场', icon: 'success' });
      await loadData(currentCampusId);
    },
    [currentCampusId, loadData],
  );

  const checkPendingRelation = useCallback(async () => {
    try {
      const local = consumePendingRelation();
      if (local && local.studentParentId) {
        setPendingRelation(local);
        setRelationSheetVisible(true);
        return;
      }
      const me = await organizationService.getMyOrganization();
      const remote = me?.pendingRelation;
      if (remote && remote.studentParentId) {
        let stored: unknown;
        try {
          stored = Taro.getStorageSync(RELATION_DISMISS_KEY);
        } catch {
          stored = undefined;
        }
        if (!isRelationDismissedToday(stored, todayDateKey())) {
          setPendingRelation(remote);
          setRelationSheetVisible(true);
        }
      }
    } catch {
      // 静默：弹窗非核心链路，失败不阻塞首页
    }
  }, []);

  const handleRelationClose = useCallback(() => {
    setRelationSheetVisible(false);
    try {
      Taro.setStorageSync(RELATION_DISMISS_KEY, todayDateKey());
    } catch {
      /* ignore */
    }
  }, []);

  const handleRelationConfirmed = useCallback(() => {
    setRelationSheetVisible(false);
  }, []);

  useEffect(() => {
    setQuickEntries(homeService.getQuickEntries(currentRole));
    fetchCampuses();
  }, [currentRole, fetchCampuses]);

  useEffect(() => {
    loadData(currentCampusId);
  }, [profile, currentRole, currentCampusId, loadData]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useDidShow(() => {
    syncTabBarByProfile(profile);
    const collaboratorResult = consumeTodoCollaboratorResult();
    if (collaboratorResult !== null) {
      if (detailItemRef.current) {
        setDetailCollaboratorIds(collaboratorResult.ids);
        setDetailCollaboratorSummaries(collaboratorResult.summaries);
      } else {
        setAddCollaboratorIds(collaboratorResult.ids);
        setAddCollaboratorSummaries(collaboratorResult.summaries);
      }
    }
    void checkPendingRelation();
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    if (isWithinRefetchTtl(lastHomeFetchAtRef.current)) {
      return;
    }
    loadData(currentCampusId);
  });

  const todayTodoItems = useMemo(() => filterTodayTodoItems(todoItems), [todoItems]);
  const otherTodoCount = useMemo(
    () => countOtherTodoItems(todoItems.length, todayTodoItems.length),
    [todoItems.length, todayTodoItems.length],
  );
  const activeTodoCount = useMemo(() => countActiveTodoItems(todayTodoItems), [todayTodoItems]);

  // 每 render 读设置（与拆分前一致）：从设置页改角标后 navigateBack 须立刻生效
  const showTodoBadge = getTodoShowTabBadge();
  const tabOptions = useMemo(
    () =>
      buildHomeTabOptions({
        showTodoBadge,
        activeTodoCount,
      }),
    [activeTodoCount, showTodoBadge],
  );

  const recentSections = useMemo(
    () => buildLessonConsumptionSections(pickHomeRecentLessonRecords(recentRecords)),
    [recentRecords],
  );

  const handleHomeTabChange = useCallback(
    (tab: HomeTab) => {
      if (tab === activeTab) return;
      if (activeTab === 'todo') {
        resetFabOnTabLeave();
        unfreezeHomeScrollNow();
      }
      if (tab === 'todo') {
        prepareFabForTodoTab();
      }
      setActiveTab(tab);
    },
    [activeTab, prepareFabForTodoTab, resetFabOnTabLeave, unfreezeHomeScrollNow],
  );

  const {
    handleCompleteTodo,
    handleOpenTodoDetail,
    handleCloseTodoDetail,
    handleDetailDelete,
    handleDetailSave,
    handleSubmitCompleteTodo,
    handleOpenAddTodoSheet,
    handleCloseAddTodoSheet,
    handleCreateCategoryFromPopover,
    handleQuadrantChange,
    handleQuadrantDragActiveChange,
    handleSubmitCustomTodo,
    handleOpenMyTodos,
  } = useHomeTodoActions({
    profileId: profile?.id,
    profileName: profile?.nickname || profile?.name || '我',
    currentCampusId,
    loadData,
    loadCategories,
    freezeHomeScroll,
    unfreezeHomeScroll,
    setTodoItems,
    setCompleteSheetItem,
    setCompleteSheetVisible,
    completeSheetItem,
    setDetailItem,
    setDetailVisible,
    setDetailCollaboratorIds,
    setDetailCollaboratorSummaries,
    setAddCollaboratorIds,
    setAddCollaboratorSummaries,
    setAddTodoDefaultQuadrant,
    setAddPopoverVisible,
    setActiveTab,
    setTodoViewMode,
    setHomeScrollIntoView,
    setQuadrantDragging,
  });

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
        label: fabViewToggleLabel(todoViewMode),
        icon: fabViewToggleIcon(todoViewMode),
        onClick: handleFabViewModeToggle,
      },
      {
        key: 'my-todos',
        label: '我的待办',
        icon: 'mdi-clipboard-text-outline',
        onClick: handleOpenMyTodos,
      },
    ],
    [handleOpenAddTodoSheet, handleFabViewModeToggle, handleOpenMyTodos, todoViewMode],
  );

  const handleParentAnchor = useCallback((anchor: string) => {
    setHomeScrollIntoView(anchor);
    setTimeout(() => setHomeScrollIntoView(''), 500);
  }, []);

  const showCampusHero = isStaffRole(currentRole) || isParentRole(currentRole);

  return (
    <>
      <PageMeta pageStyle={fabMenuExpanded || quadrantDragging ? 'overflow: hidden;' : ''} />
      <View className={cn(`theme-${activeTheme}`, 'h-screen overflow-x-hidden bg-background')}>
        <ScrollView
          id="home-scroll-view"
          scrollY={!fabMenuExpanded && !quadrantDragging}
          showScrollbar={false}
          scrollWithAnimation={false}
          className="h-full overflow-x-hidden no-scrollbar"
          // idle 时禁止绑定 scroll-into-view（空串也会导致每次 setState 回顶）
          {...scrollIntoViewProps(homeScrollIntoView)}
          // 弹层/FAB 期间钉住；idle 完全不传 scrollTop
          {...homeScrollFreezeProps}
          onScroll={handleScroll}
        >
          <View id="home-scroll-inner" className="min-h-full">
            <HomePageHeader
              showCampusHero={showCampusHero}
              unreadCount={unreadCount}
              bellTopPx={navSafeHeight - 4}
              campus={currentCampus}
              businessTime={businessTime}
              isOpen={isOpen}
              onSwitchCampus={handleOpenCampusSheet}
            />

            <View className="relative z-10 bg-transparent mx-[28rpx] pt-[0] pb-[100rpx]">
              <WechatBindReminder className="mb-[16rpx] px-[24rpx] py-[20rpx] rounded-[16rpx] bg-primary/8 flex items-center gap-[16rpx]" />
              <EmailBindReminder className="mb-[16rpx] px-[24rpx] py-[20rpx] rounded-[16rpx] bg-primary/8 flex items-center gap-[16rpx]" />
              {isStaffRole(currentRole) && <KingKongSection entries={quickEntries} />}

              {isParentRole(currentRole) && (
                <>
                  <KingKongSection
                    entries={quickEntries}
                    variant="grid"
                    onAnchor={handleParentAnchor}
                  />
                  <View className="px-[8rpx]">
                    <ParentScheduleSection schedules={parentSchedules} />
                    <ParentHoursSection
                      packages={parentPackages}
                      fallbackStudentId={parentFallbackStudentId}
                    />
                  </View>
                </>
              )}

              {isStaffRole(currentRole) && (
                <HomeStaffTabPanels
                  activeTab={activeTab}
                  tabOptions={tabOptions}
                  onTabChange={handleHomeTabChange}
                  schedules={schedules}
                  onPrivateCheckIn={handlePrivateCheckIn}
                  onVenueCheckIn={handleVenueCheckIn}
                  todoViewMode={todoViewMode}
                  todayTodoItems={todayTodoItems}
                  otherTodoCount={otherTodoCount}
                  onTodoViewModeChange={handleTodoViewModeChange}
                  onOpenMyTodos={handleOpenMyTodos}
                  onOpenAddTodo={handleOpenAddTodoSheet}
                  onCompleteTodo={handleCompleteTodo}
                  onOpenTodoDetail={handleOpenTodoDetail}
                  onQuadrantChange={handleQuadrantChange}
                  onQuadrantDragActiveChange={handleQuadrantDragActiveChange}
                  recentSections={recentSections}
                />
              )}
            </View>
          </View>
        </ScrollView>
      </View>

      <HomePageOverlays
        isDebugBuild={isDebugBuild}
        isStaff={isStaffRole(currentRole)}
        isParent={isParentRole(currentRole)}
        showCampusSheet={showCampusSheet}
        currentCampusId={currentCampusId}
        currentRole={currentRole}
        campuses={campuses}
        managedCampusIds={managedCampusIds}
        lastVisitedCampusId={lastVisitedCampusId}
        parentStorefronts={parentStorefronts}
        currentStorefrontKey={currentStorefrontKey}
        campusConfirming={campusConfirming}
        onCloseCampusSheet={handleCloseCampusSheet}
        onConfirmCampus={handleConfirmCampus}
        onConfirmStorefront={handleConfirmStorefront}
        roleSheetVisible={roleSheetVisible}
        onCloseRoleSheet={() => setRoleSheetVisible(false)}
        addPopoverVisible={addPopoverVisible}
        categoryTabs={categoryTabs}
        addTodoDefaultQuadrant={addTodoDefaultQuadrant}
        addCollaboratorIds={addCollaboratorIds}
        addCollaboratorSummaries={addCollaboratorSummaries}
        onCloseAddTodoSheet={handleCloseAddTodoSheet}
        onCreateCategoryFromPopover={handleCreateCategoryFromPopover}
        onSubmitCustomTodo={handleSubmitCustomTodo}
        detailVisible={detailVisible}
        detailItem={detailItem}
        detailCollaboratorIds={detailCollaboratorIds}
        detailCollaboratorSummaries={detailCollaboratorSummaries}
        onCloseTodoDetail={handleCloseTodoDetail}
        onDetailDelete={handleDetailDelete}
        onDetailSave={handleDetailSave}
        completeSheetVisible={completeSheetVisible}
        completeSheetItem={completeSheetItem}
        onCloseCompleteSheet={() => {
          setCompleteSheetVisible(false);
          setCompleteSheetItem(null);
        }}
        onSubmitCompleteTodo={handleSubmitCompleteTodo}
        activeTab={activeTab}
        fabVisible={fabVisible}
        fabActions={fabActions}
        onFabToggle={handleFabToggle}
        relationSheetVisible={relationSheetVisible}
        pendingStudentName={pendingRelation?.studentName || ''}
        pendingStudentParentId={pendingRelation?.studentParentId || ''}
        onRelationClose={handleRelationClose}
        onRelationConfirmed={handleRelationConfirmed}
        campusGuideVisible={campusGuideVisible}
        onCloseCampusGuide={() => setCampusGuideVisible(false)}
      />
    </>
  );
};

export default withRouteGuard(Home);
