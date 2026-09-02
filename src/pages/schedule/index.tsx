import { Button, View, Text, ScrollView, Swiper, SwiperItem, Image } from '@tarojs/components';
import Taro, { useDidShow, useShareAppMessage } from '@tarojs/taro';
import cn from 'classnames';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import BottomSheet from '@/components/BottomSheet';
import CalendarWeekSelector, { type CalendarDotType } from '@/components/CalendarWeekSelector';
import CircleCheckbox from '@/components/CircleCheckbox';
import ConfirmDialog from '@/components/ConfirmDialog';
import DraggableFab from '@/components/DraggableFab';
import Empty from '@/components/Empty';
import Icon from '@/components/Icon';
import BookTrialByClassSheet from '@/components/lead/BookTrialByClassSheet';
import TrialBookingView from '@/components/lead/TrialBookingView';
import PageContainer from '@/components/PageContainer';
import ScheduleActionButton from '@/components/schedule/ScheduleActionButton';
import ScheduleCard from '@/components/schedule/ScheduleCard';
import SwappableScheduleCard from '@/components/schedule/SwappableScheduleCard';
import VenueBookingCard from '@/components/schedule/VenueBookingCard';
import { BRAND_LOGO } from '@/constants/brand';
import {
  classBookingService,
  classService,
  leadService,
  lessonRecordService,
  notificationService,
  scheduleService,
  studentService,
  teacherService,
  temporaryRescheduleService,
  venueBookingService,
  calendarSyncService,
} from '@/services';
import { auditLogService } from '@/services/audit-log';
import { subscribeMessageService } from '@/services/subscribe-message';
import { useCampusStore } from '@/stores/campus';
import { useCourseCategoryStore } from '@/stores/course-category';
import { useThemeStore } from '@/stores/theme';
import { getThemeHexColors } from '@/theme';
import type { Class, ClassBookingSlot } from '@/types/class';
import { CLASS_LEVEL_LABELS, CLASS_LEVEL_BADGE_WRAP, CLASS_LEVEL_BADGE_TEXT } from '@/types/class';
import type { CourseCategoryMode } from '@/types/course-category';
import type { LessonRecord } from '@/types/lesson-record';
import type { Schedule } from '@/types/schedule';
import type { TeacherUIModel } from '@/types/teacher';
import type { TemporaryReschedule } from '@/types/temporary-reschedule';
import type { BookableVenue } from '@/types/venue-booking';
import { isParentRole, useAuth } from '@/utils/auth';
import { createOperationLock } from '@/utils/batch-operation';
import {
  buildLessonSharePath,
  buildLessonShareTitle,
  type LessonSharePayload,
} from '@/utils/lesson-share';
import { logError } from '@/utils/logger';
import { notifyStudentParentsSafe } from '@/utils/notify-student-parents';
import {
  upsertParentBooking,
  updateParentBookingStatus,
  readParentBookings,
} from '@/utils/parent-bookings';
import { isWithinRefetchTtl } from '@/utils/refetch-ttl';
import { withRouteGuard } from '@/utils/route-guard';
import {
  canOperateHistoricalLesson,
  canSuspendOpenSlot,
  canSuspendThisLesson,
  parseTimeToMinutes,
} from '@/utils/schedule-guard';
import {
  getCardActionVisibility,
  isHistoricalClassCard,
  isUpcomingClassCard,
} from '@/utils/schedule-card-actions';
import {
  getDurationText,
  getWeekdayText,
} from '@/utils/schedule-card-status';
import {
  buildBookingPagePath,
  buildCheckinLessonFormPath,
  buildOpenSlotRollCallPath,
  buildScheduleFormEditPath,
  buildScheduleFormReschedulePath,
  buildSupplementLessonFormPath,
  buildViewOnlyLessonFormPath,
  resolveSchedulePrimaryActionKind,
  validateEditScheduleNav,
  validateOpenSlotRollCallNav,
  validateRollCallNav,
  validateSupplementNav,
} from '@/utils/schedule-lesson-nav';
import {
  buildCancelLessonNotifyCopy,
  buildCancelLessonRecordContent,
  buildDangerActionMeta,
  buildDissolveClassNotifyContent,
  buildRestoreLessonConfirmContent,
  buildResumeClassConfirmContent,
  buildSuspendLessonConfirmContent,
  buildSuspendLessonRecordContent,
  buildSuspendNotifyCopy,
  buildSuspendOpenSlotConfirmContent,
  formatLessonChangeTime,
  type ScheduleDangerActionType,
} from '@/utils/schedule-danger-meta';
import {
  buildScheduleCardsForDate,
  summarizeScheduleCards,
  type ScheduleCardItem,
  type ScheduleCardStudentAvatar,
} from '@/utils/schedule-card-build';
import { syncTabBarByProfile } from '@/utils/tab-bar';
import { useDateSwiperWindow } from '@/utils/use-date-swiper-window';
import { useNavSafeHeight } from '@/utils/use-nav-safe-height';
import { getVenueBookingEnabled } from '@/utils/venue-booking-config';
import {
  getTabContainerWidth,
  rpxToPx,
  TAB_GAP_RPX,
  TAB_RIGHT_FIXED_WIDTH_RPX,
  TAB_WIDTH_RPX,
} from './schedule-tab-layout';

type BatchActionType = 'reschedule' | 'delete';

type ScheduleTabType = 'category' | 'venue';

interface ScheduleTabItem {
  /** Tab 唯一标识 */
  key: string;
  /** Tab 类型 */
  type: ScheduleTabType;
  /** 显示文案 */
  label: string;
  /** 分类模式（仅 category 类型） */
  mode?: CourseCategoryMode;
  /** 分类 ID（独立展示分类专用） */
  categoryId?: string;
  /** 排序序号，用于 Tab 排列 */
  sortOrder: number;
}

/** 基础模式 Tab 默认文案 */
const BASE_MODE_LABEL: Record<CourseCategoryMode, string> = {
  class: '班课',
  group: '团课',
  private: '私教',
};

interface ScheduleDangerActionState {
  visible: boolean;
  type: ScheduleDangerActionType | null;
  item: ScheduleCardItem | null;
}

const FILTER_ALL_CLASS = '';
const SCHEDULE_CARD_SWIPER_DURATION = 260;
const SCHEDULE_REFRESH_SIGNAL_KEY = 'yunce:schedule:refresh';
const NEW_CATEGORY_ACTIVE_KEY = 'yunce:schedule:new_category_active_id';
/** 开放预约卡片最多展示的前 x 个已约学员头像 */
const OPEN_BOOKING_MAX_VISIBLE_AVATARS = 5;

/**
 * 课表页
 *
 * 按设计图 bb7aaae86d5b28251be2140a59b943e.jpg 复刻为移动端排课列表样式，
 * 保留原有排课、点名、编辑、删除等核心数据流与跳转能力。
 * 单条调课进入独立表单页灵活调整，批量调课改为独立页面，仅覆盖当天课程实例。
 */
const SchedulePage: React.FC = () => {
  const { profile, currentRole } = useAuth();
  const currentCampusId = useCampusStore((state) => state.currentCampusId);
  const campuses = useCampusStore((state) => state.campuses);
  const themeStore = useThemeStore();
  const isParent = isParentRole(currentRole);
  /** 批量操作并发锁：恢复/停课/取消等危险操作共享，避免连点重复发请求 */
  const batchOperationLockRef = useRef(createOperationLock());
  /** 家长绑定孩子所在班级，用于班课只看自己的排班 */
  const [parentClassIds, setParentClassIds] = useState<Set<string>>(new Set());

  useDidShow(() => {
    syncTabBarByProfile(profile);
  });

  useEffect(() => {
    if (!isParent || !profile?.id) {
      setParentClassIds(new Set());
      return;
    }
    let cancelled = false;
    void studentService
      .getByParent(profile.id)
      .then((list) => {
        if (cancelled) return;
        const ids = new Set<string>();
        list.forEach((stu) => {
          (stu.class_ids || []).forEach((id) => ids.add(id));
        });
        setParentClassIds(ids);
      })
      .catch((err) => {
        logError('SchedulePage load parent classes', err);
      });
    return () => {
      cancelled = true;
    };
  }, [isParent, profile?.id]);

  const currentUserId = profile?.id || '';
  const currentTeacherId = profile?.teacher_profile?.id || currentUserId;
  const currentTeacherName = profile?.name || '当前老师';
  const navSafeHeight = useNavSafeHeight();

  /** 开放预约时段加载防抖 timer */
  const openSlotLoadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 开放预约加载状态 ref（避免 loadOpenClassSlots 因 state 变化频繁重建） */
  const loadingOpenSlotDatesRef = useRef<Set<string>>(new Set());
  /** 开放预约错误状态 ref */
  const errorOpenSlotDatesRef = useRef<Set<string>>(new Set());
  /** 开放预约数据缓存 ref */
  const openClassSlotsRef = useRef<Record<string, Record<string, ClassBookingSlot[]>>>({});
  /** 分享上下文：openType=share 前写入，供 useShareAppMessage 读取 */
  const pendingShareRef = useRef<LessonSharePayload | null>(null);

  // 注册页面分享能力（班课试听 / 团课约课落地 invite-landing）
  useShareAppMessage(() => {
    const payload = pendingShareRef.current;
    if (payload) {
      return {
        title: buildLessonShareTitle(payload),
        path: buildLessonSharePath(payload),
      };
    }
    return {
      title: '松果排课',
      path: '/pages/schedule/index',
    };
  });
  const realToday = useMemo(() => dayjs(), []);
  const nowTime = useMemo(() => dayjs(), []);

  const [selectedDate, setSelectedDate] = useState(realToday);
  const [currentTime, setCurrentTime] = useState(nowTime);
  const [selectedClassId, setSelectedClassId] = useState(FILTER_ALL_CLASS);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [teachers, setTeachers] = useState<TeacherUIModel[]>([]);
  const [classStudentAvatars, setClassStudentAvatars] = useState<
    Record<string, ScheduleCardStudentAvatar[]>
  >({});
  const [lessonRecords, setLessonRecords] = useState<LessonRecord[]>([]);
  const [temporaryReschedules, setTemporaryReschedules] = useState<TemporaryReschedule[]>([]);
  const lastScheduleAuxFetchAtRef = useRef(0);
  const [trialBookingKeys, setTrialBookingKeys] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  /** 当前左滑打开按钮的卡片 ID，用于卡片互斥 */
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [batchActionType, setBatchActionType] = useState<BatchActionType>('reschedule');
  const [batchActionSheetVisible, setBatchActionSheetVisible] = useState(false);
  const [batchClassSheetVisible, setBatchClassSheetVisible] = useState(false);
  const [batchSelectedClassIds, setBatchSelectedClassIds] = useState<string[]>([]);
  const [batchSubmitting] = useState(false);
  const [dangerActionSubmitting, setDangerActionSubmitting] = useState(false);
  const [dangerActionState, setDangerActionState] = useState<ScheduleDangerActionState>({
    visible: false,
    type: null,
    item: null,
  });
  // 课程分类 Store
  const { categories, fetchList: fetchCategories } = useCourseCategoryStore();
  /** 当前激活的 Tab key */
  const [activeTabKey, setActiveTabKey] = useState<string>('');
  const [tabScrollLeft, setTabScrollLeft] = useState(0);
  /** 场地预约功能开关 */
  const [venueBookingEnabled, setVenueBookingEnabled] = useState(true);
  /** 排课 / 预约 视图切换（由 activeTab 派生） */
  const [viewMode, setViewMode] = useState<'schedule' | 'booking'>('schedule');
  /** 排课视图内二级模式：fixed=固定排课, open=开放预约（由 activeTab 派生） */
  const [scheduleSubMode, setScheduleSubMode] = useState<'fixed' | 'open'>('fixed');
  /** 开放预约视图：各日期各开放班级的时段，key 为 YYYY-MM-DD */
  const [openClassSlots, setOpenClassSlots] = useState<
    Record<string, Record<string, ClassBookingSlot[]>>
  >({});
  /** 开放预约视图：存在时段的日期集合（日历红点用） */
  const [openSlotDates, setOpenSlotDates] = useState<Set<string>>(new Set());
  /** 开放预约视图：正在加载的日期集合 */
  const [loadingOpenSlotDates, setLoadingOpenSlotDates] = useState<Set<string>>(new Set());
  /** 开放预约视图：加载失败的日期集合 */
  const [errorOpenSlotDates, setErrorOpenSlotDates] = useState<Set<string>>(new Set());

  /** 可预约场地列表 */
  const [venues, setVenues] = useState<BookableVenue[]>([]);
  const [loadingVenues, setLoadingVenues] = useState(false);

  /** 课表卡片快速预约弹框 */
  const [bookSheetVisible, setBookSheetVisible] = useState(false);
  const [bookSheetItem, setBookSheetItem] = useState<ScheduleCardItem | null>(null);
  /**
   * 微信端子按钮 stopPropagation 不可靠，点「约试听/点名」时卡片 onClick 也会触发。
   * 用短锁挡住卡片主流程，保证按钮专属逻辑（弹框等）先生效。
   */
  const cardActionLockRef = useRef(false);

  const runCardButtonAction = useCallback((action: () => void) => {
    cardActionLockRef.current = true;
    try {
      action();
    } finally {
      setTimeout(() => {
        cardActionLockRef.current = false;
      }, 350);
    }
  }, []);

  /** 预约视图：老师预约开关列表弹窗 */
  const [teacherSwitchSheetVisible, setTeacherSwitchSheetVisible] = useState(false);

  // ============================================
  // 分类驱动 Tab
  // ============================================

  /** 根据课程分类生成顶部 Tab：基础模式 Tab + 场地 + 独立展示分类，统一按 sortOrder 排序 */
  const tabs = useMemo<ScheduleTabItem[]>(() => {
    const result: ScheduleTabItem[] = [];
    const modes: CourseCategoryMode[] = ['class', 'group', 'private'];

    // 基础模式 Tab：同一模式下所有「独立展示=false」的分类聚合展示
    modes.forEach((mode) => {
      const mergedCategories = categories.filter((c) => c.mode === mode && !c.independentDisplay);
      if (mergedCategories.length === 0) return;
      const systemCategory = mergedCategories.find((c) => c.isSystem);
      const minSortOrder = Math.min(...mergedCategories.map((c) => c.sortOrder));
      result.push({
        key: `mode-${mode}`,
        type: 'category',
        label: systemCategory?.name || BASE_MODE_LABEL[mode],
        mode,
        sortOrder: minSortOrder,
      });
    });

    // 场地为特殊固定 Tab，默认排序 4，受系统设置开关控制
    if (venueBookingEnabled) {
      result.push({ key: 'venue', type: 'venue', label: '场地', sortOrder: 4 });
    }

    // 独立展示分类：使用自身 sortOrder 参与全局排序
    const independentCategories = categories.filter((c) => c.independentDisplay);
    independentCategories.forEach((category) => {
      result.push({
        key: `category-${category.id}`,
        type: 'category',
        label: category.name,
        mode: category.mode,
        categoryId: category.id,
        sortOrder: category.sortOrder,
      });
    });

    return result.sort((a, b) => a.sortOrder - b.sortOrder);
  }, [categories, venueBookingEnabled]);

  const activeTab = useMemo(
    () => tabs.find((item) => item.key === activeTabKey) || tabs[0],
    [tabs, activeTabKey],
  );

  /** 初始化默认选中第一个 Tab；新增分类后默认选中该分类；分类变化导致当前 Tab 不存在时回退到第一个 */
  useEffect(() => {
    if (tabs.length === 0) return;

    let newCategoryId = '';
    try {
      newCategoryId = (Taro.getStorageSync(NEW_CATEGORY_ACTIVE_KEY) as string) || '';
      if (newCategoryId) {
        Taro.removeStorageSync(NEW_CATEGORY_ACTIVE_KEY);
      }
    } catch (err) {
      logError('SchedulePage read new category active key', err);
    }

    const newTabKey = newCategoryId ? `category-${newCategoryId}` : '';
    const exists = tabs.some((tab) => tab.key === activeTabKey);
    const newExists = newTabKey && tabs.some((tab) => tab.key === newTabKey);

    if (newExists) {
      setActiveTabKey(newTabKey);
      const tabIndex = tabs.findIndex((tab) => tab.key === newTabKey);
      const containerWidthPx = rpxToPx(750 - TAB_RIGHT_FIXED_WIDTH_RPX);
      const tabWidthPx = rpxToPx(TAB_WIDTH_RPX);
      const gapPx = rpxToPx(TAB_GAP_RPX);
      const totalWidthPx = tabs.length * tabWidthPx + (tabs.length - 1) * gapPx;
      const maxScrollLeftPx = Math.max(0, totalWidthPx - containerWidthPx);
      const targetCenterPx = tabIndex * (tabWidthPx + gapPx) + tabWidthPx / 2;
      const targetScrollLeftPx = targetCenterPx - containerWidthPx / 2;
      setTabScrollLeft(Math.max(0, Math.min(targetScrollLeftPx, maxScrollLeftPx)));
    } else if (!exists) {
      setActiveTabKey(tabs[0]?.key || '');
      setTabScrollLeft(0);
    }
  }, [tabs, activeTabKey]);

  /** 当前 Tab 应包含的分类 ID 集合 */
  const activeCategoryIds = useMemo(() => {
    if (!activeTab || activeTab.type === 'venue') return new Set<string>();
    if (activeTab.categoryId) return new Set<string>([activeTab.categoryId]);
    return new Set<string>(
      categories.filter((c) => c.mode === activeTab.mode && !c.independentDisplay).map((c) => c.id),
    );
  }, [activeTab, categories]);

  /** 按当前 Tab 过滤后的班级列表 */
  const filteredClasses = useMemo(() => {
    if (!activeTab || activeTab.type === 'venue') return [];
    return classes.filter((cls) => {
      if (cls.category_id) {
        if (!activeCategoryIds.has(cls.category_id)) return false;
      } else {
        // 兼容旧数据：无 category_id 时按 schedule_mode 回退推导
        if (activeTab.mode === 'group') {
          if (cls.schedule_mode !== 'open') return false;
        } else if (activeTab.mode === 'class') {
          if (cls.schedule_mode && cls.schedule_mode !== 'fixed') return false;
        } else {
          return false;
        }
      }
      // 家长：班课/团课都只看绑定孩子所在班级
      if (isParent && (activeTab.mode === 'class' || activeTab.mode === 'group')) {
        return parentClassIds.has(cls.id);
      }
      return true;
    });
  }, [activeTab, activeCategoryIds, classes, isParent, parentClassIds]);

  /** 按当前 Tab 过滤后的排课规则（停课班级不展开课表） */
  const filteredSchedules = useMemo(() => {
    if (!activeTab || activeTab.type === 'venue') return [];
    const classIds = new Set(filteredClasses.map((item) => item.id));
    const pausedIds = new Set(
      filteredClasses.filter((item) => item.status === 'paused').map((item) => item.id),
    );
    return schedules.filter((item) => {
      if (!item.class_id) return true;
      if (!classIds.has(item.class_id)) return false;
      if (pausedIds.has(item.class_id)) return false;
      return true;
    });
  }, [activeTab, filteredClasses, schedules]);

  /** 当前 Tab 下已停课的班级（课表底部展示，可恢复） */
  const pausedClasses = useMemo(
    () => filteredClasses.filter((item) => item.status === 'paused'),
    [filteredClasses],
  );

  /** 加载可预约场地列表 */
  const loadVenues = useCallback(async () => {
    setLoadingVenues(true);
    try {
      const data = await venueBookingService.getBookableVenues(currentCampusId);
      setVenues(data);
    } catch (err) {
      logError('SchedulePage loadVenues', err);
      Taro.showToast({ title: '场地加载失败', icon: 'none' });
    } finally {
      setLoadingVenues(false);
    }
  }, [currentCampusId]);

  const handleMainTabChange = useCallback(
    (tabKey: string, tabIndex: number) => {
      if (tabKey === activeTabKey) return;
      const tab = tabs.find((item) => item.key === tabKey);
      if (!tab) return;
      setActiveTabKey(tabKey);
      setOpenCardId(null);

      // 选中 Tab 自动滚动到可视区域中间
      const containerWidthPx = rpxToPx(750 - TAB_RIGHT_FIXED_WIDTH_RPX);
      const tabWidthPx = rpxToPx(TAB_WIDTH_RPX);
      const gapPx = rpxToPx(TAB_GAP_RPX);
      const totalWidthPx = tabs.length * tabWidthPx + (tabs.length - 1) * gapPx;
      const maxScrollLeftPx = Math.max(0, totalWidthPx - containerWidthPx);
      const targetCenterPx = tabIndex * (tabWidthPx + gapPx) + tabWidthPx / 2;
      const targetScrollLeftPx = targetCenterPx - containerWidthPx / 2;
      setTabScrollLeft(Math.max(0, Math.min(targetScrollLeftPx, maxScrollLeftPx)));

      if (tab.type === 'venue') {
        setViewMode('schedule');
        setScheduleSubMode('fixed');
        void loadVenues();
      } else if (tab.mode === 'class') {
        setViewMode('schedule');
        setScheduleSubMode('fixed');
      } else if (tab.mode === 'group') {
        setViewMode('schedule');
        setScheduleSubMode('open');
      } else if (tab.mode === 'private') {
        setViewMode('booking');
        setScheduleSubMode('fixed');
      }
    },
    [activeTabKey, tabs, loadVenues],
  );

  const loadOpenClassSlots = useCallback(
    async (targetDate: dayjs.Dayjs, force = false) => {
      if (viewMode !== 'schedule' || scheduleSubMode !== 'open') {
        return;
      }
      const openClasses = filteredClasses.filter((item) => item.schedule_mode === 'open');
      const dateStr = targetDate.format('YYYY-MM-DD');

      // 正在加载中，避免重复请求
      if (loadingOpenSlotDatesRef.current.has(dateStr)) {
        return;
      }

      // 已缓存且非错误状态，直接复用（force 可跳过缓存用于重试）
      if (
        !force &&
        Object.prototype.hasOwnProperty.call(openClassSlotsRef.current, dateStr) &&
        !errorOpenSlotDatesRef.current.has(dateStr)
      ) {
        return;
      }

      if (openClasses.length === 0) {
        openClassSlotsRef.current = { ...openClassSlotsRef.current, [dateStr]: {} };
        setOpenClassSlots(openClassSlotsRef.current);
        return;
      }

      loadingOpenSlotDatesRef.current = new Set(loadingOpenSlotDatesRef.current).add(dateStr);
      setLoadingOpenSlotDates(loadingOpenSlotDatesRef.current);
      errorOpenSlotDatesRef.current = new Set(errorOpenSlotDatesRef.current);
      errorOpenSlotDatesRef.current.delete(dateStr);
      setErrorOpenSlotDates(errorOpenSlotDatesRef.current);

      try {
        const results = await Promise.all(
          openClasses.map(async (cls) => ({
            classId: cls.id,
            slots: await classBookingService.getSlotsByClass(cls.id, dateStr),
          })),
        );
        openClassSlotsRef.current = {
          ...openClassSlotsRef.current,
          [dateStr]: results.reduce<Record<string, ClassBookingSlot[]>>((acc, item) => {
            acc[item.classId] = item.slots;
            return acc;
          }, {}),
        };
        setOpenClassSlots(openClassSlotsRef.current);
        loadingOpenSlotDatesRef.current = new Set(loadingOpenSlotDatesRef.current);
        loadingOpenSlotDatesRef.current.delete(dateStr);
        setLoadingOpenSlotDates(loadingOpenSlotDatesRef.current);
      } catch (err) {
        logError('SchedulePage loadOpenClassSlots', err);
        loadingOpenSlotDatesRef.current = new Set(loadingOpenSlotDatesRef.current);
        loadingOpenSlotDatesRef.current.delete(dateStr);
        setLoadingOpenSlotDates(loadingOpenSlotDatesRef.current);
        errorOpenSlotDatesRef.current = new Set(errorOpenSlotDatesRef.current).add(dateStr);
        setErrorOpenSlotDates(errorOpenSlotDatesRef.current);

        // 失败时设置空数据，避免一直显示加载中；UI 提供手动重试入口
        openClassSlotsRef.current = { ...openClassSlotsRef.current, [dateStr]: {} };
        setOpenClassSlots(openClassSlotsRef.current);
      }
    },
    [filteredClasses, scheduleSubMode, viewMode],
  );

  const loadOpenSlotDates = useCallback(async () => {
    const openClasses = filteredClasses.filter((item) => item.schedule_mode === 'open');
    if (openClasses.length === 0) {
      setOpenSlotDates(new Set());
      return;
    }
    try {
      const dates = await classBookingService.getOpenSlotDates(openClasses.map((cls) => cls.id));
      setOpenSlotDates(new Set(dates));
    } catch (err) {
      logError('SchedulePage loadOpenSlotDates', err);
    }
  }, [filteredClasses]);

  /**
   * 按目标日期刷新数据，绑定到日历切换事件上
   * 避免依赖 selectedDate 的 useEffect 在日期相同时跳过刷新
   */
  const refreshDateData = useCallback(
    (date: dayjs.Dayjs) => {
      if (openSlotLoadTimerRef.current) {
        clearTimeout(openSlotLoadTimerRef.current);
      }
      openSlotLoadTimerRef.current = setTimeout(() => {
        openSlotLoadTimerRef.current = null;
        if (viewMode === 'schedule' && scheduleSubMode === 'open') {
          void loadOpenClassSlots(date, true);
          void loadOpenClassSlots(date.add(1, 'day'), true);
          void loadOpenClassSlots(date.subtract(1, 'day'), true);
        }
        if (currentUserId) {
          const startDate = date.startOf('month').subtract(7, 'day').format('YYYY-MM-DD');
          const endDate = date.endOf('month').add(7, 'day').format('YYYY-MM-DD');
          void lessonRecordService
            .getByTeacherAndRange(currentUserId, startDate, endDate, currentCampusId)
            .then(setLessonRecords)
            .catch((err) => {
              logError('SchedulePage refreshDateData records', err);
              // 口径：无权限/失败 → 保留缓存或空白，不弹失败打断
            });
          void temporaryRescheduleService
            .getByTeacherAndRange(currentUserId, startDate, endDate)
            .then(setTemporaryReschedules)
            .catch((err) => {
              logError('SchedulePage refreshDateData reschedules', err);
            });
        }
      }, 150);
    },
    [currentUserId, loadOpenClassSlots, scheduleSubMode, viewMode, currentCampusId],
  );

  /** 日历切换时同步刷新目标日期数据 */
  const handleDateChangeWithRefresh = useCallback(
    (date: dayjs.Dayjs) => {
      setSelectedDate(date);
      setOpenCardId(null);
      refreshDateData(date);
    },
    [refreshDateData],
  );

  const {
    dateWindow: scheduleDateWindow,
    swiperCurrent,
    handleCalendarChange: handleScheduleDateChange,
    handleSwiperChange,
    handleSwiperAnimationFinish: handleSwiperFinish,
  } = useDateSwiperWindow({
    selectedDate,
    onDateChange: handleDateChangeWithRefresh,
  });

  const loadBaseData = useCallback(async () => {
    if (!currentUserId) {
      return;
    }
    setLoading(true);
    try {
      if (isParent) {
        const kids = await studentService.getByParent(profile?.id || currentUserId);
        const classIdSet = new Set<string>();
        kids.forEach((kid) => {
          (kid.class_ids || []).forEach((id) => classIdSet.add(id));
        });
        setParentClassIds(classIdSet);

        const classList = (
          await Promise.all([...classIdSet].map((id) => classService.getById(id)))
        ).filter(Boolean) as Class[];
        const scheduleList = await scheduleService.listForParent([...classIdSet], currentCampusId);
        const teacherList = await teacherService.getList(currentCampusId);

        const classStudentsList = await Promise.all(
          classList.map(async (classItem) => ({
            classId: classItem.id,
            students: kids.filter((kid) => (kid.class_ids || []).includes(classItem.id)),
          })),
        );
        const nextClassStudentAvatars: Record<string, ScheduleCardStudentAvatar[]> = {};
        classStudentsList.forEach((item) => {
          nextClassStudentAvatars[item.classId] = item.students.map((student) => ({
            id: student.id,
            name: student.name,
            avatar: student.avatar_url,
          }));
        });

        setSchedules(scheduleList);
        setClasses(classList);
        setTeachers(teacherList);
        setClassStudentAvatars(nextClassStudentAvatars);
        setTrialBookingKeys(new Set());
        return;
      }

      const [scheduleList, classList, teacherList, leadBookings] = await Promise.all([
        scheduleService.getByTeacher(currentUserId, currentCampusId),
        classService.getByTeacher(currentUserId, currentCampusId),
        teacherService.getList(currentCampusId),
        // 试听标签按「当天有效预约」判定，含 pending/confirmed（后端新建默认可为 pending）
        leadService.getLeadBookingsByTeacher(currentTeacherId),
        fetchCategories(),
      ]);
      await studentService.getByTeacher(currentUserId, currentCampusId);
      const classStudentsList = await Promise.all(
        classList.map(async (classItem) => ({
          classId: classItem.id,
          students: await classService.getStudents(classItem.id),
        })),
      );
      const nextClassStudentAvatars: Record<string, ScheduleCardStudentAvatar[]> = {};
      classStudentsList.forEach((item) => {
        nextClassStudentAvatars[item.classId] = item.students.map((student) => ({
          id: student.id,
          name: student.name,
          avatar: student.avatar_url,
        }));
      });
      const nextTrialBookingKeys = new Set<string>(
        leadBookings
          .filter(
            (b) =>
              b.class_id && b.lesson_date && (b.status === 'pending' || b.status === 'confirmed'),
          )
          .map((b) => `${b.class_id}|${b.lesson_date}`),
      );
      setSchedules(scheduleList);
      setClasses(classList);
      setTeachers(teacherList);
      setClassStudentAvatars(nextClassStudentAvatars);
      setTrialBookingKeys(nextTrialBookingKeys);
      void calendarSyncService.maybePromptOnSchedulePage({
        userId: currentUserId,
        teacherId: currentUserId,
        role: currentRole ?? undefined,
        campusId: currentCampusId,
        scheduleCount: scheduleList.length,
      });
    } catch (err) {
      logError('SchedulePage loadBaseData', err);
      // 口径：无权限/拉数失败 → 空白课表，不用失败 toast 打断
    } finally {
      setLoading(false);
    }
  }, [
    currentUserId,
    currentTeacherId,
    currentCampusId,
    currentRole,
    fetchCategories,
    isParent,
    profile?.id,
  ]);

  const loadMonthRecords = useCallback(async () => {
    if (!currentUserId) {
      return;
    }
    try {
      const startDate = selectedDate.startOf('month').subtract(7, 'day').format('YYYY-MM-DD');
      const endDate = selectedDate.endOf('month').add(7, 'day').format('YYYY-MM-DD');
      const list = await lessonRecordService.getByTeacherAndRange(
        currentUserId,
        startDate,
        endDate,
        currentCampusId,
      );
      setLessonRecords(list);
      lastScheduleAuxFetchAtRef.current = Date.now();
    } catch (err) {
      logError('SchedulePage loadMonthRecords', err);
      // 保留缓存；不反复 toast（Tab 切换会多次触发）
    }
  }, [currentUserId, currentCampusId, selectedDate]);

  const loadTemporaryReschedules = useCallback(async () => {
    if (!currentUserId) {
      return;
    }
    try {
      const startDate = selectedDate.startOf('month').subtract(7, 'day').format('YYYY-MM-DD');
      const endDate = selectedDate.endOf('month').add(7, 'day').format('YYYY-MM-DD');
      const list = await temporaryRescheduleService.getByTeacherAndRange(
        currentUserId,
        startDate,
        endDate,
      );
      setTemporaryReschedules(list);
      lastScheduleAuxFetchAtRef.current = Date.now();
    } catch (err) {
      logError('SchedulePage loadTemporaryReschedules', err);
      // 后端未挂载接口时 service 已降级本地；此处不再弹失败打断
    }
  }, [currentUserId, selectedDate]);

  useEffect(() => {
    loadBaseData();
  }, [loadBaseData]);

  useEffect(() => {
    // 日历切换已绑定到 onChange 回调主动刷新；这里负责初始加载及视图/模式切换后的兜底刷新
    refreshDateData(selectedDate);
    return () => {
      if (openSlotLoadTimerRef.current) {
        clearTimeout(openSlotLoadTimerRef.current);
        openSlotLoadTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshDateData]);

  useEffect(() => {
    void loadOpenSlotDates();
  }, [loadOpenSlotDates]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(dayjs());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  useDidShow(() => {
    setCurrentTime(dayjs());
    setVenueBookingEnabled(getVenueBookingEnabled());
    let hasRefreshSignal = false;
    let newCategoryId = '';
    try {
      hasRefreshSignal = Boolean(Taro.getStorageSync(SCHEDULE_REFRESH_SIGNAL_KEY));
      if (hasRefreshSignal) {
        Taro.removeStorageSync(SCHEDULE_REFRESH_SIGNAL_KEY);
      }
    } catch (err) {
      logError('SchedulePage read refresh signal', err);
    }
    try {
      newCategoryId = (Taro.getStorageSync(NEW_CATEGORY_ACTIVE_KEY) as string) || '';
    } catch (err) {
      logError('SchedulePage read new category active key', err);
    }

    if (hasRefreshSignal || newCategoryId) {
      void loadBaseData();
      void loadMonthRecords();
      void loadTemporaryReschedules();
      return;
    }
    // 产品口径：Tab 切换 TTL 内不重复打消课/临调接口
    if (isWithinRefetchTtl(lastScheduleAuxFetchAtRef.current)) {
      return;
    }
    void loadMonthRecords();
    void loadTemporaryReschedules();
  });

  const classById = useMemo(
    () =>
      filteredClasses.reduce<Record<string, Class>>((acc, item) => {
        acc[item.id] = item;
        return acc;
      }, {}),
    [filteredClasses],
  );

  const teacherById = useMemo(
    () =>
      teachers.reduce<Record<string, TeacherUIModel>>((acc, item) => {
        acc[item.id] = item;
        return acc;
      }, {}),
    [teachers],
  );

  const scheduleById = useMemo(
    () =>
      filteredSchedules.reduce<Record<string, Schedule>>((acc, item) => {
        acc[item.id] = item;
        return acc;
      }, {}),
    [filteredSchedules],
  );

  const scheduleMapByClass = useMemo(
    () =>
      filteredSchedules.reduce<Record<string, Schedule[]>>((acc, item) => {
        if (!item.class_id) {
          return acc;
        }
        if (!acc[item.class_id]) {
          acc[item.class_id] = [];
        }
        acc[item.class_id].push(item);
        return acc;
      }, {}),
    [filteredSchedules],
  );

  const notifyStudentAndParents = useCallback(
    async (studentId: string, title: string, content: string) => {
      try {
        await notificationService.send({
          sender_id: currentUserId,
          receiver_id: studentId,
          title,
          content,
          related_id: studentId,
        });
      } catch (err) {
        logError('SchedulePage notify student', err);
      }

      await notifyStudentParentsSafe({
        studentId,
        senderId: currentUserId,
        title,
        content,
        logLabel: 'SchedulePage notify parents',
      });
    },
    [currentUserId],
  );

  const buildCardsForDate = useCallback(
    (date: dayjs.Dayjs): ScheduleCardItem[] =>
      buildScheduleCardsForDate({
        date,
        now: currentTime,
        filteredSchedules,
        scheduleById,
        temporaryReschedules,
        lessonRecords,
        selectedClassId,
        classById,
        teacherById,
        classStudentAvatars,
        trialBookingKeys,
        currentTeacherName,
      }),
    [
      classById,
      classStudentAvatars,
      currentTime,
      currentTeacherName,
      lessonRecords,
      scheduleById,
      filteredSchedules,
      selectedClassId,
      teacherById,
      trialBookingKeys,
      temporaryReschedules,
    ],
  );

  const calendarWeekdaySet = useMemo(() => {
    return new Set(
      filteredSchedules
        .filter((item) => !selectedClassId || item.class_id === selectedClassId)
        .map((item) => item.day_of_week),
    );
  }, [filteredSchedules, selectedClassId]);
  const getDateDotType = useCallback(
    (date: dayjs.Dayjs): CalendarDotType => {
      const weekday = (date.day() || 7) as Schedule['day_of_week'];
      const dateStr = date.format('YYYY-MM-DD');
      const movedOutScheduleIdSet = new Set(
        temporaryReschedules
          .filter((item) => item.source_date === dateStr)
          .map((item) => item.schedule_id),
      );
      const fixedCount = filteredSchedules.filter(
        (item) =>
          item.day_of_week === weekday &&
          (!selectedClassId || item.class_id === selectedClassId) &&
          !movedOutScheduleIdSet.has(item.id),
      ).length;
      const movedInCount = temporaryReschedules.filter(
        (item) =>
          item.target_date === dateStr && (!selectedClassId || item.class_id === selectedClassId),
      ).length;

      if (!calendarWeekdaySet.has(weekday) && movedInCount === 0) {
        return 'none';
      }
      if (fixedCount + movedInCount === 0) {
        return 'none';
      }
      return date.isBefore(currentTime, 'day') ? 'past' : 'active';
    },
    [calendarWeekdaySet, currentTime, filteredSchedules, selectedClassId, temporaryReschedules],
  );

  const getOpenDateDotType = useCallback(
    (date: dayjs.Dayjs): CalendarDotType => {
      const dateStr = date.format('YYYY-MM-DD');
      if (!openSlotDates.has(dateStr)) {
        return 'none';
      }
      return date.isBefore(currentTime, 'day') ? 'past' : 'active';
    },
    [currentTime, openSlotDates],
  );

  const batchClassOptions = useMemo(() => {
    return filteredClasses
      .filter((item) => item.status === 'active')
      .map((item) => {
        const relatedSchedules = [...(scheduleMapByClass[item.id] || [])].sort(
          (left, right) =>
            parseTimeToMinutes(left.start_time) - parseTimeToMinutes(right.start_time),
        );
        const scheduleSummary =
          item.schedule ||
          (relatedSchedules.length > 0
            ? relatedSchedules
                .slice(0, 2)
                .map(
                  (schedule) =>
                    `${getWeekdayText(schedule.day_of_week)} ${schedule.start_time}-${schedule.end_time}`,
                )
                .join(' / ')
            : '未设置排课');

        return {
          id: item.id,
          name: item.name,
          studentCount: item.student_count,
          scheduleSummary,
        };
      })
      .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'));
  }, [filteredClasses, scheduleMapByClass]);

  const selectedBatchClasses = useMemo(
    () => batchClassOptions.filter((item) => batchSelectedClassIds.includes(item.id)),
    [batchClassOptions, batchSelectedClassIds],
  );

  const closeDangerActionDialog = useCallback(() => {
    setDangerActionState({
      visible: false,
      type: null,
      item: null,
    });
  }, []);

  const dangerActionMeta = useMemo(
    () =>
      buildDangerActionMeta({
        type: dangerActionState.type,
        item: dangerActionState.item,
        lessonDate: selectedDate.format('YYYY-MM-DD'),
        batchCount: selectedBatchClasses.length,
      }),
    [dangerActionState.item, dangerActionState.type, selectedBatchClasses.length, selectedDate],
  );

  const handleOpenBookSheet = useCallback((item: ScheduleCardItem) => {
    setBookSheetItem(item);
    setBookSheetVisible(true);
  }, []);

  const handleCloseBookSheet = useCallback(() => {
    setBookSheetVisible(false);
    setBookSheetItem(null);
  }, []);

  const handleBookTrialByClassSuccess = useCallback(
    ({ classId, lessonDate }: { classId: string; lessonDate: string }) => {
      // 预约成功后本地标记该班级时段为试听，并刷新课表数据
      setTrialBookingKeys((prev) => {
        const next = new Set(prev);
        next.add(`${classId}|${lessonDate}`);
        return next;
      });
      void loadBaseData();
    },
    [loadBaseData],
  );

  /** 卡片「补录」：仅历史课且 30 天内 */
  const handleSupplement = useCallback((item: ScheduleCardItem, actionDate: dayjs.Dayjs) => {
    const error = validateSupplementNav(item, actionDate, dayjs());
    if (error) {
      Taro.showToast({ title: error, icon: 'none' });
      return;
    }
    Taro.navigateTo({ url: buildSupplementLessonFormPath(item, actionDate) });
  }, []);

  /** 历史课超时：仅查看（不带补录 action） */
  const handleViewHistoricalLesson = useCallback(
    (item: ScheduleCardItem, actionDate: dayjs.Dayjs) => {
      if (!item.classId) {
        Taro.showToast({ title: '当前课程缺少班级信息', icon: 'none' });
        return;
      }
      Taro.navigateTo({ url: buildViewOnlyLessonFormPath(item, actionDate) });
    },
    [],
  );

  const handlePrimaryAction = useCallback(
    (item: ScheduleCardItem, actionDate: dayjs.Dayjs) => {
      // 子按钮（约试听等）已抢先处理时，忽略卡片主点击（微信 stopPropagation 不可靠）
      if (cardActionLockRef.current) {
        return;
      }
      const kind = resolveSchedulePrimaryActionKind(item, actionDate, dayjs());
      if (kind === 'booking') {
        Taro.navigateTo({
          url: buildBookingPagePath(actionDate.format('YYYY-MM-DD')),
        });
        return;
      }
      if (kind === 'supplement') {
        handleSupplement(item, actionDate);
        return;
      }
      if (kind === 'view') {
        handleViewHistoricalLesson(item, actionDate);
        return;
      }
      Taro.navigateTo({ url: buildCheckinLessonFormPath(item, actionDate) });
    },
    [handleSupplement, handleViewHistoricalLesson],
  );

  /** 卡片「点名」：进 lesson-form 正常点名 */
  const handleRollCall = useCallback((item: ScheduleCardItem, actionDate: dayjs.Dayjs) => {
    const error = validateRollCallNav(item, actionDate, dayjs());
    if (error) {
      Taro.showToast({ title: error, icon: 'none' });
      return;
    }
    Taro.navigateTo({ url: buildCheckinLessonFormPath(item, actionDate) });
  }, []);

  /** 团课开放时段「点名」：复用 lesson-form（classId + 日期时段；有开班排课则带 scheduleId） */
  const handleOpenSlotRollCall = useCallback((slot: ClassBookingSlot) => {
    const error = validateOpenSlotRollCallNav(slot);
    if (error) {
      Taro.showToast({ title: error, icon: 'none' });
      return;
    }
    Taro.navigateTo({
      url: buildOpenSlotRollCallPath({
        class_id: slot.class_id!,
        lesson_date: slot.lesson_date,
        start_time: slot.start_time,
        opened_schedule_id: slot.opened_schedule_id,
      }),
    });
  }, []);

  const handleEditSchedule = useCallback(
    (item: ScheduleCardItem) => {
      const visibility = getCardActionVisibility(item, selectedDate, currentTime);
      const error = validateEditScheduleNav(item, selectedDate, currentTime, visibility);
      if (error) {
        Taro.showToast({ title: error, icon: 'none' });
        return;
      }
      Taro.navigateTo({
        url: buildScheduleFormEditPath(item.id),
      });
    },
    [currentTime, selectedDate],
  );

  /** 班级调课：这一天整班换到别的时间（仅本次），长期仍挂在原排课规则上 */
  const handleClassReschedule = useCallback(
    (item: ScheduleCardItem) => {
      const visibility = getCardActionVisibility(item, selectedDate, currentTime);
      if (!visibility.showEditAndReschedule) {
        Taro.showToast({ title: '过去日期课程不支持调课', icon: 'none' });
        return;
      }
      Taro.navigateTo({
        url: buildScheduleFormReschedulePath(item.id, selectedDate.format('YYYY-MM-DD')),
      });
    },
    [currentTime, selectedDate],
  );

  const handleCancelLesson = useCallback(
    async (item: ScheduleCardItem) => {
      const visibility = getCardActionVisibility(item, selectedDate, currentTime);
      if (!visibility.showCancelLesson) {
        Taro.showToast({ title: '过去日期课程不可取消开课', icon: 'none' });
        return;
      }

      setDangerActionState({
        visible: true,
        type: 'cancel',
        item,
      });
    },
    [currentTime, selectedDate],
  );

  const handleRestoreLesson = useCallback(
    async (item: ScheduleCardItem) => {
      if (!item.classId) {
        Taro.showToast({ title: '当前课程缺少班级信息', icon: 'none' });
        return;
      }

      const lessonDate = selectedDate.format('YYYY-MM-DD');
      const cancelledRecords = lessonRecords.filter(
        (record) =>
          record.class_id === item.classId &&
          record.lesson_date === lessonDate &&
          record.status === 'cancelled',
      );

      if (cancelledRecords.length === 0) {
        Taro.showToast({ title: '未找到取消记录', icon: 'none' });
        return;
      }

      const confirmCopy = buildRestoreLessonConfirmContent({
        className: item.className,
        lessonDate,
        startTime: item.startTime,
        endTime: item.endTime,
      });
      const confirmResult = await Taro.showModal({
        title: confirmCopy.title,
        content: confirmCopy.content,
        confirmText: confirmCopy.confirmText,
        confirmColor: getThemeHexColors(themeStore.activeTheme).primary,
      });

      if (!confirmResult.confirm) {
        return;
      }

      // 并发锁：已有批量操作执行中则忽略本次，避免重复请求
      const lock = batchOperationLockRef.current;
      if (lock.isLocked()) return;
      try {
        await lock.run('restore-lesson', async () => {
          await Promise.all(
            cancelledRecords.map((record) => lessonRecordService.remove(record.id)),
          );
          setLessonRecords((prev) =>
            prev.filter(
              (record) =>
                !(
                  record.class_id === item.classId &&
                  record.lesson_date === lessonDate &&
                  record.status === 'cancelled'
                ),
            ),
          );
          Taro.showToast({ title: '已恢复本次课程', icon: 'success' });
        });
      } catch (err) {
        logError('SchedulePage restore lesson', err);
        Taro.showToast({ title: '恢复失败，请重试', icon: 'none' });
      }
    },
    [lessonRecords, selectedDate, themeStore.activeTheme],
  );

  /** 停课：仅未开课的这一节临时取消，并向学员家长发站内 + 订阅消息 */
  const handleSuspendLesson = useCallback(
    async (item: ScheduleCardItem) => {
      const classId = item.classId;
      if (!classId) {
        Taro.showToast({ title: '当前课程缺少班级信息', icon: 'none' });
        return;
      }
      if (!canSuspendThisLesson(item, selectedDate, currentTime)) {
        Taro.showToast({ title: '仅未开课的课程可停课', icon: 'none' });
        return;
      }

      const lessonDate = selectedDate.format('YYYY-MM-DD');
      const confirmCopy = buildSuspendLessonConfirmContent({
        className: item.className,
        lessonDate,
        startTime: item.startTime,
        endTime: item.endTime,
      });
      const confirmResult = await Taro.showModal({
        title: confirmCopy.title,
        content: confirmCopy.content,
        confirmText: confirmCopy.confirmText,
        confirmColor: getThemeHexColors(themeStore.activeTheme).primary,
      });
      if (!confirmResult.confirm) return;

      const scheduleInfo = scheduleById[item.id];
      const selectedClass =
        filteredClasses.find((classItem) => classItem.id === item.classId) || null;
      const className = selectedClass?.name || item.className;
      const changeTime = formatLessonChangeTime({
        lessonDate,
        startTime: item.startTime,
        endTime: item.endTime,
      });
      const notifyCopy = buildSuspendNotifyCopy({ className, changeTime });

      // 并发锁：已有批量操作执行中则忽略本次，避免重复创建停课记录
      const lock = batchOperationLockRef.current;
      if (lock.isLocked()) return;
      try {
        await lock.run('suspend-lesson', async () => {
          const students = await classService.getStudents(classId);
          const createdRecords: LessonRecord[] = [];

          for (const student of students) {
            const createdRecord = await lessonRecordService.create({
              teacher_id: scheduleInfo?.teacher_id || currentTeacherId,
              operator_teacher_id: currentTeacherId,
              assistant_teacher_id: scheduleInfo?.assistant_teacher_id || undefined,
              student_id: student.id,
              package_id: '',
              class_id: item.classId,
              lesson_date: lessonDate,
              hours_used: 0,
              status: 'cancelled',
              content: buildSuspendLessonRecordContent({
                className: item.className,
                startTime: item.startTime,
                endTime: item.endTime,
              }),
            });
            createdRecords.push(createdRecord);

            const parents = await studentService.getParents(student.id);
            for (const binding of parents) {
              await notificationService.send({
                sender_id: profile?.id || currentUserId,
                receiver_id: binding.parent_id,
                title: notifyCopy.title,
                content: notifyCopy.content,
                related_id: student.id,
                type: 'schedule_change',
              });
              await subscribeMessageService.sendScheduleChangeToReceiver({
                receiverUserId: binding.parent_id,
                bizKey: `lesson-suspend:${item.id}:${lessonDate}:${binding.parent_id}`,
                className,
                changeTime,
                changeReason: notifyCopy.changeReason,
              });
            }
          }

          setLessonRecords((prev) => {
            const filtered = prev.filter(
              (record) => !(record.class_id === item.classId && record.lesson_date === lessonDate),
            );
            return [...filtered, ...createdRecords];
          });
          Taro.showToast({ title: '已停课并通知家长', icon: 'success' });
        });
      } catch (err) {
        logError('SchedulePage suspend lesson', err);
        Taro.showToast({ title: '停课失败，请重试', icon: 'none' });
      }
    },
    [
      currentTeacherId,
      currentTime,
      currentUserId,
      filteredClasses,
      profile?.id,
      scheduleById,
      selectedDate,
      themeStore.activeTheme,
    ],
  );

  /** 团课停课：仅未开课时段，设为休息并通知已约学员家长 */
  const handleSuspendOpenSlot = useCallback(
    async (slot: ClassBookingSlot, className: string) => {
      if (!canSuspendOpenSlot(slot, currentTime)) {
        Taro.showToast({ title: '仅未开课的课程可停课', icon: 'none' });
        return;
      }

      const displayName = className || slot.class_name || '该班级';
      const changeTime = formatLessonChangeTime({
        lessonDate: slot.lesson_date,
        startTime: slot.start_time,
        endTime: slot.end_time,
      });
      const confirmCopy = buildSuspendOpenSlotConfirmContent({ displayName, changeTime });
      const notifyCopy = buildSuspendNotifyCopy({ className: displayName, changeTime });
      const confirmResult = await Taro.showModal({
        title: confirmCopy.title,
        content: confirmCopy.content,
        confirmText: confirmCopy.confirmText,
        confirmColor: getThemeHexColors(themeStore.activeTheme).primary,
      });
      if (!confirmResult.confirm) return;

      // 并发锁：已有批量操作执行中则忽略本次
      const lock = batchOperationLockRef.current;
      if (lock.isLocked()) return;
      try {
        await lock.run('suspend-open-slot', async () => {
          await classBookingService.updateSlotStatus(slot.id, 'rest');
          setOpenClassSlots((prev) => {
            const next = { ...prev };
            const dateKey = slot.lesson_date;
            if (next[dateKey]) {
              next[dateKey] = { ...next[dateKey] };
              const classSlots = next[dateKey][slot.class_id];
              if (classSlots) {
                next[dateKey][slot.class_id] = classSlots.map((s) =>
                  s.id === slot.id ? { ...s, status: 'rest' as const } : s,
                );
              }
            }
            return next;
          });

          const bookingStudents = slot.booking_students || [];
          for (const student of bookingStudents) {
            const parents = await studentService.getParents(student.id);
            for (const binding of parents) {
              await notificationService.send({
                sender_id: profile?.id || currentUserId,
                receiver_id: binding.parent_id,
                title: notifyCopy.title,
                content: notifyCopy.content,
                related_id: student.id,
                type: 'schedule_change',
              });
              await subscribeMessageService.sendScheduleChangeToReceiver({
                receiverUserId: binding.parent_id,
                bizKey: `slot-suspend:${slot.id}:${binding.parent_id}`,
                className: displayName,
                changeTime,
                changeReason: notifyCopy.changeReason,
              });
            }
          }

          Taro.showToast({ title: '已停课并通知家长', icon: 'success' });
        });
      } catch (err) {
        logError('SchedulePage suspend open slot', err);
        Taro.showToast({ title: '停课失败，请重试', icon: 'none' });
      }
    },
    [currentTime, currentUserId, profile?.id, themeStore.activeTheme],
  );

  /** 恢复上课 */
  const handleResumeClass = useCallback(
    async (classId: string, className: string) => {
      if (!classId) return;
      const confirmCopy = buildResumeClassConfirmContent(className);
      const confirmResult = await Taro.showModal({
        title: confirmCopy.title,
        content: confirmCopy.content,
        confirmText: confirmCopy.confirmText,
        confirmColor: getThemeHexColors(themeStore.activeTheme).primary,
      });
      if (!confirmResult.confirm) return;

      try {
        const updated = await classService.resume(classId);
        if (!updated) {
          Taro.showToast({ title: '恢复失败', icon: 'none' });
          return;
        }
        setClasses((prev) =>
          prev.map((item) => (item.id === classId ? { ...item, status: 'active' } : item)),
        );
        Taro.showToast({ title: '已恢复上课', icon: 'success' });
      } catch (err) {
        logError('SchedulePage resume class', err);
        Taro.showToast({ title: '恢复失败，请重试', icon: 'none' });
      }
    },
    [themeStore.activeTheme],
  );

  const handleConfirmDangerAction = useCallback(async () => {
    const item = dangerActionState.item;
    if (!dangerActionState.type) {
      return;
    }

    if (dangerActionState.type === 'cancel') {
      if (!item) {
        return;
      }
      const classId = item.classId;
      if (!classId) {
        Taro.showToast({ title: '当前课程缺少班级信息', icon: 'none' });
        return;
      }

      const lessonDate = selectedDate.format('YYYY-MM-DD');
      const scheduleInfo = scheduleById[item.id];
      const selectedClass =
        filteredClasses.find((classItem) => classItem.id === item.classId) || null;

      setDangerActionSubmitting(true);
      // 并发锁：已有批量操作执行中则忽略本次（与 submitting 双保险）
      const lock = batchOperationLockRef.current;
      if (lock.isLocked()) {
        setDangerActionSubmitting(false);
        return;
      }
      try {
        await lock.run('cancel-lesson', async () => {
          const students = await classService.getStudents(classId);
          const createdRecords: LessonRecord[] = [];

          for (const student of students) {
            const createdRecord = await lessonRecordService.create({
              teacher_id: scheduleInfo?.teacher_id || currentTeacherId,
              operator_teacher_id: currentTeacherId,
              assistant_teacher_id: scheduleInfo?.assistant_teacher_id || undefined,
              student_id: student.id,
              package_id: '',
              class_id: item.classId,
              lesson_date: lessonDate,
              hours_used: 0,
              status: 'cancelled',
              content: buildCancelLessonRecordContent({
                className: item.className,
                startTime: item.startTime,
                endTime: item.endTime,
              }),
            });

            createdRecords.push(createdRecord);

            const cancelNotify = buildCancelLessonNotifyCopy({
              className: selectedClass?.name || item.className,
              lessonDate,
              startTime: item.startTime,
              endTime: item.endTime,
            });
            const parents = await studentService.getParents(student.id);
            for (const binding of parents) {
              await notificationService.send({
                sender_id: profile?.id || currentUserId,
                receiver_id: binding.parent_id,
                title: cancelNotify.title,
                content: cancelNotify.content,
                related_id: student.id,
              });
            }
          }

          setLessonRecords((prev) => {
            const filtered = prev.filter(
              (record) => !(record.class_id === item.classId && record.lesson_date === lessonDate),
            );
            return [...filtered, ...createdRecords];
          });
          closeDangerActionDialog();
          Taro.showToast({ title: '已取消本次课程', icon: 'success' });
        });
      } catch (err) {
        logError('SchedulePage cancel lesson', err);
        Taro.showToast({ title: '取消失败，请重试', icon: 'none' });
      } finally {
        setDangerActionSubmitting(false);
      }
      return;
    }

    if (dangerActionState.type === 'batch-delete') {
      const targetClasses = selectedBatchClasses;
      if (targetClasses.length === 0) {
        Taro.showToast({ title: '请至少选择一个班级', icon: 'none' });
        return;
      }

      setDangerActionSubmitting(true);
      const successIds: string[] = [];
      const failedNames: string[] = [];

      try {
        for (const classItem of targetClasses) {
          try {
            const students = await classService.getStudents(classItem.id);
            await classService.remove(classItem.id);

            for (const student of students) {
              const dissolveNotify = buildDissolveClassNotifyContent(classItem.name);
              await notifyStudentAndParents(
                student.id,
                dissolveNotify.title,
                dissolveNotify.content,
              );
            }

            successIds.push(classItem.id);
          } catch (err) {
            logError('SchedulePage batch delete class', err);
            failedNames.push(classItem.name);
          }
        }

        if (successIds.length > 0) {
          setClasses((prev) => prev.filter((classItem) => !successIds.includes(classItem.id)));
          setSchedules((prev) =>
            prev.filter((scheduleItem) => !successIds.includes(scheduleItem.class_id || '')),
          );
          if (successIds.includes(selectedClassId)) {
            setSelectedClassId(FILTER_ALL_CLASS);
          }
        }

        closeDangerActionDialog();
        setBatchClassSheetVisible(false);
        setBatchSelectedClassIds([]);

        // 审计日志（用户口径 2026-08-22）：解散班级属高影响操作（解除学员分班+发通知）
        if (successIds.length > 0) {
          try {
            const names = selectedBatchClasses
              .filter((c) => successIds.includes(c.id))
              .map((c) => c.name);
            await auditLogService.record({
              action: 'class.dissolve',
              operatorId: profile?.id || '',
              operatorName: profile?.name || '未知',
              operatorRole: profile?.currentContext?.role || 'unknown',
              targetType: 'class',
              targetId: successIds.join(','),
              detail: `解散班级 ${successIds.length} 个：${names.join('、')}`,
              meta: { classIds: successIds, classNames: names },
            });
          } catch (e) {
            logError('audit class.dissolve', e);
          }
        }

        if (failedNames.length === 0) {
          Taro.showToast({ title: `已删除 ${successIds.length} 个班级`, icon: 'success' });
        } else if (successIds.length === 0) {
          Taro.showToast({ title: '删除失败，请重试', icon: 'none' });
        } else {
          Taro.showToast({
            title: `${successIds.length}个已删除，${failedNames.length}个失败`,
            icon: 'none',
            duration: 3000,
          });
        }
      } finally {
        setDangerActionSubmitting(false);
      }
      return;
    }

    if (!item) {
      return;
    }

    setDangerActionSubmitting(true);
    try {
      await scheduleService.remove(item.id);
      setSchedules((prev) => prev.filter((schedule) => schedule.id !== item.id));
      closeDangerActionDialog();
      Taro.showToast({ title: '排课规则已删除', icon: 'success' });
      void calendarSyncService.syncAfterScheduleChange({
        userId: currentUserId,
        teacherId: currentUserId,
        campusId: currentCampusId,
        role: profile?.currentContext?.role,
      });
    } catch (err) {
      logError('SchedulePage remove schedule', err);
      Taro.showToast({ title: '删除失败，请重试', icon: 'none' });
    } finally {
      setDangerActionSubmitting(false);
    }
  }, [
    filteredClasses,
    closeDangerActionDialog,
    currentCampusId,
    currentTeacherId,
    currentUserId,
    dangerActionState.item,
    dangerActionState.type,
    notifyStudentAndParents,
    profile?.id,
    profile?.name,
    profile?.currentContext?.role,
    scheduleById,
    selectedBatchClasses,
    selectedClassId,
    selectedDate,
  ]);

  const handleCreateSchedule = useCallback(
    (sourceMode?: string) => {
      const mode = sourceMode || activeTab?.mode || 'class';
      Taro.navigateTo({
        url: `/package-course/pages/schedule-form/index?sourceMode=${encodeURIComponent(mode)}`,
      });
    },
    [activeTab?.mode],
  );

  /** 预约视图：打开老师预约开关列表弹窗 */
  const handleManageBookingConfig = useCallback(() => {
    setTeacherSwitchSheetVisible(true);
  }, []);

  const handleBatchAction = useCallback(() => {
    const initialSelectedIds =
      selectedClassId && selectedClassId !== FILTER_ALL_CLASS ? [selectedClassId] : [];
    setBatchSelectedClassIds(initialSelectedIds);
    setBatchActionSheetVisible(true);
  }, [selectedClassId]);

  const renderDateCards = useCallback(
    (date: dayjs.Dayjs) => {
      const cards = buildCardsForDate(date);
      return { cards, summary: summarizeScheduleCards(cards) };
    },
    [buildCardsForDate],
  );

  const renderSwiperItem = useCallback(
    (date: dayjs.Dayjs) => {
      const { cards, summary } = renderDateCards(date);

      return (
        <View className="h-full bg-muted">
          <ScrollView
            className="h-full"
            scrollY
            enhanced
            showScrollbar={false}
            onScroll={() => setOpenCardId(null)}
          >
            <View className="min-h-full">
              <View className="px-[24rpx] py-[12rpx]">
                <Text className="text-[28rpx] text-foreground-secondary">
                  共<Text className="font-semibold text-schedule-header">{summary.total}</Text>
                  节课，
                  <Text className="ml-[8rpx]">已点名：</Text>
                  <Text className="font-semibold text-foreground-secondary">{summary.checked}</Text>
                  节，
                  <Text className="ml-[8rpx]">未点名：</Text>
                  <Text className="font-semibold text-schedule-header">{summary.unchecked}</Text>节
                </Text>
              </View>

              <View className="px-[24rpx] pb-[160rpx] pt-[12rpx]">
                {loading && cards.length === 0 ? (
                  <View className="py-[120rpx] flex items-center justify-center">
                    <Text className="text-[28rpx] text-muted-foreground">课表加载中...</Text>
                  </View>
                ) : null}

                {!loading && cards.length === 0 ? (
                  <View className="rounded-[16rpx] bg-card py-[80rpx] shadow-card">
                    <Empty icon="mdi-calendar-blank" description="当前日期暂无课程安排" />
                  </View>
                ) : null}

                <View className="flex flex-col gap-[14rpx]">
                  {cards.map((item) => {
                    const actionVisibility = getCardActionVisibility(item, date, currentTime);
                    const isCancelled = item.status === 'cancelled';
                    const cardBody = (
                      <ScheduleCard
                        item={item}
                        showShare={!isParent && item.status !== 'cancelled'}
                        onSharePrepare={
                          isParent
                            ? undefined
                            : (card) => {
                                pendingShareRef.current = {
                                  type: 'class_lesson',
                                  teacherId: currentTeacherId || currentUserId,
                                  campusId:
                                    card.campusId ||
                                    currentCampusId ||
                                    profile?.currentContext?.campusId ||
                                    '',
                                  classId: card.classId || '',
                                  className: card.className,
                                  scheduleId: card.id,
                                  date: date.format('YYYY-MM-DD'),
                                  start: card.startTime,
                                  end: card.endTime,
                                };
                              }
                        }
                        metaAction={
                          isParent ? (
                            item.status !== 'cancelled' && isUpcomingClassCard(item.status) ? (
                              <ScheduleActionButton
                                label="请假"
                                variant="neutral"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  runCardButtonAction(() => {
                                    const lessonKey = `${item.id}:${date.format('YYYY-MM-DD')}`;
                                    const studentId = item.students?.[0]?.id || '';
                                    const query = [
                                      studentId ? `studentId=${encodeURIComponent(studentId)}` : '',
                                      `lessonKey=${encodeURIComponent(lessonKey)}`,
                                      item.classId
                                        ? `classId=${encodeURIComponent(item.classId)}`
                                        : '',
                                    ]
                                      .filter(Boolean)
                                      .join('&');
                                    void Taro.navigateTo({
                                      url: `/package-course/pages/leave-request/index?${query}`,
                                    });
                                  });
                                }}
                              />
                            ) : undefined
                          ) : item.status === 'cancelled' ? undefined : isHistoricalClassCard(
                              item.status,
                              date,
                              currentTime,
                            ) ? (
                            canOperateHistoricalLesson(date, currentTime) ? (
                              <ScheduleActionButton
                                label="补录"
                                variant="neutral"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  runCardButtonAction(() => handleSupplement(item, date));
                                }}
                              />
                            ) : undefined
                          ) : (
                            <ScheduleActionButton
                              label={item.status === 'urgent' ? '立即点名' : '点名'}
                              variant="attend"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                runCardButtonAction(() => handleRollCall(item, date));
                              }}
                            />
                          )
                        }
                        footerAction={
                          isParent || !isUpcomingClassCard(item.status) ? undefined : (
                            <View
                              className="flex min-h-[48rpx] items-center px-[4rpx] active:opacity-70"
                              hoverStopPropagation
                              onClick={(e) => {
                                e.stopPropagation();
                                runCardButtonAction(() => handleOpenBookSheet(item));
                              }}
                            >
                              <Text className="text-[24rpx] text-primary">约试听/补课</Text>
                              <Text className="ml-[2rpx] text-[24rpx] text-primary">›</Text>
                            </View>
                          )
                        }
                        showStudentRow={
                          item.status !== 'cancelled' &&
                          (isUpcomingClassCard(item.status) ||
                            item.status === 'active' ||
                            (item.students?.length || 0) > 0)
                        }
                      />
                    );

                    if (isParent) {
                      const openLeave = () => {
                        if (item.status === 'cancelled') return;
                        const lessonKey = `${item.id}:${date.format('YYYY-MM-DD')}`;
                        const studentId = item.students?.[0]?.id || '';
                        const query = [
                          studentId ? `studentId=${encodeURIComponent(studentId)}` : '',
                          `lessonKey=${encodeURIComponent(lessonKey)}`,
                          item.classId ? `classId=${encodeURIComponent(item.classId)}` : '',
                        ]
                          .filter(Boolean)
                          .join('&');
                        void Taro.navigateTo({
                          url: `/package-course/pages/leave-request/index?${query}`,
                        });
                      };
                      return (
                        <View key={item.id} className="rounded-[16rpx]" onClick={openLeave}>
                          {cardBody}
                        </View>
                      );
                    }

                    return (
                      <SwappableScheduleCard
                        key={item.id}
                        cardId={item.id}
                        openCardId={openCardId}
                        onOpenChange={setOpenCardId}
                        onClick={() => handlePrimaryAction(item, date)}
                        actions={[
                          {
                            label: '编辑',
                            variant: 'default',
                            onClick: () => handleEditSchedule(item),
                            disabled: !actionVisibility.showEditAndReschedule,
                          },
                          {
                            label: '停课',
                            variant: 'warning',
                            onClick: () => {
                              void handleSuspendLesson(item);
                            },
                            disabled: !canSuspendThisLesson(item, date, currentTime),
                          },
                          {
                            label: '调课',
                            variant: 'warning',
                            onClick: () => handleClassReschedule(item),
                            disabled: !actionVisibility.showEditAndReschedule,
                          },
                          isCancelled
                            ? {
                                label: '恢复',
                                variant: 'warning',
                                onClick: () => void handleRestoreLesson(item),
                              }
                            : {
                                label: '取消',
                                variant: 'danger',
                                onClick: () => void handleCancelLesson(item),
                                disabled: !actionVisibility.showCancelLesson,
                              },
                        ]}
                      >
                        {cardBody}
                      </SwappableScheduleCard>
                    );
                  })}
                </View>

                {!isParent && pausedClasses.length > 0 ? (
                  <View className="mt-[28rpx] flex flex-col gap-[14rpx]">
                    <Text className="px-[4rpx] text-[24rpx] text-muted-foreground">已停课班级</Text>
                    {pausedClasses.map((cls) => (
                      <View
                        key={cls.id}
                        className="flex items-center gap-[16rpx] rounded-[16rpx] bg-card px-[24rpx] py-[22rpx] shadow-card"
                      >
                        <View className="min-w-0 flex-1">
                          <Text className="block text-[28rpx] font-medium text-foreground truncate">
                            {cls.name}
                          </Text>
                          <Text className="mt-[4rpx] block text-[22rpx] text-muted-foreground">
                            停课中 · 课表已隐藏排课
                          </Text>
                        </View>
                        <View
                          className="shrink-0 rounded-[12rpx] bg-primary px-[22rpx] py-[12rpx] active:opacity-85"
                          onClick={() => void handleResumeClass(cls.id, cls.name)}
                        >
                          <Text className="text-[24rpx] font-semibold text-primary-foreground">
                            恢复上课
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            </View>
          </ScrollView>
        </View>
      );
    },
    [
      renderDateCards,
      loading,
      currentTime,
      openCardId,
      handleOpenBookSheet,
      runCardButtonAction,
      handlePrimaryAction,
      handleRollCall,
      handleSupplement,
      handleEditSchedule,
      handleClassReschedule,
      handleCancelLesson,
      handleRestoreLesson,
      handleSuspendLesson,
      handleResumeClass,
      pausedClasses,
      isParent,
    ],
  );

  const toggleBatchClassSelection = useCallback((classId: string) => {
    setBatchSelectedClassIds((prev) =>
      prev.includes(classId) ? prev.filter((id) => id !== classId) : [...prev, classId],
    );
  }, []);

  const handleSelectAllBatchClasses = useCallback(() => {
    setBatchSelectedClassIds((prev) =>
      prev.length === batchClassOptions.length ? [] : batchClassOptions.map((item) => item.id),
    );
  }, [batchClassOptions]);

  const handleChooseBatchType = useCallback(
    (type: BatchActionType) => {
      setBatchActionType(type);
      setBatchActionSheetVisible(false);
      if (type === 'reschedule') {
        if (selectedDate.isBefore(currentTime, 'day')) {
          Taro.showToast({ title: '过去的日期不能批量调课', icon: 'none' });
          return;
        }
        const date = encodeURIComponent(selectedDate.format('YYYY-MM-DD'));
        const classId = encodeURIComponent(selectedClassId || '');
        void Taro.navigateTo({
          url: `/package-course/pages/batch-reschedule-select/index?date=${date}&classId=${classId}`,
        });
        return;
      }
      setBatchClassSheetVisible(true);
    },
    [currentTime, selectedClassId, selectedDate],
  );

  const handleConfirmBatchClassSelection = useCallback(() => {
    if (batchSelectedClassIds.length === 0) {
      Taro.showToast({ title: '请至少选择一个班级', icon: 'none' });
      return;
    }

    setDangerActionState({
      visible: true,
      type: 'batch-delete',
      item: null,
    });
  }, [batchSelectedClassIds.length]);

  const handleOpenClassSlotConfig = useCallback((classId: string, dateStr: string) => {
    const date = encodeURIComponent(dateStr);
    void Taro.navigateTo({
      url: `/package-lead/pages/class-slot-config/index?classId=${encodeURIComponent(classId)}&date=${date}`,
    });
  }, []);

  const handleProxyBooking = useCallback(
    (slot: ClassBookingSlot) => {
      const date = encodeURIComponent(slot.lesson_date);
      const time = encodeURIComponent(slot.start_time);
      const endTime = encodeURIComponent(slot.end_time || '');
      const className = encodeURIComponent(slot.class_name || '');
      const subjectId = filteredClasses.find((item) => item.id === slot.class_id)?.subject_id || '';
      void Taro.navigateTo({
        url:
          `/package-lead/pages/proxy-booking-form/index?teacherId=${encodeURIComponent(slot.teacher_id)}` +
          `&date=${date}&time=${time}&endTime=${endTime}&mode=group` +
          `&classId=${encodeURIComponent(slot.class_id)}&className=${className}` +
          `&subjectId=${encodeURIComponent(subjectId)}`,
      });
    },
    [filteredClasses],
  );

  /** 开放预约：左滑编辑时段 — 跳转到简约表单编辑页 */
  const handleEditOpenSlot = useCallback((slot: ClassBookingSlot) => {
    const date = encodeURIComponent(slot.lesson_date);
    void Taro.navigateTo({
      url:
        `/package-lead/pages/open-slot-edit/index?slotId=${encodeURIComponent(slot.id)}` +
        `&classId=${encodeURIComponent(slot.class_id)}&date=${date}`,
    });
  }, []);

  /** 家长端：团课开放时段预约 */
  const handleParentBookOpenSlot = useCallback(
    async (slot: ClassBookingSlot) => {
      if (!profile?.id) {
        Taro.showToast({ title: '请先登录', icon: 'none' });
        return;
      }
      if (slot.status === 'rest') {
        Taro.showToast({ title: '该时段休息中', icon: 'none' });
        return;
      }
      if (slot.status === 'full' || slot.current_count >= slot.max_count) {
        Taro.showToast({ title: '名额已满', icon: 'none' });
        return;
      }

      try {
        const kids = await studentService.getByParent(profile.id);
        if (kids.length === 0) {
          Taro.showToast({ title: '暂无绑定学员', icon: 'none' });
          return;
        }

        let student = kids[0];
        if (kids.length > 1) {
          const sheet = await Taro.showActionSheet({
            itemList: kids.map((k) => k.name),
          });
          student = kids[sheet.tapIndex];
        }

        const alreadyBooked = (slot.booking_students || []).some((s) => s.id === student.id);
        if (alreadyBooked) {
          Taro.showToast({ title: '已预约该时段', icon: 'none' });
          return;
        }

        const created = await classBookingService.addBookingRecord(slot.id, student.id);
        // 本地仅缓存展示；真相源为 class-booking record id
        upsertParentBooking({
          id: created.id || `pb-${slot.id}-${student.id}`,
          userId: profile.id,
          studentId: student.id,
          studentName: student.name,
          occurrenceKey: `${slot.class_id}:${slot.lesson_date}:${slot.start_time}`,
          courseId: slot.class_id,
          courseName: slot.class_name || '团课',
          courseType: 'group',
          classId: slot.class_id,
          campusId: slot.campus_id,
          lessonDate: slot.lesson_date,
          timeRange: `${slot.start_time}-${slot.end_time}`,
          teacherName: slot.teacher_name || '老师',
          deadline: dayjs(`${slot.lesson_date} ${slot.start_time}`)
            .subtract(1, 'hour')
            .toISOString(),
          campusName:
            campuses.find((c) => c.id === (slot.campus_id || currentCampusId))?.name || '校区',
          room: slot.room,
          status: 'booked',
          createdAt: created.created_at || new Date().toISOString(),
        });

        await loadOpenClassSlots(dayjs(slot.lesson_date), true);
        Taro.showToast({ title: '预约成功', icon: 'success' });
      } catch (err) {
        logError('parent book open slot', err);
        Taro.showToast({ title: '预约失败', icon: 'none' });
      }
    },
    [campuses, currentCampusId, loadOpenClassSlots, profile],
  );

  /** 家长端：取消团课预约 */
  const handleParentCancelOpenSlot = useCallback(
    async (slot: ClassBookingSlot) => {
      if (!profile?.id) {
        Taro.showToast({ title: '请先登录', icon: 'none' });
        return;
      }
      try {
        const kids = await studentService.getByParent(profile.id);
        const kidIds = new Set(kids.map((k) => k.id));
        const bookedKids = (slot.booking_students || []).filter((s) => kidIds.has(s.id));
        if (bookedKids.length === 0) {
          Taro.showToast({ title: '未预约该时段', icon: 'none' });
          return;
        }

        let student = bookedKids[0];
        if (bookedKids.length > 1) {
          const sheet = await Taro.showActionSheet({
            itemList: bookedKids.map((k) => k.name),
          });
          student = bookedKids[sheet.tapIndex];
        }

        const { confirm } = await Taro.showModal({
          title: '取消预约',
          content: `确认取消「${student.name}」该时段的预约？`,
        });
        if (!confirm) return;

        const records = await classBookingService.getRecordsBySlot(slot.id);
        const record = records.find((r) => r.student_id === student.id && r.status !== 'cancelled');
        if (record) {
          await classBookingService.removeBookingRecord(record.id);
          updateParentBookingStatus(record.id, 'cancelled');
        }
        // 兼容旧本地草稿 id
        updateParentBookingStatus(`pb-${slot.id}-${student.id}`, 'cancelled');

        await loadOpenClassSlots(dayjs(slot.lesson_date), true);
        Taro.showToast({ title: '已取消预约', icon: 'success' });
      } catch (err) {
        logError('parent cancel open slot', err);
        Taro.showToast({ title: '取消失败', icon: 'none' });
      }
    },
    [loadOpenClassSlots, profile],
  );
  /** 开放预约：左滑取消 — 将活跃/已满时段设为休息 */
  const handleCancelOpenSlot = useCallback(async (slot: ClassBookingSlot) => {
    if (slot.status === 'rest') return;
    try {
      await classBookingService.updateSlotStatus(slot.id, 'rest');
      setOpenClassSlots((prev) => {
        const next = { ...prev };
        const dateKey = slot.lesson_date;
        if (next[dateKey]) {
          next[dateKey] = { ...next[dateKey] };
          const classSlots = next[dateKey][slot.class_id];
          if (classSlots) {
            next[dateKey][slot.class_id] = classSlots.map((s) =>
              s.id === slot.id ? { ...s, status: 'rest' as const } : s,
            );
          }
        }
        return next;
      });
      Taro.showToast({ title: '已设为休息', icon: 'success' });
    } catch (err) {
      logError('cancel open slot', err);
      Taro.showToast({ title: '操作失败', icon: 'none' });
    }
  }, []);

  /** 开放预约：左滑恢复 — 将休息时段恢复为活跃 */
  const handleRestoreOpenSlot = useCallback(async (slot: ClassBookingSlot) => {
    if (slot.status !== 'rest') return;
    try {
      await classBookingService.updateSlotStatus(slot.id, 'active');
      setOpenClassSlots((prev) => {
        const next = { ...prev };
        const dateKey = slot.lesson_date;
        if (next[dateKey]) {
          next[dateKey] = { ...next[dateKey] };
          const classSlots = next[dateKey][slot.class_id];
          if (classSlots) {
            next[dateKey][slot.class_id] = classSlots.map((s) =>
              s.id === slot.id ? { ...s, status: 'active' as const } : s,
            );
          }
        }
        return next;
      });
      Taro.showToast({ title: '已恢复开放', icon: 'success' });
    } catch (err) {
      logError('restore open slot', err);
      Taro.showToast({ title: '操作失败', icon: 'none' });
    }
  }, []);

  const renderOpenClassList = useCallback(
    (date: dayjs.Dayjs) => {
      const dateStr = date.format('YYYY-MM-DD');
      const openClasses = filteredClasses.filter((item) => item.schedule_mode === 'open');
      const dateSlots = openClassSlots[dateStr] || {};
      const isDateLoading = loadingOpenSlotDates.has(dateStr);
      const isDateError = errorOpenSlotDates.has(dateStr);
      // 用户口径（2026-08-23）：休息（rest）不产生约课，列表不渲染 rest 卡片；
      // 全天休息的日期自然显示"当前日期暂无开放预约时段"空态
      // 停课班级的时段亦不展示（底部「已停课班级」可恢复）
      const pausedClassIds = new Set(
        openClasses.filter((item) => item.status === 'paused').map((item) => item.id),
      );
      const allSlots = Object.values(dateSlots)
        .flat()
        .filter((s) => s.status !== 'rest' && !pausedClassIds.has(s.class_id))
        .sort(
          (left, right) =>
            parseTimeToMinutes(left.start_time) - parseTimeToMinutes(right.start_time),
        );
      const summaryFullSlots = allSlots.filter((s) => s.status === 'full').length;
      const summaryActiveSlots = allSlots.filter((s) => s.status === 'active').length;
      const openClassMap = openClasses.reduce<Record<string, Class>>((acc, cls) => {
        acc[cls.id] = cls;
        return acc;
      }, {});

      return (
        <View className="h-full bg-muted">
          <ScrollView
            className="h-full"
            scrollY
            enhanced
            showScrollbar={false}
            onScroll={() => setOpenCardId(null)}
          >
            <View className="min-h-full">
              <View className="px-[24rpx] py-[12rpx]">
                <Text className="text-[28rpx] text-foreground-secondary">
                  共<Text className="font-semibold text-schedule-header">{allSlots.length}</Text>
                  个时段，
                  <Text className="ml-[8rpx]">已约满：</Text>
                  <Text className="font-semibold text-foreground-secondary">
                    {summaryFullSlots}
                  </Text>
                  个，
                  <Text className="ml-[8rpx]">可预约：</Text>
                  <Text className="font-semibold text-schedule-header">{summaryActiveSlots}</Text>个
                </Text>
              </View>

              <View className="px-[24rpx] pb-[160rpx] pt-[12rpx]">
                {isDateLoading && allSlots.length === 0 ? (
                  <View className="py-[120rpx] flex items-center justify-center">
                    <Text className="text-[28rpx] text-muted-foreground">开放班级加载中...</Text>
                  </View>
                ) : null}

                {isDateError && allSlots.length === 0 ? (
                  <View className="py-[120rpx] flex flex-col items-center justify-center gap-[16rpx]">
                    <Text className="text-[28rpx] text-muted-foreground">开放班级加载失败</Text>
                    <Button
                      className="m-0 h-[64rpx] px-[32rpx] text-[28rpx] leading-[64rpx] rounded-[32rpx] bg-primary text-primary-foreground"
                      onClick={() => loadOpenClassSlots(date, true)}
                    >
                      点击重试
                    </Button>
                  </View>
                ) : null}

                {!isDateLoading && !isDateError && allSlots.length === 0 ? (
                  <View className="rounded-[16rpx] bg-card py-[80rpx] shadow-card">
                    <Empty icon="mdi-calendar-blank" description="当前日期暂无开放预约时段" />
                  </View>
                ) : null}

                <View className="flex flex-col gap-[14rpx]">
                  {allSlots.map((slot) => {
                    const cls = openClassMap[slot.class_id];
                    const teacherName =
                      cls?.teachers
                        ?.map((id) => teacherById[id]?.name)
                        .filter(Boolean)
                        .join('、') ||
                      teacherById[cls?.teacher_id || '']?.name ||
                      slot.teacher_name ||
                      '未分配老师';
                    const duration = getDurationText(slot.start_time, slot.end_time);
                    const isRest = slot.status === 'rest';
                    const isSlotInProgress =
                      !isRest &&
                      date.isSame(currentTime, 'day') &&
                      (() => {
                        const nowMinutes = currentTime.hour() * 60 + currentTime.minute();
                        const startMinutes = parseTimeToMinutes(slot.start_time);
                        const endMinutes = parseTimeToMinutes(slot.end_time);
                        return nowMinutes >= startMinutes && nowMinutes <= endMinutes;
                      })();

                    return isParent ? (
                      <View
                        key={slot.id}
                        className={cn(
                          'rounded-[24rpx] px-[24rpx] py-[20rpx] shadow-card',
                          isRest ? 'bg-muted border border-border' : 'bg-card',
                        )}
                      >
                        <View className="flex">
                          {/* 左侧时间轴 */}
                          <View className="flex w-[116rpx] flex-shrink-0 flex-col items-center py-[2rpx]">
                            <View className="flex items-center gap-[8rpx]">
                              <View className="h-[12rpx] w-[12rpx] rounded-full bg-foreground" />
                              <Text className="text-[34rpx] font-bold leading-none text-foreground">
                                {slot.start_time}
                              </Text>
                            </View>
                            <View className="flex w-[2rpx] flex-1 flex-col items-center py-[4rpx]">
                              <View className="w-[2rpx] flex-1 bg-border" />
                              {duration ? (
                                <View className="py-[2rpx]">
                                  <Text className="text-[22rpx] text-muted-foreground">
                                    {duration}
                                  </Text>
                                </View>
                              ) : null}
                              <View className="w-[2rpx] flex-1 bg-border" />
                            </View>
                            <View className="flex items-center gap-[8rpx]">
                              <View className="h-[12rpx] w-[12rpx] rounded-full border-[3rpx] border-foreground bg-transparent" />
                              <Text className="text-[34rpx] font-bold leading-none text-foreground">
                                {slot.end_time}
                              </Text>
                            </View>
                          </View>

                          {/* 右侧内容 */}
                          <View className="relative ml-[16rpx] flex flex-1 flex-col justify-between">
                            <View>
                              <View className="flex flex-wrap items-center gap-[12rpx]">
                                <Text className="text-[36rpx] font-bold leading-tight text-foreground">
                                  {cls?.name || slot.class_name || '未命名班级'}
                                </Text>
                                {/* 团课无试听：状态标签仅「上课中」（预约满/可约用人数区表达） */}
                                {isSlotInProgress ? (
                                  <View className="course-tag-active rounded-full flex items-center shrink-0 whitespace-nowrap px-[14rpx] py-[4rpx]">
                                    <Text className="text-[20rpx] font-medium">上课中</Text>
                                  </View>
                                ) : null}
                              </View>
                              <View className="mt-[12rpx] flex flex-wrap items-center gap-[12rpx]">
                                {cls?.level ? (
                                  <View className={CLASS_LEVEL_BADGE_WRAP}>
                                    <Text className={CLASS_LEVEL_BADGE_TEXT}>
                                      {CLASS_LEVEL_LABELS[cls.level]}
                                    </Text>
                                  </View>
                                ) : null}
                                {slot.room ? (
                                  <View className="flex items-center gap-[6rpx] rounded-[10rpx] bg-muted px-[14rpx] py-[6rpx]">
                                    <Icon
                                      name="mdi-map-marker"
                                      size={18}
                                      color="hsl(var(--muted-foreground))"
                                    />
                                    <Text className="text-[24rpx] font-medium leading-none text-muted-foreground">
                                      {slot.room}
                                    </Text>
                                  </View>
                                ) : null}
                              </View>
                            </View>

                            <View className="mt-[12rpx] flex items-center justify-between gap-[12rpx]">
                              <View className="flex min-w-0 flex-1 items-center gap-[12rpx]">
                                <Image
                                  src={BRAND_LOGO}
                                  className="h-[40rpx] w-[40rpx] flex-shrink-0 rounded-full border border-border bg-card"
                                  mode="aspectFit"
                                />
                                <Text className="truncate text-[26rpx] text-foreground">
                                  {teacherName}
                                </Text>
                              </View>
                            </View>
                          </View>
                        </View>

                        {/* 底部：已约人数 + 家长预约 */}
                        <View className="mt-[18rpx] flex items-center justify-between border-t border-border pt-[14rpx]">
                          <View className="flex flex-1 items-center min-w-0 overflow-hidden">
                            {(slot.booking_students || [])
                              .slice(0, OPEN_BOOKING_MAX_VISIBLE_AVATARS)
                              .map((student, index) => (
                                <Image
                                  key={student.id}
                                  src={student.avatar || BRAND_LOGO}
                                  className={cn(
                                    'relative h-[60rpx] w-[60rpx] flex-shrink-0 rounded-full border-2 border-card bg-muted',
                                    index > 0 && '-ml-[16rpx]',
                                  )}
                                  mode="aspectFill"
                                  lazyLoad
                                />
                              ))}
                          </View>

                          <View className="ml-[16rpx] flex flex-shrink-0 items-center gap-[16rpx]">
                            <Text className="text-[30rpx] font-semibold text-foreground">
                              <Text className="text-[34rpx] font-bold text-foreground">
                                {slot.current_count}
                              </Text>
                              <Text className="text-[24rpx] font-medium text-muted-foreground">
                                /{slot.max_count}人
                              </Text>
                            </Text>
                            {(() => {
                              const myKids = classStudentAvatars[slot.class_id] || [];
                              const parentBooked = (slot.booking_students || []).some((s) =>
                                myKids.some((kid) => kid.id === s.id),
                              );
                              if (isRest) return null;
                              if (parentBooked) {
                                return (
                                  <View className="flex items-center gap-[12rpx]">
                                    <View
                                      className="center h-[56rpx] rounded-full bg-muted px-[24rpx] active:opacity-80"
                                      onClick={() => {
                                        const booking = readParentBookings(profile?.id || '').find(
                                          (b) =>
                                            b.classId === slot.class_id &&
                                            b.lessonDate === slot.lesson_date &&
                                            b.timeRange?.startsWith(slot.start_time) &&
                                            b.status === 'booked',
                                        );
                                        if (booking) {
                                          void Taro.navigateTo({
                                            url: `/package-course/pages/booking-record-detail/index?id=${encodeURIComponent(booking.id)}`,
                                          });
                                        } else {
                                          void handleParentCancelOpenSlot(slot);
                                        }
                                      }}
                                    >
                                      <Text className="text-[24rpx] font-medium text-foreground">
                                        详情
                                      </Text>
                                    </View>
                                    <View
                                      className="center h-[56rpx] rounded-full border border-destructive/40 bg-destructive-5 px-[24rpx] active:opacity-80"
                                      onClick={() => void handleParentCancelOpenSlot(slot)}
                                    >
                                      <Text className="text-[24rpx] font-medium text-destructive">
                                        取消
                                      </Text>
                                    </View>
                                  </View>
                                );
                              }
                              if (slot.status === 'full') return null;
                              return (
                                <View
                                  className="center h-[56rpx] rounded-full bg-primary px-[28rpx] active:opacity-80"
                                  onClick={() => void handleParentBookOpenSlot(slot)}
                                >
                                  <Text className="text-[24rpx] font-medium text-white">预约</Text>
                                </View>
                              );
                            })()}
                          </View>
                        </View>
                      </View>
                    ) : (
                      <SwappableScheduleCard
                        key={slot.id}
                        cardId={slot.id}
                        openCardId={openCardId}
                        onOpenChange={setOpenCardId}
                        radiusClassName="rounded-[24rpx]"
                        onClick={() => handleOpenClassSlotConfig(slot.class_id, slot.lesson_date)}
                        actions={[
                          {
                            label: '编辑',
                            variant: 'default',
                            onClick: () => handleEditOpenSlot(slot),
                          },
                          {
                            label: '停课',
                            variant: 'warning',
                            onClick: () =>
                              void handleSuspendOpenSlot(
                                slot,
                                openClassMap[slot.class_id]?.name || slot.class_name || '该班级',
                              ),
                            disabled: !canSuspendOpenSlot(slot, currentTime),
                          },
                          isRest
                            ? {
                                label: '恢复',
                                variant: 'warning',
                                onClick: () => handleRestoreOpenSlot(slot),
                              }
                            : {
                                label: '取消',
                                variant: 'danger',
                                onClick: () => handleCancelOpenSlot(slot),
                              },
                        ]}
                      >
                        <View
                          className={cn(
                            'rounded-[24rpx] px-[24rpx] py-[20rpx] shadow-card',
                            isRest ? 'bg-muted border border-border' : 'bg-card',
                          )}
                        >
                          <View className="flex">
                            <View className="flex w-[116rpx] flex-shrink-0 flex-col items-center py-[2rpx]">
                              <View className="flex items-center gap-[8rpx]">
                                <View className="h-[12rpx] w-[12rpx] rounded-full bg-foreground" />
                                <Text className="text-[34rpx] font-bold leading-none text-foreground">
                                  {slot.start_time}
                                </Text>
                              </View>
                              <View className="flex w-[2rpx] flex-1 flex-col items-center py-[4rpx]">
                                <View className="w-[2rpx] flex-1 bg-border" />
                                {duration ? (
                                  <View className="py-[2rpx]">
                                    <Text className="text-[22rpx] text-muted-foreground">
                                      {duration}
                                    </Text>
                                  </View>
                                ) : null}
                                <View className="w-[2rpx] flex-1 bg-border" />
                              </View>
                              <View className="flex items-center gap-[8rpx]">
                                <View className="h-[12rpx] w-[12rpx] rounded-full border-[3rpx] border-foreground bg-transparent" />
                                <Text className="text-[34rpx] font-bold leading-none text-foreground">
                                  {slot.end_time}
                                </Text>
                              </View>
                            </View>

                            <View className="relative ml-[16rpx] flex flex-1 flex-col justify-between">
                              <Button
                                className="absolute -right-[8rpx] -top-[8rpx] z-10 flex h-[48rpx] w-[48rpx] items-center justify-center border-none bg-transparent p-0 leading-none after:border-none active:opacity-60"
                                openType="share"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  pendingShareRef.current = {
                                    type: 'group_slot',
                                    teacherId: slot.teacher_id || currentTeacherId || currentUserId,
                                    campusId:
                                      slot.campus_id ||
                                      cls?.campus_id ||
                                      currentCampusId ||
                                      profile?.currentContext?.campusId ||
                                      '',
                                    classId: slot.class_id,
                                    className: cls?.name || slot.class_name,
                                    slotId: slot.id,
                                    date: slot.lesson_date,
                                    start: slot.start_time,
                                    end: slot.end_time,
                                  };
                                }}
                              >
                                <Icon
                                  name="mdi-share-variant"
                                  size={28}
                                  color="hsl(var(--muted-foreground))"
                                />
                              </Button>

                              <View>
                                <View className="flex flex-wrap items-center gap-[12rpx] pr-[44rpx]">
                                  <Text className="text-[36rpx] font-bold leading-tight text-foreground">
                                    {cls?.name || slot.class_name || '未命名班级'}
                                  </Text>
                                  {isSlotInProgress ? (
                                    <View className="course-tag-active rounded-full flex items-center shrink-0 whitespace-nowrap px-[14rpx] py-[4rpx]">
                                      <Text className="text-[20rpx] font-medium">上课中</Text>
                                    </View>
                                  ) : null}
                                </View>
                                <View className="mt-[12rpx] flex flex-wrap items-center gap-[12rpx]">
                                  {cls?.level ? (
                                    <View className={CLASS_LEVEL_BADGE_WRAP}>
                                      <Text className={CLASS_LEVEL_BADGE_TEXT}>
                                        {CLASS_LEVEL_LABELS[cls.level]}
                                      </Text>
                                    </View>
                                  ) : null}
                                  {slot.room ? (
                                    <View className="flex items-center gap-[6rpx] rounded-[10rpx] bg-muted px-[14rpx] py-[6rpx]">
                                      <Icon
                                        name="mdi-map-marker"
                                        size={18}
                                        color="hsl(var(--muted-foreground))"
                                      />
                                      <Text className="text-[24rpx] font-medium leading-none text-muted-foreground">
                                        {slot.room}
                                      </Text>
                                    </View>
                                  ) : null}
                                </View>
                              </View>

                              <View className="mt-[12rpx] flex items-center justify-between gap-[12rpx]">
                                <View className="flex min-w-0 flex-1 items-center gap-[12rpx]">
                                  <Image
                                    src={BRAND_LOGO}
                                    className="h-[40rpx] w-[40rpx] flex-shrink-0 rounded-full border border-border bg-card"
                                    mode="aspectFit"
                                  />
                                  <Text className="truncate text-[26rpx] text-foreground">
                                    {teacherName}
                                  </Text>
                                </View>
                                {!isRest ? (
                                  <View hoverStopPropagation onClick={(e) => e.stopPropagation()}>
                                    <ScheduleActionButton
                                      label="点名"
                                      variant="attend"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        runCardButtonAction(() => handleOpenSlotRollCall(slot));
                                      }}
                                    />
                                  </View>
                                ) : null}
                              </View>
                            </View>
                          </View>

                          <View className="mt-[18rpx] flex items-center justify-between border-t border-border pt-[14rpx]">
                            <View className="flex flex-1 items-center min-w-0 overflow-hidden">
                              {(slot.booking_students || [])
                                .slice(0, OPEN_BOOKING_MAX_VISIBLE_AVATARS)
                                .map((student, index) => (
                                  <Image
                                    key={student.id}
                                    src={student.avatar || BRAND_LOGO}
                                    className={cn(
                                      'relative h-[60rpx] w-[60rpx] flex-shrink-0 rounded-full border-2 border-card bg-muted',
                                      index > 0 && '-ml-[16rpx]',
                                    )}
                                    mode="aspectFill"
                                    lazyLoad
                                  />
                                ))}
                              <View
                                className="relative flex h-[60rpx] w-[60rpx] flex-shrink-0 items-center justify-center rounded-full border border-border bg-muted active:opacity-80"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleProxyBooking(slot);
                                }}
                              >
                                <Icon
                                  name="mdi-plus"
                                  size={30}
                                  color="hsl(var(--muted-foreground))"
                                />
                              </View>
                            </View>
                            <Text className="ml-[24rpx] flex-shrink-0 text-[30rpx] font-semibold text-foreground">
                              <Text className="text-[34rpx] font-bold text-foreground">
                                {slot.current_count}
                              </Text>
                              <Text className="text-[24rpx] font-medium text-muted-foreground">
                                /{slot.max_count}人
                              </Text>
                            </Text>
                          </View>
                        </View>
                      </SwappableScheduleCard>
                    );
                  })}
                </View>

                {!isParent && openClasses.some((item) => item.status === 'paused') ? (
                  <View className="mt-[28rpx] flex flex-col gap-[14rpx]">
                    <Text className="px-[4rpx] text-[24rpx] text-muted-foreground">已停课班级</Text>
                    {openClasses
                      .filter((item) => item.status === 'paused')
                      .map((cls) => (
                        <View
                          key={cls.id}
                          className="flex items-center gap-[16rpx] rounded-[24rpx] bg-card px-[24rpx] py-[22rpx] shadow-card"
                        >
                          <View className="min-w-0 flex-1">
                            <Text className="block truncate text-[28rpx] font-medium text-foreground">
                              {cls.name}
                            </Text>
                            <Text className="mt-[4rpx] block text-[22rpx] text-muted-foreground">
                              停课中 · 开放时段已隐藏
                            </Text>
                          </View>
                          <View
                            className="shrink-0 rounded-[12rpx] bg-primary px-[22rpx] py-[12rpx] active:opacity-85"
                            onClick={() => void handleResumeClass(cls.id, cls.name)}
                          >
                            <Text className="text-[24rpx] font-semibold text-primary-foreground">
                              恢复上课
                            </Text>
                          </View>
                        </View>
                      ))}
                  </View>
                ) : null}
              </View>
            </View>
          </ScrollView>
        </View>
      );
    },
    [
      filteredClasses,
      openClassSlots,
      loadingOpenSlotDates,
      errorOpenSlotDates,
      openCardId,
      teacherById,
      currentTime,
      loadOpenClassSlots,
      handleOpenClassSlotConfig,
      handleProxyBooking,
      handleOpenSlotRollCall,
      handleEditOpenSlot,
      handleCancelOpenSlot,
      handleRestoreOpenSlot,
      handleSuspendOpenSlot,
      handleResumeClass,
      runCardButtonAction,
      handleParentBookOpenSlot,
      handleParentCancelOpenSlot,
      isParent,
      currentCampusId,
      currentTeacherId,
      currentUserId,
      profile?.id,
      profile?.currentContext?.campusId,
      classStudentAvatars,
    ],
  );

  /** 场地 Tab 内容渲染（按当前日期展示可预约场地） */
  const renderVenueTab = useCallback(
    (_date: dayjs.Dayjs) => {
      if (loadingVenues) {
        return (
          <View className="py-[120rpx] flex items-center justify-center">
            <Text className="text-[28rpx] text-muted-foreground">场地加载中...</Text>
          </View>
        );
      }

      if (venues.length === 0) {
        return (
          <View className="px-[24rpx]">
            <View className="rounded-[16rpx] bg-card py-[80rpx] shadow-card">
              <Empty icon="mdi-map-marker-outline" description="暂无可用场地" />
            </View>
          </View>
        );
      }

      return (
        <View className="flex flex-col gap-[14rpx] px-[24rpx] pb-[160rpx] pt-[12rpx]">
          {venues.map((venue) => (
            <VenueBookingCard
              key={venue.id}
              venue={venue}
              onClick={() => {
                Taro.navigateTo({
                  url: `/package-course/pages/venue-booking/index?roomId=${encodeURIComponent(venue.id)}`,
                });
              }}
              onBook={() => {
                Taro.navigateTo({
                  url: `/package-course/pages/venue-booking/index?roomId=${encodeURIComponent(venue.id)}`,
                });
              }}
            />
          ))}
        </View>
      );
    },
    [loadingVenues, venues],
  );

  // 注意：不传 safeBottom — pb-safe-bottom 会给外层 View 增加安全区 padding，
  // 使得 PageContainer 总高度（min-h-screen + safe-area）超过视口，
  // 在 tabBar 页面中产生页面级背景滚动条，与 TrialBookingView 内的 ScrollView
  // 形成双滚动条，背景滚动消费垂直手势后影响卡片列表的滚动效果。
  // 底部间距已由各视图内容区的 pb-[160rpx] 处理；排课 FAB 可拖动并记忆位置。
  return (
    <PageContainer className="bg-schedule-page">
      <View
        id="schedule-page-root"
        className="relative h-screen bg-schedule-page flex flex-col overflow-hidden"
      >
        <View className="bg-schedule-header flex-shrink-0">
          <View
            className="flex items-end justify-end px-[18rpx] pb-[18rpx]"
            style={{ height: `${navSafeHeight}px` }}
          />
        </View>

        <View className="bg-schedule-page flex-shrink-0">
          {/* 主分类 Tab：基础模式 + 场地 + 独立展示分类 */}
          <View className="flex items-center px-[24rpx] py-[16rpx]">
            <ScrollView
              id="schedule-tab-scroll"
              className="flex-1 min-w-0 overflow-hidden"
              scrollX
              scrollWithAnimation
              showScrollbar={false}
              enhanced
              scrollLeft={tabScrollLeft}
            >
              <View
                className="flex items-center"
                style={{ width: `${getTabContainerWidth(tabs.length)}rpx` }}
              >
                {tabs.map((tab, index) => {
                  const isActive = activeTabKey === tab.key;
                  const isLast = index === tabs.length - 1;
                  return (
                    <View
                      key={tab.key}
                      className={cn(
                        'flex items-center justify-center rounded-full border py-[12rpx] transition-colors active:scale-95 shrink-0',
                        !isLast && 'mr-[16rpx]',
                        isActive ? 'border-primary/55 bg-primary/10' : 'border-border bg-card',
                      )}
                      style={{ width: `${TAB_WIDTH_RPX}rpx` }}
                      onClick={() => handleMainTabChange(tab.key, index)}
                    >
                      <Text
                        className={cn(
                          'text-[28rpx] font-medium',
                          isActive ? 'text-primary' : 'text-foreground-secondary',
                        )}
                      >
                        {tab.label}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
            <View className="ml-[16rpx] flex flex-shrink-0 items-center gap-[16rpx]">
              {!isParent && (
                <View
                  className="flex items-center gap-[4rpx] active:opacity-70"
                  onClick={handleBatchAction}
                >
                  <Text className="text-[28rpx] text-foreground-secondary">筛选</Text>
                  <Icon name="mdi-chevron-down" size={20} color="mutedForeground" />
                </View>
              )}
              {!isParent && (activeTab?.mode === 'class' || activeTab?.mode === 'group') && (
                <View
                  className="flex h-[56rpx] w-[56rpx] items-center justify-center active:opacity-70"
                  onClick={handleBatchAction}
                >
                  <Icon
                    name="mdi-checkbox-multiple-marked-outline"
                    size={28}
                    color="mutedForeground"
                  />
                </View>
              )}
            </View>
          </View>

          {activeTab?.mode !== 'private' && (
            <CalendarWeekSelector
              selectedDate={selectedDate}
              onChange={handleScheduleDateChange}
              getDateDotType={
                activeTab?.type === 'venue'
                  ? undefined
                  : scheduleSubMode === 'fixed'
                    ? getDateDotType
                    : getOpenDateDotType
              }
            />
          )}
        </View>

        {activeTab?.mode === 'class' && activeTab?.type === 'category' && (
          <Swiper
            className="bg-schedule-page"
            style={{ flex: 1, minHeight: 0 }}
            current={swiperCurrent}
            duration={SCHEDULE_CARD_SWIPER_DURATION}
            easingFunction="easeOutCubic"
            skipHiddenItemLayout
            onChange={handleSwiperChange}
            onAnimationFinish={handleSwiperFinish}
          >
            {scheduleDateWindow.map((date) => (
              <SwiperItem key={date.format('YYYY-MM-DD')} itemId={date.format('YYYY-MM-DD')}>
                {renderSwiperItem(date)}
              </SwiperItem>
            ))}
          </Swiper>
        )}

        {activeTab?.mode === 'group' && activeTab?.type === 'category' && (
          <Swiper
            className="bg-schedule-page"
            style={{ flex: 1, minHeight: 0 }}
            current={swiperCurrent}
            duration={SCHEDULE_CARD_SWIPER_DURATION}
            easingFunction="easeOutCubic"
            skipHiddenItemLayout
            onChange={handleSwiperChange}
            onAnimationFinish={handleSwiperFinish}
          >
            {scheduleDateWindow.map((date) => (
              <SwiperItem key={date.format('YYYY-MM-DD')} itemId={date.format('YYYY-MM-DD')}>
                {renderOpenClassList(date)}
              </SwiperItem>
            ))}
          </Swiper>
        )}

        {(activeTab?.mode === 'class' || activeTab?.mode === 'group') &&
          activeTab?.type === 'category' && (
            <>
              <BottomSheet
                visible={batchActionSheetVisible}
                title="批量处理"
                onClose={() => setBatchActionSheetVisible(false)}
                scrollable={false}
                className="pb-safe-bar"
              >
                <View className="px-[24rpx] py-[18rpx]">
                  <View className="rounded-[18rpx] bg-muted px-[18rpx] py-[16rpx]">
                    <Text className="text-[24rpx] text-muted-foreground">
                      请选择要执行的批量操作
                    </Text>
                  </View>
                </View>
                <View className="px-[24rpx] pb-[32rpx] flex flex-col gap-[18rpx]">
                  <View
                    className="rounded-[22rpx] border border-border bg-muted px-[24rpx] py-[24rpx]"
                    onClick={() => handleChooseBatchType('reschedule')}
                  >
                    <View className="flex items-center justify-between gap-[16rpx]">
                      <View className="flex items-center gap-[16rpx]">
                        <View className="flex h-[80rpx] w-[80rpx] items-center justify-center rounded-[22rpx] bg-card shadow-card">
                          <Icon name="mdi-calendar-check-outline" size="md" color="primary" />
                        </View>
                        <View className="min-w-0 flex-1">
                          <View className="flex items-center gap-[10rpx]">
                            <Text className="text-[30rpx] font-semibold text-foreground">
                              批量调课
                            </Text>
                            <View className="rounded-full bg-card/80 px-[12rpx] py-[6rpx]">
                              <Text className="text-[20rpx] font-medium text-primary">
                                只调当天
                              </Text>
                            </View>
                          </View>
                          <Text className="mt-[8rpx] block text-[24rpx] leading-[34rpx] text-muted-foreground">
                            选择多个班级，将当天课程统一调整到新的日期
                          </Text>
                        </View>
                      </View>
                      <Icon name="mdi-chevron-right" size="sm" color="primary" />
                    </View>
                  </View>
                  <View
                    className="rounded-[22rpx] border border-border bg-muted px-[24rpx] py-[24rpx]"
                    onClick={() => handleChooseBatchType('delete')}
                  >
                    <View className="flex items-center justify-between gap-[16rpx]">
                      <View className="flex items-center gap-[16rpx]">
                        <View className="flex h-[80rpx] w-[80rpx] items-center justify-center rounded-[22rpx] bg-card shadow-card">
                          <Icon name="mdi-delete-outline" size="md" color="destructive" />
                        </View>
                        <View className="min-w-0 flex-1">
                          <View className="flex items-center gap-[10rpx]">
                            <Text className="text-[30rpx] font-semibold text-destructive">
                              批量删除
                            </Text>
                            <View className="rounded-full bg-card/85 px-[12rpx] py-[6rpx]">
                              <Text className="text-[20rpx] font-medium text-destructive">
                                谨慎操作
                              </Text>
                            </View>
                          </View>
                          <Text className="mt-[8rpx] block text-[24rpx] leading-[34rpx] text-muted-foreground">
                            选择多个班级删除，并向学员发送班级解散通知
                          </Text>
                        </View>
                      </View>
                      <Icon name="mdi-chevron-right" size="sm" color="destructive" />
                    </View>
                  </View>
                </View>
              </BottomSheet>

              <BottomSheet
                visible={batchClassSheetVisible}
                title={batchActionType === 'reschedule' ? '选择调课班级' : '选择删除班级'}
                onClose={() => setBatchClassSheetVisible(false)}
                className="pb-safe-bar"
              >
                <View className="px-[24rpx] py-[16rpx]">
                  <View className="flex items-center justify-between">
                    <Text className="text-[24rpx] text-muted-foreground">
                      已选 {batchSelectedClassIds.length} 个班级
                    </Text>
                    <Text
                      className="text-[24rpx] text-primary"
                      onClick={handleSelectAllBatchClasses}
                    >
                      {batchSelectedClassIds.length === batchClassOptions.length
                        ? '取消全选'
                        : '全选'}
                    </Text>
                  </View>
                </View>

                <View className="px-[24rpx] pb-[24rpx] flex flex-col gap-[16rpx]">
                  {batchClassOptions.map((item) => {
                    const checked = batchSelectedClassIds.includes(item.id);
                    return (
                      <View
                        key={item.id}
                        className={cn(
                          'rounded-[16rpx] border px-[24rpx] py-[22rpx] flex items-start gap-[18rpx]',
                          checked ? 'border-primary bg-primary-10' : 'border-schedule-soft bg-card',
                        )}
                        onClick={() => toggleBatchClassSelection(item.id)}
                      >
                        <CircleCheckbox checked={checked} size={42} />
                        <View className="min-w-0 flex-1">
                          <View className="flex items-center gap-[12rpx]">
                            <Text className="truncate text-[30rpx] font-semibold text-foreground">
                              {item.name}
                            </Text>
                            <Text className="text-[22rpx] text-muted-foreground">
                              {item.studentCount}人
                            </Text>
                          </View>
                          <Text className="mt-[8rpx] block text-[24rpx] text-muted-foreground">
                            {item.scheduleSummary}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>

                <View className="border-t border-schedule-soft px-[24rpx] pt-[20rpx] pb-[24rpx] flex gap-[16rpx] bg-card">
                  <View
                    className="flex-1 h-[84rpx] rounded-[14rpx] bg-muted flex items-center justify-center"
                    onClick={() => setBatchClassSheetVisible(false)}
                  >
                    <Text className="text-[28rpx] font-medium text-foreground-secondary">取消</Text>
                  </View>
                  <View
                    className={cn(
                      'flex-1 h-[84rpx] rounded-[14rpx] flex items-center justify-center',
                      batchActionType === 'delete' ? 'bg-schedule-delete' : 'bg-schedule-adjust',
                      batchSubmitting ? 'opacity-60' : '',
                    )}
                    onClick={() => void handleConfirmBatchClassSelection()}
                  >
                    <Text className="text-[28rpx] font-semibold text-primary-foreground">
                      {batchActionType === 'delete' ? '确定删除' : '下一步'}
                    </Text>
                  </View>
                </View>
              </BottomSheet>

              {dangerActionMeta ? (
                <ConfirmDialog
                  visible={dangerActionState.visible}
                  title={dangerActionMeta.title}
                  description={dangerActionMeta.description}
                  confirmText={dangerActionMeta.confirmText}
                  tone={dangerActionMeta.tone}
                  confirmLoading={dangerActionSubmitting}
                  onClose={closeDangerActionDialog}
                  onConfirm={() => void handleConfirmDangerAction()}
                />
              ) : null}
            </>
          )}

        {activeTab?.mode === 'private' && activeTab?.type === 'category' && (
          <TrialBookingView
            className="min-h-0 flex-1"
            isParent={isParent}
            onSuccess={() => {
              const firstClassTab = tabs.find((item) => item.mode === 'class');
              const targetKey = firstClassTab?.key || tabs[0]?.key || '';
              const targetIndex = tabs.findIndex((item) => item.key === targetKey);
              handleMainTabChange(targetKey, Math.max(0, targetIndex));
            }}
            switchSheetVisible={teacherSwitchSheetVisible}
            onSwitchSheetClose={() => setTeacherSwitchSheetVisible(false)}
          />
        )}

        {activeTab?.type === 'venue' && (
          <Swiper
            className="bg-schedule-page"
            style={{ flex: 1, minHeight: 0 }}
            current={swiperCurrent}
            duration={SCHEDULE_CARD_SWIPER_DURATION}
            easingFunction="easeOutCubic"
            skipHiddenItemLayout
            onChange={handleSwiperChange}
            onAnimationFinish={handleSwiperFinish}
          >
            {scheduleDateWindow.map((date) => (
              <SwiperItem key={date.format('YYYY-MM-DD')} itemId={date.format('YYYY-MM-DD')}>
                <ScrollView
                  className="h-full bg-schedule-page"
                  scrollY
                  enhanced
                  showScrollbar={false}
                >
                  {renderVenueTab(date)}
                </ScrollView>
              </SwiperItem>
            ))}
          </Swiper>
        )}

        {/* 悬浮排课按钮：仅机构端；家长只浏览/预约 */}
        {!isParent &&
          (activeTab?.mode === 'class' ||
            activeTab?.mode === 'group' ||
            activeTab?.mode === 'private') &&
          activeTab?.type === 'category' && (
            <DraggableFab
              containerSelector="#schedule-page-root"
              storageKey={`schedule-fab-position-${activeTab.mode}`}
              variant="pill"
              label="排课"
              defaultBottomRpx={160}
              defaultRightRpx={32}
              layoutKey={`${activeTabKey}-${activeTab.mode}`}
              onClick={
                activeTab.mode === 'private' ? handleManageBookingConfig : handleCreateSchedule
              }
            />
          )}

        <BookTrialByClassSheet
          visible={bookSheetVisible}
          classId={bookSheetItem?.classId}
          campusId={bookSheetItem?.campusId}
          className={bookSheetItem?.className}
          lessonDate={bookSheetItem ? selectedDate.format('YYYY-MM-DD') : ''}
          startTime={bookSheetItem?.startTime || ''}
          endTime={bookSheetItem?.endTime || ''}
          teacherId={currentTeacherId}
          teacherName={bookSheetItem?.leadTeacherName}
          onClose={handleCloseBookSheet}
          onSuccess={handleBookTrialByClassSuccess}
        />
      </View>
    </PageContainer>
  );
};

export default withRouteGuard(SchedulePage);

export function definePageConfig() {
  return {
    navigationStyle: 'custom',
    navigationBarTextStyle: 'white',
    navigationBarTitleText: '课表',
    enableShareAppMessage: true,
    enableShareTimeline: true,
    usingComponents: {},
  };
}
