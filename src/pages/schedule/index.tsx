import { View } from '@tarojs/components';
import Taro, { useDidShow, usePullDownRefresh, useShareAppMessage } from '@tarojs/taro';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PageContainer from '@/components/PageContainer';
import { useHolidayCheck } from '@/hooks/use-holiday-check';
import { notificationService, studentService } from '@/services';
import { useCampusStore } from '@/stores/campus';
import { useCourseCategoryStore } from '@/stores/course-category';
import { useThemeStore } from '@/stores/theme';
import type { Class, ClassBookingSlot } from '@/types/class';
import type { LessonRecord } from '@/types/lesson-record';
import type { Schedule } from '@/types/schedule';
import type { TeacherUIModel } from '@/types/teacher';
import type { TemporaryReschedule } from '@/types/temporary-reschedule';
import type { BookableVenue } from '@/types/venue-booking';
import { isParentRole, useAuth } from '@/utils/auth';
import { TTL } from '@/utils/data-freshness';
import {
  buildLessonSharePath,
  buildLessonShareTitle,
  type LessonSharePayload,
} from '@/utils/lesson-share';
import { logError } from '@/utils/logger';
import { notifyStudentParentsSafe } from '@/utils/notify-student-parents';
import { isWithinRefetchTtl } from '@/utils/refetch-ttl';
import { consumeRefreshSignal, REFRESH_SIGNAL } from '@/utils/refresh-signal';
import { withRouteGuard } from '@/utils/route-guard';
import type { ScheduleCardItem, ScheduleCardStudentAvatar } from '@/utils/schedule-card-build';
import { syncTabBarByProfile } from '@/utils/tab-bar';
import { useDateSwiperWindow } from '@/utils/use-date-swiper-window';
import { useNavSafeHeight } from '@/utils/use-nav-safe-height';
import { fetchVenueBookingEnabled, getVenueBookingEnabled } from '@/utils/venue-booking-config';
import {
  rpxToPx,
  TAB_GAP_RPX,
  TAB_RIGHT_FIXED_WIDTH_RPX,
  TAB_WIDTH_RPX,
} from './schedule-tab-layout';
import { type ScheduleBatchActionType as BatchActionType } from './ScheduleBatchSheets';
import ScheduleMainViews from './ScheduleMainViews';
import SchedulePageChrome from './SchedulePageChrome';
import { useClassReminder } from './use-class-reminder';
import { useScheduleCardActions } from './use-schedule-card-actions';
import {
  useScheduleDangerActions,
  type ScheduleDangerActionState,
} from './use-schedule-danger-actions';
import { useScheduleDerived } from './use-schedule-derived';
import { useScheduleLoaders } from './use-schedule-loaders';
import { useScheduleOpenSlotActions } from './use-schedule-open-slot-actions';

const FILTER_ALL_CLASS = '';
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
  const [batchActionType, setBatchActionType] = useState<BatchActionType>('reschedule');
  const [batchActionSheetVisible, setBatchActionSheetVisible] = useState(false);
  const [batchClassSheetVisible, setBatchClassSheetVisible] = useState(false);
  const [batchSelectedClassIds, setBatchSelectedClassIds] = useState<string[]>([]);
  const [dangerActionSubmitting, setDangerActionSubmitting] = useState(false);
  const [dangerActionState, setDangerActionState] = useState<ScheduleDangerActionState>({
    visible: false,
    type: null,
  });
  const { categories, fetchList: fetchCategories } = useCourseCategoryStore();
  /** 当前激活的 Tab key */
  const [activeTabKey, setActiveTabKey] = useState<string>('');
  const [tabScrollLeft, setTabScrollLeft] = useState(0);
  /** 场地预约功能开关 */
  const [venueBookingEnabled, setVenueBookingEnabled] = useState(true);
  /**
   * 场地预约开关接入 TanStack Query（B9-2）：
   * - 原为 useDidShow 每次进页/切 tab 无条件打 /booking-config/venue（计划点名的 over-fetch）；
   * - 现改为 Query 缓存，staleTime 内（校区级慢变配置）不重复请求；
   * - 本地存储即时值仍用于首帧兜底，服务端真值经下方 effect 同步回 state。
   */
  const venueEnabledQuery = useQuery({
    queryKey: ['schedule', 'venue-booking-enabled'],
    queryFn: () => fetchVenueBookingEnabled(),
    staleTime: TTL.campus,
  });
  useEffect(() => {
    if (venueEnabledQuery.data !== undefined) {
      setVenueBookingEnabled(venueEnabledQuery.data);
    }
  }, [venueEnabledQuery.data]);
  /** 排课 / 预约 视图切换（由 activeTab 派生） */
  const [viewMode, setViewMode] = useState<'schedule' | 'booking'>('schedule');
  /** 排课视图内二级模式：fixed=固定排课, open=开放预约（由 activeTab 派生） */
  const [scheduleSubMode, setScheduleSubMode] = useState<'fixed' | 'open'>('fixed');
  /**
   * 私教视图（TrialBookingView）刷新令牌：下拉刷新时递增。
   * 该视图自带数据加载（老师/时段/预约记录），页面侧只能通过令牌触发它重拉。
   */
  const [privateReloadToken, setPrivateReloadToken] = useState(0);
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

  const [venues, setVenues] = useState<BookableVenue[]>([]);
  const [loadingVenues, setLoadingVenues] = useState(false);

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

  const [teacherSwitchSheetVisible, setTeacherSwitchSheetVisible] = useState(false);

  /**
   * 放假判断 hook：日历「休」标识 + 课表卡片「放假停课」标记共用（教师端/家长端）。
   * 必须等身份就绪再拉——挂载瞬间 token/机构可能尚未解析，此时请求会 401 且本 hook 不自动重试。
   * ⚠️ 必须放在 useScheduleDerived 之前：卡片构建时要用它打标记。
   */
  const isHolidayDate = useHolidayCheck({ enabled: Boolean(currentRole) });
  const {
    tabs,
    activeTab,
    filteredClasses,
    pausedClasses,
    teacherById,
    getDateDotType,
    getOpenDateDotType,
    batchClassOptions,
    selectedBatchClasses,
    dangerActionMeta,
    renderDateCards,
  } = useScheduleDerived({
    categories,
    venueBookingEnabled,
    activeTabKey,
    classes,
    schedules,
    teachers,
    isParent,
    parentClassIds,
    selectedClassId,
    currentTime,
    temporaryReschedules,
    lessonRecords,
    classStudentAvatars,
    trialBookingKeys,
    currentTeacherName,
    openSlotDates,
    batchSelectedClassIds,
    dangerActionState,
    selectedDate,
    isHolidayDate,
  });

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

  const {
    loadVenues,
    loadOpenClassSlots,
    loadBaseData,
    loadMonthRecords,
    loadTemporaryReschedules,
    refreshDateData,
    pullRefresh,
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

  /**
   * 卡片铃铛：上课提醒开关状态 + 点击授权。
   * 家长端不显示（那不是"自己的课"，家长不需要上课提醒）。
   */
  const classReminder = useClassReminder({
    role: currentRole,
    campusId: currentCampusId || undefined,
    disabled: isParent,
  });

  const handleMainTabChange = useCallback(
    (tabKey: string, tabIndex: number) => {
      if (tabKey === activeTabKey) return;
      const tab = tabs.find((item) => item.key === tabKey);
      if (!tab) return;
      setActiveTabKey(tabKey);

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

  const handleDateChangeWithRefresh = useCallback(
    (date: dayjs.Dayjs) => {
      setSelectedDate(date);
      refreshDateData(date);
    },
    [refreshDateData],
  );

  const {
    dateWindow: scheduleDateWindow,
    swiperCurrent,
    swiperSyncKey: scheduleSwiperSyncKey,
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
    // 场地预约开关：本地存储即时值兜底；服务端真值由 venueEnabledQuery 在 staleTime 内缓存、不重复请求
    setVenueBookingEnabled(getVenueBookingEnabled());
    let hasRefreshSignal = false;
    let newCategoryId = '';
    try {
      hasRefreshSignal = consumeRefreshSignal(REFRESH_SIGNAL.schedule);
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
      // 2026-10-03：新增/删除放假日期后回到课表页也要立刻联动
      isHolidayDate.reload();
      return;
    }
    if (isWithinRefetchTtl(lastScheduleAuxFetchAtRef.current)) {
      return;
    }
    void loadMonthRecords();
    void loadTemporaryReschedules();
  });

  /**
   * 下拉刷新：把「当前 Tab 上能看到的数据」整批重拉。
   *
   * 用的是**页面级**下拉（`index.config.ts` 的 `enablePullDownRefresh`）—— 内容虽然在
   * 各视图内层 ScrollView 里滚动，但页面根是 `h-screen + overflow-hidden`、页面本身不滚动，
   * 与 `package-settings/pages/my-todos`、`package-student/pages/students` 同一套路。
   *
   * 覆盖范围：班课/团课（排课+点名统计+临时调课，团课再加开放时段）、场地（场地列表）；
   * 私教视图由它自己的 `reloadToken` 触发。指示器必须显式 `stopPullDownRefresh`，否则一直转。
   */
  usePullDownRefresh(() => {
    void (async () => {
      try {
        if (activeTab?.mode === 'private') {
          setPrivateReloadToken((token) => token + 1);
        }
        // 2026-10-03：放假日期改动后课表不联动 —— 假期是独立 hook、原来只拉一次，
        // 必须显式重拉，否则下拉也刷不出来。
        isHolidayDate.reload();
        await pullRefresh({ withVenues: activeTab?.type === 'venue' });
      } finally {
        Taro.stopPullDownRefresh();
      }
    })();
  });

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

  const closeDangerActionDialog = useCallback(() => {
    setDangerActionState({
      visible: false,
      type: null,
    });
  }, []);

  const { handleResumeClass, handleConfirmDangerAction } = useScheduleDangerActions({
    currentTime,
    activeTheme: themeStore.activeTheme,
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
    selectedBatchClasses,
    selectedClassId,
    filterAllClassId: FILTER_ALL_CLASS,
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
    bookSheetItem,
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
    handleParentBookOpenSlot,
    handleParentCancelOpenSlot,
  } = useScheduleOpenSlotActions({
    filteredClasses,
    campuses,
    currentCampusId,
    profile,
    loadOpenClassSlots,
    setOpenClassSlots,
  });

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
          isHoliday={isHolidayDate}
          onMainTabChange={handleMainTabChange}
          onBatchAction={handleBatchAction}
          onScheduleDateChange={handleScheduleDateChange}
        />

        <ScheduleMainViews
          activeTab={activeTab}
          activeTabKey={activeTabKey}
          tabs={tabs}
          isParent={isParent}
          reminderEnabled={classReminder.enabled}
          onReminderClick={classReminder.onReminderClick}
          isHoliday={isHolidayDate}
          selectedDate={selectedDate}
          privateReloadToken={privateReloadToken}
          currentTime={currentTime}
          loading={loading}
          swiperCurrent={swiperCurrent}
          scheduleDateWindow={scheduleDateWindow}
          scheduleSwiperSyncKey={scheduleSwiperSyncKey}
          currentCampusId={currentCampusId || ''}
          currentTeacherId={currentTeacherId}
          currentUserId={currentUserId}
          profileId={profile?.id}
          profileCampusId={profile?.currentContext?.campusId}
          pausedClasses={pausedClasses}
          filteredClasses={filteredClasses}
          teacherById={teacherById}
          classStudentAvatars={classStudentAvatars}
          openClassSlots={openClassSlots}
          loadingOpenSlotDates={loadingOpenSlotDates}
          errorOpenSlotDates={errorOpenSlotDates}
          venues={venues}
          loadingVenues={loadingVenues}
          teacherSwitchSheetVisible={teacherSwitchSheetVisible}
          onSwitchSheetClose={() => setTeacherSwitchSheetVisible(false)}
          batchActionSheetVisible={batchActionSheetVisible}
          batchClassSheetVisible={batchClassSheetVisible}
          batchActionType={batchActionType}
          batchClassOptions={batchClassOptions}
          batchSelectedClassIds={batchSelectedClassIds}
          submitting={dangerActionSubmitting}
          dangerActionMeta={dangerActionMeta}
          dangerDialogVisible={dangerActionState.visible}
          dangerActionSubmitting={dangerActionSubmitting}
          bookSheetVisible={bookSheetVisible}
          bookSheetItem={bookSheetItem}
          renderDateCards={renderDateCards}
          onPrepareShare={(payload) => {
            pendingShareRef.current = payload;
          }}
          onRunCardButtonAction={runCardButtonAction}
          onSwiperChange={handleSwiperChange}
          onSwiperFinish={handleSwiperFinish}
          onMainTabChange={handleMainTabChange}
          onLoadOpenClassSlots={loadOpenClassSlots}
          onOpenBookSheet={handleOpenBookSheet}
          onPrimaryAction={handlePrimaryAction}
          onRollCall={handleRollCall}
          onSupplement={handleSupplement}
          onResumeClass={handleResumeClass}
          onOpenClassSlotConfig={handleOpenClassSlotConfig}
          onProxyBooking={handleProxyBooking}
          onOpenSlotRollCall={handleOpenSlotRollCall}
          onParentBookOpenSlot={handleParentBookOpenSlot}
          onParentCancelOpenSlot={handleParentCancelOpenSlot}
          onCloseBatchActionSheet={() => setBatchActionSheetVisible(false)}
          onChooseBatchType={handleChooseBatchType}
          onCloseBatchClassSheet={() => setBatchClassSheetVisible(false)}
          onSelectAllBatchClasses={handleSelectAllBatchClasses}
          onToggleBatchClassSelection={toggleBatchClassSelection}
          onConfirmBatchClassSelection={handleConfirmBatchClassSelection}
          onCloseDangerDialog={closeDangerActionDialog}
          onConfirmDangerAction={handleConfirmDangerAction}
          onCreateSchedule={handleCreateSchedule}
          onManageBookingConfig={handleManageBookingConfig}
          onCloseBookSheet={handleCloseBookSheet}
          onBookTrialByClassSuccess={handleBookTrialByClassSuccess}
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
