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
import { useCampusList, useCampusStore } from '@/stores/campus';
import { useThemeStore } from '@/stores/theme';
import type { CampusUIModel } from '@/types/campus';
import type { TodoItem } from '@/types/home-todo';
import type { LessonRecord } from '@/types/lesson-record';
import type { Schedule } from '@/types/schedule';
import type { ParentStorefrontItem } from '@/types/storefront';
import type { TodoQuadrant } from '@/types/todo-quadrant';
import { isParentRole, isPrincipalOrAbove, isStaffRole, useAuth } from '@/utils/auth';
import { clearAllCache } from '@/utils/cache-store';
import { parseBusinessHours, getCampusOpenStatus } from '@/utils/campus';
import { TTL, markFetched, shouldRefetch } from '@/utils/data-freshness';
import { reportLocalDebug } from '@/utils/local-debug';
import { logError } from '@/utils/logger';
import { safeReLaunch } from '@/utils/navigation';
import { storefrontKey } from '@/utils/parent-storefront';
import { consumeRefreshSignal, REFRESH_SIGNAL } from '@/utils/refresh-signal';
/** P0 取证仪表：仅首屏打点，只读观测，不干预业务行为 */
import { markFirstScreen } from '@/utils/request-instrument';
import { withRouteGuard } from '@/utils/route-guard';
import { scrollIntoViewProps } from '@/utils/scroll-view-props';
import {
  clearStoredIdentity,
  readStoredIdentity,
  writeStoredIdentity,
  type SessionIdentityType,
} from '@/utils/session-identity';
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
 * 校区列表已统一走 useCampusList harness（唯一数据源 useCampusStore：
 * TTL 15min + 冷启动快照 + 唯一自愈 ensureLoaded）。
 * 曾用 React Query 包过一层（双时钟）导致卡片永久空白，已移除——
 * 详见 docs/diagnostics/2026-09-19-campus-data-harness.md，禁止再加中间层。
 */

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

  // 校区列表 + 当前校区派生：统一走 harness（useCampusList，禁止页面自写）
  const { currentCampus, ensureLoaded: ensureCampusesLoaded } = useCampusList();

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
    // 本次实际可用的家长门店数。setParentStorefronts 是异步的，同一函数内读 state
    // 拿到的仍是旧值，因此必须用接口刚返回的结果判断，否则纯家长首次打开会被
    // 「暂无校区」误拦截（state 此时还是空数组）。
    let storefrontCount = parentStorefronts.length;

    // 兼身份要在同一张列表里同时展示「老师」「家长」两行，因此员工身份也必须拉家长门店。
    // 后端已放开员工身份查询（仅返回本人绑定），无绑定时返回空列表属正常。
    if (isParentRole(currentRole) || isStaffRole(currentRole)) {
      Taro.showLoading({ title: '加载中', mask: true });
      try {
        const result = await listParentStorefronts();
        if (result.error) {
          // 员工身份：家长门店只用于展示兼身份的第二行，失败不应阻塞校区切换
          if (isParentRole(currentRole)) {
            Taro.showToast({ title: result.error.message, icon: 'none' });
            return;
          }
        } else {
          // 仅纯家长身份且无门店时才拦截；员工身份没有家长绑定是常态，照常打开
          if (result.list.length === 0 && isParentRole(currentRole)) {
            Taro.showToast({ title: '暂无门店', icon: 'none' });
            return;
          }
          setParentStorefronts(result.list);
          storefrontCount = result.list.length;
        }
      } catch (err) {
        logError('Home openParentStorefronts', err);
        // 员工身份下拉取异常同样不阻塞
        if (isParentRole(currentRole)) {
          Taro.showToast({ title: '门店列表加载失败', icon: 'none' });
          return;
        }
      } finally {
        Taro.hideLoading();
      }
    }

    // 两端都没有可进入的入口时才拦截
    if (campuses.length === 0 && storefrontCount === 0) {
      Taro.showToast({ title: '暂无校区', icon: 'none' });
      return;
    }
    setShowCampusSheet(true);
  }, [campuses.length, currentRole, parentStorefronts.length]);

  const handleCloseCampusSheet = useCallback(() => {
    if (campusConfirming) return;
    setShowCampusSheet(false);
  }, [campusConfirming]);

  // handleConfirmCampus 见下方 switchToIdentity 之后（端切换依赖它，需先定义）

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

  /** 校区列表（harness）：唯一自愈入口；身份就绪后才首拉，避免 token 未恢复先发 401 */
  useEffect(() => {
    if (homeIdentityReady) void ensureCampusesLoaded();
  }, [homeIdentityReady, ensureCampusesLoaded]);

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

  /**
   * 切换端（教师端 ⇄ 家长端），或跨机构切换门店。
   *
   * 端不同则 JWT 里的角色不同，必须重签会话，因此统一走 POST /auth/switch-context。
   * 流程：重签 → 落会话与目标校区 → 记住本次选择的端 → 清理旧端缓存 → 重载首页。
   * 清理缓存与重载是必要的：教师端与家长端是两个端，业务数据与页面内容都不同。
   *
   * @returns 是否成功。冷启动恢复依赖该返回值决定是否清除本地缓存。
   */
  const switchToIdentity = useCallback(
    async (params: {
      organizationId: string;
      campusId: string;
      identity: SessionIdentityType;
      organizationName?: string;
    }): Promise<boolean> => {
      if (campusConfirming) return false;
      setCampusConfirming(true);
      try {
        const switched = await switchAuthContext({
          organizationId: params.organizationId,
          campusId: params.campusId,
          identity: params.identity,
        });
        if (switched.error || !switched.session || !switched.profile) {
          Taro.showToast({
            title: switched.error?.message || '切换失败',
            icon: 'none',
          });
          return false;
        }

        // 先落会话与目标校区，再 await，避免 effect 用新 JWT + 旧 campusId
        applyAuthPayload({ session: switched.session, profile: switched.profile });
        if (params.organizationName) {
          setOrgName(params.organizationName);
        }
        setCurrentOrganizationId(params.organizationId);
        setCurrentCampusId(params.campusId);
        setAllowedCampusIds([params.campusId]);
        // 记住本次选择的端：下次进入小程序默认进入该端
        writeStoredIdentity(params.identity);
        // 端已切换，旧端的业务缓存全部失效
        clearAllCache();

        setShowCampusSheet(false);
        await safeReLaunch('/pages/home/index');
        return true;
      } catch (err) {
        logError('Home switchToIdentity', err);
        Taro.showToast({
          title: err instanceof Error ? err.message : '切换失败',
          icon: 'none',
        });
        return false;
      } finally {
        setCampusConfirming(false);
      }
    },
    [
      applyAuthPayload,
      campusConfirming,
      setAllowedCampusIds,
      setCurrentCampusId,
      setCurrentOrganizationId,
      setOrgName,
    ],
  );

  const handleConfirmStorefront = useCallback(
    (item: ParentStorefrontItem, identity: SessionIdentityType) => {
      void switchToIdentity({
        organizationId: item.organizationId,
        campusId: item.campusId,
        identity,
        organizationName: item.organizationName,
      });
    },
    [switchToIdentity],
  );

  const handleConfirmCampus = useCallback(
    (campus: CampusUIModel, identity: SessionIdentityType) => {
      const currentIdentityType: SessionIdentityType = isParentRole(currentRole)
        ? 'parent'
        : 'staff';
      // 端不一致（当前在家长端却点了「老师」行）→ 角色不同必须重签会话
      if (identity !== currentIdentityType) {
        void switchToIdentity({
          organizationId: profile?.currentContext?.organizationId || '',
          campusId: campus.id,
          identity,
        });
        return;
      }
      // 同端切校区：无需重签，仅切本地校区
      setCurrentCampusId(campus.id);
      setShowCampusSheet(false);
    },
    [currentRole, profile?.currentContext?.organizationId, setCurrentCampusId, switchToIdentity],
  );

  // 冷启动恢复上次使用的端（2026-09-25）
  //
  // 后端按默认规则签发（教师端优先），若本地记住的是家长端，需在此切回去。
  // 只尝试一次：先置 ref 再执行 —— 成功时 reLaunch 会重建页面且届时角色已一致，
  // 失败则清掉本地缓存，避免每次启动都拿同一份失效缓存重复重试。
  const identityRestoredRef = useRef(false);
  useEffect(() => {
    if (identityRestoredRef.current || !homeIdentityReady) return;

    const stored = readStoredIdentity();
    const currentIdentityType: SessionIdentityType = isParentRole(currentRole) ? 'parent' : 'staff';
    if (!stored || stored === currentIdentityType) {
      identityRestoredRef.current = true;
      return;
    }

    identityRestoredRef.current = true;

    void (async () => {
      if (stored === 'parent') {
        // 家长端必须落在具体门店上，先取本人的门店列表再切
        const result = await listParentStorefronts();
        if (result.error || result.list.length === 0) {
          clearStoredIdentity();
          return;
        }
        const currentOrgId = profile?.currentContext?.organizationId || '';
        const target =
          result.list.find((item) => item.organizationId === currentOrgId) ?? result.list[0];
        const ok = await switchToIdentity({
          organizationId: target.organizationId,
          campusId: target.campusId,
          identity: 'parent',
          organizationName: target.organizationName,
        });
        if (!ok) clearStoredIdentity();
        return;
      }

      // 记住的是教师端，当前却在家长端：切回本机构当前校区
      const ok = await switchToIdentity({
        organizationId: profile?.currentContext?.organizationId || '',
        campusId: currentCampusId || profile?.currentContext?.campusId || '',
        identity: 'staff',
      });
      if (!ok) clearStoredIdentity();
    })();
  }, [
    currentCampusId,
    currentRole,
    homeIdentityReady,
    profile?.currentContext?.campusId,
    profile?.currentContext?.organizationId,
    switchToIdentity,
  ]);

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

  // 金刚区是否渲染取决于 isStaffRole/isParentRole；角色为空时两个分支都不渲染，
  // 「学员管理」入口不会出现在页面上（表现为点了没反应）。
  useEffect(() => {
    reportLocalDebug({
      hypothesisId: 'H6',
      location: 'src/pages/home/index.tsx:entry-gate',
      msg: `[DEBUG] home role=${currentRole ?? 'null'} quickEntries=${quickEntries.length} isStaff=${isStaffRole(currentRole)} isParent=${isParentRole(currentRole)}`,
      data: {
        currentRole: currentRole ?? null,
        quickEntries: quickEntries.length,
        hasProfile: Boolean(profile),
      },
    });
  }, [currentRole, quickEntries.length, profile]);

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
    // 校区列表自愈走 harness（useCampusList.ensureLoaded：TTL 守卫 + loading 防并发 + 失败强拉重试一次）。
    // 背景：tab 页不重挂载且 RQ focus/reconnect 全局关闭，若无此自愈，首挂载一次失败即永久空白。
    if (homeIdentityReady) void ensureCampusesLoaded();
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
        organizationName={profile?.identities?.[0]?.organizationName || ''}
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
