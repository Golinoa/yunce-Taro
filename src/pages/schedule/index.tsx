import { View, ScrollView, Swiper, SwiperItem } from '@tarojs/components';
import Taro, { useDidShow, useShareAppMessage } from '@tarojs/taro';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type CalendarDotType } from '@/components/CalendarWeekSelector';
import DraggableFab from '@/components/DraggableFab';
import BookTrialByClassSheet from '@/components/lead/BookTrialByClassSheet';
import TrialBookingView from '@/components/lead/TrialBookingView';
import PageContainer from '@/components/PageContainer';
import { notificationService, studentService } from '@/services';
import { useCampusStore } from '@/stores/campus';
import { useCourseCategoryStore } from '@/stores/course-category';
import { useThemeStore } from '@/stores/theme';
import type { Class, ClassBookingSlot } from '@/types/class';
import type { CourseCategoryMode } from '@/types/course-category';
import type { LessonRecord } from '@/types/lesson-record';
import type { Schedule } from '@/types/schedule';
import type { TeacherUIModel } from '@/types/teacher';
import type { TemporaryReschedule } from '@/types/temporary-reschedule';
import type { BookableVenue } from '@/types/venue-booking';
import { isParentRole, useAuth } from '@/utils/auth';
import {
  buildLessonSharePath,
  buildLessonShareTitle,
  type LessonSharePayload,
} from '@/utils/lesson-share';
import { logError } from '@/utils/logger';
import { notifyStudentParentsSafe } from '@/utils/notify-student-parents';
import { isWithinRefetchTtl } from '@/utils/refetch-ttl';
import { withRouteGuard } from '@/utils/route-guard';
import { parseTimeToMinutes } from '@/utils/schedule-guard';
import { getWeekdayText } from '@/utils/schedule-card-status';
import { buildDangerActionMeta } from '@/utils/schedule-danger-meta';
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
import SchedulePageChrome from './SchedulePageChrome';
import ScheduleVenueTab from './ScheduleVenueTab';
import {
  rpxToPx,
  TAB_GAP_RPX,
  TAB_RIGHT_FIXED_WIDTH_RPX,
  TAB_WIDTH_RPX,
} from './schedule-tab-layout';
import ScheduleBatchSheets, {
  type ScheduleBatchActionType as BatchActionType,
} from './ScheduleBatchSheets';
import { useScheduleCardActions } from './use-schedule-card-actions';
import {
  useScheduleDangerActions,
  type ScheduleDangerActionState,
} from './use-schedule-danger-actions';
import { useScheduleLoaders } from './use-schedule-loaders';
import { useScheduleOpenSlotActions } from './use-schedule-open-slot-actions';

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

  const {
    handleCancelLesson,
    handleRestoreLesson,
    handleSuspendLesson,
    handleSuspendOpenSlot,
    handleResumeClass,
    handleConfirmDangerAction,
  } = useScheduleDangerActions({
    selectedDate,
    currentTime,
    activeTheme: themeStore.activeTheme,
    lessonRecords,
    setLessonRecords,
    setOpenClassSlots,
    setClasses,
    setSchedules,
    setSelectedClassId,
    setBatchClassSheetVisible,
    setBatchSelectedClassIds,
    setDangerActionSubmitting,
    dangerActionState,
    setDangerActionState,
    closeDangerActionDialog,
    scheduleById,
    filteredClasses,
    selectedBatchClasses,
    selectedClassId,
    filterAllClassId: FILTER_ALL_CLASS,
    currentTeacherId,
    currentUserId,
    currentCampusId,
    profileId: profile?.id,
    profileName: profile?.name,
    profileRole: profile?.currentContext?.role,
    notifyStudentAndParents,
  });

  const {
    handleOpenBookSheet,
    handleCloseBookSheet,
    handleBookTrialByClassSuccess,
    handleSupplement,
    handlePrimaryAction,
    handleRollCall,
    handleEditSchedule,
    handleClassReschedule,
    handleCreateSchedule,
    handleManageBookingConfig,
    handleBatchAction,
    toggleBatchClassSelection,
    handleSelectAllBatchClasses,
    handleChooseBatchType,
    handleConfirmBatchClassSelection,
  } = useScheduleCardActions({
    selectedDate,
    currentTime,
    selectedClassId,
    filterAllClassId: FILTER_ALL_CLASS,
    activeTabMode: activeTab?.mode,
    cardActionLockRef,
    batchClassOptions,
    batchSelectedClassIds,
    loadBaseData,
    setBookSheetItem,
    setBookSheetVisible,
    setTrialBookingKeys,
    setTeacherSwitchSheetVisible,
    setBatchSelectedClassIds,
    setBatchActionSheetVisible,
    setBatchActionType,
    setBatchClassSheetVisible,
    setDangerActionState,
  });

  const {
    handleOpenClassSlotConfig,
    handleProxyBooking,
    handleOpenSlotRollCall,
    handleEditOpenSlot,
    handleParentBookOpenSlot,
    handleParentCancelOpenSlot,
    handleCancelOpenSlot,
    handleRestoreOpenSlot,
  } = useScheduleOpenSlotActions({
    filteredClasses,
    campuses,
    currentCampusId,
    profile,
    loadOpenClassSlots,
    setOpenClassSlots,
  });

  const renderDateCards = useCallback(
    (date: dayjs.Dayjs) => {
      const cards = buildCardsForDate(date);
      return { cards, summary: summarizeScheduleCards(cards) };
    },
    [buildCardsForDate],
  );

  /** 班课日卡片列表已抽至 ScheduleDaySwiperItem（Q2-1） */
  /** 团课开放预约列表已抽至 OpenClassScheduleList（Q2-1） */

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
        <SchedulePageChrome
          navSafeHeight={navSafeHeight}
          tabs={tabs}
          activeTabKey={activeTabKey}
          activeTab={activeTab}
          tabScrollLeft={tabScrollLeft}
          isParent={isParent}
          selectedDate={selectedDate}
          scheduleSubMode={scheduleSubMode}
          getDateDotType={getDateDotType}
          getOpenDateDotType={getOpenDateDotType}
          onMainTabChange={handleMainTabChange}
          onBatchAction={handleBatchAction}
          onScheduleDateChange={handleScheduleDateChange}
        />

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
                  <ScheduleVenueTab loadingVenues={loadingVenues} venues={venues} />
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
