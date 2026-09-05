import { View } from '@tarojs/components';
import Taro, { useDidShow, useShareAppMessage } from '@tarojs/taro';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PageContainer from '@/components/PageContainer';
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
import { getVenueBookingEnabled } from '@/utils/venue-booking-config';
import {
  rpxToPx,
  TAB_GAP_RPX,
  TAB_RIGHT_FIXED_WIDTH_RPX,
  TAB_WIDTH_RPX,
} from './schedule-tab-layout';
import { type ScheduleBatchActionType as BatchActionType } from './ScheduleBatchSheets';
import ScheduleMainViews from './ScheduleMainViews';
import SchedulePageChrome from './SchedulePageChrome';
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

  const {
    tabs,
    activeTab,
    filteredClasses,
    pausedClasses,
    teacherById,
    scheduleById,
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
      return;
    }
    if (isWithinRefetchTtl(lastScheduleAuxFetchAtRef.current)) {
      return;
    }
    void loadMonthRecords();
    void loadTemporaryReschedules();
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
      item: null,
    });
  }, []);

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

        <ScheduleMainViews
          activeTab={activeTab}
          activeTabKey={activeTabKey}
          tabs={tabs}
          isParent={isParent}
          selectedDate={selectedDate}
          currentTime={currentTime}
          loading={loading}
          swiperCurrent={swiperCurrent}
          scheduleDateWindow={scheduleDateWindow}
          openCardId={openCardId}
          onOpenCardIdChange={setOpenCardId}
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
          batchSubmitting={batchSubmitting}
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
          onEditSchedule={handleEditSchedule}
          onClassReschedule={handleClassReschedule}
          onCancelLesson={handleCancelLesson}
          onRestoreLesson={handleRestoreLesson}
          onSuspendLesson={handleSuspendLesson}
          onResumeClass={handleResumeClass}
          onOpenClassSlotConfig={handleOpenClassSlotConfig}
          onProxyBooking={handleProxyBooking}
          onOpenSlotRollCall={handleOpenSlotRollCall}
          onEditOpenSlot={handleEditOpenSlot}
          onCancelOpenSlot={handleCancelOpenSlot}
          onRestoreOpenSlot={handleRestoreOpenSlot}
          onSuspendOpenSlot={handleSuspendOpenSlot}
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
