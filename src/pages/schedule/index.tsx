import { View, Text, ScrollView, Swiper, SwiperItem } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import cn from 'classnames';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import BottomSheet from '@/components/BottomSheet';
import CalendarWeekSelector, { type CalendarDotType } from '@/components/CalendarWeekSelector';
import CircleCheckbox from '@/components/CircleCheckbox';
import Empty from '@/components/Empty';
import Icon from '@/components/Icon';
import PageContainer from '@/components/PageContainer';
import {
  classService,
  lessonRecordService,
  notificationService,
  scheduleService,
  studentService,
  teacherService,
  temporaryRescheduleService,
} from '@/services';
import type { Class } from '@/types/class';
import type { LessonRecord } from '@/types/lesson-record';
import type { Schedule } from '@/types/schedule';
import type { TeacherUIModel } from '@/types/teacher';
import type { TemporaryReschedule } from '@/types/temporary-reschedule';
import { useAuth } from '@/utils/auth';
import { logError } from '@/utils/logger';
import { withRouteGuard } from '@/utils/route-guard';
import { useNavSafeHeight } from '@/utils/use-nav-safe-height';

type ScheduleCardStatus = 'urgent' | 'upcoming' | 'active' | 'done' | 'ended' | 'cancelled';
type BatchActionType = 'reschedule' | 'delete';

interface ScheduleCardItem {
  id: string;
  classId?: string;
  className: string;
  startTime: string;
  endTime: string;
  leadTeacherName: string;
  assistantTeacherName?: string;
  checkedCount: number;
  totalCount: number;
  status: ScheduleCardStatus;
  countdownText?: string;
  bookingTag?: string;
  canCancelLesson: boolean;
  isTemporaryAdjusted?: boolean;
}

const FULL_WEEKDAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'] as const;
const FILTER_ALL_CLASS = '';
const SCHEDULE_CARD_SWIPER_DURATION = 260;
const SCHEDULE_WINDOW_SIZE = 9;
const SCHEDULE_WINDOW_PRELOAD_THRESHOLD = 2;
const SCHEDULE_WINDOW_EXTEND_COUNT = 4;

function buildScheduleDateWindow(centerDate: dayjs.Dayjs): dayjs.Dayjs[] {
  const half = Math.floor(SCHEDULE_WINDOW_SIZE / 2);
  return Array.from({ length: SCHEDULE_WINDOW_SIZE }, (_, index) =>
    centerDate.add(index - half, 'day'),
  );
}

function findDayIndex(list: dayjs.Dayjs[], target: dayjs.Dayjs): number {
  return list.findIndex((item) => item.isSame(target, 'day'));
}

function parseTimeToMinutes(time: string): number {
  const [hour, minute] = time.split(':').map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return 0;
  }
  return hour * 60 + minute;
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
      .filter((record) => record.status !== 'cancelled')
      .map((record) => record.student_id),
  ).size;
  const hasCancelled = records.length > 0 && records.every((record) => record.status === 'cancelled');
  const hasMakeup = records.some((record) => record.status === 'makeup');

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
    if (checkedCount > 0) {
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

  const nowMinutes = now.hour() * 60 + now.minute();
  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);
  const diffMinutes = startMinutes - nowMinutes;

  if (checkedCount > 0 && nowMinutes <= endMinutes && checkedCount < totalCount) {
    return {
      status: 'active' as const,
      checkedCount,
      countdownText: undefined,
      hasMakeup,
    };
  }

  if (checkedCount > 0 && (checkedCount >= totalCount || nowMinutes > endMinutes)) {
    return {
      status: 'done' as const,
      checkedCount,
      countdownText: undefined,
      hasMakeup,
    };
  }

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

function getDisplayedTeacherName(item: ScheduleCardItem): string {
  return item.assistantTeacherName
    ? `${item.leadTeacherName}、${item.assistantTeacherName}`
    : item.leadTeacherName;
}

function getWeekdayText(dayOfWeek: Schedule['day_of_week']): string {
  return FULL_WEEKDAY_LABELS[dayOfWeek - 1];
}

function hasLessonEnded(selectedDate: dayjs.Dayjs, endTime: string, now: dayjs.Dayjs): boolean {
  if (selectedDate.isBefore(now, 'day')) {
    return true;
  }
  if (selectedDate.isAfter(now, 'day')) {
    return false;
  }
  return parseTimeToMinutes(now.format('HH:mm')) > parseTimeToMinutes(endTime);
}

function hasLessonStarted(selectedDate: dayjs.Dayjs, startTime: string, now: dayjs.Dayjs): boolean {
  if (selectedDate.isBefore(now, 'day')) {
    return true;
  }
  if (selectedDate.isAfter(now, 'day')) {
    return false;
  }
  return parseTimeToMinutes(now.format('HH:mm')) >= parseTimeToMinutes(startTime);
}

function canManageLessonBeforeStart(
  selectedDate: dayjs.Dayjs,
  startTime: string,
  now: dayjs.Dayjs,
): boolean {
  return !hasLessonStarted(selectedDate, startTime, now);
}

function canCancelLessonButton(
  selectedDate: dayjs.Dayjs,
  startTime: string,
  now: dayjs.Dayjs,
): boolean {
  // 不是当天的课程，不显示取消开课
  if (!selectedDate.isSame(now, 'day')) {
    return false;
  }
  // 已经开课了，不显示取消开课
  if (hasLessonStarted(selectedDate, startTime, now)) {
    return false;
  }
  // 计算距离开课还有多少分钟
  const nowMinutes = parseTimeToMinutes(now.format('HH:mm'));
  const startMinutes = parseTimeToMinutes(startTime);
  const minutesUntilStart = startMinutes - nowMinutes;
  // 必须在开课前1小时以上才能取消开课
  return minutesUntilStart > 60;
}

function shouldShowEditAndRescheduleButtons(
  selectedDate: dayjs.Dayjs,
  startTime: string,
  now: dayjs.Dayjs,
  isTemporaryAdjusted: boolean,
): boolean {
  // 临时调课的课程不显示调课和编辑
  if (isTemporaryAdjusted) {
    return false;
  }
  // 过去的课程不显示
  if (hasLessonEnded(selectedDate, '23:59', now)) {
    return false;
  }
  // 未开始的课程可以显示
  return !hasLessonStarted(selectedDate, startTime, now);
}

function shouldShowDeleteButton(
  selectedDate: dayjs.Dayjs,
  startTime: string,
  now: dayjs.Dayjs,
  isTemporaryAdjusted: boolean,
): boolean {
  // 临时调课的课程不显示删除
  if (isTemporaryAdjusted) {
    return false;
  }
  // 过去的课程不显示
  if (hasLessonEnded(selectedDate, '23:59', now)) {
    return false;
  }
  // 未开始的课程可以显示
  return !hasLessonStarted(selectedDate, startTime, now);
}

function getPrimaryActionText(
  item: ScheduleCardItem,
  selectedDate: dayjs.Dayjs,
  currentTime: dayjs.Dayjs,
): string {
  if (hasLessonEnded(selectedDate, item.endTime, currentTime)) {
    return '补录';
  }
  if (item.status === 'done' || item.status === 'cancelled') {
    return '点名';
  }
  return '点名';
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
  const { profile } = useAuth();
  const currentUserId = profile?.id || '';
  const currentTeacherName = profile?.name || '当前老师';
  const navSafeHeight = useNavSafeHeight();

  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [currentTime, setCurrentTime] = useState(dayjs());
  const [scheduleDateWindow, setScheduleDateWindow] = useState(() =>
    buildScheduleDateWindow(dayjs()),
  );
  const [swiperCurrent, setSwiperCurrent] = useState(() =>
    Math.floor(SCHEDULE_WINDOW_SIZE / 2),
  );
  const [selectedClassId, setSelectedClassId] = useState(FILTER_ALL_CLASS);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [teachers, setTeachers] = useState<TeacherUIModel[]>([]);
  const [lessonRecords, setLessonRecords] = useState<LessonRecord[]>([]);
  const [temporaryReschedules, setTemporaryReschedules] = useState<TemporaryReschedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [batchActionType, setBatchActionType] = useState<BatchActionType>('reschedule');
  const [batchActionSheetVisible, setBatchActionSheetVisible] = useState(false);
  const [batchClassSheetVisible, setBatchClassSheetVisible] = useState(false);
  const [batchSelectedClassIds, setBatchSelectedClassIds] = useState<string[]>([]);
  const [batchSubmitting, setBatchSubmitting] = useState(false);

  const loadBaseData = useCallback(async () => {
    if (!currentUserId) {
      return;
    }
    setLoading(true);
    try {
      const [scheduleList, classList, teacherList] = await Promise.all([
        scheduleService.getByTeacher(currentUserId),
        classService.getByTeacher(currentUserId),
        teacherService.getList(),
      ]);
      setSchedules(scheduleList);
      setClasses(classList);
      setTeachers(teacherList);
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
      const list = await lessonRecordService.getByTeacherAndRange(currentUserId, startDate, endDate);
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
      const list = await temporaryRescheduleService.getByTeacherAndRange(currentUserId, startDate, endDate);
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
    loadMonthRecords();
  }, [loadMonthRecords]);

  useEffect(() => {
    loadTemporaryReschedules();
  }, [loadTemporaryReschedules]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(dayjs());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  useDidShow(() => {
    void loadMonthRecords();
    void loadTemporaryReschedules();
  });

  useEffect(() => {
    setScheduleDateWindow((prev) => {
      const index = findDayIndex(prev, selectedDate);
      if (index >= 0) {
        setSwiperCurrent(index);
        return prev;
      }
      setSwiperCurrent(Math.floor(SCHEDULE_WINDOW_SIZE / 2));
      return buildScheduleDateWindow(selectedDate);
    });
  }, [selectedDate]);

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

  const selectedDateStr = selectedDate.format('YYYY-MM-DD');
  const selectedWeekday = (selectedDate.day() || 7) as Schedule['day_of_week'];

  const cards = useMemo<ScheduleCardItem[]>(() => {
    const dayRecords = lessonRecords.filter((record) => record.lesson_date === selectedDateStr);
    const movedOutScheduleIdSet = new Set(
      temporaryReschedules
        .filter((item) => item.source_date === selectedDateStr)
        .map((item) => item.schedule_id),
    );
    const movedInSchedules = temporaryReschedules
      .filter((item) => item.target_date === selectedDateStr)
      .map((item) => {
        const originalSchedule = scheduleById[item.schedule_id];
        if (!originalSchedule) {
          return null;
        }
        return {
          ...originalSchedule,
          start_time: item.start_time,
          end_time: item.end_time,
          class_id: item.class_id,
          day_of_week: selectedWeekday,
          updated_at: item.updated_at,
          note: originalSchedule.note,
          __temporaryAdjusted: true,
        };
      })
      .filter(
        (item): item is Schedule & { __temporaryAdjusted: boolean } =>
          Boolean(item),
      );
    const visibleSchedules = [
      ...schedules
        .filter((schedule) => schedule.day_of_week === selectedWeekday)
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
        const totalCount = classInfo?.student_count || schedule.total_count || (schedule.student_id ? 1 : 0);
        const { leadTeacherName, assistantTeacherName } = getTeacherNames(
          classInfo,
          teacherById,
          schedule.teacher_name || currentTeacherName,
        );
        const statusResult = resolveScheduleStatus({
          selectedDate,
          startTime: schedule.start_time,
          endTime: schedule.end_time,
          records: recordList,
          totalCount,
          now: currentTime,
        });

        return {
          id: schedule.id,
          classId: schedule.class_id,
          className: classInfo?.name || schedule.class_info?.name || schedule.note || '未命名班级',
          startTime: schedule.start_time,
          endTime: schedule.end_time,
          leadTeacherName,
          assistantTeacherName,
          checkedCount: statusResult.checkedCount,
          totalCount,
          status: statusResult.status,
          countdownText: statusResult.countdownText,
          bookingTag: isBookingSchedule(schedule) ? '约' : undefined,
          canCancelLesson: isBookingSchedule(schedule) || statusResult.hasMakeup,
          isTemporaryAdjusted:
            '__temporaryAdjusted' in schedule ? Boolean(schedule.__temporaryAdjusted) : false,
        };
      })
      .sort((left, right) => parseTimeToMinutes(left.startTime) - parseTimeToMinutes(right.startTime));
  }, [
    classById,
    currentTime,
    currentTeacherName,
    lessonRecords,
    scheduleById,
    schedules,
    selectedClassId,
    selectedDate,
    selectedDateStr,
    selectedWeekday,
    teacherById,
    temporaryReschedules,
  ]);

  const summary = useMemo(() => {
    const checked = cards.filter((item) => item.checkedCount > 0).length;
    return {
      total: cards.length,
      checked,
      unchecked: Math.max(cards.length - checked, 0),
    };
  }, [cards]);
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
          item.target_date === dateStr &&
          (!selectedClassId || item.class_id === selectedClassId),
      ).length;

      if (!calendarWeekdaySet.has(weekday) && movedInCount === 0) {
        return 'none';
      }
      if (fixedCount + movedInCount === 0) {
        return 'none';
      }
      return date.isBefore(dayjs(), 'day') ? 'past' : 'active';
    },
    [calendarWeekdaySet, schedules, selectedClassId, temporaryReschedules],
  );

  const batchClassOptions = useMemo(() => {
    return classes
      .filter((item) => item.status === 'active')
      .map((item) => {
        const relatedSchedules = [...(scheduleMapByClass[item.id] || [])].sort(
          (left, right) => parseTimeToMinutes(left.start_time) - parseTimeToMinutes(right.start_time),
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

  const handlePrimaryAction = useCallback((item: ScheduleCardItem) => {
    if (item.status === 'done' || item.status === 'cancelled') {
      Taro.navigateTo({ url: '/package-teacher/pages/attendance/index' });
      return;
    }
    Taro.navigateTo({
      url: `/package-course/pages/lesson-form/index?scheduleId=${encodeURIComponent(item.id)}&classId=${encodeURIComponent(item.classId || '')}`,
    });
  }, []);

  const handleAdjustSchedule = useCallback((item: ScheduleCardItem) => {
    if (!canManageLessonBeforeStart(selectedDate, item.startTime, currentTime)) {
      Taro.showToast({ title: '已开课或已结束课程不支持调课', icon: 'none' });
      return;
    }
    Taro.navigateTo({
      url: `/package-course/pages/schedule-form/index?id=${encodeURIComponent(item.id)}&mode=reschedule`,
    });
  }, [currentTime, selectedDate]);

  const handleEditSchedule = useCallback((item: ScheduleCardItem) => {
    if (!canManageLessonBeforeStart(selectedDate, item.startTime, currentTime)) {
      Taro.showToast({ title: '已开课或已结束课程不支持编辑', icon: 'none' });
      return;
    }
    Taro.navigateTo({
      url: `/package-course/pages/schedule-form/index?id=${encodeURIComponent(item.id)}`,
    });
  }, [currentTime, selectedDate]);

  const handleDeleteSchedule = useCallback(async (item: ScheduleCardItem) => {
    // 取消开课（约课/补课）
    if (item.canCancelLesson) {
      if (!canCancelLessonButton(selectedDate, item.startTime, currentTime)) {
        Taro.showToast({ title: '距离开课不足1小时，无法取消开课', icon: 'none' });
        return;
      }
      Taro.navigateTo({
        url: `/package-course/pages/lesson-form/index?scheduleId=${encodeURIComponent(item.id)}&classId=${encodeURIComponent(item.classId || '')}`,
      });
      return;
    }

    // 删除排课规则
    if (!shouldShowDeleteButton(selectedDate, item.startTime, currentTime, item.isTemporaryAdjusted)) {
      Taro.showToast({ title: '已开课或已结束课程不支持删除', icon: 'none' });
      return;
    }

    const { confirm } = await Taro.showModal({
      title: '删除排课',
      content: `确认删除“${item.className} ${item.startTime}-${item.endTime}”吗？`,
      confirmText: '删除',
      confirmColor: '#f97768',
    });
    if (!confirm) {
      return;
    }

    try {
      await scheduleService.remove(item.id);
      setSchedules((prev) => prev.filter((schedule) => schedule.id !== item.id));
      Taro.showToast({ title: '删除成功', icon: 'success' });
    } catch (err) {
      logError('SchedulePage remove schedule', err);
      Taro.showToast({ title: '删除失败，请重试', icon: 'none' });
    }
  }, [currentTime, selectedDate]);

  const handleCreateSchedule = useCallback(() => {
    Taro.navigateTo({ url: '/package-course/pages/schedule-form/index' });
  }, []);

  const handleBatchAction = useCallback(() => {
    const initialSelectedIds =
      selectedClassId && selectedClassId !== FILTER_ALL_CLASS ? [selectedClassId] : [];
    setBatchSelectedClassIds(initialSelectedIds);
    setBatchActionSheetVisible(true);
  }, [selectedClassId]);

  const handleBack = useCallback(() => {
    Taro.navigateBack({
      fail: () => {
        void Taro.switchTab({ url: '/pages/home/index' });
      },
    });
  }, []);

  const handleScheduleDateChange = useCallback((date: dayjs.Dayjs) => {
    setSelectedDate(date);
  }, []);

  const handleSwiperChange = useCallback((event: { detail?: { current?: number } }) => {
    setSwiperCurrent(event.detail?.current ?? Math.floor(SCHEDULE_WINDOW_SIZE / 2));
  }, []);

  const handleSwiperFinish = useCallback((event: { detail?: { current?: number } }) => {
    const currentIndex = event.detail?.current ?? swiperCurrent;
    const currentDate = scheduleDateWindow[currentIndex];
    if (!currentDate) {
      return;
    }

    if (!currentDate.isSame(selectedDate, 'day')) {
      handleScheduleDateChange(currentDate);
    }

    if (currentIndex <= SCHEDULE_WINDOW_PRELOAD_THRESHOLD) {
      const firstDate = scheduleDateWindow[0];
      const prependDates = Array.from({ length: SCHEDULE_WINDOW_EXTEND_COUNT }, (_, index) =>
        firstDate.subtract(SCHEDULE_WINDOW_EXTEND_COUNT - index, 'day'),
      );
      setScheduleDateWindow([...prependDates, ...scheduleDateWindow]);
      setSwiperCurrent(currentIndex + SCHEDULE_WINDOW_EXTEND_COUNT);
      return;
    }

    if (currentIndex >= scheduleDateWindow.length - 1 - SCHEDULE_WINDOW_PRELOAD_THRESHOLD) {
      const lastDate = scheduleDateWindow[scheduleDateWindow.length - 1];
      const appendDates = Array.from({ length: SCHEDULE_WINDOW_EXTEND_COUNT }, (_, index) =>
        lastDate.add(index + 1, 'day'),
      );
      setScheduleDateWindow([...scheduleDateWindow, ...appendDates]);
    }
  }, [handleScheduleDateChange, scheduleDateWindow, selectedDate, swiperCurrent]);

  const renderDateCards = useCallback((date: dayjs.Dayjs) => {
    const dateStr = date.format('YYYY-MM-DD');
    const weekday = (date.day() || 7) as Schedule['day_of_week'];
    const movedOutScheduleIdSet = new Set(
      temporaryReschedules
        .filter((item) => item.source_date === dateStr)
        .map((item) => item.schedule_id),
    );

    const movedInSchedules = temporaryReschedules
      .filter((item) => item.target_date === dateStr)
      .map((item) => ({
        ...(scheduleById[item.schedule_id]!),
        start_time: item.target_start_time,
        end_time: item.target_end_time,
        __temporaryAdjusted: true,
      }));

    const fixedSchedules = schedules
      .filter((item) => item.day_of_week === weekday)
      .filter((item) => !selectedClassId || item.class_id === selectedClassId)
      .filter((item) => !movedOutScheduleIdSet.has(item.id))
      .filter((item) => !movedInSchedules.find((ms) => ms.id === item.id));

    const combinedSchedules = [...fixedSchedules, ...movedInSchedules];
    const cards: ScheduleCardItem[] = combinedSchedules
      .map((schedule) => {
        const classInfo = classById[schedule.class_id];
        const leadTeacher = teacherById[schedule.teacher_id];
        const assistantTeacher = schedule.assistant_teacher_id
          ? teacherById[schedule.assistant_teacher_id]
          : null;
        const leadTeacherName = leadTeacher?.name || currentTeacherName;
        const assistantTeacherName = assistantTeacher?.name;

        const recordList = lessonRecords.filter(
          (item) => item.class_id === schedule.class_id && item.schedule_date === dateStr,
        );
        const totalCount = classInfo?.student_count || 0;

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
          className: classInfo?.name || schedule.class_info?.name || schedule.note || '未命名班级',
          startTime: schedule.start_time,
          endTime: schedule.end_time,
          leadTeacherName,
          assistantTeacherName,
          checkedCount: statusResult.checkedCount,
          totalCount,
          status: statusResult.status,
          countdownText: statusResult.countdownText,
          bookingTag: isBookingSchedule(schedule) ? '约' : undefined,
          canCancelLesson: isBookingSchedule(schedule) || statusResult.hasMakeup,
          isTemporaryAdjusted:
            '__temporaryAdjusted' in schedule ? Boolean(schedule.__temporaryAdjusted) : false,
        };
      })
      .sort((left, right) => parseTimeToMinutes(left.startTime) - parseTimeToMinutes(right.startTime));

    const summary = {
      total: cards.length,
      checked: cards.filter((item) => item.checkedCount > 0).length,
      unchecked: Math.max(cards.length - cards.filter((item) => item.checkedCount > 0).length, 0),
    };

    return { cards, summary };
  }, [
    classById,
    currentTime,
    currentTeacherName,
    lessonRecords,
    scheduleById,
    schedules,
    selectedClassId,
    teacherById,
    temporaryReschedules,
  ]);

  const renderSwiperItem = useCallback((date: dayjs.Dayjs) => {
    const { cards, summary } = renderDateCards(date);

    return (
      <ScrollView className="h-full" scrollY>
        <View className="bg-muted px-[24rpx] py-[12rpx]">
          <Text className="text-[28rpx] text-foreground-secondary">
            共
            <Text className="font-semibold text-schedule-header">{summary.total}</Text>
            节课，
            <Text className="ml-[8rpx]">已点名：</Text>
            <Text className="font-semibold text-foreground-secondary">{summary.checked}</Text>
            节，
            <Text className="ml-[8rpx]">未点名：</Text>
            <Text className="font-semibold text-schedule-header">{summary.unchecked}</Text>
            节
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
            {cards.map((item) => (
              <View key={item.id} className="rounded-[14rpx] bg-white px-[24rpx] py-[22rpx] shadow-card">
                <View className="flex items-center gap-[14rpx] flex-wrap">
                  <Text className="text-[34rpx] font-bold text-foreground">{item.className}</Text>
                  {item.bookingTag ? (
                    <View className="rounded-full bg-schedule-attend px-[10rpx] py-[4rpx]">
                      <Text className="text-[20rpx] font-semibold text-white">{item.bookingTag}</Text>
                    </View>
                  ) : null}
                  <View className="rounded-[8rpx] bg-primary-10 px-[12rpx] py-[6rpx]">
                    <Text className="text-[28rpx] font-semibold text-primary">
                      {item.startTime}-{item.endTime}
                    </Text>
                  </View>
                </View>

                <View className="mt-[18rpx] flex items-center justify-between">
                  <View className="flex min-w-0 items-center gap-[10rpx]">
                    <Icon name="mdi-account-outline" size="xs" color="mutedForeground" />
                    <Text className="truncate text-[28rpx] text-muted-foreground">
                      {getDisplayedTeacherName(item)}
                    </Text>
                  </View>
                  <View className="flex items-center gap-[8rpx] pl-[16rpx]">
                    <Icon name="mdi-account-outline" size="xs" color="mutedForeground" />
                    <Text className="text-[28rpx] text-muted-foreground">
                      {item.totalCount > 0 ? `${item.checkedCount}/${item.totalCount}` : '0/0'}
                    </Text>
                  </View>
                </View>

                {item.countdownText ? (
                  <Text className="mt-[12rpx] block text-[24rpx] text-warning">
                    {item.countdownText}
                  </Text>
                ) : null}

                <View className="mt-[22rpx] flex items-center gap-[18rpx] flex-wrap">
                  <View
                    className="min-w-[88rpx] rounded-[8rpx] bg-schedule-attend px-[20rpx] py-[14rpx] flex items-center justify-center"
                    onClick={() => handlePrimaryAction(item)}
                  >
                    <Text className="text-[26rpx] font-semibold text-white">
                      {getPrimaryActionText(item, date, currentTime)}
                    </Text>
                  </View>
                  {/* 未开课课程：显示调课、编辑按钮 */}
                  {shouldShowEditAndRescheduleButtons(date, item.startTime, currentTime, item.isTemporaryAdjusted) ? (
                    <>
                      <View
                        className="min-w-[88rpx] rounded-[8rpx] bg-schedule-adjust px-[20rpx] py-[14rpx] flex items-center justify-center"
                        onClick={() => handleAdjustSchedule(item)}
                      >
                        <Text className="text-[26rpx] font-semibold text-white">调课</Text>
                      </View>
                      <View
                        className="min-w-[88rpx] rounded-[8rpx] bg-schedule-edit px-[20rpx] py-[14rpx] flex items-center justify-center"
                        onClick={() => handleEditSchedule(item)}
                      >
                        <Text className="text-[26rpx] font-semibold text-white">编辑</Text>
                      </View>
                    </>
                  ) : null}
                  {/* 当天课程且开课前1小时以上：显示取消开课 */}
                  {canCancelLessonButton(date, item.startTime, currentTime) && item.canCancelLesson ? (
                    <View
                      className="min-w-[132rpx] rounded-[8rpx] bg-schedule-cancel px-[20rpx] py-[14rpx] flex items-center justify-center"
                      onClick={() => void handleDeleteSchedule(item)}
                    >
                      <Text className="text-[26rpx] font-semibold text-white">取消开课</Text>
                    </View>
                  ) : null}
                  {/* 未开课课程：显示删除排课按钮 */}
                  {shouldShowDeleteButton(date, item.startTime, currentTime, item.isTemporaryAdjusted) && !item.canCancelLesson ? (
                    <View
                      className="min-w-[88rpx] rounded-[8rpx] bg-schedule-delete px-[20rpx] py-[14rpx] flex items-center justify-center"
                      onClick={() => void handleDeleteSchedule(item)}
                    >
                      <Text className="text-[26rpx] font-semibold text-white">删除</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    );
  }, [
    renderDateCards,
    loading,
    currentTime,
    getDisplayedTeacherName,
    handlePrimaryAction,
    handleAdjustSchedule,
    handleEditSchedule,
    handleDeleteSchedule,
    getPrimaryActionText,
    shouldShowEditAndRescheduleButtons,
    canCancelLessonButton,
    shouldShowDeleteButton,
  ]);

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
        if (selectedDate.isBefore(dayjs(), 'day')) {
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
    [selectedClassId, selectedDate],
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

  const handleConfirmBatchClassSelection = useCallback(async () => {
    if (batchSelectedClassIds.length === 0) {
      Taro.showToast({ title: '请至少选择一个班级', icon: 'none' });
      return;
    }

    const targetClasses = selectedBatchClasses;
    const { confirm } = await Taro.showModal({
      title: '确认批量删除',
      content: `确认删除所选 ${targetClasses.length} 个班级吗？删除后会向学员发送班级解散通知。`,
      confirmText: '确认删除',
      confirmColor: '#f97768',
    });

    if (!confirm) {
      return;
    }

    setBatchSubmitting(true);
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
        setClasses((prev) => prev.filter((item) => !successIds.includes(item.id)));
        setSchedules((prev) => prev.filter((item) => !successIds.includes(item.class_id || '')));
        if (successIds.includes(selectedClassId)) {
          setSelectedClassId(FILTER_ALL_CLASS);
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

      if (successIds.length > 0) {
        setBatchClassSheetVisible(false);
        setBatchSelectedClassIds([]);
      }
    } finally {
      setBatchSubmitting(false);
    }
  }, [
    batchActionType,
    batchSelectedClassIds.length,
    notifyStudentAndParents,
    selectedBatchClasses,
    selectedClassId,
  ]);

  return (
    <PageContainer safeBottom className="bg-schedule-page">
      <View className="relative h-screen bg-schedule-page flex flex-col overflow-hidden">
        <View className="bg-schedule-header flex-shrink-0">
          <View
            className="flex items-end px-[18rpx] pb-[18rpx]"
            style={{ height: `${navSafeHeight}px` }}
          >
            <View className="flex items-center gap-[14rpx]">
              <View
                className="flex h-[72rpx] w-[72rpx] items-center justify-center active:opacity-80"
                onClick={handleBack}
              >
                <Icon name="mdi-chevron-left" size="md" color="white" />
              </View>
              <View
                className="flex h-[64rpx] items-center gap-[8rpx] px-[22rpx] active:opacity-80"
                onClick={handleBatchAction}
              >
                <Icon name="mdi-clipboard-text" size="sm" color="white" />
                <Text className="text-[28rpx] font-medium text-white">批量</Text>
              </View>
            </View>
          </View>
        </View>

        <View className="bg-schedule-page flex-shrink-0">
          <CalendarWeekSelector
            selectedDate={selectedDate}
            onChange={(date) => {
              handleScheduleDateChange(date);
              const index = findDayIndex(scheduleDateWindow, date);
              if (index >= 0) {
                setSwiperCurrent(index);
                return;
              }
              setScheduleDateWindow(buildScheduleDateWindow(date));
              setSwiperCurrent(Math.floor(SCHEDULE_WINDOW_SIZE / 2));
            }}
            getDateDotType={getDateDotType}
          />
        </View>

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

        <View className="fixed bottom-[220rpx] right-[32rpx] z-100" onClick={handleCreateSchedule}>
          <View className="flex h-[108rpx] w-[108rpx] items-center justify-center rounded-full bg-schedule-attend shadow-schedule-fab">
            <Icon name="mdi-plus" size="xl" color="white" />
          </View>
        </View>

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
                      <Text className="text-[30rpx] font-semibold text-foreground">批量调课</Text>
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
                      <Text className="text-[30rpx] font-semibold text-destructive">批量删除</Text>
                      <View className="rounded-full bg-white/85 px-[12rpx] py-[6rpx]">
                        <Text className="text-[20rpx] font-medium text-destructive">谨慎操作</Text>
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
                {batchSelectedClassIds.length === batchClassOptions.length ? '取消全选' : '全选'}
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

      </View>
    </PageContainer>
  );
};

export default withRouteGuard(SchedulePage);
