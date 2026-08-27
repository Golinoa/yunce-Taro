/**
 * 新增排课页 package-course/pages/schedule-form/index
 *
 * 设计参考：新增排课截图（班级名称、排课规则切换、开始日期、重复方式、
 *           上课周几多选、上课时间多组+/-、常用时间段、自动签到、保存）
 *
 * 核心业务逻辑：
 *   - 班课（class）：课程内容/人员已提前配置，排课 = 决定「这个班什么时候上」
 *   - 团课（group）：设置开放时段等学员预约，排课 = 「放出哪些时段可约」
 *   - 选中班级后，同步展示关键信息（已扣课时、老师、学员）
 *
 * 入参：sourceMode=class|group（来自课表页 FAB 按钮的来源 Tab）
 * 入参：id=xxx（编辑模式，已有排课 ID）
 * 入参：mode=reschedule（调课模式）
 */

import { View, Text, Picker, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import dayjs from 'dayjs';
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import ActionButton from '@/components/ActionButton';
import ClassStudentsCard from '@/components/course/ClassStudentsCard';
import CalendarMonthSheet from '@/components/CalendarMonthSheet';
import type { CalendarDotType } from '@/components/CalendarWeekSelector';
import Empty from '@/components/Empty';
import Icon from '@/components/Icon';
import Loading from '@/components/Loading';
import PageContainer from '@/components/PageContainer';
import PickerSheet, { PickerOption } from '@/components/PickerSheet';
import Stepper from '@/components/Stepper';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import {
  classService,
  notificationService,
  roomService,
  campusService,
  scheduleService,
  studentService,
  teacherService,
  temporaryRescheduleService,
  subscribeMessageService,
  calendarSyncService,
} from '@/services';
import { useStudentStore, useClassStore } from '@/stores';
import { useCampusStore } from '@/stores/campus';
import { subjectService } from '@/services/campus';
import type { CampusUIModel, Room, Subject } from '@/types/campus';
import type { Class } from '@/types/class';
import type { Schedule, ScheduleColor, DayOfWeek } from '@/types/schedule';
import type { Student } from '@/types/student';
import type { TeacherUIModel } from '@/types/teacher';
import { useAuth } from '@/utils/auth';
import { logError } from '@/utils/logger';
import { getDefaultRescheduleTargetDate } from '@/utils/reschedule-date';
import { withRouteGuard } from '@/utils/route-guard';

/* ======================== 常量 ======================== */

/** 重复方式 */

const MIN_DURATION_MINUTES = 30;

/** 课程类型选项（班课=内容人员已定，排课决定何时上；团课=放时段等预约） */
const SCHEDULE_TYPE_OPTIONS = ['班课', '团课'] as const;

const USE_MOCK =
  typeof process !== 'undefined' && typeof process.env !== 'undefined'
    ? process.env.VITE_USE_MOCK !== 'false'
    : true;

/* ======================== 工具函数 ======================== */

function getNextDateByDayOfWeek(dayOfWeek: DayOfWeek, baseDate = dayjs()): dayjs.Dayjs {
  const currentDate = baseDate.startOf('day');
  const currentWeekday = (currentDate.day() || 7) as DayOfWeek;
  const diff = dayOfWeek - currentWeekday;
  return currentDate.add(diff >= 0 ? diff : diff + 7, 'day');
}

function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

function formatMinutesToTime(m: number): string {
  const s = Math.max(0, Math.min(24 * 60 - 1, m));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
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
  const tIds = classInfo?.teachers?.length
    ? classInfo.teachers
    : classInfo?.teacher_id
      ? [classInfo.teacher_id]
      : [];
  const teachers = tIds.map((id) => teacherById[id]).filter(Boolean);
  const lead =
    teachers.find((t) => t.role !== 'assist') ||
    (classInfo?.teacher_id ? teacherById[classInfo.teacher_id] : undefined) ||
    (fallbackTeacherId ? teacherById[fallbackTeacherId] : undefined);
  const assist =
    teachers.find((t) => t.role === 'assist' && t.id !== lead?.id) ||
    (fallbackAssistantTeacherId ? teacherById[fallbackAssistantTeacherId] : undefined);
  return {
    leadTeacherId: lead?.id || fallbackTeacherId || '',
    leadTeacherName: lead?.name || fallbackTeacherName || '待分配',
    assistantTeacherId: assist?.id || fallbackAssistantTeacherId || '',
    assistantTeacherName: assist?.name || fallbackAssistantTeacherName || '未安排',
  };
}

/** 时间槽组 */
interface TimeSlotPair {
  id: number;
  start: string;
  end: string;
}

/* ======================== 主组件 ======================== */

const ScheduleForm: React.FC = () => {
  const { profile } = useAuth();
  const currentUserId = profile?.id || '';
  const currentTeacherName = profile?.name || '当前老师';
  const fetchStudentsByTeacher = useStudentStore((s) => s.fetchByTeacher);
  const invalidateStudents = useStudentStore((s) => s.invalidate);
  const fetchClassesByTeacher = useClassStore((s) => s.fetchByTeacher);
  const { currentCampusId } = useCampusStore();

  /* ---- 路由参数 ---- */
  const routerParams = useMemo(() => Taro.getCurrentInstance()?.router?.params || {}, []);
  const scheduleId = useMemo(() => decodeURIComponent(routerParams.id || ''), [routerParams]);
  const formMode = useMemo(() => decodeURIComponent(routerParams.mode || ''), [routerParams]);
  const lessonDateParam = useMemo(
    () => decodeURIComponent(routerParams.lessonDate || ''),
    [routerParams],
  );
  /** 来源模式：class=班课排课，group=团课排课 */
  const sourceMode = useMemo(
    () => decodeURIComponent(routerParams.sourceMode || 'class'),
    [routerParams],
  );
  const isEdit = !!scheduleId;
  const isRescheduleMode = isEdit && formMode === 'reschedule';

  /* ---- 状态 ---- */
  const { loading, setLoading } = useDelayedLoading();
  const [loadError, setLoadError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting] = useState(false);
  const [originalSchedule, setOriginalSchedule] = useState<Schedule | null>(null);

  /* 数据列表 */
  const [classes, setClasses] = useState<Class[]>([]);
  const [allSchedules, setAllSchedules] = useState<Schedule[]>([]);
  const [teachers, setTeachers] = useState<TeacherUIModel[]>([]);
  const [campusOptions, setCampusOptions] = useState<CampusUIModel[]>([]);

  /* 表单字段 —— 对齐参考图 */
  const [classId, setClassId] = useState('');
  const [startDate, setStartDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [selectedDays] = useState<DayOfWeek[]>([1]); // 多选
  const [timeSlots, setTimeSlots] = useState<TimeSlotPair[]>([
    { id: 1, start: '09:00', end: '10:00' },
  ]);

  /* 原有字段（保留兼容） */
  const [campusId, setCampusId] = useState('');
  const [, setRooms] = useState<Room[]>([]);
  const [room, setRoom] = useState('');
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [mode, setMode] = useState<'student' | 'class'>('class');
  const [studentId, setStudentId] = useState('');
  const [, setDayOfWeek] = useState<DayOfWeek>(1);
  const [selectedDateValue, setSelectedDateValue] = useState(dayjs().format('YYYY-MM-DD'));
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:30');
  const [selectedTeachingTeacherId, setSelectedTeachingTeacherId] = useState('');
  const [selectedAssistantTeacherId, setSelectedAssistantTeacherId] = useState('');
  const [color, setColor] = useState<ScheduleColor>('primary');
  const [note, setNote] = useState('');
  const [reminderMinutes, setReminderMinutes] = useState(0);

  /* ---- 统一排课表单字段（班课/团课共用） ---- */
  const [scheduleType, setScheduleType] = useState<'class' | 'group'>(
    sourceMode === 'group' ? 'group' : 'class',
  );
  const [consumedHours, setConsumedHours] = useState(1); // 消耗课时（步进器）
  /** 选中课程的学员列表（只读展示） */
  const [classStudents, setClassStudents] = useState<Student[]>([]);
  /** 全部学员池（学员选择弹窗搜索用） */
  const [students, setStudents] = useState<Student[]>([]);
  /** 科目列表（学员选择弹窗筛选用） */
  const [subjects, setSubjects] = useState<Subject[]>([]);
  /** 弹窗选择器可见性（统一使用 PickerSheet 标准组件） */
  const [typePickerVisible, setTypePickerVisible] = useState(false);
  const [classPickerVisible, setClassPickerVisible] = useState(false);
  const [teacherPickerVisible, setTeacherPickerVisible] = useState(false);
  const [assistantPickerVisible, setAssistantPickerVisible] = useState(false);
  /** 是否团课模式 */
  const isGroupMode = scheduleType === 'group';

  /* ---- 数据加载 ---- */
  const loadFormData = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    setNotFound(false);
    if (!currentUserId) {
      setLoadError('未获取到登录信息');
      setLoading(false);
      return;
    }
    try {
      const [stuList, clsList, schList, tchList, campList] = await Promise.all([
        fetchStudentsByTeacher(currentUserId),
        fetchClassesByTeacher(currentUserId),
        scheduleService.getByTeacher(currentUserId),
        teacherService.getList(),
        campusService.getList(),
      ]);
      // 全部学员池（供学员选择弹窗搜索）
      setStudents(stuList);
      // 科目列表（供学员选择弹窗按科目筛选）
      subjectService
        .getList()
        .then(setSubjects)
        .catch(() => setSubjects([]));
      setClasses(clsList);
      setAllSchedules(schList);
      setTeachers(tchList);
      setCampusOptions(campList);
      const mainCampusId = campList.find((c) => c.isMain)?.id || '';
      const fbCampusId = currentCampusId || mainCampusId || campList[0]?.id || '';

      if (isEdit && scheduleId) {
        const sch = await scheduleService.getById(scheduleId);
        if (!sch) {
          setNotFound(true);
          return;
        }
        const srcDate =
          lessonDateParam && dayjs(lessonDateParam).isValid()
            ? dayjs(lessonDateParam).startOf('day')
            : getNextDateByDayOfWeek(sch.day_of_week).startOf('day');
        if (isRescheduleMode) {
          const today = dayjs().startOf('day');
          if (srcDate.isBefore(today)) {
            Taro.showToast({ title: '已结束的课程不支持调课', icon: 'none' });
            setTimeout(() => Taro.navigateBack(), 1500);
            setLoading(false);
            return;
          }
        }
        setOriginalSchedule(sch);
        setMode(!USE_MOCK || sch.class_id ? 'class' : 'student');
        if (sch.student_id) setStudentId(sch.student_id);
        if (sch.class_id) setClassId(sch.class_id);
        setDayOfWeek(
          (dayjs(
            isRescheduleMode
              ? getDefaultRescheduleTargetDate(srcDate.format('YYYY-MM-DD'))
              : srcDate,
          ).day() || 7) as DayOfWeek,
        );
        setSelectedDateValue(
          dayjs(
            isRescheduleMode
              ? getDefaultRescheduleTargetDate(srcDate.format('YYYY-MM-DD'))
              : srcDate,
          ).format('YYYY-MM-DD'),
        );
        setStartTime(sch.start_time);
        setEndTime(sch.end_time);
        setSelectedTeachingTeacherId(sch.teacher_id || currentUserId);
        setSelectedAssistantTeacherId(sch.assistant_teacher_id || '');
        setColor(sch.color || 'primary');
        setNote(sch.note || '');
        setReminderMinutes(sch.reminder_minutes || 0);
        const cCampusId = sch.class_id
          ? clsList.find((c) => c.id === sch.class_id)?.campus_id
          : undefined;
        setCampusId(cCampusId || fbCampusId);
        setRoom(sch.room || '');
      } else {
        setOriginalSchedule(null);
        if (stuList.length > 0) setStudentId(stuList[0].id);
        // 课程名称不默认选中，由用户主动选择
        if (!USE_MOCK) setMode('class');
        setSelectedDateValue(dayjs().format('YYYY-MM-DD'));
        setStartDate(dayjs().format('YYYY-MM-DD'));
        setSelectedTeachingTeacherId(currentUserId);
        setCampusId(fbCampusId);
      }
    } catch (err) {
      logError('init schedule form', err);
      setLoadError('排课表单初始化失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [currentUserId, currentCampusId, isEdit, isRescheduleMode, lessonDateParam, scheduleId]);

  useEffect(() => {
    void loadFormData();
  }, [loadFormData]);

  /* 校区 → 教室联动 */
  useEffect(() => {
    if (!campusId) {
      setRooms([]);
      return;
    }
    roomService
      .getList({ campusId })
      .then(setRooms)
      .catch(() => setRooms([]));
  }, [campusId]);

  /* ---- 计算属性 ---- */
  const selectedClass = useMemo(
    () => classes.find((c) => c.id === classId) || null,
    [classId, classes],
  );

  /* 班级切换 → 同步校区 */
  useEffect(() => {
    if (mode !== 'class') return;
    const cc = selectedClass?.campus_id;
    if (cc && cc !== campusId) {
      setCampusId(cc);
      setRoom('');
    }
  }, [mode, selectedClass, campusId]);

  const teacherById = useMemo(
    () =>
      teachers.reduce<Record<string, TeacherUIModel>>((a, t) => {
        a[t.id] = t;
        return a;
      }, {}),
    [teachers],
  );

  /** 当前选中的班级信息（用于展示卡片） */
  const classInfoCard = useMemo(() => {
    if (!selectedClass) return null;
    const ti = getTeacherSelectionInfo({
      classInfo: selectedClass,
      teacherById,
      fallbackTeacherId: selectedTeachingTeacherId || currentUserId,
      fallbackTeacherName: currentTeacherName,
    });
    return {
      name: selectedClass.name,
      studentCount: selectedClass.student_count || 0,
      usedLessons: selectedClass.used_lessons || 0,
      totalLessons:
        ((selectedClass as unknown as Record<string, unknown>).total_lessons as
          | number
          | undefined) ?? null,
      pricePerLesson: selectedClass.pricePerLesson || 0,
      teacherName: ti.leadTeacherName,
      assistantName: ti.assistantTeacherName || undefined,
      campusName:
        selectedClass.campus_name ||
        campusOptions.find((c) => c.id === selectedClass.campus_id)?.name ||
        '',
      scheduleMode: selectedClass.schedule_mode,
    };
  }, [
    selectedClass,
    teacherById,
    selectedTeachingTeacherId,
    currentUserId,
    currentTeacherName,
    campusOptions,
  ]);

  /* 是否已有真实时间组（非默认占位 09:00-10:00） */
  const hasRealTimeSlots =
    timeSlots.length > 0 && timeSlots.some((ts) => ts.start !== '09:00' || ts.end !== '10:00');

  const sourceLessonDateText = useMemo(() => {
    if (lessonDateParam && dayjs(lessonDateParam).isValid())
      return dayjs(lessonDateParam).format('YYYY-MM-DD');
    return originalSchedule
      ? getNextDateByDayOfWeek(originalSchedule.day_of_week).format('YYYY-MM-DD')
      : '';
  }, [lessonDateParam, originalSchedule]);

  const scheduleWeekdaySet = useMemo(
    () => new Set(allSchedules.map((s) => s.day_of_week)),
    [allSchedules],
  );
  const getDateDotType = useCallback(
    (date: dayjs.Dayjs): CalendarDotType => {
      const wd = (date.day() || 7) as Schedule['day_of_week'];
      if (!scheduleWeekdaySet.has(wd)) return 'none';
      return date.isBefore(dayjs(), 'day') ? 'past' : 'active';
    },
    [scheduleWeekdaySet],
  );

  /* 时间校验 */
  useEffect(() => {
    setTimeSlots((prev) =>
      prev.map((ts) => {
        if (parseTimeToMinutes(ts.end) - parseTimeToMinutes(ts.start) < MIN_DURATION_MINUTES) {
          return {
            ...ts,
            end: formatMinutesToTime(parseTimeToMinutes(ts.start) + MIN_DURATION_MINUTES),
          };
        }
        return ts;
      }),
    );
  }, []); // 仅初始化时校验

  /* 班级切换 → 自动填充老师 */
  useEffect(() => {
    if (teachers.length === 0) return;
    if (mode === 'class') {
      const ti = getTeacherSelectionInfo({
        classInfo: selectedClass,
        teacherById,
        fallbackTeacherId: originalSchedule?.teacher_id || currentUserId,
        fallbackTeacherName: originalSchedule?.teacher_name || currentTeacherName,
        fallbackAssistantTeacherId: originalSchedule?.assistant_teacher_id,
        fallbackAssistantTeacherName: originalSchedule?.assistant_teacher_name,
      });
      setSelectedTeachingTeacherId(ti.leadTeacherId || currentUserId);
      setSelectedAssistantTeacherId(ti.assistantTeacherId);
      return;
    }
    setSelectedTeachingTeacherId(currentUserId);
    setSelectedAssistantTeacherId('');
  }, [
    currentTeacherName,
    currentUserId,
    mode,
    originalSchedule,
    selectedClass,
    teacherById,
    teachers.length,
  ]);

  /* 班级切换 → 拉取学员列表（只读展示） */
  useEffect(() => {
    if (!classId) {
      setClassStudents([]);
      return;
    }
    classService
      .getStudents(classId)
      .then(setClassStudents)
      .catch(() => setClassStudents([]));
  }, [classId]);

  /* ---- 操作方法 ---- */

  /** 添加一组时间 */
  const addTimeSlot = useCallback(() => {
    setTimeSlots((prev) => [...prev, { id: Date.now(), start: '10:00', end: '11:00' }]);
  }, []);

  /** 删除一组时间 */
  const removeTimeSlot = useCallback((id: number) => {
    setTimeSlots((prev) => (prev.length > 1 ? prev.filter((ts) => ts.id !== id) : prev));
  }, []);

  /** 更新某组时间的起/止 */
  const updateTimeSlot = useCallback((id: number, field: 'start' | 'end', val: string) => {
    setTimeSlots((prev) => prev.map((ts) => (ts.id === id ? { ...ts, [field]: val } : ts)));
  }, []);

  /* ---- 课程信息编辑同步 ---- */

  /**
   * 上课学员变更（移除/添加）：实时同步到班级（classService），
   * 并刷新当前页 classStudents + store 让课程管理页面同步生效。
   */
  const handleStudentsChange = useCallback(
    async (newIds: string[]) => {
      if (!classId) return;
      const oldIds = classStudents.map((s) => s.id);
      const toRemove = oldIds.filter((id) => !newIds.includes(id));
      const toAdd = newIds.filter((id) => !oldIds.includes(id));
      try {
        for (const sid of toRemove) {
          await classService.removeStudent(classId, sid);
        }
        if (toAdd.length > 0) {
          await classService.addStudents(classId, toAdd);
        }
        // 重新拉取本班学员（确保头像/姓名/课时为最新）
        const fresh = await classService.getStudents(classId);
        setClassStudents(fresh);
        // 刷新 store，让其他页面（课程管理/班级详情）看到最新结果
        invalidateStudents(currentUserId);
        Taro.showToast({ title: '已同步到课程管理', icon: 'success', duration: 1200 });
        // E02A：入班成功后操作人弹框
        if (toAdd.length > 0) {
          try {
            Taro.hideToast();
            await subscribeMessageService.runFlow('E02A', {
              classId,
              className: selectedClass?.name || '',
              role: profile?.currentContext?.role,
              navigateUrl: classId
                ? `/package-course/pages/course-form/index?id=${encodeURIComponent(classId)}&type=class`
                : undefined,
            });
          } catch (error) {
            logError('subscribe E02A after schedule student assign', error);
          }
        }
      } catch (err) {
        logError('同步班级学员失败', err);
        Taro.showToast({ title: '同步失败，请重试', icon: 'none' });
      }
    },
    [classId, classStudents, currentUserId, invalidateStudents, selectedClass?.name, profile?.currentContext?.role],
  );

  /** 调整授课老师 */
  const handleTeacherConfirm = useCallback((v: string) => {
    setSelectedTeachingTeacherId(v);
    setTeacherPickerVisible(false);
  }, []);

  /** 调整助教 */
  const handleAssistantConfirm = useCallback((v: string) => {
    setSelectedAssistantTeacherId(v);
    setAssistantPickerVisible(false);
  }, []);

  /* ---- 提交校验 ---- */
  const submitBlockedReason = useMemo(() => {
    if (!currentUserId) return '未获取到登录信息';
    if (mode === 'student' && !USE_MOCK) return '真实联调仅支持班级排课';
    if (mode === 'class' && !classId) return '请选择班级';
    if (!startDate) return '请选择开始日期';
    if (selectedDays.length === 0) return '请至少选择一个上课周几';
    if (timeSlots.some((ts) => !ts.start || !ts.end)) return '请填写完整的上课时间';
    if (timeSlots.some((ts) => ts.start >= ts.end)) return '结束时间需晚于开始时间';
    if (!selectedTeachingTeacherId) return '请选择主讲老师';
    return '';
  }, [classId, currentUserId, mode, selectedDays, selectedTeachingTeacherId, startDate, timeSlots]);

  const canSubmit = useMemo(
    () => !loading && !loadError && !notFound && !submitBlockedReason,
    [loadError, loading, notFound, submitBlockedReason],
  );

  /* ---- 通知 ---- */
  const handleNotifyStudentAndParents = useCallback(
    async (sid: string, title: string, content: string) => {
      try {
        await notificationService.send({
          sender_id: currentUserId,
          receiver_id: sid,
          title,
          content,
          related_id: sid,
        });
      } catch {
        /* ignore */
      }
      try {
        const parents = await studentService.getParents(sid);
        for (const p of parents) {
          try {
            await notificationService.send({
              sender_id: currentUserId,
              receiver_id: p.parent_id,
              title,
              content,
              related_id: sid,
            });
          } catch {
            /* ignore */
          }
        }
      } catch {
        /* ignore */
      }
    },
    [currentUserId],
  );

  /* ---- 保存 ---- */
  const handleSave = useCallback(async () => {
    if (saving) return;
    if (submitBlockedReason) {
      Taro.showToast({ title: submitBlockedReason, icon: 'none' });
      return;
    }

    /* 调课分支 */
    if (isRescheduleMode) {
      if (!originalSchedule) {
        Taro.showToast({ title: '未找到原课程信息', icon: 'none' });
        return;
      }
      const sd = sourceLessonDateText,
        td = selectedDateValue;
      if (!sd || !dayjs(sd).isValid()) {
        Taro.showToast({ title: '原上课日期异常', icon: 'none' });
        return;
      }
      const noDate = td === sd,
        noTime = startTime === originalSchedule.start_time && endTime === originalSchedule.end_time;
      if (noDate && noTime) {
        Taro.showToast({ title: '请至少调整日期或时间', icon: 'none' });
        return;
      }
      const adj: Schedule = { ...originalSchedule, start_time: startTime, end_time: endTime };
      const conflicts = await temporaryRescheduleService.checkDateConflict({
        teacherId: currentUserId,
        sourceDate: sd,
        targetDate: td,
        movingSchedules: [adj],
        allSchedules,
      });
      if (conflicts.length > 0) {
        Taro.showToast({ title: '目标日期存在时间冲突', icon: 'none', duration: 3000 });
        return;
      }
      setSaving(true);
      try {
        await temporaryRescheduleService.saveBatch({
          teacherId: currentUserId,
          sourceDate: sd,
          targetDate: td,
          schedules: [adj],
        });
        const ot = `${dayjs(sd).format('MM月DD日')} ${originalSchedule.start_time}-${originalSchedule.end_time}`;
        const nt = `${dayjs(td).format('MM月DD日')} ${startTime}-${endTime}`;
        if (mode === 'class' && classId) {
          const cs = await classService.getStudents(classId);
          for (const s of cs)
            await handleNotifyStudentAndParents(
              s.id,
              '调课通知',
              `${selectedClass?.name || '班级课程'} 已由 ${ot} 调整为 ${nt}，仅本次生效。`,
            );
        }
        Taro.showToast({ title: '调课成功', icon: 'success' });
        try {
          Taro.hideToast();
          await subscribeMessageService.runFlow('E07', {
            className: selectedClass?.name || '',
            role: profile?.currentContext?.role,
            campusId: profile?.currentContext?.campusId,
          });
        } catch (error) {
          logError('subscribe E07 after reschedule', error);
        }
        void calendarSyncService.syncAfterScheduleChange({
          userId: currentUserId,
          teacherId: currentUserId,
          campusId: profile?.currentContext?.campusId,
          role: profile?.currentContext?.role,
        });
        setTimeout(() => Taro.navigateBack(), 1200);
      } catch {
        Taro.showToast({ title: '调课失败', icon: 'none' });
      } finally {
        setSaving(false);
      }
      return;
    }

    /* 创建/编辑排课 */
    const targetDow = (dayjs(selectedDateValue).day() || 7) as DayOfWeek;
    const hasConflict = await scheduleService.checkConflict(
      currentUserId,
      targetDow,
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
          day_of_week: targetDow,
          start_time: startTime,
          end_time: endTime,
          room: room || undefined,
          color,
          note: note.trim() || undefined,
          reminder_minutes: reminderMinutes,
        };
        if (isEdit) {
          await scheduleService.update(scheduleId, data);
          Taro.showToast({ title: '更新成功', icon: 'success' });
        } else {
          await scheduleService.create(data as Omit<Schedule, 'id' | 'created_at' | 'updated_at'>);
          Taro.showToast({ title: '添加成功', icon: 'success' });
        }
        try {
          Taro.hideToast();
          await subscribeMessageService.runFlow('E07', {
            className: selectedClass?.name || '',
            role: profile?.currentContext?.role,
            campusId: profile?.currentContext?.campusId,
          });
        } catch (error) {
          logError('subscribe E07 after schedule save', error);
        }
        void calendarSyncService.syncAfterScheduleChange({
          userId: currentUserId,
          teacherId: currentUserId,
          campusId: profile?.currentContext?.campusId,
          role: profile?.currentContext?.role,
        });
        setTimeout(() => Taro.navigateBack(), 1200);
      } catch {
        Taro.showToast({ title: '保存失败', icon: 'none' });
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
    profile?.currentContext?.campusId,
    profile?.currentContext?.role,
    reminderMinutes,
    room,
    saving,
    scheduleId,
    selectedAssistantTeacherId,
    selectedClass?.name,
    selectedDateValue,
    selectedTeachingTeacherId,
    startTime,
    studentId,
    submitBlockedReason,
    sourceLessonDateText,
  ]);

  /* ---- 渲染：加载态 ---- */
  if (loading)
    return (
      <PageContainer>
        <View className="flex items-center justify-center pt-[200rpx]">
          <Loading text="加载中..." />
        </View>
      </PageContainer>
    );
  if (loadError)
    return (
      <PageContainer>
        <View className="min-h-screen bg-muted px-8 flex items-center justify-center">
          <Empty
            icon="mdi-alert-circle"
            description={loadError}
            actionText="重新加载"
            onAction={() => void loadFormData()}
          />
        </View>
      </PageContainer>
    );
  if (notFound)
    return (
      <PageContainer>
        <View className="min-h-screen bg-muted px-8 flex items-center justify-center">
          <Empty
            icon="mdi-calendar-blank"
            description="未找到对应排课信息"
            actionText="返回"
            onAction={() => Taro.navigateBack()}
          />
        </View>
      </PageContainer>
    );

  /* ======================== 主渲染 ======================== */
  return (
    <PageContainer safeBottom className="bg-muted">
      <ScrollView scrollY className="h-screen" enhanced showScrollbar={false}>
        <View className="min-h-screen pb-[240rpx]">
          {/* ===================== 统一排课表单（班课/团课共用） ===================== */}
          {/* 设计要点：课程类型 → 课程名称 → 消耗课时(步进器) → 上课时间； */}
          {/* 引用信息（老师/助教/时长/难度）选中课程后带出，折叠到上课时间下方展示 */}
          <>
            {/* 主表单 —— 单一大圆角白卡片 */}
            <View className="mx-[24rpx] mt-[24rpx] overflow-hidden rounded-[20rpx] bg-card">
              {/* 1. 课程类型（班课/团课） */}
              <View className="flex items-center justify-between px-[32rpx] py-[32rpx] border-b border-border/60">
                <Text className="text-[28rpx] text-foreground">课程类型</Text>
                <View
                  className="flex items-center gap-[8rpx]"
                  onClick={() => setTypePickerVisible(true)}
                >
                  <Text className="text-[28rpx] text-foreground">
                    {SCHEDULE_TYPE_OPTIONS[isGroupMode ? 1 : 0]}
                  </Text>
                  <Icon name="mdi-chevron-right" size={24} color="mutedForeground" />
                </View>
              </View>

              {/* 2. 课程名称（选择对应课程，选中后带出老师/助教/时长/难度） */}
              <View className="flex items-center justify-between px-[32rpx] py-[32rpx] border-b border-border/60">
                <Text className="text-[28rpx] text-foreground">课程名称</Text>
                <View
                  className="flex items-center gap-[8rpx]"
                  onClick={() => setClassPickerVisible(true)}
                >
                  <Text
                    className={cn(
                      'text-[28rpx]',
                      selectedClass ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {selectedClass?.name || '请选择'}
                  </Text>
                  <Icon name="mdi-chevron-right" size={24} color="mutedForeground" />
                </View>
              </View>

              {/* 2.5 授课老师 / 助教（选中课程后显示，与课程信息同一卡片不分割） */}
              {selectedClass && (
                <>
                  <View
                    className="flex items-center justify-between px-[32rpx] py-[32rpx] border-b border-border/60"
                    onClick={() => setTeacherPickerVisible(true)}
                  >
                    <Text className="text-[28rpx] text-foreground">授课老师</Text>
                    <View className="flex items-center gap-[8rpx]">
                      <Text
                        className={cn(
                          'text-[28rpx]',
                          classInfoCard?.teacherName ? 'text-foreground' : 'text-muted-foreground',
                        )}
                      >
                        {classInfoCard?.teacherName || '请选择'}
                      </Text>
                      <Icon name="mdi-chevron-right" size={24} color="mutedForeground" />
                    </View>
                  </View>
                  <View
                    className="flex items-center justify-between px-[32rpx] py-[32rpx] border-b border-border/60"
                    onClick={() => setAssistantPickerVisible(true)}
                  >
                    <Text className="text-[28rpx] text-foreground">助教</Text>
                    <View className="flex items-center gap-[8rpx]">
                      <Text
                        className={cn(
                          'text-[28rpx]',
                          classInfoCard?.assistantName
                            ? 'text-foreground'
                            : 'text-muted-foreground',
                        )}
                      >
                        {classInfoCard?.assistantName || '未安排'}
                      </Text>
                      <Icon name="mdi-chevron-right" size={24} color="mutedForeground" />
                    </View>
                  </View>
                </>
              )}

              {/* 3. 消耗课时（加减步进器） */}
              <View className="flex items-center justify-between px-[32rpx] py-[32rpx]">
                <Text className="text-[28rpx] text-foreground">消耗课时</Text>
                <Stepper
                  value={consumedHours}
                  min={0.5}
                  max={99}
                  step={0.5}
                  onChange={setConsumedHours}
                />
              </View>
            </View>

            {/* 上课时间 —— 独立区域（虚线加号卡片） */}
            <View className="mx-[24rpx] mt-[24rpx] overflow-hidden rounded-[20rpx] bg-card px-[32rpx] py-[32rpx]">
              <Text className="mb-[24rpx] block text-[28rpx] font-medium text-foreground">
                上课时间
              </Text>
              <View
                className="flex min-h-[260rpx] flex-col items-center justify-center rounded-[16rpx] border-[2rpx] border-dashed border-border bg-muted/60"
                onClick={addTimeSlot}
              >
                {hasRealTimeSlots ? (
                  <View className="w-full px-[24rpx] pb-[20rpx]">
                    {timeSlots.map((ts) => (
                      <View
                        key={ts.id}
                        className="mb-[16rpx] flex items-center justify-between rounded-[12rpx] bg-card px-[24rpx] py-[18rpx] shadow-sm"
                      >
                        <View className="flex items-center gap-[16rpx]">
                          <Picker
                            mode="time"
                            value={ts.start}
                            onChange={(e) => updateTimeSlot(ts.id, 'start', e.detail.value)}
                          >
                            <View className="rounded-[8rpx] bg-primary/10 px-[18rpx] py-[10rpx]">
                              <Text className="text-[26rpx] font-semibold text-primary">
                                {ts.start}
                              </Text>
                            </View>
                          </Picker>
                          <Text className="text-[24rpx] text-muted-foreground">~</Text>
                          <Picker
                            mode="time"
                            value={ts.end}
                            onChange={(e) => updateTimeSlot(ts.id, 'end', e.detail.value)}
                          >
                            <View className="rounded-[8rpx] bg-primary/10 px-[18rpx] py-[10rpx]">
                              <Text className="text-[26rpx] font-semibold text-primary">
                                {ts.end}
                              </Text>
                            </View>
                          </Picker>
                        </View>
                        {timeSlots.length > 1 && (
                          <View
                            className="flex h-[44rpx] w-[44rpx] items-center justify-center rounded-full bg-error/10"
                            onClick={() => removeTimeSlot(ts.id)}
                          >
                            <Icon name="mdi-close" size={20} color="error" />
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                ) : (
                  <>
                    <View className="flex h-[88rpx] w-[88rpx] items-center justify-center rounded-full bg-[#FF8A2A] shadow-md">
                      <Icon name="mdi-plus" size={40} color="#ffffff" />
                    </View>
                    <Text className="mt-[20rpx] text-[26rpx] text-muted-foreground">
                      添加上课时间
                    </Text>
                  </>
                )}
              </View>
            </View>

            {/* 上课学员：选中课程后显示（核心可编辑区块） */}
            {selectedClass && (
              <View className="mx-[24rpx] mt-[24rpx]">
                <ClassStudentsCard
                  studentIds={classStudents.map((s) => s.id)}
                  students={classStudents}
                  allStudents={students}
                  subjectId={selectedClass?.subject_id}
                  subjects={subjects}
                  onChange={handleStudentsChange}
                />
              </View>
            )}
          </>
        </View>
      </ScrollView>

      {/* ====== 底部操作栏 ====== */}
      <View className="fixed bottom-0 left-0 right-0 border-t border-border bg-card px-[28rpx] py-[18rpx] pb-safe-bar">
        {!canSubmit && submitBlockedReason && (
          <View className="absolute left-[28rpx] right-[28rpx] top-[-64rpx] rounded-[16rpx] bg-background px-[20rpx] py-[14rpx] shadow-soft">
            <Text className="text-[24rpx] text-muted-foreground">{submitBlockedReason}</Text>
          </View>
        )}
        <ActionButton
          text={saving ? '保存中...' : '保存'}
          fixed={false}
          onClick={handleSave}
          disabled={!canSubmit || saving || deleting}
        />
      </View>

      {/* 日历弹窗 */}
      <CalendarMonthSheet
        visible={calendarVisible}
        title="选择开始日期"
        selectedDate={dayjs(startDate)}
        onClose={() => setCalendarVisible(false)}
        onSelect={(d) => {
          setStartDate(d.format('YYYY-MM-DD'));
          setSelectedDateValue(d.format('YYYY-MM-DD'));
          setDayOfWeek((d.day() || 7) as DayOfWeek);
        }}
        getDateDotType={getDateDotType}
        disablePastDates
      />

      {/* 课程类型选择器（PickerSheet 标准组件） */}
      <PickerSheet
        visible={typePickerVisible}
        title="课程类型"
        options={[
          { label: '班课', value: 'class' },
          { label: '团课', value: 'group' },
        ]}
        value={isGroupMode ? 'group' : 'class'}
        onClose={() => setTypePickerVisible(false)}
        onConfirm={(v) => setScheduleType(v === 'group' ? 'group' : 'class')}
      />

      {/* 课程名称选择器（PickerSheet 标准组件） */}
      <PickerSheet
        visible={classPickerVisible}
        title="选择课程"
        options={classes.map((c): PickerOption => ({ label: c.name, value: c.id }))}
        value={classId}
        onClose={() => setClassPickerVisible(false)}
        onConfirm={(v) => setClassId(v)}
      />

      {/* 授课老师选择器（PickerSheet 标准组件） */}
      <PickerSheet
        visible={teacherPickerVisible}
        title="选择授课老师"
        options={[
          { label: '待分配', value: '' },
          ...teachers
            .filter((t) => t.role !== 'assist' || t.id === selectedTeachingTeacherId)
            .map((t): PickerOption => ({ label: t.name, value: t.id })),
        ]}
        value={selectedTeachingTeacherId}
        onClose={() => setTeacherPickerVisible(false)}
        onConfirm={handleTeacherConfirm}
      />

      {/* 助教选择器（PickerSheet 标准组件） */}
      <PickerSheet
        visible={assistantPickerVisible}
        title="选择助教"
        options={[
          { label: '未安排', value: '' },
          ...teachers
            .filter(
              (t) =>
                t.id !== selectedTeachingTeacherId &&
                (t.role === 'assist' || t.id === selectedAssistantTeacherId),
            )
            .map((t): PickerOption => ({ label: t.name, value: t.id })),
        ]}
        value={selectedAssistantTeacherId}
        onClose={() => setAssistantPickerVisible(false)}
        onConfirm={handleAssistantConfirm}
      />
    </PageContainer>
  );
};

export default withRouteGuard(ScheduleForm);
