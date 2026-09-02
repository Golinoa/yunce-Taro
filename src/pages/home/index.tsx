import { View, Text, ScrollView, PageMeta } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import cn from 'classnames';
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import AddToDesktopTip from '@/components/AddToDesktopTip';
import HomeCampusCard from '@/components/home/campus-card';
import CampusSelectSheet from '@/components/home/CampusSelectSheet';
import CompleteTodoSheet from '@/components/home/CompleteTodoSheet';
import ExpandableFabMenu from '@/components/home/ExpandableFabMenu';
import HomeCampusGuideDialog, {
  hasShownCampusGuide,
} from '@/components/home/HomeCampusGuideDialog';
import HomeHeroBanner from '@/components/home/HomeHeroBanner';
import KingKongSection from '@/components/home/KingKongSection';
import ParentHoursSection from '@/components/home/ParentHoursSection';
import ParentScheduleSection from '@/components/home/ParentScheduleSection';
import TodayScheduleCard from '@/components/home/TodayScheduleCard';
import TodoList from '@/components/home/TodoList';
import TodoQuadrantBoard from '@/components/home/TodoQuadrantBoard';
import TodoToolbar, { type TodoViewMode } from '@/components/home/TodoToolbar';
import Icon from '@/components/Icon';
import LessonConsumptionList, {
  buildLessonConsumptionSections,
  navigateToLessonDetail,
  pickHomeRecentLessonRecords,
} from '@/components/lesson/LessonConsumptionList';
import MockIdentitySwitcher from '@/components/MockIdentitySwitcher';
import AddCustomTodoPopover from '@/components/my-todos/AddCustomTodoPopover';
import TodoDetailPopover from '@/components/my-todos/TodoDetailPopover';
import RelationConfirmSheet from '@/components/RelationConfirmSheet';
import RoleSwitchSheet from '@/components/RoleSwitchSheet';
import { useOverlayScrollFreeze } from '@/hooks/useOverlayScrollFreeze';
import EmailBindReminder from '@/package-auth/components/EmailBindReminder';
import WechatBindReminder from '@/package-auth/components/WechatBindReminder';
import { lessonRecordService, todoService } from '@/services';
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
import type { TodoItem, TodoCollaborationMode } from '@/types/home-todo';
import type { LessonRecord } from '@/types/lesson-record';
import type { Schedule } from '@/types/schedule';
import type { TodoQuadrant } from '@/types/todo-quadrant';
import { isParentRole, isPrincipalOrAbove, isStaffRole, useAuth } from '@/utils/auth';
import { parseBusinessHours, isCampusOpen } from '@/utils/campus';
import { logError } from '@/utils/logger';
import { isWithinRefetchTtl } from '@/utils/refetch-ttl';
import { withRouteGuard } from '@/utils/route-guard';
import { scrollIntoViewProps } from '@/utils/scroll-view-props';
import { hasPushedUnattended, pushUnattendedReminder } from '@/utils/subscribe-message';
import { syncTabBarByProfile } from '@/utils/tab-bar';
import { buildTodoCardDomId } from '@/utils/todo-card-meta';
import {
  TODO_CATEGORY_INBOX_ID,
  addTodoCategory,
  listTodoCategoryTabs,
  type TodoCategoryTab,
} from '@/utils/todo-categories';
import {
  consumeTodoCollaboratorResult,
  type CollaboratorSummary,
} from '@/utils/todo-collaborator-select';
import { getTodoShowTabBadge } from '@/utils/todo-settings';
import { isTodoVisibleOnTimelineToday } from '@/utils/todo-timeline';
import { useNavSafeHeight } from '@/utils/use-nav-safe-height';

/** Tab 类型 */
type HomeTab = 'schedule' | 'todo' | 'recent';

/** FAB 距屏幕底的安全边距（rpx），与 ExpandableFabMenu 对齐 */
const FAB_REVEAL_BOTTOM_OFFSET_RPX = 48;
/** Tab 标签行下方禁区（rpx）：视口底到 Tab 底不足该高度时不显示 FAB */
const FAB_REVEAL_TAB_GAP_RPX = 300;
/** FAB 菜单收起后，再触发工具栏同款视图切换（毫秒） */
const FAB_VIEW_TOGGLE_DELAY_MS = 220;
/** 待办空状态 Tab 面板兜底高度（rpx @375） */
const TODO_EMPTY_PANEL_MIN_HEIGHT_RPX = 520;
/** 关系确认弹窗「暂不选择」当天不再弹的日期存储 key（R11） */
const RELATION_DISMISS_KEY = 'yunce:relation-dismiss-date';

/** 当日日期 key（yyyy-mm-dd，本地时区） */
function todayDateKey(): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${mm}-${dd}`;
}

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
  const { profile, currentRole, currentIdentity } = useAuth();
  const { campuses, currentCampusId, lastVisitedCampusId, setCurrentCampusId, fetchCampuses } =
    useCampusStore();
  const { activeTheme } = useThemeStore();
  const [roleSheetVisible, setRoleSheetVisible] = useState(false);
  const [showCampusSheet, setShowCampusSheet] = useState(false);
  const navSafeHeight = useNavSafeHeight();

  // ---- 关系确认弹窗（R11）：绑定/归属完成后进入首页弹一次 ----
  const [pendingRelation, setPendingRelation] = useState<PendingRelation | null>(null);
  const [relationSheetVisible, setRelationSheetVisible] = useState(false);

  // ---- 新校长校区配置引导弹窗（M1）：机构无校区且未展示过时弹一次 ----
  const [campusGuideVisible, setCampusGuideVisible] = useState(false);
  const isManagerRole = currentRole === 'principal' || currentRole === 'admin';

  useEffect(() => {
    if (!isManagerRole) {
      return;
    }
    if (campuses.length > 0) {
      return;
    }
    if (hasShownCampusGuide()) {
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

  // ---- 教师端状态 ----
  const [schedules, setSchedules] = useState<Schedule[]>([]);

  // ---- 家长端状态 ----
  const [parentSchedules, setParentSchedules] = useState<Schedule[]>([]);
  const [parentPackages, setParentPackages] = useState<ParentHomePackageCard[]>([]);
  const [parentFallbackStudentId, setParentFallbackStudentId] = useState('');

  // ---- 快捷入口 ----
  const [quickEntries, setQuickEntries] = useState<QuickEntry[]>([]);

  // ---- Tab 状态 ----
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

  // ---- 最近消课 ----
  const [recentRecords, setRecentRecords] = useState<LessonRecord[]>([]);

  // ---- 未读消息数 ----
  const [unreadCount, setUnreadCount] = useState(0);
  // ---- 公共状态 ----
  const isFirstMount = useRef(true);
  const lastHomeFetchAtRef = useRef<number>(0);
  const [fabMenuExpanded, setFabMenuExpanded] = useState(false);
  const [fabVisible, setFabVisible] = useState(false);
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
  /** 待办 Tab 内是否发生过滚动（防止仅点 Tab 未滑就误显） */
  const todoTabScrollEngagedRef = useRef(false);
  const fabVisibilityRafRef = useRef(0);
  const [homeScrollIntoView, setHomeScrollIntoView] = useState('');

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
      onOverlayScrollTrack(event);
      if (activeTab !== 'todo') return;
      if (fabMenuExpanded) return;
      todoTabScrollEngagedRef.current = true;
      scheduleFabVisibilityUpdate();
    },
    [activeTab, fabMenuExpanded, onOverlayScrollTrack, scheduleFabVisibilityUpdate],
  );

  const handleFabToggle = useCallback(
    (expanded: boolean) => {
      setFabMenuExpanded(expanded);
      if (expanded) {
        freezeHomeScroll();
        return;
      }
      unfreezeHomeScrollNow();
    },
    [freezeHomeScroll, unfreezeHomeScrollNow],
  );
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

  const loadCategories = useCallback(() => {
    if (!profile?.id) {
      setCategoryTabs(listTodoCategoryTabs(''));
      return;
    }
    setCategoryTabs(listTodoCategoryTabs(profile.id));
  }, [profile?.id]);

  // ============================================
  // 教师端数据加载
  // ============================================
  const loadData = useCallback(
    async (campusId?: string) => {
      if (!profile?.id) return;

      if (isParentRole(currentRole)) {
        try {
          const [parentData, unread] = await Promise.all([
            homeService.getParent(profile.id),
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

  // ============================================
  // 关系确认弹窗（R11）
  // ============================================
  const checkPendingRelation = useCallback(async () => {
    try {
      // 1) 本地待确认关系（绑定机构流程写入，优先消费）
      const local = consumePendingRelation();
      if (local && local.studentParentId) {
        setPendingRelation(local);
        setRelationSheetVisible(true);
        return;
      }
      // 2) 后端待确认关系（分享归属注册等场景）
      const me = await organizationService.getMyOrganization();
      const remote = me?.pendingRelation;
      if (remote && remote.studentParentId) {
        let dismissedToday = false;
        try {
          dismissedToday = Taro.getStorageSync(RELATION_DISMISS_KEY) === todayDateKey();
        } catch {
          /* ignore */
        }
        if (!dismissedToday) {
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

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useDidShow(() => {
    syncTabBarByProfile(profile);
    const collaboratorResult = consumeTodoCollaboratorResult();
    if (collaboratorResult !== null) {
      // 详情弹框未关时从参与人页返回 → 写回详情；否则写回新建弹框
      if (detailItemRef.current) {
        setDetailCollaboratorIds(collaboratorResult.ids);
        setDetailCollaboratorSummaries(collaboratorResult.summaries);
      } else {
        setAddCollaboratorIds(collaboratorResult.ids);
        setAddCollaboratorSummaries(collaboratorResult.summaries);
      }
    }
    // 关系确认弹窗（R11）：绑定/归属完成后进入首页弹一次
    void checkPendingRelation();
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    // 产品口径：Tab 切换 TTL 内不重复全量拉库
    if (isWithinRefetchTtl(lastHomeFetchAtRef.current)) {
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
    Taro.navigateTo({ url: '/package-settings/pages/my-todos/index' });
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
        unfreezeHomeScrollNow();
        todoTabScrollEngagedRef.current = false;
      }

      if (tab === 'todo') {
        todoTabScrollEngagedRef.current = false;
        setFabVisible(false);
      }

      setActiveTab(tab);
    },
    [activeTab, unfreezeHomeScrollNow],
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
      void todoService
        .complete(item.id, { userId: profile.id, userName })
        .then(() => loadData(currentCampusId))
        .catch((err) => logError('Home completeTodo', err));
    },
    [profile, currentCampusId, loadData],
  );

  const handleOpenTodoDetail = useCallback(
    (item: TodoItem) => {
      // scrollOffset 实测后再开层；禁止先 setVisible 再 freeze（会丢位置钉成 0）
      freezeHomeScroll(() => {
        setDetailItem(item);
        setDetailCollaboratorIds(item.assigneeTeacherIds ? [...item.assigneeTeacherIds] : []);
        setDetailCollaboratorSummaries([]);
        setDetailVisible(true);
      });
    },
    [freezeHomeScroll],
  );

  const handleCloseTodoDetail = useCallback(() => {
    setDetailVisible(false);
    setDetailItem(null);
    setDetailCollaboratorIds([]);
    setDetailCollaboratorSummaries([]);
    // 延迟解绑 scrollTop；禁止 +0.01 微调（那会主动驱动滚动条）
    unfreezeHomeScroll();
  }, [unfreezeHomeScroll]);

  const handleDetailDelete = useCallback(
    async (item: TodoItem) => {
      if (!profile?.id) return;
      await todoService.remove(profile.id, item.id);
      await loadData(currentCampusId);
    },
    [profile, currentCampusId, loadData],
  );

  const handleDetailSave = useCallback(
    async (
      item: TodoItem,
      payload: {
        title: string;
        note?: string;
        remindEnabled: boolean;
        remindDate?: string;
        remindTime?: string;
        quadrant?: TodoQuadrant;
        categoryId?: string;
        collaboratorIds?: string[];
        collaborationMode?: TodoCollaborationMode;
      },
    ) => {
      if (!profile?.id) return;
      const updated = await todoService.update(profile.id, item.id, payload);
      await loadData(currentCampusId);
      if (updated) setDetailItem(updated);
    },
    [profile, currentCampusId, loadData],
  );

  const handleSubmitCompleteTodo = useCallback(
    async (note: string) => {
      if (!profile?.id || !completeSheetItem) return;
      const userName = profile.nickname || profile.name || '我';
      await todoService.complete(completeSheetItem.id, {
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

  const handleOpenAddTodoSheet = useCallback(
    (quadrant?: TodoQuadrant) => {
      freezeHomeScroll(() => {
        setAddCollaboratorIds([]);
        setAddCollaboratorSummaries([]);
        setAddTodoDefaultQuadrant(quadrant);
        setAddPopoverVisible(true);
      });
    },
    [freezeHomeScroll],
  );

  const handleCloseAddTodoSheet = useCallback(() => {
    setAddPopoverVisible(false);
    setAddTodoDefaultQuadrant(undefined);
    unfreezeHomeScroll();
  }, [unfreezeHomeScroll]);

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

  const handleQuadrantChange = useCallback(
    async (item: TodoItem, quadrant: TodoQuadrant) => {
      if (!profile?.id) return;
      const ok = await todoService.updateQuadrant(profile.id, item.id, quadrant);
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
      quadrant?: TodoQuadrant;
      categoryId?: string;
      collaboratorIds?: string[];
      collaborationMode?: TodoCollaborationMode;
    }) => {
      if (!profile?.id) return;
      const created = await todoService.add(profile.id, payload);
      setAddPopoverVisible(false);
      setAddTodoDefaultQuadrant(undefined);
      setActiveTab('todo');
      setTodoViewMode('timeline');
      await loadData(currentCampusId);

      // 首页仅展示今日时间轴：在首页则滚动定位；否则 Toast 兜底引导去「我的待办」
      if (isTodoVisibleOnTimelineToday(created)) {
        setTimeout(() => {
          setHomeScrollIntoView(buildTodoCardDomId(created.id));
          setTimeout(() => setHomeScrollIntoView(''), 500);
        }, 150);
        Taro.showToast({ title: '已保存', icon: 'success' });
      } else {
        Taro.showToast({ title: '已保存，请到「我的待办」查看', icon: 'none' });
      }
    },
    [profile?.id, loadData, currentCampusId],
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
          Taro.navigateTo({ url: '/package-settings/pages/my-todos/index' });
        },
      },
    ],
    [handleOpenAddTodoSheet, handleFabViewModeToggle, todoViewMode],
  );

  const handleParentAnchor = useCallback((anchor: string) => {
    setHomeScrollIntoView(anchor);
    setTimeout(() => setHomeScrollIntoView(''), 500);
  }, []);

  const renderHeader = () => {
    // 家长端与教师端共用上半部分：封面图 + 校区卡片
    if (isStaffRole(currentRole) || isParentRole(currentRole)) {
      return (
        <>
          <HomeHeroBanner
            unreadCount={unreadCount}
            bellTopPx={navSafeHeight - 4}
            onNotify={() => Taro.navigateTo({ url: '/package-settings/pages/notifications/index' })}
          />

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
    }

    return (
      <View className="mx-[32rpx] mt-[32rpx] p-[40rpx] rounded-[32rpx] bg-card shadow-soft flex flex-col items-center">
        <Icon name="school" size={80} className="text-primary mb-[24rpx]" />
        <Text className="text-[32rpx] font-bold text-foreground mb-[12rpx]">首页</Text>
        <Text className="text-[26rpx] text-muted-foreground text-center leading-normal">
          请先完成身份选择后继续使用
        </Text>
      </View>
    );
  };

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
            {renderHeader()}

            {/* 内容区：校区卡片压住上半部分 */}
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
                          <TodayScheduleCard
                            schedules={schedules}
                            title=""
                            onPrivateCheckIn={handlePrivateCheckIn}
                            onVenueCheckIn={handleVenueCheckIn}
                          />
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
                            <TodoList
                              items={todayTodoItems}
                              onComplete={handleCompleteTodo}
                              onPress={handleOpenTodoDetail}
                            />
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
                            onRecordClick={navigateToLessonDetail}
                            footerText="查看更多"
                            onFooterClick={() =>
                              Taro.navigateTo({
                                url: '/package-course/pages/records/index',
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
      {(isStaffRole(currentRole) || isParentRole(currentRole)) && (
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

      <AddCustomTodoPopover
        visible={addPopoverVisible}
        categoryTabs={categoryTabs}
        defaultCategoryId={TODO_CATEGORY_INBOX_ID}
        defaultQuadrant={addTodoDefaultQuadrant}
        collaboratorIds={addCollaboratorIds}
        collaboratorSummaries={addCollaboratorSummaries}
        onClose={handleCloseAddTodoSheet}
        onCreateCategory={handleCreateCategoryFromPopover}
        onSubmit={handleSubmitCustomTodo}
      />

      <TodoDetailPopover
        visible={detailVisible}
        item={detailItem}
        categoryTabs={categoryTabs}
        collaboratorIds={detailCollaboratorIds}
        collaboratorSummaries={detailCollaboratorSummaries}
        onClose={handleCloseTodoDetail}
        onCreateCategory={handleCreateCategoryFromPopover}
        onDelete={handleDetailDelete}
        onSave={handleDetailSave}
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

      <AddToDesktopTip />

      <RelationConfirmSheet
        visible={relationSheetVisible}
        studentName={pendingRelation?.studentName || ''}
        studentParentId={pendingRelation?.studentParentId || ''}
        onClose={handleRelationClose}
        onConfirmed={handleRelationConfirmed}
      />

      <HomeCampusGuideDialog
        visible={campusGuideVisible}
        onClose={() => setCampusGuideVisible(false)}
      />

      {/* 仅 debug 构建挂载；生产构建常量折叠后整棵子树被移除 */}
      {isDebugBuild && <MockIdentitySwitcher />}
    </>
  );
};

export default withRouteGuard(Home);
