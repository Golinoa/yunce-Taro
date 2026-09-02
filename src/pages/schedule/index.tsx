import { View, Text, ScrollView, Swiper, SwiperItem } from '@tarojs/components';
import Taro, { useDidShow, useShareAppMessage } from '@tarojs/taro';
import cn from 'classnames';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CalendarWeekSelector, { type CalendarDotType } from '@/components/CalendarWeekSelector';
import DraggableFab from '@/components/DraggableFab';
import Empty from '@/components/Empty';
import Icon from '@/components/Icon';
import BookTrialByClassSheet from '@/components/lead/BookTrialByClassSheet';
import TrialBookingView from '@/components/lead/TrialBookingView';
import PageContainer from '@/components/PageContainer';
import VenueBookingCard from '@/components/schedule/VenueBookingCard';
import {
  classBookingService,
  classService,
  lessonRecordService,
  notificationService,
  scheduleService,
  studentService,
  calendarSyncService,
} from '@/services';
import { auditLogService } from '@/services/audit-log';
import { subscribeMessageService } from '@/services/subscribe-message';
import { useCampusStore } from '@/stores/campus';
import { useCourseCategoryStore } from '@/stores/course-category';
import { useThemeStore } from '@/stores/theme';
import { getThemeHexColors } from '@/theme';
import type { Class, ClassBookingSlot } from '@/types/class';
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
import { upsertParentBooking, updateParentBookingStatus } from '@/utils/parent-bookings';
import { isWithinRefetchTtl } from '@/utils/refetch-ttl';
import { withRouteGuard } from '@/utils/route-guard';
import {
  canSuspendOpenSlot,
  canSuspendThisLesson,
  parseTimeToMinutes,
} from '@/utils/schedule-guard';
import { getCardActionVisibility } from '@/utils/schedule-card-actions';
import { getWeekdayText } from '@/utils/schedule-card-status';
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
import OpenClassScheduleList from './OpenClassScheduleList';
import ScheduleDaySwiperItem from './ScheduleDaySwiperItem';
import {
  getTabContainerWidth,
  rpxToPx,
  TAB_GAP_RPX,
  TAB_RIGHT_FIXED_WIDTH_RPX,
  TAB_WIDTH_RPX,
} from './schedule-tab-layout';
import ScheduleBatchSheets, {
  type ScheduleBatchActionType as BatchActionType,
} from './ScheduleBatchSheets';
import { useScheduleLoaders } from './use-schedule-loaders';

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

  const {
    loadVenues,
    loadOpenClassSlots,
    loadBaseData,
    loadMonthRecords,
    loadTemporaryReschedules,
    refreshDateData,
    lastScheduleAuxFetchAtRef,
  } = useScheduleLoaders({
    currentUserId,
    currentTeacherId,
    currentCampusId,
    currentRole,
    isParent,
    profileId: profile?.id,
    fetchCategories,
    filteredClasses,
    viewMode,
    scheduleSubMode,
    selectedDate,
    setParentClassIds,
    setVenues,
    setLoadingVenues,
    setOpenClassSlots,
    setLoadingOpenSlotDates,
    setErrorOpenSlotDates,
    setOpenSlotDates,
    setSchedules,
    setClasses,
    setTeachers,
    setClassStudentAvatars,
    setTrialBookingKeys,
    setLoading,
    setLessonRecords,
    setTemporaryReschedules,
  });

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

  /** 班课日卡片列表已抽至 ScheduleDaySwiperItem（Q2-1） */

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

  /** 团课开放预约列表已抽至 OpenClassScheduleList（Q2-1） */

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
            {scheduleDateWindow.map((date) => {
              const { cards, summary } = renderDateCards(date);
              return (
                <SwiperItem key={date.format('YYYY-MM-DD')} itemId={date.format('YYYY-MM-DD')}>
                  <ScheduleDaySwiperItem
                    date={date}
                    cards={cards}
                    summary={summary}
                    loading={loading}
                    currentTime={currentTime}
                    openCardId={openCardId}
                    onOpenCardIdChange={setOpenCardId}
                    isParent={isParent}
                    currentCampusId={currentCampusId || ''}
                    currentTeacherId={currentTeacherId}
                    currentUserId={currentUserId}
                    profileCampusId={profile?.currentContext?.campusId}
                    pausedClasses={pausedClasses}
                    onPrepareShare={(payload) => {
                      pendingShareRef.current = payload;
                    }}
                    onRunCardButtonAction={runCardButtonAction}
                    onOpenBookSheet={handleOpenBookSheet}
                    onPrimaryAction={handlePrimaryAction}
                    onRollCall={handleRollCall}
                    onSupplement={handleSupplement}
                    onEditSchedule={handleEditSchedule}
                    onClassReschedule={handleClassReschedule}
                    onCancelLesson={handleCancelLesson}
                    onRestoreLesson={handleRestoreLesson}
                    onSuspendLesson={handleSuspendLesson}
                    onResumeClass={handleResumeClass}
                  />
                </SwiperItem>
              );
            })}
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
                <OpenClassScheduleList
                  date={date}
                  filteredClasses={filteredClasses}
                  openClassSlots={openClassSlots}
                  loadingOpenSlotDates={loadingOpenSlotDates}
                  errorOpenSlotDates={errorOpenSlotDates}
                  openCardId={openCardId}
                  onOpenCardIdChange={setOpenCardId}
                  teacherById={teacherById}
                  currentTime={currentTime}
                  isParent={isParent}
                  currentCampusId={currentCampusId || ''}
                  currentTeacherId={currentTeacherId}
                  currentUserId={currentUserId}
                  profileId={profile?.id}
                  profileCampusId={profile?.currentContext?.campusId}
                  classStudentAvatars={classStudentAvatars}
                  onLoadOpenClassSlots={loadOpenClassSlots}
                  onOpenClassSlotConfig={handleOpenClassSlotConfig}
                  onProxyBooking={handleProxyBooking}
                  onOpenSlotRollCall={handleOpenSlotRollCall}
                  onEditOpenSlot={handleEditOpenSlot}
                  onCancelOpenSlot={handleCancelOpenSlot}
                  onRestoreOpenSlot={handleRestoreOpenSlot}
                  onSuspendOpenSlot={handleSuspendOpenSlot}
                  onResumeClass={handleResumeClass}
                  onRunCardButtonAction={runCardButtonAction}
                  onParentBookOpenSlot={handleParentBookOpenSlot}
                  onParentCancelOpenSlot={handleParentCancelOpenSlot}
                  onPrepareShare={(payload) => {
                    pendingShareRef.current = payload;
                  }}
                />
              </SwiperItem>
            ))}
          </Swiper>
        )}

        {(activeTab?.mode === 'class' || activeTab?.mode === 'group') &&
          activeTab?.type === 'category' && (
            <ScheduleBatchSheets
              batchActionSheetVisible={batchActionSheetVisible}
              onCloseBatchActionSheet={() => setBatchActionSheetVisible(false)}
              onChooseBatchType={handleChooseBatchType}
              batchClassSheetVisible={batchClassSheetVisible}
              onCloseBatchClassSheet={() => setBatchClassSheetVisible(false)}
              batchActionType={batchActionType}
              batchClassOptions={batchClassOptions}
              batchSelectedClassIds={batchSelectedClassIds}
              batchSubmitting={batchSubmitting}
              onSelectAllBatchClasses={handleSelectAllBatchClasses}
              onToggleBatchClassSelection={toggleBatchClassSelection}
              onConfirmBatchClassSelection={handleConfirmBatchClassSelection}
              dangerActionMeta={dangerActionMeta}
              dangerDialogVisible={dangerActionState.visible}
              dangerActionSubmitting={dangerActionSubmitting}
              onCloseDangerDialog={closeDangerActionDialog}
              onConfirmDangerAction={handleConfirmDangerAction}
            />
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
