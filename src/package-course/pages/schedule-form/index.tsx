import { View, Text, Picker } from '@tarojs/components';
import Taro from '@tarojs/taro';
import dayjs from 'dayjs';
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import ActionButton from '@/components/ActionButton';
import CalendarMonthSheet from '@/components/CalendarMonthSheet';
import type { CalendarDotType } from '@/components/CalendarWeekSelector';
import Empty from '@/components/Empty';
import Icon from '@/components/Icon';
import Loading from '@/components/Loading';
import PageContainer from '@/components/PageContainer';
import WorkflowHeaderCard from '@/components/reschedule/WorkflowHeaderCard';
import {
  classService,
  notificationService,
  roomService,
  campusService,
  scheduleService,
  studentService,
  teacherService,
  temporaryRescheduleService,
} from '@/services';
import { useStudentStore, useClassStore } from '@/stores';
import { useCampusStore } from '@/stores/campus';
import type { CampusUIModel, Room } from '@/types/campus';
import type { Class } from '@/types/class';
import type { Schedule, ScheduleColor, DayOfWeek } from '@/types/schedule';
import type { Student } from '@/types/student';
import type { TeacherUIModel } from '@/types/teacher';
import { useAuth } from '@/utils/auth';
import { logError } from '@/utils/logger';
import { getDefaultRescheduleTargetDate } from '@/utils/reschedule-date';
import { withRouteGuard } from '@/utils/route-guard';

const DAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const DAY_VALUES: DayOfWeek[] = [1, 2, 3, 4, 5, 6, 7];

const COLOR_OPTIONS: { key: ScheduleColor; label: string; emoji: string }[] = [
  { key: 'primary', label: '薄荷绿', emoji: '🟢' },
  { key: 'info', label: '天空蓝', emoji: '🔵' },
  { key: 'accent', label: '棉花粉', emoji: '🩷' },
  { key: 'lavender', label: '珍珠紫', emoji: '🟣' },
];

const REMINDER_OPTIONS = [
  { value: 0, label: '不提醒' },
  { value: 5, label: '提前5分钟' },
  { value: 15, label: '提前15分钟' },
  { value: 30, label: '提前30分钟' },
  { value: 60, label: '提前1小时' },
];

const COMMON_TIME_RANGES = [
  { start: '09:00', end: '10:00', label: '09:00-10:00' },
  { start: '10:30', end: '11:30', label: '10:30-11:30' },
  { start: '14:00', end: '15:00', label: '14:00-15:00' },
  { start: '19:00', end: '20:00', label: '19:00-20:00' },
];
const MIN_DURATION_MINUTES = 30;
const FORM_SECTION_TITLE_CLASS =
  'mb-[12rpx] block pl-[6rpx] text-[22rpx] font-medium text-[#98a2b3]';
const FORM_CARD_CLASS = 'overflow-hidden rounded-[18rpx] border border-[#eceff3] bg-white';
const FORM_CELL_CLASS = 'flex min-h-[88rpx] items-center justify-between px-[24rpx]';
const FORM_CELL_LABEL_CLASS = 'text-[28rpx] text-[#111827]';
const FORM_CELL_VALUE_CLASS = 'text-[26rpx] text-[#98a2b3]';
const FORM_ARROW_CLASS = 'text-[24rpx] text-[#c7ced9]';

const USE_MOCK =
  typeof process !== 'undefined' && typeof process.env !== 'undefined'
    ? process.env.VITE_USE_MOCK !== 'false'
    : true;

function getNextDateByDayOfWeek(dayOfWeek: DayOfWeek, baseDate = dayjs()): dayjs.Dayjs {
  const currentDate = baseDate.startOf('day');
  const currentWeekday = (currentDate.day() || 7) as DayOfWeek;
  const diff = dayOfWeek - currentWeekday;
  return currentDate.add(diff >= 0 ? diff : diff + 7, 'day');
}

function getDurationHours(startTime: string, endTime: string): string {
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);
  if (
    !Number.isFinite(startHour) ||
    !Number.isFinite(startMinute) ||
    !Number.isFinite(endHour) ||
    !Number.isFinite(endMinute)
  ) {
    return '0';
  }
  const startTotal = startHour * 60 + startMinute;
  const endTotal = endHour * 60 + endMinute;
  if (endTotal <= startTotal) {
    return '0';
  }
  const hours = (endTotal - startTotal) / 60;
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
}

function parseTimeToMinutes(time: string): number {
  const [hour, minute] = time.split(':').map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return 0;
  }
  return hour * 60 + minute;
}

function formatMinutesToTime(totalMinutes: number): string {
  const safeMinutes = Math.max(0, Math.min(24 * 60 - 1, totalMinutes));
  const hour = Math.floor(safeMinutes / 60);
  const minute = safeMinutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function getTeacherSelectionInfo(params: {
  classInfo: Class | null;
  teacherById: Record<string, TeacherUIModel>;
  fallbackTeacherId?: string;
  fallbackTeacherName?: string;
  fallbackAssistantTeacherId?: string;
  fallbackAssistantTeacherName?: string;
}) {
  const {
    classInfo,
    teacherById,
    fallbackTeacherId,
    fallbackTeacherName,
    fallbackAssistantTeacherId,
    fallbackAssistantTeacherName,
  } = params;
  const teacherIds = classInfo?.teachers?.length
    ? classInfo.teachers
    : classInfo?.teacher_id
      ? [classInfo.teacher_id]
      : [];
  const teachers = teacherIds
    .map((id) => teacherById[id])
    .filter((item): item is TeacherUIModel => Boolean(item));
  const leadTeacher =
    teachers.find((item) => item.role !== 'assist') ||
    (classInfo?.teacher_id ? teacherById[classInfo.teacher_id] : undefined) ||
    (fallbackTeacherId ? teacherById[fallbackTeacherId] : undefined);
  const assistantTeacher =
    teachers.find((item) => item.role === 'assist' && item.id !== leadTeacher?.id) ||
    (fallbackAssistantTeacherId ? teacherById[fallbackAssistantTeacherId] : undefined);

  return {
    leadTeacherId: leadTeacher?.id || fallbackTeacherId || '',
    leadTeacherName: leadTeacher?.name || fallbackTeacherName || '待分配',
    assistantTeacherId: assistantTeacher?.id || fallbackAssistantTeacherId || '',
    assistantTeacherName: assistantTeacher?.name || fallbackAssistantTeacherName || '未安排',
  };
}

const ScheduleForm: React.FC = () => {
  const { profile } = useAuth();
  const currentUserId = profile?.id || '';
  const currentTeacherName = profile?.name || '当前老师';
  const fetchStudentsByTeacher = useStudentStore((state) => state.fetchByTeacher);
  const fetchClassesByTeacher = useClassStore((state) => state.fetchByTeacher);
  const { currentCampusId } = useCampusStore();

  const routerParams = useMemo(() => {
    const instance = Taro.getCurrentInstance();
    return instance?.router?.params || {};
  }, []);

  const scheduleId = useMemo(() => decodeURIComponent(routerParams.id || ''), [routerParams]);
  const formMode = useMemo(() => decodeURIComponent(routerParams.mode || ''), [routerParams]);
  const lessonDateParam = useMemo(
    () => decodeURIComponent(routerParams.lessonDate || ''),
    [routerParams],
  );
  const isEdit = !!scheduleId;
  const isRescheduleMode = isEdit && formMode === 'reschedule';

  const { loading, setLoading } = useDelayedLoading();
  const [loadError, setLoadError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [originalSchedule, setOriginalSchedule] = useState<Schedule | null>(null);

  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [allSchedules, setAllSchedules] = useState<Schedule[]>([]);
  const [teachers, setTeachers] = useState<TeacherUIModel[]>([]);
  const [campusOptions, setCampusOptions] = useState<CampusUIModel[]>([]);
  const [campusId, setCampusId] = useState('');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [room, setRoom] = useState('');
  const [calendarVisible, setCalendarVisible] = useState(false);

  const [mode, setMode] = useState<'student' | 'class'>('student');
  const [studentId, setStudentId] = useState('');
  const [classId, setClassId] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState<DayOfWeek>(1);
  const [selectedDateValue, setSelectedDateValue] = useState(dayjs().format('YYYY-MM-DD'));
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:30');
  const [selectedTeachingTeacherId, setSelectedTeachingTeacherId] = useState('');
  const [selectedAssistantTeacherId, setSelectedAssistantTeacherId] = useState('');
  const [color, setColor] = useState<ScheduleColor>('primary');
  const [note, setNote] = useState('');
  const [reminderMinutes, setReminderMinutes] = useState(0);

  const loadFormData = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    setNotFound(false);

    if (!currentUserId) {
      setLoadError('未获取到登录信息，请重新进入页面');
      setLoading(false);
      return;
    }

    try {
      const [stuList, clsList, scheduleList, teacherList, campusList] = await Promise.all([
        fetchStudentsByTeacher(currentUserId),
        fetchClassesByTeacher(currentUserId),
        scheduleService.getByTeacher(currentUserId),
        teacherService.getList(),
        campusService.getList(),
      ]);
      setStudents(stuList);
      setClasses(clsList);
      setAllSchedules(scheduleList);
      setTeachers(teacherList);
      setCampusOptions(campusList);

      const mainCampusId = campusList.find((campus) => campus.isMain)?.id || '';
      const fallbackCampusId = currentCampusId || mainCampusId || campusList[0]?.id || '';

      if (isEdit && scheduleId) {
        const sch = await scheduleService.getById(scheduleId);
        if (!sch) {
          setNotFound(true);
          return;
        }

        const sourceLessonDate =
          lessonDateParam && dayjs(lessonDateParam).isValid()
            ? dayjs(lessonDateParam).startOf('day')
            : getNextDateByDayOfWeek(sch.day_of_week).startOf('day');

        if (isRescheduleMode) {
          const today = dayjs().startOf('day');
          if (sourceLessonDate.isBefore(today)) {
            Taro.showToast({ title: '已结束的课程不支持调课', icon: 'none', duration: 2000 });
            setTimeout(() => Taro.navigateBack(), 1500);
            setLoading(false);
            return;
          }
        }

        const defaultTargetDate = isRescheduleMode
          ? getDefaultRescheduleTargetDate(sourceLessonDate.format('YYYY-MM-DD'))
          : sourceLessonDate;

        setOriginalSchedule(sch);
        setMode(!USE_MOCK || sch.class_id ? 'class' : 'student');
        if (sch.student_id) setStudentId(sch.student_id);
        if (sch.class_id) setClassId(sch.class_id);
        setDayOfWeek((defaultTargetDate.day() || 7) as DayOfWeek);
        setSelectedDateValue(defaultTargetDate.format('YYYY-MM-DD'));
        setStartTime(sch.start_time);
        setEndTime(sch.end_time);
        setSelectedTeachingTeacherId(sch.teacher_id || currentUserId);
        setSelectedAssistantTeacherId(sch.assistant_teacher_id || '');
        setColor(sch.color || 'primary');
        setNote(sch.note || '');
        setReminderMinutes(sch.reminder_minutes || 0);

        const classCampusId = sch.class_id
          ? clsList.find((c) => c.id === sch.class_id)?.campus_id
          : undefined;
        setCampusId(classCampusId || fallbackCampusId);
        setRoom(sch.room || '');
      } else {
        setOriginalSchedule(null);
        if (stuList.length > 0) setStudentId(stuList[0].id);
        if (clsList.length > 0) setClassId(clsList[0].id);
        if (!USE_MOCK) setMode('class');
        setSelectedDateValue(dayjs().format('YYYY-MM-DD'));
        setSelectedTeachingTeacherId(currentUserId);
        setSelectedAssistantTeacherId('');
        setCampusId(fallbackCampusId);
        setRoom('');
      }
    } catch (err) {
      logError('init schedule form', err);
      setLoadError('排课表单初始化失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [
    currentUserId,
    currentCampusId,
    fetchClassesByTeacher,
    fetchStudentsByTeacher,
    isEdit,
    isRescheduleMode,
    lessonDateParam,
    scheduleId,
  ]);

  useEffect(() => {
    void loadFormData();
  }, [loadFormData]);

  // 根据选中校区加载教室列表
  useEffect(() => {
    const loadRooms = async () => {
      if (!campusId) {
        setRooms([]);
        return;
      }
      try {
        const list = await roomService.getList({ campusId });
        setRooms(list);
      } catch (err) {
        logError('schedule-form load rooms', err);
        setRooms([]);
      }
    };
    loadRooms();
  }, [campusId]);

  const handleModeChange = useCallback((nextMode: 'student' | 'class') => {
    if (!USE_MOCK && nextMode === 'student') {
      Taro.showToast({ title: '真实联调阶段仅支持班级排课', icon: 'none' });
      return;
    }
    setMode(nextMode);
  }, []);

  const studentPickerData = useMemo(() => students.map((item) => item.name), [students]);
  const classPickerData = useMemo(() => classes.map((item) => item.name), [classes]);
  const campusPickerOptions = useMemo(
    () => ['请选择校区', ...campusOptions.map((item) => item.name)],
    [campusOptions],
  );
  const campusIndex = useMemo(() => {
    const index = campusOptions.findIndex((item) => item.id === campusId);
    return Math.max(0, index + 1);
  }, [campusOptions, campusId]);
  const roomOptions = useMemo(() => {
    const activeNames = rooms.filter((item) => item.status === 'active').map((item) => item.name);
    const options = [...activeNames];
    if (room && !options.includes(room)) {
      options.unshift(room);
    }
    return ['请选择', ...options];
  }, [rooms, room]);
  const roomIndex = useMemo(
    () => Math.max(0, roomOptions.indexOf(room || '请选择')),
    [roomOptions, room],
  );
  const teacherById = useMemo(
    () =>
      teachers.reduce<Record<string, TeacherUIModel>>((acc, item) => {
        acc[item.id] = item;
        return acc;
      }, {}),
    [teachers],
  );
  const selectedStudentIdx = useMemo(
    () => students.findIndex((item) => item.id === studentId),
    [studentId, students],
  );
  const selectedClassIdx = useMemo(
    () => classes.findIndex((item) => item.id === classId),
    [classId, classes],
  );
  const selectedStudent = useMemo(
    () => students.find((item) => item.id === studentId) || null,
    [studentId, students],
  );
  const selectedClass = useMemo(
    () => classes.find((item) => item.id === classId) || null,
    [classId, classes],
  );

  // 班级课程时，随班级切换同步校区并清空教室
  useEffect(() => {
    if (mode !== 'class') return;
    const classCampusId = selectedClass?.campus_id;
    if (classCampusId && classCampusId !== campusId) {
      setCampusId(classCampusId);
      setRoom('');
    }
  }, [mode, selectedClass, campusId]);

  const originalScheduleText = useMemo(() => {
    if (!originalSchedule) {
      return '';
    }
    return `${DAY_LABELS[originalSchedule.day_of_week - 1]} ${originalSchedule.start_time}-${originalSchedule.end_time}`;
  }, [originalSchedule]);
  const currentTargetName = useMemo(() => {
    if (mode === 'class') {
      return selectedClass?.name || '请选择班级';
    }
    return selectedStudent?.name || '请选择学员';
  }, [mode, selectedClass, selectedStudent]);
  const leadTeacherOptions = useMemo(
    () =>
      teachers.filter((item) => item.role !== 'assist' || item.id === selectedTeachingTeacherId),
    [selectedTeachingTeacherId, teachers],
  );
  const assistantTeacherOptions = useMemo(
    () =>
      teachers.filter(
        (item) =>
          item.id !== selectedTeachingTeacherId &&
          (item.role === 'assist' || item.id === selectedAssistantTeacherId),
      ),
    [selectedAssistantTeacherId, selectedTeachingTeacherId, teachers],
  );
  const selectedTeachingTeacher = useMemo(
    () => teachers.find((item) => item.id === selectedTeachingTeacherId) || null,
    [selectedTeachingTeacherId, teachers],
  );
  const selectedAssistantTeacher = useMemo(
    () => teachers.find((item) => item.id === selectedAssistantTeacherId) || null,
    [selectedAssistantTeacherId, teachers],
  );
  const selectedTeachingTeacherIndex = useMemo(
    () =>
      Math.max(
        0,
        leadTeacherOptions.findIndex((item) => item.id === selectedTeachingTeacherId),
      ),
    [leadTeacherOptions, selectedTeachingTeacherId],
  );
  const selectedAssistantTeacherIndex = useMemo(
    () =>
      Math.max(
        0,
        assistantTeacherOptions.findIndex((item) => item.id === selectedAssistantTeacherId),
      ),
    [assistantTeacherOptions, selectedAssistantTeacherId],
  );
  const durationHoursText = useMemo(
    () => getDurationHours(startTime, endTime),
    [endTime, startTime],
  );
  const sourceLessonDateText = useMemo(() => {
    if (lessonDateParam && dayjs(lessonDateParam).isValid()) {
      return dayjs(lessonDateParam).format('YYYY-MM-DD');
    }
    return originalSchedule
      ? getNextDateByDayOfWeek(originalSchedule.day_of_week).format('YYYY-MM-DD')
      : '';
  }, [lessonDateParam, originalSchedule]);
  const sourceLessonWeekdayText = useMemo(() => {
    if (!sourceLessonDateText || !dayjs(sourceLessonDateText).isValid()) {
      return '';
    }
    const weekday = (dayjs(sourceLessonDateText).day() || 7) as DayOfWeek;
    return DAY_LABELS[weekday - 1];
  }, [sourceLessonDateText]);
  const rescheduleSummaryTeacherText = useMemo(() => {
    const teacherNames = [
      selectedTeachingTeacher?.name || originalSchedule?.teacher_name || currentTeacherName,
      selectedAssistantTeacher?.name || originalSchedule?.assistant_teacher_name || '',
    ].filter(Boolean);
    return teacherNames.join(' / ');
  }, [
    currentTeacherName,
    originalSchedule?.assistant_teacher_name,
    originalSchedule?.teacher_name,
    selectedAssistantTeacher?.name,
    selectedTeachingTeacher?.name,
  ]);
  const scheduleWeekdaySet = useMemo(() => {
    return new Set(allSchedules.map((item) => item.day_of_week));
  }, [allSchedules]);
  const getDateDotType = useCallback(
    (date: dayjs.Dayjs): CalendarDotType => {
      const weekday = (date.day() || 7) as Schedule['day_of_week'];
      if (!scheduleWeekdaySet.has(weekday)) {
        return 'none';
      }
      return date.isBefore(dayjs(), 'day') ? 'past' : 'active';
    },
    [scheduleWeekdaySet],
  );

  useEffect(() => {
    if (parseTimeToMinutes(endTime) - parseTimeToMinutes(startTime) >= MIN_DURATION_MINUTES) {
      return;
    }
    setEndTime(formatMinutesToTime(parseTimeToMinutes(startTime) + MIN_DURATION_MINUTES));
  }, [endTime, startTime]);

  useEffect(() => {
    if (teachers.length === 0) {
      return;
    }
    if (mode === 'class') {
      const teacherInfo = getTeacherSelectionInfo({
        classInfo: selectedClass,
        teacherById,
        fallbackTeacherId: originalSchedule?.teacher_id || currentUserId,
        fallbackTeacherName: originalSchedule?.teacher_name || currentTeacherName,
        fallbackAssistantTeacherId: originalSchedule?.assistant_teacher_id,
        fallbackAssistantTeacherName: originalSchedule?.assistant_teacher_name,
      });
      setSelectedTeachingTeacherId(teacherInfo.leadTeacherId || currentUserId);
      setSelectedAssistantTeacherId(teacherInfo.assistantTeacherId);
      return;
    }
    setSelectedTeachingTeacherId(currentUserId);
    setSelectedAssistantTeacherId('');
  }, [
    currentTeacherName,
    currentUserId,
    mode,
    originalSchedule?.assistant_teacher_id,
    originalSchedule?.assistant_teacher_name,
    originalSchedule?.teacher_id,
    originalSchedule?.teacher_name,
    selectedClass,
    teacherById,
    teachers.length,
  ]);

  const submitBlockedReason = useMemo(() => {
    if (!currentUserId) return '未获取到登录信息，请重新进入页面';
    if (mode === 'student' && !USE_MOCK) return '真实联调阶段仅支持班级排课';
    if (mode === 'student' && !students.length) return '暂无可排学员';
    if (mode === 'student' && !studentId) return '请选择学员';
    if (mode === 'class' && !classes.length && !classId) return '暂无可排班级';
    if (mode === 'class' && !classId) return '请选择班级';
    if (!selectedDateValue) return '请选择上课日期';
    if (!startTime || !endTime) return '请选择完整的上课时间';
    if (startTime >= endTime) return '结束时间需晚于开始时间';
    if (!selectedTeachingTeacherId) return '请选择主讲老师';
    return '';
  }, [
    classId,
    classes.length,
    currentUserId,
    endTime,
    mode,
    selectedDateValue,
    selectedTeachingTeacherId,
    startTime,
    studentId,
    students.length,
  ]);

  const canSubmit = useMemo(
    () => !loading && !loadError && !notFound && !submitBlockedReason,
    [loadError, loading, notFound, submitBlockedReason],
  );
  const pageTitle = useMemo(() => {
    if (isRescheduleMode) {
      return '调课';
    }
    return isEdit ? '编辑排课' : '创建排课';
  }, [isEdit, isRescheduleMode]);
  const submitButtonText = useMemo(() => {
    if (saving) {
      return isRescheduleMode ? '保存中...' : '保存中...';
    }
    return '保存';
  }, [isRescheduleMode, saving]);

  const handleNotifyStudentAndParents = useCallback(
    async (targetStudentId: string, title: string, content: string) => {
      try {
        await notificationService.send({
          sender_id: currentUserId,
          receiver_id: targetStudentId,
          title,
          content,
          related_id: targetStudentId,
        });
      } catch (err) {
        logError('scheduleForm notify student', err);
      }

      try {
        const parents = await studentService.getParents(targetStudentId);
        for (const binding of parents) {
          await notificationService.send({
            sender_id: currentUserId,
            receiver_id: binding.parent_id,
            title,
            content,
            related_id: targetStudentId,
          });
        }
      } catch (err) {
        logError('scheduleForm notify parents', err);
      }
    },
    [currentUserId],
  );

  const handleSave = useCallback(async () => {
    if (saving) {
      return;
    }

    if (submitBlockedReason) {
      Taro.showToast({ title: submitBlockedReason, icon: 'none' });
      return;
    }

    if (isRescheduleMode) {
      if (!originalSchedule) {
        Taro.showToast({ title: '未找到原课程信息', icon: 'none' });
        return;
      }

      const sourceDate = sourceLessonDateText;
      const targetDate = selectedDateValue;
      if (!sourceDate || !dayjs(sourceDate).isValid()) {
        Taro.showToast({ title: '原上课日期异常', icon: 'none' });
        return;
      }
      const noDateChange = targetDate === sourceDate;
      const noTimeChange =
        startTime === originalSchedule.start_time && endTime === originalSchedule.end_time;
      if (noDateChange && noTimeChange) {
        Taro.showToast({ title: '请至少调整日期或时间', icon: 'none' });
        return;
      }

      const adjustedSchedule: Schedule = {
        ...originalSchedule,
        start_time: startTime,
        end_time: endTime,
      };

      const conflictItems = await temporaryRescheduleService.checkDateConflict({
        teacherId: currentUserId,
        sourceDate,
        targetDate,
        movingSchedules: [adjustedSchedule],
        allSchedules,
      });
      if (conflictItems.length > 0) {
        Taro.showToast({
          title: '目标日期存在时间冲突',
          icon: 'none',
          duration: 3000,
        });
        return;
      }

      setSaving(true);
      try {
        await temporaryRescheduleService.saveBatch({
          teacherId: currentUserId,
          sourceDate,
          targetDate,
          schedules: [adjustedSchedule],
        });

        const originalText =
          `${dayjs(sourceDate).format('MM月DD日')} ` +
          `${originalSchedule.start_time}-${originalSchedule.end_time}`;
        const updatedText = `${dayjs(targetDate).format('MM月DD日')} ${startTime}-${endTime}`;
        if (mode === 'class' && classId) {
          const classStudents = await classService.getStudents(classId);
          const title = '调课通知';
          const content = `${selectedClass?.name || '班级课程'} 已由 ${originalText} 调整为 ${updatedText}，仅本次课程生效。`;
          for (const student of classStudents) {
            await handleNotifyStudentAndParents(student.id, title, content);
          }
        }
        if (mode === 'student' && studentId) {
          await handleNotifyStudentAndParents(
            studentId,
            '调课通知',
            `${selectedStudent?.name || '您的课程'} 已由 ${originalText} 调整为 ${updatedText}，仅本次课程生效。`,
          );
        }

        Taro.showToast({ title: '调课成功', icon: 'success' });
        setTimeout(() => Taro.navigateBack(), 1200);
      } catch (err) {
        logError('scheduleForm single reschedule', err);
        Taro.showToast({ title: '调课失败，请重试', icon: 'none' });
      } finally {
        setSaving(false);
      }
      return;
    }

    const targetDayOfWeek = (dayjs(selectedDateValue).day() || 7) as DayOfWeek;

    const hasConflict = await scheduleService.checkConflict(
      currentUserId,
      targetDayOfWeek,
      startTime,
      endTime,
      isEdit ? scheduleId : undefined,
    );

    const doSave = async () => {
      setSaving(true);
      try {
        const data: Partial<Schedule> = {
          teacher_id: selectedTeachingTeacherId || currentUserId,
          assistant_teacher_id: selectedAssistantTeacherId || undefined,
          student_id: mode === 'student' ? studentId : undefined,
          class_id: mode === 'class' ? classId : undefined,
          day_of_week: targetDayOfWeek,
          start_time: startTime,
          end_time: endTime,
          room: room || undefined,
          color,
          note: note.trim() || undefined,
          reminder_minutes: reminderMinutes,
        };

        if (isEdit) {
          await scheduleService.update(scheduleId, data);
          if (isRescheduleMode) {
            const originalText = originalScheduleText || '原排课';
            const updatedText = `${selectedDateValue} ${startTime}-${endTime}`;
            if (mode === 'class' && classId) {
              const classStudents = await classService.getStudents(classId);
              const title = '调课通知';
              const content = `${selectedClass?.name || '班级课程'} 已由 ${originalText} 调整为 ${updatedText}，请留意最新上课安排。`;
              for (const student of classStudents) {
                await handleNotifyStudentAndParents(student.id, title, content);
              }
            }
            if (mode === 'student' && studentId) {
              await handleNotifyStudentAndParents(
                studentId,
                '调课通知',
                `${selectedStudent?.name || '您的课程'} 已由 ${originalText} 调整为 ${updatedText}，请留意最新上课安排。`,
              );
            }
          }
          Taro.showToast({ title: isRescheduleMode ? '调课成功' : '更新成功', icon: 'success' });
        } else {
          await scheduleService.create(data as Omit<Schedule, 'id' | 'created_at' | 'updated_at'>);
          Taro.showToast({ title: '添加成功', icon: 'success' });
        }
        setTimeout(() => Taro.navigateBack(), 1200);
      } catch (err) {
        Taro.showToast({ title: '保存失败，请重试', icon: 'none' });
      } finally {
        setSaving(false);
      }
    };

    if (hasConflict) {
      const { confirm } = await Taro.showModal({
        title: '时间冲突',
        content: '该时间段已有课程安排，是否继续保存？',
      });
      if (!confirm) return;
    }

    await doSave();
  }, [
    allSchedules,
    classId,
    color,
    currentUserId,
    endTime,
    handleNotifyStudentAndParents,
    isEdit,
    isRescheduleMode,
    mode,
    note,
    originalSchedule,
    originalScheduleText,
    reminderMinutes,
    room,
    saving,
    scheduleId,
    selectedAssistantTeacherId,
    selectedClass?.name,
    selectedDateValue,
    selectedStudent?.name,
    selectedTeachingTeacherId,
    startTime,
    studentId,
    submitBlockedReason,
    sourceLessonDateText,
  ]);

  const handleDelete = useCallback(async () => {
    if (deleting) {
      return;
    }

    const { confirm } = await Taro.showModal({
      title: '确认删除',
      content: '删除后课程数据将无法恢复，是否确认删除？',
      confirmColor: '#ef4444',
    });
    if (!confirm) return;

    setDeleting(true);
    try {
      await scheduleService.remove(scheduleId);
      Taro.showToast({ title: '已删除', icon: 'success' });
      setTimeout(() => Taro.navigateBack(), 1200);
    } catch {
      Taro.showToast({ title: '删除失败', icon: 'none' });
    } finally {
      setDeleting(false);
    }
  }, [deleting, scheduleId]);

  if (loading) {
    return (
      <PageContainer>
        <View className="flex items-center justify-center pt-[200rpx]">
          <Loading text="加载中..." />
        </View>
      </PageContainer>
    );
  }

  if (loadError) {
    return (
      <PageContainer>
        <View className="min-h-screen bg-[#f7f7f7] px-8 flex items-center justify-center">
          <Empty
            icon="mdi-alert-circle"
            description={loadError}
            actionText="重新加载"
            onAction={() => void loadFormData()}
          />
        </View>
      </PageContainer>
    );
  }

  if (notFound) {
    return (
      <PageContainer>
        <View className="min-h-screen bg-[#f7f7f7] px-8 flex items-center justify-center">
          <Empty
            icon="mdi-calendar-blank"
            description="未找到对应排课信息"
            actionText="返回上一页"
            onAction={() => Taro.navigateBack()}
          />
        </View>
      </PageContainer>
    );
  }

  return (
    <PageContainer safeBottom className={isRescheduleMode ? 'bg-[#f6f8fc]' : 'bg-[#f5f6f8]'}>
      <View
        className={`min-h-screen pb-[220rpx] ${isRescheduleMode ? 'bg-[#f6f8fc]' : 'bg-[#f5f6f8]'}`}
      >
        {isRescheduleMode ? null : null}

        <View className={`px-[24rpx] pt-[24rpx] ${isRescheduleMode ? '' : ''}`}>
          {isRescheduleMode ? (
            <>
              <WorkflowHeaderCard
                eyebrow="单次调课"
                title="确认调课"
                tone="green"
                hintLines={[
                  '仅调整本次课程日期，不改变长期排课规则',
                  '确认后会自动通知相关学员和家长',
                ]}
              >
                <View className="flex items-center gap-[12rpx] rounded-[20rpx] bg-[#f4fffa] px-[18rpx] py-[18rpx]">
                  <View className="flex h-[56rpx] w-[56rpx] items-center justify-center rounded-full bg-[#e8f7ee]">
                    <Icon name="mdi-swap-horizontal" size="xs" color="#16a34a" />
                  </View>
                  <Text className="text-[24rpx] font-medium text-foreground-secondary">
                    {dayjs(sourceLessonDateText).isValid()
                      ? `${dayjs(sourceLessonDateText).format('MM月DD日')} ${sourceLessonWeekdayText}`
                      : '原上课日期'}
                  </Text>
                  <Icon name="mdi-arrow-right" size="xs" color="mutedForeground" />
                  <Text className="text-[24rpx] font-semibold text-[#16a34a]">
                    {dayjs(selectedDateValue).format('MM月DD日')}
                  </Text>
                </View>

                <View
                  className="mt-[14rpx] rounded-[24rpx] border border-[#dff3e8] bg-[#f4fffa] px-[22rpx] py-[22rpx]"
                  onClick={() => setCalendarVisible(true)}
                >
                  <View className="flex items-center justify-between">
                    <View className="flex items-center gap-[14rpx]">
                      <View className="flex h-[72rpx] w-[72rpx] items-center justify-center rounded-[20rpx] bg-[#e4fff1]">
                        <Icon name="mdi-calendar-check" size="md" color="#16a34a" />
                      </View>
                      <Text className="text-[34rpx] font-semibold text-foreground">
                        {dayjs(selectedDateValue).format('YYYY年MM月DD日')}
                      </Text>
                    </View>
                    <View className="flex items-center gap-[8rpx]">
                      <Text className="text-[24rpx] font-medium text-[#16a34a]">点击选择</Text>
                      <Icon name="mdi-chevron-right" size="sm" color="#16a34a" />
                    </View>
                  </View>
                </View>

                <View className="mt-[14rpx] rounded-[20rpx] border border-[#e1f5e8] bg-[#fbfffc] px-[20rpx] py-[18rpx]">
                  <View className="flex items-center justify-between">
                    <Text className="text-[24rpx] font-medium text-[#4b5563]">时间调整</Text>
                    <View className="rounded-full bg-[#edfdf3] px-[14rpx] py-[6rpx]">
                      <Text className="text-[22rpx] font-medium text-[#16a34a]">
                        {durationHoursText} 课时
                      </Text>
                    </View>
                  </View>
                  <View className="mt-[14rpx] flex items-center gap-[12rpx]">
                    <Picker
                      mode="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.detail.value)}
                    >
                      <View className="flex-1 rounded-[18rpx] border border-[#dff3e8] bg-white px-[18rpx] py-[16rpx]">
                        <Text className="block text-[22rpx] text-muted-foreground">开始</Text>
                        <View className="mt-[6rpx] flex items-center justify-between">
                          <Text className="text-[30rpx] font-semibold text-foreground">
                            {startTime}
                          </Text>
                          <Icon name="mdi-chevron-right" size="sm" color="#16a34a" />
                        </View>
                      </View>
                    </Picker>
                    <Picker
                      mode="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.detail.value)}
                    >
                      <View className="flex-1 rounded-[18rpx] border border-[#dff3e8] bg-white px-[18rpx] py-[16rpx]">
                        <Text className="block text-[22rpx] text-muted-foreground">结束</Text>
                        <View className="mt-[6rpx] flex items-center justify-between">
                          <Text className="text-[30rpx] font-semibold text-foreground">
                            {endTime}
                          </Text>
                          <Icon name="mdi-chevron-right" size="sm" color="#16a34a" />
                        </View>
                      </View>
                    </Picker>
                  </View>
                </View>
              </WorkflowHeaderCard>

              <View className="mt-[24rpx] rounded-[28rpx] bg-white px-[24rpx] py-[22rpx] shadow-card">
                <View className="flex items-center justify-between">
                  <View>
                    <Text className="text-[30rpx] font-semibold text-foreground">
                      {mode === 'class' ? '调课班级' : '调课学员'}
                    </Text>
                    <Text className="mt-[6rpx] block text-[24rpx] text-muted-foreground">
                      共 1 节课
                    </Text>
                  </View>
                  <View className="rounded-full bg-[#edfdf3] px-[18rpx] py-[10rpx]">
                    <Text className="text-[24rpx] font-medium text-[#16a34a]">
                      {durationHoursText} 课时
                    </Text>
                  </View>
                </View>
              </View>

              <View className="mt-[16rpx] flex flex-col gap-[16rpx]">
                <View className="rounded-[26rpx] bg-white px-[24rpx] py-[24rpx] shadow-card">
                  <View className="flex items-center justify-between gap-[16rpx]">
                    <Text className="truncate text-[32rpx] font-semibold text-foreground">
                      {currentTargetName}
                    </Text>
                    <View className="rounded-full bg-[#f4f7fb] px-[14rpx] py-[8rpx]">
                      <Text className="flex-shrink-0 text-[22rpx] text-muted-foreground">
                        {mode === 'class' ? `${selectedClass?.student_count || 0}人` : '单课'}
                      </Text>
                    </View>
                  </View>
                  <View className="mt-[14rpx] flex items-center gap-[10rpx]">
                    <Icon name="mdi-account-outline" size="xs" color="mutedForeground" />
                    <Text className="text-[25rpx] text-muted-foreground">
                      {rescheduleSummaryTeacherText || '未分配老师'}
                    </Text>
                  </View>
                  <View className="mt-[10rpx] flex items-center gap-[10rpx]">
                    <Icon name="mdi-clock-outline" size="xs" color="mutedForeground" />
                    <Text className="text-[25rpx] text-muted-foreground">
                      {startTime}-{endTime}
                    </Text>
                  </View>
                  {note ? (
                    <View className="mt-[10rpx] flex items-start gap-[10rpx]">
                      <Icon name="mdi-note-text-outline" size="xs" color="mutedForeground" />
                      <Text className="flex-1 text-[25rpx] text-muted-foreground">{note}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </>
          ) : (
            <>
              <View className="mb-[18rpx] px-[6rpx]">
                <Text className="block text-[34rpx] font-semibold text-[#111827]">{pageTitle}</Text>
                <Text className="mt-[4rpx] block text-[22rpx] leading-[32rpx] text-[#98a2b3]">
                  维护班级或学员的常规排课信息
                </Text>
              </View>

              <View className="mb-[24rpx]">
                <Text className={FORM_SECTION_TITLE_CLASS}>课程类型</Text>
                <View className="flex gap-[14rpx]">
                  <View
                    className={`flex-1 rounded-[16rpx] border px-[24rpx] py-[22rpx] text-center ${mode === 'student' ? 'border-[#f97361] bg-[#fff7f5]' : 'border-[#eceff3] bg-white'}`}
                    onClick={() => handleModeChange('student')}
                  >
                    <Text
                      className={`block text-[28rpx] font-medium ${mode === 'student' ? 'text-[#f97361]' : 'text-[#374151]'}`}
                    >
                      单人课程
                    </Text>
                  </View>
                  <View
                    className={`flex-1 rounded-[16rpx] border px-[24rpx] py-[22rpx] text-center ${mode === 'class' ? 'border-[#f97361] bg-[#fff7f5]' : 'border-[#eceff3] bg-white'}`}
                    onClick={() => handleModeChange('class')}
                  >
                    <Text
                      className={`block text-[28rpx] font-medium ${mode === 'class' ? 'text-[#f97361]' : 'text-[#374151]'}`}
                    >
                      班级课程
                    </Text>
                  </View>
                </View>
              </View>

              <View className="mb-[24rpx]">
                <Text className={FORM_SECTION_TITLE_CLASS}>基础信息</Text>
                <View className={FORM_CARD_CLASS}>
                  {mode === 'student' ? (
                    <Picker
                      mode="selector"
                      range={studentPickerData}
                      value={selectedStudentIdx >= 0 ? selectedStudentIdx : 0}
                      onChange={(e) => {
                        const index = Number(e.detail.value);
                        if (students[index]) {
                          setStudentId(students[index].id);
                        }
                      }}
                    >
                      <View className={FORM_CELL_CLASS}>
                        <Text className={FORM_CELL_LABEL_CLASS}>学员名称</Text>
                        <View className="flex items-center gap-[12rpx]">
                          <Text
                            className={
                              selectedStudent
                                ? 'text-[28rpx] text-[#111827]'
                                : FORM_CELL_VALUE_CLASS
                            }
                          >
                            {selectedStudent?.name || '请选择'}
                          </Text>
                          <Text className={FORM_ARROW_CLASS}>{'>'}</Text>
                        </View>
                      </View>
                    </Picker>
                  ) : (
                    <Picker
                      mode="selector"
                      range={classPickerData}
                      value={selectedClassIdx >= 0 ? selectedClassIdx : 0}
                      onChange={(e) => {
                        const index = Number(e.detail.value);
                        if (classes[index]) {
                          setClassId(classes[index].id);
                        }
                      }}
                    >
                      <View className={FORM_CELL_CLASS}>
                        <Text className={FORM_CELL_LABEL_CLASS}>班级名称</Text>
                        <View className="flex items-center gap-[12rpx]">
                          <Text
                            className={
                              selectedClass ? 'text-[28rpx] text-[#111827]' : FORM_CELL_VALUE_CLASS
                            }
                          >
                            {selectedClass?.name || '请选择'}
                          </Text>
                          <Text className={FORM_ARROW_CLASS}>{'>'}</Text>
                        </View>
                      </View>
                    </Picker>
                  )}

                  <View className="border-t border-[#f1f5f9] px-[24rpx] py-[18rpx]">
                    <Text className="mb-[14rpx] block text-[28rpx] text-[#111827]">上课日</Text>
                    <View className="flex gap-[10rpx]">
                      {DAY_VALUES.map((item, index) => {
                        const active = dayOfWeek === item;
                        return (
                          <View
                            key={item}
                            className={`flex-1 rounded-[14rpx] border px-[8rpx] py-[16rpx] text-center ${active ? 'border-[#f97361] bg-[#fff7f5]' : 'border-[#e5e7eb] bg-[#fafafa]'}`}
                            onClick={() => setDayOfWeek(item)}
                          >
                            <Text
                              className={`text-[24rpx] font-medium ${active ? 'text-[#f97361]' : 'text-[#4b5563]'}`}
                            >
                              {DAY_LABELS[index]}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>

                  <View className="border-t border-[#f1f5f9] px-[24rpx] py-[18rpx]">
                    <Text className="mb-[14rpx] block text-[28rpx] text-[#111827]">上课时间</Text>
                    <View className="flex items-center gap-[12rpx]">
                      <Picker
                        mode="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.detail.value)}
                      >
                        <View className="flex h-[82rpx] flex-1 items-center justify-between rounded-[14rpx] border border-[#eef2f6] bg-[#f8fafc] px-[20rpx]">
                          <Text className="text-[28rpx] text-[#111827]">{startTime}</Text>
                          <Text className={FORM_ARROW_CLASS}>▼</Text>
                        </View>
                      </Picker>
                      <Text className="text-[24rpx] text-[#9ca3af]">至</Text>
                      <Picker
                        mode="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.detail.value)}
                      >
                        <View className="flex h-[82rpx] flex-1 items-center justify-between rounded-[14rpx] border border-[#eef2f6] bg-[#f8fafc] px-[20rpx]">
                          <Text className="text-[28rpx] text-[#111827]">{endTime}</Text>
                          <Text className={FORM_ARROW_CLASS}>▼</Text>
                        </View>
                      </Picker>
                    </View>
                    <View className="mt-[14rpx] flex flex-wrap gap-[12rpx]">
                      {COMMON_TIME_RANGES.map((item) => {
                        const active = startTime === item.start && endTime === item.end;
                        return (
                          <View
                            key={item.label}
                            className={`rounded-full px-[18rpx] py-[10rpx] ${active ? 'bg-[#fff1ee]' : 'border border-[#e5e7eb] bg-white'}`}
                            onClick={() => {
                              setStartTime(item.start);
                              setEndTime(item.end);
                            }}
                          >
                            <Text
                              className={`text-[22rpx] ${active ? 'text-[#f97361]' : 'text-[#6b7280]'}`}
                            >
                              {item.label}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                </View>
              </View>

              <View className="mb-[24rpx]">
                <Text className={FORM_SECTION_TITLE_CLASS}>授课老师</Text>
                <View className={FORM_CARD_CLASS}>
                  <Picker
                    mode="selector"
                    range={leadTeacherOptions.map((item) => item.name)}
                    value={selectedTeachingTeacherIndex}
                    onChange={(e) => {
                      const index = Number(e.detail.value);
                      if (leadTeacherOptions[index]) {
                        const nextTeacherId = leadTeacherOptions[index].id;
                        setSelectedTeachingTeacherId(nextTeacherId);
                        if (selectedAssistantTeacherId === nextTeacherId) {
                          setSelectedAssistantTeacherId('');
                        }
                      }
                    }}
                  >
                    <View className={FORM_CELL_CLASS}>
                      <Text className={FORM_CELL_LABEL_CLASS}>主讲老师</Text>
                      <View className="flex items-center gap-[12rpx]">
                        <Text className="text-[28rpx] text-[#111827]">
                          {selectedTeachingTeacher?.name || currentTeacherName || '请选择'}
                        </Text>
                        <Text className={FORM_ARROW_CLASS}>{'>'}</Text>
                      </View>
                    </View>
                  </Picker>

                  {assistantTeacherOptions.length > 0 ? (
                    <Picker
                      mode="selector"
                      range={assistantTeacherOptions.map((item) => item.name)}
                      value={selectedAssistantTeacherIndex}
                      onChange={(e) => {
                        const index = Number(e.detail.value);
                        if (assistantTeacherOptions[index]) {
                          setSelectedAssistantTeacherId(assistantTeacherOptions[index].id);
                        }
                      }}
                    >
                      <View className="border-t border-[#f1f5f9]">
                        <View className={FORM_CELL_CLASS}>
                          <Text className={FORM_CELL_LABEL_CLASS}>上课助教</Text>
                          <View className="flex items-center gap-[12rpx]">
                            <Text
                              className={
                                selectedAssistantTeacher
                                  ? 'text-[28rpx] text-[#111827]'
                                  : FORM_CELL_VALUE_CLASS
                              }
                            >
                              {selectedAssistantTeacher?.name || '请选择'}
                            </Text>
                            <Text className={FORM_ARROW_CLASS}>{'>'}</Text>
                          </View>
                        </View>
                      </View>
                    </Picker>
                  ) : (
                    <View className="border-t border-[#f1f5f9]">
                      <View className={FORM_CELL_CLASS}>
                        <Text className={FORM_CELL_LABEL_CLASS}>上课助教</Text>
                        <Text className={FORM_CELL_VALUE_CLASS}>请选择</Text>
                      </View>
                    </View>
                  )}
                </View>
              </View>

              <View className="mb-[24rpx]">
                <Text className={FORM_SECTION_TITLE_CLASS}>上课地点</Text>
                <View className={FORM_CARD_CLASS}>
                  <Picker
                    mode="selector"
                    range={campusPickerOptions}
                    value={campusIndex}
                    onChange={(e) => {
                      const index = Number(e.detail.value);
                      if (index === 0) {
                        setCampusId('');
                      } else {
                        setCampusId(campusOptions[index - 1]?.id || '');
                      }
                      setRoom('');
                    }}
                  >
                    <View className={FORM_CELL_CLASS}>
                      <Text className={FORM_CELL_LABEL_CLASS}>上课校区</Text>
                      <View className="flex items-center gap-[12rpx]">
                        <Text
                          className={
                            campusId ? 'text-[28rpx] text-[#111827]' : FORM_CELL_VALUE_CLASS
                          }
                        >
                          {campusOptions.find((item) => item.id === campusId)?.name || '请选择'}
                        </Text>
                        <Text className={FORM_ARROW_CLASS}>{'>'}</Text>
                      </View>
                    </View>
                  </Picker>

                  <View className="border-t border-[#f1f5f9]">
                    <Picker
                      mode="selector"
                      range={roomOptions}
                      value={roomIndex}
                      onChange={(e) => {
                        const index = Number(e.detail.value);
                        const value = roomOptions[index];
                        setRoom(value === '请选择' ? '' : value);
                      }}
                    >
                      <View className={FORM_CELL_CLASS}>
                        <Text className={FORM_CELL_LABEL_CLASS}>上课教室</Text>
                        <View className="flex items-center gap-[12rpx]">
                          <Text
                            className={room ? 'text-[28rpx] text-[#111827]' : FORM_CELL_VALUE_CLASS}
                          >
                            {room || '请选择'}
                          </Text>
                          <Text className={FORM_ARROW_CLASS}>{'>'}</Text>
                        </View>
                      </View>
                    </Picker>
                  </View>
                </View>
              </View>

              <View className="mb-[24rpx]">
                <Text className={FORM_SECTION_TITLE_CLASS}>课时信息</Text>
                <View className={FORM_CARD_CLASS}>
                  <View className={FORM_CELL_CLASS}>
                    <Text className={FORM_CELL_LABEL_CLASS}>授课课时</Text>
                    <Text className="text-[28rpx] text-[#111827]">{durationHoursText}</Text>
                  </View>
                  <View className="border-t border-[#f1f5f9]">
                    <View className={FORM_CELL_CLASS}>
                      <Text className={FORM_CELL_LABEL_CLASS}>授课扣金额</Text>
                      <Text className="text-[28rpx] text-[#111827]">0</Text>
                    </View>
                  </View>
                </View>
              </View>

              <View className="mb-[24rpx]">
                <Text className={FORM_SECTION_TITLE_CLASS}>附加设置</Text>
                <View className="rounded-[18rpx] border border-[#eceff3] bg-white px-[20rpx] py-[20rpx]">
                  <Text className="mb-[14rpx] block text-[26rpx] text-[#111827]">颜色标签</Text>
                  <View className="flex gap-[10rpx]">
                    {COLOR_OPTIONS.map((item) => (
                      <View
                        key={item.key}
                        className={`flex-1 rounded-[14rpx] border px-[10rpx] py-[16rpx] text-center ${color === item.key ? 'border-[#f97361] bg-[#fff7f5]' : 'border-[#eceff3] bg-[#fafafa]'}`}
                        onClick={() => setColor(item.key)}
                      >
                        <Text className="block text-[34rpx]">{item.emoji}</Text>
                        <Text
                          className={`mt-[6rpx] block text-[20rpx] ${color === item.key ? 'text-[#f97361]' : 'text-[#6b7280]'}`}
                        >
                          {item.label}
                        </Text>
                      </View>
                    ))}
                  </View>

                  <Text className="mb-[14rpx] mt-[22rpx] block text-[26rpx] text-[#111827]">
                    课前提醒
                  </Text>
                  <View className="flex flex-wrap gap-[12rpx]">
                    {REMINDER_OPTIONS.map((item) => (
                      <View
                        key={item.value}
                        className={`rounded-full px-[18rpx] py-[10rpx] ${reminderMinutes === item.value ? 'bg-[#fff1ee]' : 'border border-[#e5e7eb] bg-white'}`}
                        onClick={() => setReminderMinutes(item.value)}
                      >
                        <Text
                          className={`text-[22rpx] ${reminderMinutes === item.value ? 'text-[#f97361]' : 'text-[#6b7280]'}`}
                        >
                          {item.label}
                        </Text>
                      </View>
                    ))}
                  </View>

                  <Text className="mb-[14rpx] mt-[22rpx] block text-[26rpx] text-[#111827]">
                    备注
                  </Text>
                  <View className="rounded-[14rpx] border border-[#eef2f6] bg-[#f8fafc] px-[20rpx] py-[22rpx]">
                    <Text
                      className={
                        note ? 'text-[26rpx] text-[#111827]' : 'text-[26rpx] text-[#9ca3af]'
                      }
                    >
                      {note || '可选备注'}
                    </Text>
                  </View>
                </View>
              </View>
            </>
          )}
        </View>

        {isRescheduleMode ? (
          <View className="fixed bottom-0 left-0 right-0 border-t border-input bg-background px-[24rpx] py-[18rpx] pb-safe-bar">
            <ActionButton
              text={saving ? '提交中...' : '确认调课'}
              fixed={false}
              onClick={handleSave}
              disabled={saving}
            />
          </View>
        ) : (
          <View className="fixed bottom-0 left-0 right-0 border-t border-[#eef2f7] bg-white px-[24rpx] py-[18rpx] pb-safe-bar">
            {!canSubmit && submitBlockedReason ? (
              <View className="absolute left-[24rpx] right-[24rpx] top-[-64rpx] rounded-[16rpx] bg-white px-4 py-3 shadow-soft">
                <Text className="text-sm text-muted-foreground">{submitBlockedReason}</Text>
              </View>
            ) : null}
            <View className="flex gap-[16rpx]">
              <ActionButton
                text={submitButtonText}
                fixed={false}
                onClick={handleSave}
                disabled={!canSubmit || saving || deleting}
              />
              {isEdit ? (
                <View
                  className={`flex min-w-[144rpx] items-center justify-center rounded-[14rpx] border px-[28rpx] ${saving || deleting ? 'border-border bg-muted' : 'border-[#fca5a5] bg-white'}`}
                  onClick={saving || deleting ? undefined : handleDelete}
                >
                  <Text
                    className={`text-[26rpx] font-medium ${saving || deleting ? 'text-muted-foreground' : 'text-[#ef4444]'}`}
                  >
                    {deleting ? '删除中...' : '删除'}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        )}
        {isRescheduleMode ? (
          <CalendarMonthSheet
            visible={calendarVisible}
            title="选择新日期"
            selectedDate={dayjs(selectedDateValue)}
            onClose={() => setCalendarVisible(false)}
            onSelect={(date) => {
              setSelectedDateValue(date.format('YYYY-MM-DD'));
              setDayOfWeek((date.day() || 7) as DayOfWeek);
            }}
            getDateDotType={getDateDotType}
            disablePastDates
          />
        ) : null}
      </View>
    </PageContainer>
  );
};

export default withRouteGuard(ScheduleForm);
