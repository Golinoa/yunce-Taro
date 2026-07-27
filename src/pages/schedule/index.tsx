import { Button, View, Text, ScrollView, Swiper, SwiperItem, Image } from '@tarojs/components';
import Taro, { useDidShow, useShareAppMessage } from '@tarojs/taro';
import cn from 'classnames';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import BottomSheet from '@/components/BottomSheet';
import CalendarWeekSelector, { type CalendarDotType } from '@/components/CalendarWeekSelector';
import CircleCheckbox from '@/components/CircleCheckbox';
import ConfirmDialog from '@/components/ConfirmDialog';
import Empty from '@/components/Empty';
import Icon from '@/components/Icon';
import BookTrialByClassSheet from '@/components/lead/BookTrialByClassSheet';
import TrialBookingView from '@/components/lead/TrialBookingView';
import PageContainer from '@/components/PageContainer';
import ScheduleActionButton from '@/components/schedule/ScheduleActionButton';
import ScheduleBookingSwitch, {
  type ScheduleBookingTab,
} from '@/components/schedule/ScheduleBookingSwitch';
import ScheduleCard from '@/components/schedule/ScheduleCard';
import SwappableScheduleCard from '@/components/schedule/SwappableScheduleCard';
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
} from '@/services';
import type { Class, ClassBookingSlot } from '@/types/class';
import { CLASS_LEVEL_LABELS } from '@/types/class';
import type { LessonRecord } from '@/types/lesson-record';
import type { Schedule } from '@/types/schedule';
import type { TeacherUIModel } from '@/types/teacher';
import type { TemporaryReschedule } from '@/types/temporary-reschedule';
import { isParentRole, useAuth } from '@/utils/auth';
import { logError } from '@/utils/logger';
import { hasTrialPackage } from '@/utils/package-helper';
import { withRouteGuard } from '@/utils/route-guard';
import { useDateSwiperWindow } from '@/utils/use-date-swiper-window';
import { useNavSafeHeight } from '@/utils/use-nav-safe-height';

type ScheduleCardStatus = 'urgent' | 'upcoming' | 'active' | 'done' | 'ended' | 'cancelled';
type BatchActionType = 'reschedule' | 'delete';
type ScheduleDangerActionType = 'cancel' | 'delete' | 'batch-delete';

interface ScheduleCardItem {
  id: string;
  classId?: string;
  campusId?: string;
  detailRecordId?: string;
  className: string;
  startTime: string;
  endTime: string;
  leadTeacherName: string;
  assistantTeacherName?: string;
  note?: string;
  checkedCount: number;
  totalCount: number;
  status: ScheduleCardStatus;
  countdownText?: string;
  bookingTag?: string;
  hasTrialStudent?: boolean;
  canCancelLesson: boolean;
  isTemporaryAdjusted?: boolean;
}

interface ScheduleDangerActionState {
  visible: boolean;
  type: ScheduleDangerActionType | null;
  item: ScheduleCardItem | null;
}

const FULL_WEEKDAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'] as const;
const FILTER_ALL_CLASS = '';
const SCHEDULE_CARD_SWIPER_DURATION = 260;
const SCHEDULE_REFRESH_SIGNAL_KEY = 'yunce:schedule:refresh';
/** 开放预约卡片最多展示的前 x 个已约学员头像 */
const OPEN_BOOKING_MAX_VISIBLE_AVATARS = 5;

function parseTimeToMinutes(time: string): number {
  const [hour, minute] = time.split(':').map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return 0;
  }
  return hour * 60 + minute;
}

function getDurationText(startTime: string, endTime: string): string {
  const minutes = parseTimeToMinutes(endTime) - parseTimeToMinutes(startTime);
  if (minutes <= 0) return '';
  return `${minutes}'`;
}

function getCountdownText(diffMinutes: number): string | undefined {
  if (diffMinutes <= 0 || diffMinutes > 30) {
    return undefined;
  }
  return diffMinutes <= 5 ? `还有${diffMinutes}分钟开课` : `${diffMinutes}分钟后开课`;
}

function getTeacherNames(
  classInfo: Class | undefined,
  teacherById: Record<string, TeacherUIModel>,
  fallbackTeacherName: string,
) {
  const teacherIds = classInfo?.teachers?.length
    ? classInfo.teachers
    : classInfo?.teacher_id
      ? [classInfo.teacher_id]
      : [];
  const teachers = teacherIds
    .map((id) => teacherById[id])
    .filter((teacher): teacher is TeacherUIModel => Boolean(teacher));
  const leadTeacher =
    teachers.find((teacher) => teacher.role !== 'assist') ||
    teachers[0] ||
    (classInfo?.teacher_id ? teacherById[classInfo.teacher_id] : undefined);
  const assistantTeacher =
    teachers.find((teacher) => teacher.role === 'assist' && teacher.id !== leadTeacher?.id) ||
    undefined;

  return {
    leadTeacherName: leadTeacher?.name || fallbackTeacherName || '未分配主讲',
    assistantTeacherName: assistantTeacher?.name,
  };
}

function resolveScheduleStatus(params: {
  selectedDate: dayjs.Dayjs;
  startTime: string;
  endTime: string;
  records: LessonRecord[];
  totalCount: number;
  now: dayjs.Dayjs;
}) {
  const { selectedDate, startTime, endTime, records, totalCount, now } = params;
  const selectedDateStr = selectedDate.format('YYYY-MM-DD');
  const todayStr = now.format('YYYY-MM-DD');
  const checkedCount = new Set(
    records
      .filter((record) => ['normal', 'makeup'].includes(record.status || 'normal'))
      .map((record) => record.student_id),
  ).size;
  const recordedCount = new Set(
    records.filter((record) => record.status !== 'cancelled').map((record) => record.student_id),
  ).size;
  const hasCancelled =
    records.length > 0 && records.every((record) => record.status === 'cancelled');
  const hasMakeup = records.some((record) => record.status === 'makeup');
  const attendanceCompleted = totalCount > 0 ? recordedCount >= totalCount : checkedCount > 0;

  if (hasCancelled) {
    return {
      status: 'cancelled' as const,
      checkedCount,
      hintText: '本次课程已取消，不扣减课时',
      countdownText: undefined,
      tags: ['取消'],
      hasMakeup,
    };
  }

  if (selectedDateStr < todayStr) {
    if (checkedCount > 0 || attendanceCompleted) {
      return {
        status: 'done' as const,
        checkedCount,
        hintText:
          totalCount > 0
            ? `已完成 ${checkedCount}/${totalCount} 人消课`
            : `已完成 ${checkedCount} 条消课记录`,
        countdownText: undefined,
        tags: [],
        hasMakeup,
      };
    }

    return {
      status: 'ended' as const,
      checkedCount,
      hintText: '已下课，尚未登记消课记录',
      countdownText: undefined,
      tags: [],
      hasMakeup,
    };
  }

  if (selectedDateStr > todayStr) {
    return {
      status: 'upcoming' as const,
      checkedCount,
      countdownText: undefined,
      hasMakeup,
    };
  }

  // 当天课程一旦生成消课记录，就视为老师已完成点名，立即切换到查看态。
  if (checkedCount > 0 || attendanceCompleted) {
    return {
      status: 'done' as const,
      checkedCount,
      countdownText: undefined,
      hasMakeup,
    };
  }

  const nowMinutes = now.hour() * 60 + now.minute();
  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);
  const diffMinutes = startMinutes - nowMinutes;

  if (nowMinutes < startMinutes) {
    const urgent = diffMinutes <= 30;
    return {
      status: urgent ? ('urgent' as const) : ('upcoming' as const),
      checkedCount,
      countdownText: getCountdownText(diffMinutes),
      hasMakeup,
    };
  }

  if (nowMinutes >= startMinutes && nowMinutes <= endMinutes) {
    return {
      status: 'active' as const,
      checkedCount,
      countdownText: undefined,
      hasMakeup,
    };
  }

  return {
    status: 'ended' as const,
    checkedCount,
    countdownText: undefined,
    hasMakeup,
  };
}

function getWeekdayText(dayOfWeek: Schedule['day_of_week']): string {
  return FULL_WEEKDAY_LABELS[dayOfWeek - 1];
}

function isPastScheduleDate(selectedDate: dayjs.Dayjs, now: dayjs.Dayjs): boolean {
  return selectedDate.isBefore(now, 'day');
}

function canCancelLessonButton(
  selectedDate: dayjs.Dayjs,
  startTime: string,
  now: dayjs.Dayjs,
): boolean {
  void startTime;
  return !isPastScheduleDate(selectedDate, now);
}

function shouldShowCancelLessonAction(
  item: Pick<ScheduleCardItem, 'canCancelLesson' | 'status' | 'startTime'>,
  selectedDate: dayjs.Dayjs,
  now: dayjs.Dayjs,
): boolean {
  if (!item.canCancelLesson || item.status === 'cancelled' || item.status === 'done') {
    return false;
  }
  return canCancelLessonButton(selectedDate, item.startTime, now);
}

function shouldShowEditAndRescheduleButtons(
  selectedDate: dayjs.Dayjs,
  startTime: string,
  now: dayjs.Dayjs,
  isTemporaryAdjusted: boolean,
  status: ScheduleCardStatus,
): boolean {
  void startTime;
  void isTemporaryAdjusted;
  if (status === 'done' || status === 'cancelled') {
    return false;
  }
  return !isPastScheduleDate(selectedDate, now);
}

function shouldShowDeleteButton(
  selectedDate: dayjs.Dayjs,
  startTime: string,
  now: dayjs.Dayjs,
  isTemporaryAdjusted: boolean,
): boolean {
  void selectedDate;
  void startTime;
  void now;
  void isTemporaryAdjusted;
  return true;
}

function getCardActionVisibility(
  item: Pick<ScheduleCardItem, 'canCancelLesson' | 'isTemporaryAdjusted' | 'startTime' | 'status'>,
  selectedDate: dayjs.Dayjs,
  now: dayjs.Dayjs,
) {
  // 普通课按钮按“过去 / 非过去”决定主按钮；删除规则对普通课始终保留。
  return {
    canManageBeforeStart: !isPastScheduleDate(selectedDate, now),
    showEditAndReschedule: shouldShowEditAndRescheduleButtons(
      selectedDate,
      item.startTime,
      now,
      Boolean(item.isTemporaryAdjusted),
      item.status,
    ),
    showCancelLesson: shouldShowCancelLessonAction(item, selectedDate, now),
    showDelete: shouldShowDeleteButton(
      selectedDate,
      item.startTime,
      now,
      Boolean(item.isTemporaryAdjusted),
    ),
  };
}

function isBookingSchedule(schedule: Schedule): boolean {
  return Boolean(schedule.tag || schedule.student_id);
}

/**
 * 课表页
 *
 * 按设计图 bb7aaae86d5b28251be2140a59b943e.jpg 复刻为移动端排课列表样式，
 * 保留原有排课、点名、编辑、删除等核心数据流与跳转能力。
 * 单条调课进入独立表单页灵活调整，批量调课改为独立页面，仅覆盖当天课程实例。
 */
const SchedulePage: React.FC = () => {
  const { profile, currentRole } = useAuth();

  // 家长角色进入课表页时重定向到约课页
  React.useEffect(() => {
    if (isParentRole(currentRole)) {
      Taro.redirectTo({ url: '/pages/booking/index' });
    }
  }, [currentRole]);
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

  // 注册页面分享能力
  useShareAppMessage(() => {
    return {
      title: '松果排课 - 开放预约时段',
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
  const [lessonRecords, setLessonRecords] = useState<LessonRecord[]>([]);
  const [temporaryReschedules, setTemporaryReschedules] = useState<TemporaryReschedule[]>([]);
  const [trialClassIds, setTrialClassIds] = useState<Set<string>>(new Set());
  /** 已约试听的班级时段 key: classId|lessonDate */
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
  /** 排课 / 预约 视图切换 */
  const [viewMode, setViewMode] = useState<ScheduleBookingTab>('schedule');
  /** 排课视图内二级模式：fixed=固定排课, open=开放预约 */
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

  /** 课表卡片快速预约弹框 */
  const [bookSheetVisible, setBookSheetVisible] = useState(false);
  const [bookSheetItem, setBookSheetItem] = useState<ScheduleCardItem | null>(null);

  /** 预约视图：老师预约开关列表弹窗 */
  const [teacherSwitchSheetVisible, setTeacherSwitchSheetVisible] = useState(false);

  const handleViewModeChange = useCallback((mode: ScheduleBookingTab) => {
    setViewMode(mode);
  }, []);

  const handleScheduleSubModeChange = useCallback((mode: 'fixed' | 'open') => {
    setScheduleSubMode(mode);
  }, []);

  const loadOpenClassSlots = useCallback(
    async (targetDate: dayjs.Dayjs, force = false) => {
      if (viewMode !== 'schedule' || scheduleSubMode !== 'open') {
        return;
      }
      const openClasses = classes.filter((item) => item.schedule_mode === 'open');
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
    [classes, scheduleSubMode, viewMode],
  );

  const loadOpenSlotDates = useCallback(async () => {
    const openClasses = classes.filter((item) => item.schedule_mode === 'open');
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
  }, [classes]);

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
            .getByTeacherAndRange(currentUserId, startDate, endDate)
            .then(setLessonRecords)
            .catch((err) => {
              logError('SchedulePage refreshDateData records', err);
              Taro.showToast({ title: '课表记录加载失败', icon: 'none' });
            });
          void temporaryRescheduleService
            .getByTeacherAndRange(currentUserId, startDate, endDate)
            .then(setTemporaryReschedules)
            .catch((err) => {
              logError('SchedulePage refreshDateData reschedules', err);
              Taro.showToast({ title: '临时调课加载失败', icon: 'none' });
            });
        }
      }, 150);
    },
    [currentUserId, loadOpenClassSlots, scheduleSubMode, viewMode],
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
      const [scheduleList, classList, teacherList, leadBookings] = await Promise.all([
        scheduleService.getByTeacher(currentUserId),
        classService.getByTeacher(currentUserId),
        teacherService.getList(),
        leadService.getLeadBookingsByTeacher(currentUserId, { status: 'confirmed' }),
      ]);
      await studentService.getByTeacher(currentUserId);
      const classStudentsList = await Promise.all(
        classList.map(async (classItem) => ({
          classId: classItem.id,
          students: await classService.getStudents(classItem.id),
        })),
      );
      const nextTrialClassIds = new Set<string>(
        classStudentsList
          .filter((item) =>
            item.students.some((student) => hasTrialPackage(student.course_packages || [])),
          )
          .map((item) => item.classId),
      );
      const nextTrialBookingKeys = new Set<string>(
        leadBookings
          .filter((b) => b.class_id && b.lesson_date)
          .map((b) => `${b.class_id}|${b.lesson_date}`),
      );
      setSchedules(scheduleList);
      setClasses(classList);
      setTeachers(teacherList);
      setTrialClassIds(nextTrialClassIds);
      setTrialBookingKeys(nextTrialBookingKeys);
    } catch (err) {
      logError('SchedulePage loadBaseData', err);
      Taro.showToast({ title: '课表加载失败', icon: 'none' });
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

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
      );
      setLessonRecords(list);
    } catch (err) {
      logError('SchedulePage loadMonthRecords', err);
      Taro.showToast({ title: '课表记录加载失败', icon: 'none' });
    }
  }, [currentUserId, selectedDate]);

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
    } catch (err) {
      logError('SchedulePage loadTemporaryReschedules', err);
      Taro.showToast({ title: '临时调课加载失败', icon: 'none' });
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
    let hasRefreshSignal = false;
    try {
      hasRefreshSignal = Boolean(Taro.getStorageSync(SCHEDULE_REFRESH_SIGNAL_KEY));
      if (hasRefreshSignal) {
        Taro.removeStorageSync(SCHEDULE_REFRESH_SIGNAL_KEY);
      }
    } catch (err) {
      logError('SchedulePage read refresh signal', err);
    }

    if (hasRefreshSignal) {
      void loadBaseData();
    }
    void loadMonthRecords();
    void loadTemporaryReschedules();
  });

  const classById = useMemo(
    () =>
      classes.reduce<Record<string, Class>>((acc, item) => {
        acc[item.id] = item;
        return acc;
      }, {}),
    [classes],
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
      schedules.reduce<Record<string, Schedule>>((acc, item) => {
        acc[item.id] = item;
        return acc;
      }, {}),
    [schedules],
  );

  const scheduleMapByClass = useMemo(
    () =>
      schedules.reduce<Record<string, Schedule[]>>((acc, item) => {
        if (!item.class_id) {
          return acc;
        }
        if (!acc[item.class_id]) {
          acc[item.class_id] = [];
        }
        acc[item.class_id].push(item);
        return acc;
      }, {}),
    [schedules],
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

      try {
        const parents = await studentService.getParents(studentId);
        for (const binding of parents) {
          await notificationService.send({
            sender_id: currentUserId,
            receiver_id: binding.parent_id,
            title,
            content,
            related_id: studentId,
          });
        }
      } catch (err) {
        logError('SchedulePage notify parents', err);
      }
    },
    [currentUserId],
  );

  const buildCardsForDate = useCallback(
    (date: dayjs.Dayjs): ScheduleCardItem[] => {
      const dateStr = date.format('YYYY-MM-DD');
      const weekday = (date.day() || 7) as Schedule['day_of_week'];
      const dayRecords = lessonRecords.filter((record) => record.lesson_date === dateStr);
      const movedOutScheduleIdSet = new Set(
        temporaryReschedules
          .filter((item) => item.source_date === dateStr)
          .map((item) => item.schedule_id),
      );
      const movedInSchedules = temporaryReschedules
        .filter((item) => item.target_date === dateStr)
        .reduce<Array<Schedule & { __temporaryAdjusted: boolean }>>((acc, item) => {
          const originalSchedule = scheduleById[item.schedule_id];
          if (!originalSchedule) {
            return acc;
          }

          acc.push({
            ...originalSchedule,
            start_time: item.start_time,
            end_time: item.end_time,
            class_id: item.class_id,
            day_of_week: weekday,
            updated_at: item.updated_at,
            note: originalSchedule.note,
            __temporaryAdjusted: true,
          });
          return acc;
        }, []);
      const visibleSchedules = [
        ...schedules
          .filter((schedule) => schedule.day_of_week === weekday)
          .filter((schedule) => !movedOutScheduleIdSet.has(schedule.id)),
        ...movedInSchedules,
      ];

      return visibleSchedules
        .filter((schedule) => !selectedClassId || schedule.class_id === selectedClassId)
        .map((schedule) => {
          const classInfo =
            (schedule.class_id ? classById[schedule.class_id] : undefined) ||
            (schedule.class_id
              ? {
                  id: schedule.class_id,
                  name: schedule.class_info?.name || schedule.note || '未命名班级',
                  teacher_id: '',
                  created_at: '',
                  updated_at: '',
                  type: 'limited',
                  status: 'active',
                  used_lessons: 0,
                  color: 'primary',
                  student_count: schedule.total_count || 0,
                }
              : undefined);
          const recordList = dayRecords.filter((record) =>
            schedule.class_id
              ? record.class_id === schedule.class_id
              : record.student_id === schedule.student_id,
          );
          const totalCount =
            classInfo?.student_count || schedule.total_count || (schedule.student_id ? 1 : 0);
          const { leadTeacherName, assistantTeacherName } = getTeacherNames(
            classInfo,
            teacherById,
            schedule.teacher_name || currentTeacherName,
          );
          const statusResult = resolveScheduleStatus({
            selectedDate: date,
            startTime: schedule.start_time,
            endTime: schedule.end_time,
            records: recordList,
            totalCount,
            now: currentTime,
          });

          return {
            id: schedule.id,
            classId: schedule.class_id,
            campusId: classInfo?.campus_id,
            detailRecordId: recordList[0]?.id,
            className:
              classInfo?.name || schedule.class_info?.name || schedule.note || '未命名班级',
            startTime: schedule.start_time,
            endTime: schedule.end_time,
            leadTeacherName,
            assistantTeacherName,
            note: schedule.note || '',
            checkedCount: statusResult.checkedCount,
            totalCount,
            status: statusResult.status,
            countdownText: statusResult.countdownText,
            bookingTag: isBookingSchedule(schedule) ? '约' : undefined,
            hasTrialStudent: Boolean(
              (schedule.class_id && trialClassIds.has(schedule.class_id)) ||
              trialBookingKeys.has(`${schedule.class_id}|${date.format('YYYY-MM-DD')}`),
            ),
            canCancelLesson: statusResult.status !== 'cancelled',
            isTemporaryAdjusted:
              '__temporaryAdjusted' in schedule ? Boolean(schedule.__temporaryAdjusted) : false,
          };
        })
        .sort(
          (left, right) => parseTimeToMinutes(left.startTime) - parseTimeToMinutes(right.startTime),
        );
    },
    [
      classById,
      currentTime,
      currentTeacherName,
      lessonRecords,
      scheduleById,
      schedules,
      selectedClassId,
      teacherById,
      trialClassIds,
      trialBookingKeys,
      temporaryReschedules,
    ],
  );

  const calendarWeekdaySet = useMemo(() => {
    return new Set(
      schedules
        .filter((item) => !selectedClassId || item.class_id === selectedClassId)
        .map((item) => item.day_of_week),
    );
  }, [schedules, selectedClassId]);
  const getDateDotType = useCallback(
    (date: dayjs.Dayjs): CalendarDotType => {
      const weekday = (date.day() || 7) as Schedule['day_of_week'];
      const dateStr = date.format('YYYY-MM-DD');
      const movedOutScheduleIdSet = new Set(
        temporaryReschedules
          .filter((item) => item.source_date === dateStr)
          .map((item) => item.schedule_id),
      );
      const fixedCount = schedules.filter(
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
    [calendarWeekdaySet, currentTime, schedules, selectedClassId, temporaryReschedules],
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
    return classes
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
  }, [classes, scheduleMapByClass]);

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

  const dangerActionMeta = useMemo(() => {
    if (!dangerActionState.type) {
      return null;
    }

    if (dangerActionState.type === 'batch-delete') {
      return {
        title: '删除提示',
        confirmText: '确认删除',
        tone: 'danger' as const,
        description: `确认删除所选 ${selectedBatchClasses.length} 个班级吗？删除后会向相关学员发送班级解散通知。`,
      };
    }

    const item = dangerActionState.item;
    if (!item) {
      return null;
    }

    if (dangerActionState.type === 'cancel') {
      return {
        title: '取消开课提醒',
        confirmText: '确认取消开课',
        tone: 'warning' as const,
        description: `是否确定取消【${item.className}】${selectedDate.format('YYYY-MM-DD')} ${item.startTime}-${item.endTime}的课，取消后不可恢复并自动发送取消开课提醒给学员`,
      };
    }

    return {
      title: '删除提示',
      confirmText: '确认删除',
      tone: 'danger' as const,
      description: '确认要批量删除所选课节吗，删除后将不能恢复?',
    };
  }, [dangerActionState.item, dangerActionState.type, selectedBatchClasses.length, selectedDate]);

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

  const handlePrimaryAction = useCallback((item: ScheduleCardItem, actionDate: dayjs.Dayjs) => {
    if (item.bookingTag) {
      Taro.navigateTo({
        url: `/pages/booking/index?date=${encodeURIComponent(actionDate.format('YYYY-MM-DD'))}`,
      });
      return;
    }

    // 点击卡片直接进入点名页（班级模式），老师可对学员进行签到/请假/补录等操作
    const checkinUrl =
      `/package-course/pages/lesson-form/index?scheduleId=${encodeURIComponent(item.id)}` +
      `&classId=${encodeURIComponent(item.classId || '')}` +
      `&lessonDate=${encodeURIComponent(actionDate.format('YYYY-MM-DD'))}` +
      `&hasTrialStudent=${item.hasTrialStudent ? '1' : '0'}`;
    Taro.navigateTo({ url: checkinUrl });
  }, []);

  const handleEditSchedule = useCallback(
    (item: ScheduleCardItem) => {
      const visibility = getCardActionVisibility(item, selectedDate, currentTime);
      if (!visibility.showEditAndReschedule) {
        Taro.showToast({ title: '过去日期课程不支持编辑', icon: 'none' });
        return;
      }
      Taro.navigateTo({
        url: `/package-course/pages/schedule-form/index?id=${encodeURIComponent(item.id)}`,
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

      const confirmResult = await Taro.showModal({
        title: '恢复开课',
        content: `确定恢复【${item.className}】${lessonDate} ${item.startTime}-${item.endTime} 的课程吗？`,
        confirmText: '恢复',
        confirmColor: '#2563eb',
      });

      if (!confirmResult.confirm) {
        return;
      }

      try {
        await Promise.all(cancelledRecords.map((record) => lessonRecordService.remove(record.id)));
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
      } catch (err) {
        logError('SchedulePage restore lesson', err);
        Taro.showToast({ title: '恢复失败，请重试', icon: 'none' });
      }
    },
    [lessonRecords, selectedDate],
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
      if (!item.classId) {
        Taro.showToast({ title: '当前课程缺少班级信息', icon: 'none' });
        return;
      }

      const lessonDate = selectedDate.format('YYYY-MM-DD');
      const scheduleInfo = scheduleById[item.id];
      const selectedClass = classes.find((classItem) => classItem.id === item.classId) || null;

      setDangerActionSubmitting(true);
      try {
        const students = await classService.getStudents(item.classId);
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
            content: `取消开课：${item.className} ${item.startTime}-${item.endTime}`,
          });

          createdRecords.push(createdRecord);

          const parents = await studentService.getParents(student.id);
          for (const binding of parents) {
            await notificationService.send({
              sender_id: profile?.id || currentUserId,
              receiver_id: binding.parent_id,
              title: `${selectedClass?.name || item.className}已取消`,
              content: `${lessonDate} ${item.startTime}-${item.endTime} 的课程已取消`,
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
              await notifyStudentAndParents(
                student.id,
                '班级解散通知',
                `您所在的「${classItem.name}」已解散，请留意老师后续安排。`,
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
    } catch (err) {
      logError('SchedulePage remove schedule', err);
      Taro.showToast({ title: '删除失败，请重试', icon: 'none' });
    } finally {
      setDangerActionSubmitting(false);
    }
  }, [
    classes,
    closeDangerActionDialog,
    currentTeacherId,
    currentUserId,
    dangerActionState.item,
    dangerActionState.type,
    notifyStudentAndParents,
    profile?.id,
    scheduleById,
    selectedBatchClasses,
    selectedClassId,
    selectedDate,
  ]);

  const handleCreateSchedule = useCallback(() => {
    Taro.navigateTo({ url: '/package-course/pages/schedule-form/index' });
  }, []);

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
      const summary = {
        total: cards.length,
        checked: cards.filter((item) => item.checkedCount > 0).length,
        unchecked: Math.max(cards.length - cards.filter((item) => item.checkedCount > 0).length, 0),
      };

      return { cards, summary };
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
                  <View className="rounded-[16rpx] bg-white py-[80rpx] shadow-card">
                    <Empty icon="mdi-calendar-blank" description="当前日期暂无课程安排" />
                  </View>
                ) : null}

                <View className="flex flex-col gap-[14rpx]">
                  {cards.map((item) => {
                    const actionVisibility = getCardActionVisibility(item, date, currentTime);
                    const isCancelled = item.status === 'cancelled';
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
                        <ScheduleCard item={item}>
                          {/* 卡片底部：未开始课程保留「约试听」入口 */}
                          {(item.status === 'upcoming' || item.status === 'urgent') && (
                            <View className="flex items-center justify-end">
                              <ScheduleActionButton
                                label="约试听"
                                variant="edit"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenBookSheet(item);
                                }}
                              />
                            </View>
                          )}
                        </ScheduleCard>
                      </SwappableScheduleCard>
                    );
                  })}
                </View>
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
      handlePrimaryAction,
      handleEditSchedule,
      handleCancelLesson,
      handleRestoreLesson,
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
      const subjectId = classes.find((item) => item.id === slot.class_id)?.subject_id || '';
      void Taro.navigateTo({
        url:
          `/package-lead/pages/proxy-booking-form/index?teacherId=${encodeURIComponent(slot.teacher_id)}` +
          `&date=${date}&time=${time}&endTime=${endTime}&mode=group` +
          `&classId=${encodeURIComponent(slot.class_id)}&className=${className}` +
          `&subjectId=${encodeURIComponent(subjectId)}`,
      });
    },
    [classes],
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
      const openClasses = classes.filter((item) => item.schedule_mode === 'open');
      const dateSlots = openClassSlots[dateStr] || {};
      const isDateLoading = loadingOpenSlotDates.has(dateStr);
      const isDateError = errorOpenSlotDates.has(dateStr);
      const allSlots = Object.values(dateSlots)
        .flat()
        .sort(
          (left, right) =>
            parseTimeToMinutes(left.start_time) - parseTimeToMinutes(right.start_time),
        );
      const summaryFullSlots = allSlots.filter((s) => s.status === 'full').length;
      const summaryActiveSlots = allSlots.filter((s) => s.status === 'active').length;
      const summaryRestSlots = allSlots.filter((s) => s.status === 'rest').length;
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
                  {summaryRestSlots > 0 ? (
                    <>
                      ，<Text className="ml-[8rpx]">休息：</Text>
                      <Text className="font-semibold text-foreground-secondary">
                        {summaryRestSlots}
                      </Text>
                      个
                    </>
                  ) : null}
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
                      className="m-0 h-[64rpx] px-[32rpx] text-[28rpx] leading-[64rpx] rounded-[32rpx] bg-primary text-white"
                      onClick={() => loadOpenClassSlots(date, true)}
                    >
                      点击重试
                    </Button>
                  </View>
                ) : null}

                {!isDateLoading && !isDateError && allSlots.length === 0 ? (
                  <View className="rounded-[16rpx] bg-white py-[80rpx] shadow-card">
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

                    return (
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
                            isRest ? 'bg-muted border border-border' : 'bg-white',
                          )}
                        >
                          <View className="flex">
                            {/* 左侧时间轴 */}
                            <View className="flex w-[116rpx] flex-shrink-0 flex-col items-center py-[2rpx]">
                              <View className="flex items-center gap-[8rpx]">
                                <View className="h-[12rpx] w-[12rpx] rounded-full bg-black" />
                                <Text className="text-[34rpx] font-bold leading-none text-foreground">
                                  {slot.start_time}
                                </Text>
                              </View>
                              <View className="flex w-[2rpx] flex-1 flex-col items-center py-[4rpx]">
                                <View className="w-[2rpx] flex-1 bg-[#e8e8e8]" />
                                {duration ? (
                                  <View className="py-[2rpx]">
                                    <Text className="text-[22rpx] text-muted-foreground">
                                      {duration}
                                    </Text>
                                  </View>
                                ) : null}
                                <View className="w-[2rpx] flex-1 bg-[#e8e8e8]" />
                              </View>
                              <View className="flex items-center gap-[8rpx]">
                                <View className="h-[12rpx] w-[12rpx] rounded-full border-[3rpx] border-black bg-transparent" />
                                <Text className="text-[34rpx] font-bold leading-none text-foreground">
                                  {slot.end_time}
                                </Text>
                              </View>
                            </View>

                            {/* 右侧内容 */}
                            <View className="relative ml-[16rpx] flex flex-1 flex-col justify-between">
                              <Button
                                className="absolute -right-[8rpx] -top-[8rpx] z-10 flex h-[48rpx] w-[48rpx] items-center justify-center border-none bg-transparent p-0 leading-none after:border-none active:opacity-60"
                                openType="share"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <Icon name="mdi-share-variant" size={28} color="#999999" />
                              </Button>

                              <View>
                                <Text className="pr-[44rpx] text-[36rpx] font-bold leading-tight text-foreground">
                                  {cls?.name || slot.class_name || '未命名班级'}
                                </Text>
                                <View className="mt-[12rpx] flex flex-wrap items-center gap-[12rpx]">
                                  {cls?.level ? (
                                    <View className="rounded-[10rpx] bg-[#f5f5f5] px-[14rpx] py-[6rpx]">
                                      <Text className="text-[24rpx] font-medium leading-none text-[#666666]">
                                        {CLASS_LEVEL_LABELS[cls.level]}
                                      </Text>
                                    </View>
                                  ) : null}
                                  {slot.room ? (
                                    <View className="flex items-center gap-[6rpx] rounded-[10rpx] bg-[#f5f5f5] px-[14rpx] py-[6rpx]">
                                      <Icon name="mdi-map-marker" size={18} color="#999999" />
                                      <Text className="text-[24rpx] font-medium leading-none text-[#666666]">
                                        {slot.room}
                                      </Text>
                                    </View>
                                  ) : null}
                                </View>
                              </View>

                              <View className="mt-[12rpx] flex items-center gap-[12rpx]">
                                <Image
                                  src={BRAND_LOGO}
                                  className="h-[40rpx] w-[40rpx] rounded-full border border-[#e8e8e8] bg-white"
                                  mode="aspectFit"
                                />
                                <Text className="text-[26rpx] text-[#333333]">{teacherName}</Text>
                              </View>
                            </View>
                          </View>

                          {/* 底部操作栏：已约学员头像 + 代约加号按钮 + 人数 */}
                          <View className="mt-[18rpx] flex items-center justify-between border-t border-[#f0f0f0] pt-[14rpx]">
                            <View className="flex flex-1 items-center min-w-0 overflow-hidden">
                              {/* 已约学员头像从左往右排列，互相轻微压住，最多展示前 x 个 */}
                              {(slot.booking_students || [])
                                .slice(0, OPEN_BOOKING_MAX_VISIBLE_AVATARS)
                                .map((student, index) => (
                                  <Image
                                    key={student.id}
                                    src={student.avatar || BRAND_LOGO}
                                    className={cn(
                                      'relative h-[60rpx] w-[60rpx] flex-shrink-0 rounded-full border-2 border-white bg-muted',
                                      index > 0 && '-ml-[16rpx]',
                                    )}
                                    mode="aspectFill"
                                  />
                                ))}

                              {/* 代约加号按钮：无预约时在最左侧，随头像增多被挤到最右侧 */}
                              <View
                                className="relative flex h-[60rpx] w-[60rpx] flex-shrink-0 items-center justify-center rounded-full border border-[#e8e8e8] bg-[#f8f8f8] active:opacity-80"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleProxyBooking(slot);
                                }}
                              >
                                <Icon name="mdi-plus" size={30} color="#999999" />
                              </View>
                            </View>

                            <Text className="ml-[24rpx] flex-shrink-0 text-[30rpx] font-semibold text-foreground">
                              <Text className="text-[34rpx] font-bold text-[#333333]">
                                {slot.current_count}
                              </Text>
                              <Text className="text-[24rpx] font-medium text-[#999999]">
                                /{slot.max_count}人
                              </Text>
                            </Text>
                          </View>
                        </View>
                      </SwappableScheduleCard>
                    );
                  })}
                </View>
              </View>
            </View>
          </ScrollView>
        </View>
      );
    },
    [
      classes,
      openClassSlots,
      loadingOpenSlotDates,
      errorOpenSlotDates,
      openCardId,
      teacherById,
      loadOpenClassSlots,
      handleOpenClassSlotConfig,
      handleProxyBooking,
      handleEditOpenSlot,
      handleCancelOpenSlot,
      handleRestoreOpenSlot,
    ],
  );

  // 注意：不传 safeBottom — pb-safe-bottom 会给外层 View 增加安全区 padding，
  // 使得 PageContainer 总高度（min-h-screen + safe-area）超过视口，
  // 在 tabBar 页面中产生页面级背景滚动条，与 TrialBookingView 内的 ScrollView
  // 形成双滚动条，背景滚动消费垂直手势后影响卡片列表的滚动效果。
  // 底部间距已由各视图内容区的 pb-[160rpx] 处理，FAB 按钮为 fixed 定位不受影响。
  return (
    <PageContainer className="bg-schedule-page">
      <View className="relative h-screen bg-schedule-page flex flex-col overflow-hidden">
        <View className="bg-schedule-header flex-shrink-0">
          <View
            className="flex items-end px-[18rpx] pb-[18rpx]"
            style={{ height: `${navSafeHeight}px` }}
          >
            <View className="flex items-center gap-[14rpx]">
              <ScheduleBookingSwitch
                active={viewMode}
                variant="dark"
                onChange={handleViewModeChange}
              />
              {viewMode === 'schedule' && (
                <View
                  className="flex h-[64rpx] items-center gap-[8rpx] px-[22rpx] active:opacity-80"
                  onClick={handleBatchAction}
                >
                  <Icon name="mdi-clipboard-text" size="sm" color="white" />
                  <Text className="text-[28rpx] font-medium text-white">批量</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {viewMode === 'schedule' && (
          <>
            <View className="bg-schedule-page flex-shrink-0">
              <CalendarWeekSelector
                selectedDate={selectedDate}
                onChange={handleScheduleDateChange}
                getDateDotType={scheduleSubMode === 'fixed' ? getDateDotType : getOpenDateDotType}
              />
            </View>

            <View className="flex items-center justify-center bg-schedule-page py-[16rpx]">
              <View className="inline-flex items-center rounded-full bg-muted p-[6rpx]">
                {[
                  { key: 'fixed' as const, label: '固定排课' },
                  { key: 'open' as const, label: '开放预约' },
                ].map((tab) => {
                  const isActive = scheduleSubMode === tab.key;
                  return (
                    <View
                      key={tab.key}
                      className={cn(
                        'center min-w-[160rpx] rounded-full border px-[28rpx] py-[12rpx] transition-colors active:scale-95',
                        isActive
                          ? 'border-primary bg-primary shadow-md'
                          : 'border-transparent bg-transparent text-muted-foreground',
                      )}
                      onClick={() => handleScheduleSubModeChange(tab.key)}
                    >
                      <Text
                        className={cn(
                          'text-[28rpx] font-medium',
                          isActive ? 'text-white' : 'text-muted-foreground',
                        )}
                      >
                        {tab.label}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {scheduleSubMode === 'fixed' ? (
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
            ) : (
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

            <BottomSheet
              visible={batchActionSheetVisible}
              title="批量处理"
              onClose={() => setBatchActionSheetVisible(false)}
              scrollable={false}
              className="pb-safe-bar"
            >
              <View className="px-[24rpx] py-[18rpx]">
                <View className="rounded-[18rpx] bg-[#f6f8fc] px-[18rpx] py-[16rpx]">
                  <Text className="text-[24rpx] text-muted-foreground">请选择要执行的批量操作</Text>
                </View>
              </View>
              <View className="px-[24rpx] pb-[32rpx] flex flex-col gap-[18rpx]">
                <View
                  className="rounded-[22rpx] border border-[#dceafe] bg-[linear-gradient(180deg,#f8fbff_0%,#eef5ff_100%)] px-[24rpx] py-[24rpx]"
                  onClick={() => handleChooseBatchType('reschedule')}
                >
                  <View className="flex items-center justify-between gap-[16rpx]">
                    <View className="flex items-center gap-[16rpx]">
                      <View className="flex h-[80rpx] w-[80rpx] items-center justify-center rounded-[22rpx] bg-white shadow-[0_6rpx_16rpx_rgba(59,110,245,0.10)]">
                        <Icon name="mdi-calendar-check-outline" size="md" color="primary" />
                      </View>
                      <View className="min-w-0 flex-1">
                        <View className="flex items-center gap-[10rpx]">
                          <Text className="text-[30rpx] font-semibold text-foreground">
                            批量调课
                          </Text>
                          <View className="rounded-full bg-white/80 px-[12rpx] py-[6rpx]">
                            <Text className="text-[20rpx] font-medium text-primary">只调当天</Text>
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
                  className="rounded-[22rpx] border border-[#fde2e2] bg-[linear-gradient(180deg,#fff8f8_0%,#fff1f1_100%)] px-[24rpx] py-[24rpx]"
                  onClick={() => handleChooseBatchType('delete')}
                >
                  <View className="flex items-center justify-between gap-[16rpx]">
                    <View className="flex items-center gap-[16rpx]">
                      <View className="flex h-[80rpx] w-[80rpx] items-center justify-center rounded-[22rpx] bg-white shadow-[0_6rpx_16rpx_rgba(239,68,68,0.08)]">
                        <Icon name="mdi-delete-outline" size="md" color="destructive" />
                      </View>
                      <View className="min-w-0 flex-1">
                        <View className="flex items-center gap-[10rpx]">
                          <Text className="text-[30rpx] font-semibold text-destructive">
                            批量删除
                          </Text>
                          <View className="rounded-full bg-white/85 px-[12rpx] py-[6rpx]">
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
                  <Text className="text-[24rpx] text-primary" onClick={handleSelectAllBatchClasses}>
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
                        checked ? 'border-primary bg-primary-10' : 'border-schedule-soft bg-white',
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

              <View className="border-t border-schedule-soft px-[24rpx] pt-[20rpx] pb-[24rpx] flex gap-[16rpx] bg-white">
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
                  <Text className="text-[28rpx] font-semibold text-white">
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

        {viewMode === 'booking' && (
          <TrialBookingView
            className="min-h-0 flex-1"
            onSuccess={() => setViewMode('schedule')}
            switchSheetVisible={teacherSwitchSheetVisible}
            onSwitchSheetClose={() => setTeacherSwitchSheetVisible(false)}
          />
        )}

        {/* 悬浮加号按钮：固定排课进入排课表单，预约视图打开老师预约开关弹窗；开放预约使用卡片内加号 */}
        {!(viewMode === 'schedule' && scheduleSubMode === 'open') && (
          <View
            className="fixed bottom-[160rpx] right-[32rpx] z-100"
            onClick={viewMode === 'schedule' ? handleCreateSchedule : handleManageBookingConfig}
          >
            <View className="flex h-[72rpx] w-[72rpx] items-center justify-center rounded-full bg-schedule-attend shadow-schedule-fab">
              <Icon name="mdi-plus" size="md" color="white" />
            </View>
          </View>
        )}

        <BookTrialByClassSheet
          visible={bookSheetVisible}
          classId={bookSheetItem?.classId}
          campusId={bookSheetItem?.campusId}
          className={bookSheetItem?.className}
          lessonDate={bookSheetItem ? selectedDate.format('YYYY-MM-DD') : ''}
          startTime={bookSheetItem?.startTime || ''}
          endTime={bookSheetItem?.endTime || ''}
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
    navigationBarTitleText: '课表',
    enableShareAppMessage: true,
    enableShareTimeline: true,
  };
}
