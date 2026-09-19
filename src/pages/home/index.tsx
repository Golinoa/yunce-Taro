import { View, ScrollView, PageMeta } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import { todoService } from '@/services';
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
import { parseBusinessHours, getCampusOpenStatus } from '@/utils/campus';
import { TTL, markFetched, shouldRefetch } from '@/utils/data-freshness';
import { logError } from '@/utils/logger';
import { storefrontKey } from '@/utils/parent-storefront';
import { consumeRefreshSignal, REFRESH_SIGNAL } from '@/utils/refresh-signal';
/** P0 取证仪表：仅首屏打点，只读观测，不干预业务行为 */
import { markFirstScreen } from '@/utils/request-instrument';
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

/** 首页查询缓存根前缀：写后统一按前缀失效（TanStack Query 层级失效） */
const HOME_QUERY_ROOT = ['home'] as const;

/** 首页查询保鲜期：30s 内切回不重复请求（与 app.tsx 默认值一致，显式写明口径） */
const HOME_QUERY_STALE_TIME_MS = 30_000;

/**
 * 校区列表保鲜期为 0（每次挂载都让 queryFn 跑一遍）。
 * 理由：校区列表的真正新鲜度归 Zustand store（TTL.campus = 15min，见 stores/campus.ts），
 * React Query 只是「触发 store 拉取」的入口。若这里再设 30s staleTime，就会出现两个互相独立的时钟：
 * 登出/切机构时 store 清了内存 + 快照并把 lastCampusesFetchAt 归零，但 RQ 仍认为 30s 内缓存新鲜
 * → 不再调用 queryFn → 校区列表停在已清空的状态（首页校区卡片空、「未设置校区」引导误弹）。
 * 设为 0 后：每次进首页都会走到 store，由 store 自己的 TTL 决定是否真发网络（稳态下不发），
 * 而被 invalidateCache 归零后必然真正重拉。
 */
const CAMPUSES_QUERY_STALE_TIME_MS = 0;

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

  const openStatus = useMemo(
    () => getCampusOpenStatus(currentCampus?.businessHours),
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
  /** 待确认关系远端查询上次成功时间（TTL 节流用） */
  const lastPendingRelationFetchAtRef = useRef<number | null>(null);
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

  // ==========================================================================
  // 首页服务端状态：TanStack Query（Batch 7 POC）
  //
  // 承接 Batch 2 的「身份就绪闸门 + key 去重」：
  // - enabled 等价原来的就绪判定（profile.id + currentRole 未齐不发请求）；
  // - queryKey 里带身份三元组（profileId / role / campusId），key 未变不重复请求，
  //   key 变化（切校区、换身份）自动重拉，不再需要手工 ref 记录上次 key。
  // 数据仍写入原 useState 供既有渲染路径使用（POC 不改 UI 层）。
  // ==========================================================================
  const queryClient = useQueryClient();
  const profileId = profile?.id;
  const isParent = isParentRole(currentRole);
  /** 身份就绪：与原 Batch 2 手工闸门一致 */
  const homeIdentityReady = Boolean(profileId && currentRole);

  /**
   * 校区列表：真正的新鲜度由 Store 内 TTL(CAMPUS) 控，这里 staleTime 必须为 0，
   * 否则 store 的 invalidateCache（登出/切机构清内存 + 清快照 + 归零 lastCampusesFetchAt）
   * 会被 RQ 的 staleTime 挡住而不重拉 —— 见 CAMPUSES_QUERY_STALE_TIME_MS 注释。
   */
  const campusesQuery = useQuery({
    queryKey: ['campuses', currentRole ?? ''],
    queryFn: async () => {
      const ok = await fetchCampuses();
      // 失败必须抛错：store 内部只记 error 不抛，若不抛则 RQ 判定 queryFn 成功 → 不重试
      // → 空列表常驻 → 首页校区卡片一直空白（2026-09-19 反馈的问题）
      if (!ok) throw new Error('校区列表加载失败');
      return true;
    },
    // 与聚合接口同一闸门（profileId + role 双就绪）：profile 未恢复完时 token 可能未就绪，
    // 过早发出的 401 会白白消耗 retry 次数，放大「一次失败 → 永久空白」的概率
    enabled: homeIdentityReady,
    // 早于身份恢复发出时会 401，退避重试可自动补偿
    retry: 2,
    retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 4000),
    staleTime: CAMPUSES_QUERY_STALE_TIME_MS,
  });

  /** 首页聚合（B10 / PERF-14）：教师/家长/课表/未读/消课 一次请求返回 */
  const aggregateQuery = useQuery({
    queryKey: ['home', 'aggregate', profileId ?? '', currentRole ?? '', currentCampusId],
    queryFn: () => homeService.getAggregate(currentCampusId),
    enabled: homeIdentityReady,
    staleTime: HOME_QUERY_STALE_TIME_MS,
  });
  const agg = aggregateQuery.data;
  /** teacherId 来自聚合（教师=真实教师 id；无教师档案的员工=userId），供待办/未点名提醒使用 */
  const teacherId = agg?.teacher?.id ?? '';

  /** 首页待办：独立请求（B10 契约确认点 ③ 偏离：保留 todoService 本地 enrichment，零回归） */
  const todosQuery = useQuery({
    queryKey: ['home', 'todos', teacherId, currentRole ?? '', currentCampusId, profileId ?? ''],
    queryFn: () =>
      todoService.getList({
        view: 'home',
        teacherId,
        role: currentRole,
        campusId: currentCampusId,
        userId: profileId ?? '',
        userName: profile?.nickname || profile?.name || '我',
      }),
    enabled: Boolean(teacherId && profileId),
    staleTime: HOME_QUERY_STALE_TIME_MS,
  });

  /**
   * 首屏完成打点（P0 取证）：身份就绪 + 聚合数据到位即视为「首屏渲染完成」。
   * **只标记时间戳，不影响任何渲染与请求行为**（惰性，只记第一次）。
   */
  const homeFirstScreenReady = homeIdentityReady && agg !== undefined;
  useEffect(() => {
    if (homeFirstScreenReady) {
      markFirstScreen();
    }
  }, [homeFirstScreenReady]);

  /** 查询结果 → 页面展示态同步（保持既有 useState 驱动渲染，行为与改造前一致） */
  useEffect(() => {
    if (!agg) return;
    if (isParent) {
      setUnreadCount(agg.unreadCount);
      setParentSchedules(agg.parentSchedules);
      setParentPackages(agg.parentPackages);
      setParentFallbackStudentId(agg.parentFallbackStudentId);
      return;
    }
    setUnreadCount(agg.unreadCount);
  }, [isParent, agg]);

  useEffect(() => {
    if (!agg || isParent) return;
    setSchedules(agg.schedules);
    setRecentRecords(agg.recentRecords);
  }, [agg, isParent]);

  useEffect(() => {
    if (todosQuery.data === undefined) return;
    setTodoItems(todosQuery.data);
  }, [todosQuery.data]);

  // 未点名提醒（用户口径 2026-08-23）：当天 20:00 后，今日课表存在下课未点名 → 微信订阅消息提醒补点名
  useEffect(() => {
    const scheduleList = agg?.schedules;
    if (!scheduleList) return;
    const now = new Date();
    if (now.getHours() < 20) return;
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
  }, [agg]);

  /**
   * 写后 / 强制刷新：统一走查询缓存失效（不再直调取数函数），
   * 避免「直调 loadData」与「useQuery 缓存」两套机制并存互相覆盖。
   * 失效后重新拉取当前 key 的全部首页查询（若 key 刚随切校区变化，则复用已在飞的请求，不产生重复请求）。
   */
  const refreshHome = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: HOME_QUERY_ROOT });
  }, [queryClient]);

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
        await refreshHome();
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
      refreshHome,
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
      await refreshHome();
    },
    [refreshHome],
  );

  const handleVenueCheckIn = useCallback(
    async (venueBookingId: string) => {
      const result = await venueBookingService.checkInBooking(venueBookingId);
      if (!result) {
        Taro.showToast({ title: '确认失败', icon: 'none' });
        return;
      }
      Taro.showToast({ title: '已确认到场', icon: 'success' });
      await refreshHome();
    },
    [refreshHome],
  );

  const checkPendingRelation = useCallback(async () => {
    try {
      // 本地待确认关系（引导/绑定流程写入）优先消费，不受 TTL 限制
      const local = consumePendingRelation();
      if (local && local.studentParentId) {
        setPendingRelation(local);
        setRelationSheetVisible(true);
        return;
      }
      // 远端查询按 TTL.tab 节流：原先每次切回首页都会打 /organization/me
      if (!shouldRefetch(lastPendingRelationFetchAtRef.current, TTL.tab)) {
        return;
      }
      const me = await organizationService.getMyOrganization();
      markFetched(lastPendingRelationFetchAtRef);
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
  }, [currentRole]);

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
    // 校区列表自愈：失败或为空且无在飞请求 → 强制失效重拉。
    // 背景：tab 页不重挂载、refetchOnWindowFocus/Reconnect 全局关闭，而 campuses query
    // 不在 HOME_QUERY_ROOT 前缀内（下方 refetchQueries 覆盖不到）——首挂载一旦失败
    //（如身份恢复竞态 401），此后没有任何自愈路径，首页校区卡片永久空白（2026-09-19 反馈的根治）。
    if (
      (campusesQuery.isError || campuses.length === 0) &&
      !campusesQuery.isFetching &&
      currentRole
    ) {
      void queryClient.invalidateQueries({ queryKey: ['campuses', currentRole] });
    }
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    // 写后刷新信号：强制重拉，不等保鲜期（原 loadData 直调的等价职责）
    if (consumeRefreshSignal(REFRESH_SIGNAL.home)) {
      void refreshHome();
      return;
    }
    // 无信号：只重拉已过保鲜期（staleTime 30s）的查询；
    // fetchStatus: 'idle' 保证不打断正在飞的请求（否则会取消并重发，反而增加请求数）
    void queryClient.refetchQueries({
      queryKey: HOME_QUERY_ROOT,
      type: 'active',
      stale: true,
      fetchStatus: 'idle',
    });
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
    // 写后刷新统一走查询缓存失效（refreshHome），不再直调取数
    loadData: refreshHome,
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
              openStatus={openStatus}
              onSwitchCampus={handleOpenCampusSheet}
            />

            <View className="relative z-10 bg-transparent mx-[28rpx] pt-[0] pb-[100rpx]">
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
