/**
 * 新增排课页 package-course/pages/schedule-form/index
 *
 * 设计参考：新增排课截图（班级名称、排课规则切换、开始日期、重复方式、
 *           上课周几多选、上课时间多组+/-、常用时间段、自动签到、保存）
 *
 * 核心业务逻辑：
 *   - 班课（class）：课程内容/人员已提前配置，排课 = 决定「这个班什么时候上」
 *   - 团课（group）：同班课表单，但无学员列表（预约制）；含「预约设置」
 *     （与时段配置 class-slot-config 同步：自动开班 / 每时段可约 / 最少开班）
 * 入参：sourceMode=class|group（来自课表页 FAB 按钮的来源 Tab）
 * 入参：id=xxx（编辑模式，已有排课 ID）
 * 入参：mode=reschedule（调课模式）
 */

import { View, Text, ScrollView, Textarea } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import dayjs from 'dayjs';
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import CalendarMonthSheet from '@/components/CalendarMonthSheet';
import type { CalendarDotType } from '@/components/CalendarWeekSelector';
import ClassPickerSheet from '@/components/course/ClassPickerSheet';
import ClassStudentsCard from '@/components/course/ClassStudentsCard';
import Empty from '@/components/Empty';
import Loading from '@/components/Loading';
import PageContainer from '@/components/PageContainer';
import PickerSheet, { PickerOption } from '@/components/PickerSheet';
import ScheduleConflictDialog from '@/components/schedule/ScheduleConflictDialog';
import TimePickerSheet from '@/components/TimePickerSheet';
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
import { subjectService } from '@/services/campus';
import { useStudentStore, useClassStore } from '@/stores';
import { useCampusStore } from '@/stores/campus';
import type { CampusUIModel, Room, Subject } from '@/types/campus';
import type { Class, ClassLevel } from '@/types/class';
import { CLASS_LEVEL_LABELS } from '@/types/class';
import type { Schedule, ScheduleColor, DayOfWeek } from '@/types/schedule';
import type { ScheduleConflictResult } from '@/types/schedule-conflict';
import type { Student } from '@/types/student';
import type { TeacherUIModel } from '@/types/teacher';
import { useAuth } from '@/utils/auth';
import { logError } from '@/utils/logger';
import { getDefaultRescheduleTargetDate } from '@/utils/reschedule-date';
import { withRouteGuard } from '@/utils/route-guard';
import { getTeacherSelectionInfo } from './teacher-selection';
import {
  formatMinutesToTime,
  getNextDateByDayOfWeek,
  MIN_DURATION_MINUTES,
  parseTimeToMinutes,
} from './time';
import {
  formatRescheduleTimeLabel,
  getScheduleFormSubmitBlockedReason,
  validateRescheduleSaveInput,
} from './schedule-form-validate';
import {
  buildScheduleRuleNote,
  buildScheduleSaveSuccessTitle,
  buildScheduleSaveTargets,
  mergeScheduleConflictResults,
} from './schedule-form-save';
import {
  END_MODE_OPTIONS,
  SCHEDULE_TYPE_OPTIONS,
  type AutoOpenType,
  type EndMode,
  type RepeatMode,
  type SchedulingMode,
  type TimeSlotPair,
} from './schedule-form-constants';
import ScheduleFormBaseCard from './ScheduleFormBaseCard';
import ScheduleFormRuleCard from './ScheduleFormRuleCard';
import ScheduleFormTimeSlots from './ScheduleFormTimeSlots';

/* ======================== 主组件 ======================== */

const ScheduleForm: React.FC = () => {
  const { profile } = useAuth();
  const currentUserId = profile?.id || '';
  const currentTeacherName = profile?.name || '当前老师';
  const fetchStudentsByTeacher = useStudentStore((s) => s.fetchByTeacher);
  const invalidateStudents = useStudentStore((s) => s.invalidate);
  const fetchClassesByTeacher = useClassStore((s) => s.fetchByTeacher);
  const invalidateClasses = useClassStore((s) => s.invalidate);
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

  /* 表单字段 —— 对齐班课定稿 */
  const [classId, setClassId] = useState('');
  const [startDate, setStartDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [selectedDays, setSelectedDays] = useState<DayOfWeek[]>([1]);
  const [timeSlots, setTimeSlots] = useState<TimeSlotPair[]>([]);
  const [schedulingMode, setSchedulingMode] = useState<SchedulingMode>('rule');
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('weekly');
  const [endMode, setEndMode] = useState<EndMode>('never');
  const [endDate, setEndDate] = useState(dayjs().add(1, 'month').format('YYYY-MM-DD'));
  const [endCount, setEndCount] = useState(10);
  /** 节假日是否排课：是=true，否=false（默认否） */
  const [scheduleOnHoliday, setScheduleOnHoliday] = useState(false);
  const [freeDates, setFreeDates] = useState<string[]>([]);
  const [endDateCalendarVisible, setEndDateCalendarVisible] = useState(false);
  /** 自由排课：课表同款月历多选 */
  const [freeCalendarVisible, setFreeCalendarVisible] = useState(false);
  const [roomPickerVisible, setRoomPickerVisible] = useState(false);
  const [scrollTop, setScrollTop] = useState(0);
  const savedScrollTopRef = useRef(0);
  const autoOpenedClassPickerRef = useRef(false);
  const [endModePickerVisible, setEndModePickerVisible] = useState(false);
  const [conflictDialogVisible, setConflictDialogVisible] = useState(false);
  const [conflictResult, setConflictResult] = useState<ScheduleConflictResult | null>(null);
  const ignoreConflictRef = useRef(false);
  const [teacherPickerVisible, setTeacherPickerVisible] = useState(false);
  const [assistantPickerVisible, setAssistantPickerVisible] = useState(false);
  const [levelPickerVisible, setLevelPickerVisible] = useState(false);
  const [courseLevel, setCourseLevel] = useState<ClassLevel>('all');
  /**
   * 团课预约设置（与时段配置同步，落库在班级）
   * - autoOpenType：自动开班条件
   * - slotMaxCount：每时段可约人数（同步 class.student_count 作为默认容量）
   * - minOpenCount：最少开班人数
   */
  const [autoOpenType, setAutoOpenType] = useState<AutoOpenType>('full');
  const [slotMaxCount, setSlotMaxCount] = useState(6);
  const [minOpenCount, setMinOpenCount] = useState(5);
  /** 上课时间：空态点加号 → 选开始 → 选结束 */
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [timePickerTitle, setTimePickerTitle] = useState('选择开始时间');
  const [timePickerValue, setTimePickerValue] = useState('09:00');
  const [timePickerPhase, setTimePickerPhase] = useState<'start' | 'end'>('start');
  const [draftStartTime, setDraftStartTime] = useState('09:00');
  const [editingSlotId, setEditingSlotId] = useState<number | null>(null);
  const chainingTimePickerRef = useRef(false);

  /* 原有字段（保留兼容） */
  const [campusId, setCampusId] = useState('');
  const [rooms, setRooms] = useState<Room[]>([]);
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
        setMode('class');
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
        setTimeSlots([{ id: 1, start: sch.start_time, end: sch.end_time }]);
        setSelectedDays([sch.day_of_week]);
        setStartDate(srcDate.format('YYYY-MM-DD'));
        setSelectedTeachingTeacherId(sch.teacher_id || currentUserId);
        setSelectedAssistantTeacherId(sch.assistant_teacher_id || '');
        setColor(sch.color || 'primary');
        const rawNote = sch.note || '';
        if (/类型:团课/.test(rawNote) || sourceMode === 'group') {
          setScheduleType('group');
        }
        // 预约设置优先从班级回填（见下方 selectedClass effect）；note 仅作兼容兜底
        const noteAuto = rawNote.match(/自动开班:(manual|full|time|full_or_time)/);
        if (noteAuto?.[1]) setAutoOpenType(noteAuto[1] as AutoOpenType);
        const noteMax = rawNote.match(/每时段可约:(\d+)/);
        if (noteMax?.[1]) setSlotMaxCount(Math.max(1, Number(noteMax[1]) || 6));
        const noteMin = rawNote.match(/最少开班:(\d+)/) || rawNote.match(/满人开课人数:(\d+)/);
        if (noteMin?.[1]) setMinOpenCount(Math.max(1, Number(noteMin[1]) || 5));
        // 备注只回填用户原文，去掉系统拼接的元数据行
        setNote(
          rawNote
            .split('\n')
            .filter(
              (line) =>
                !/(规则:|节假日排课:|消耗课时:|类型:|满人开课|自动开班:|每时段可约:|最少开班:)/.test(
                  line,
                ) && !/^日期:\d{4}-\d{2}-\d{2}$/.test(line.trim()),
            )
            .join('\n')
            .trim(),
        );
        setReminderMinutes(sch.reminder_minutes || 0);
        const cCampusId = sch.class_id
          ? clsList.find((c) => c.id === sch.class_id)?.campus_id
          : undefined;
        setCampusId(cCampusId || fbCampusId);
        setRoom(sch.room || '');
      } else {
        setOriginalSchedule(null);
        if (stuList.length > 0) setStudentId(stuList[0].id);
        // 班级名称不默认选中；进页后自动弹出选择班级（见下方 effect）
        setMode('class');
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
  }, [
    currentUserId,
    currentCampusId,
    isEdit,
    isRescheduleMode,
    lessonDateParam,
    scheduleId,
    sourceMode,
  ]);

  useEffect(() => {
    void loadFormData();
  }, [loadFormData]);

  useEffect(() => {
    const title = isRescheduleMode ? '班级调课' : isEdit ? '编辑排课' : '新增排课';
    void Taro.setNavigationBarTitle({ title });
  }, [isEdit, isRescheduleMode]);

  /* 新增排课：进页默认弹出选择班级，缩短操作路径 */
  useEffect(() => {
    if (loading || isEdit || isRescheduleMode) return;
    if (autoOpenedClassPickerRef.current) return;
    if (classId || classes.length === 0) return;
    autoOpenedClassPickerRef.current = true;
    setClassPickerVisible(true);
  }, [loading, isEdit, isRescheduleMode, classId, classes.length]);

  /* 校区 → 教室联动：进入机构页必有当前校区，教室只跟当前校区 */
  useEffect(() => {
    const effectiveCampusId = currentCampusId || campusId;
    if (!effectiveCampusId) {
      setRooms([]);
      return;
    }
    if (effectiveCampusId !== campusId) {
      setCampusId(effectiveCampusId);
    }
    roomService
      .getList({ campusId: effectiveCampusId })
      .then(setRooms)
      .catch(() => setRooms([]));
  }, [campusId, currentCampusId]);

  /* 隔天：仅允许一组上课时间 */
  useEffect(() => {
    if (schedulingMode === 'rule' && repeatMode === 'alternate' && timeSlots.length > 1) {
      setTimeSlots((prev) => prev.slice(0, 1));
    }
  }, [repeatMode, schedulingMode, timeSlots.length]);

  /* 同步首组时间到兼容字段（保存/冲突检测仍用） */
  useEffect(() => {
    const first = timeSlots[0];
    if (!first) return;
    setStartTime(first.start);
    setEndTime(first.end);
  }, [timeSlots]);

  /* ---- 计算属性 ---- */
  const selectedClass = useMemo(
    () => classes.find((c) => c.id === classId) || null,
    [classId, classes],
  );

  const classLevelLabel = useMemo(() => CLASS_LEVEL_LABELS[courseLevel] || '所有人', [courseLevel]);

  /* 班级切换 → 同步难度 */
  useEffect(() => {
    if (selectedClass?.level) {
      setCourseLevel(selectedClass.level);
    }
  }, [selectedClass?.id, selectedClass?.level]);

  /* 团课：班级切换 → 同步预约设置（与时段配置同一数据源） */
  useEffect(() => {
    if (!isGroupMode || !selectedClass) return;
    setAutoOpenType(selectedClass.auto_open_type || 'full');
    const max = selectedClass.student_count > 0 ? selectedClass.student_count : 6;
    setSlotMaxCount(max);
    setMinOpenCount(selectedClass.min_open_count || selectedClass.student_count || 5);
  }, [
    isGroupMode,
    selectedClass?.id,
    selectedClass?.auto_open_type,
    selectedClass?.min_open_count,
    selectedClass?.student_count,
  ]);

  const selectedRoomName = useMemo(
    () => rooms.find((r) => r.id === room || r.name === room)?.name || room || '',
    [room, rooms],
  );

  const timeDisplayDateLabel = useMemo(() => {
    const raw = schedulingMode === 'free' && freeDates.length > 0 ? freeDates[0] : startDate;
    if (!raw || !dayjs(raw).isValid()) return '请选择日期';
    const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
    const d = dayjs(raw);
    return `${d.format('YYYY-MM-DD')} 星期${WEEK[d.day()]}`;
  }, [freeDates, schedulingMode, startDate]);

  /* 班级切换 → 同步校区（班级校区优先，但仍落在当前机构上下文） */
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

  /* 是否已添加上课时间 */
  const hasRealTimeSlots = timeSlots.length > 0;

  const sourceLessonDateText = useMemo(() => {
    if (lessonDateParam && dayjs(lessonDateParam).isValid())
      return dayjs(lessonDateParam).format('YYYY-MM-DD');
    return originalSchedule
      ? getNextDateByDayOfWeek(originalSchedule.day_of_week).format('YYYY-MM-DD')
      : '';
  }, [lessonDateParam, originalSchedule]);

  const scheduledClassIds = useMemo(() => {
    const ids = new Set<string>();
    for (const s of allSchedules) {
      if (s.class_id) ids.add(s.class_id);
    }
    return ids;
  }, [allSchedules]);

  const scheduleWeekdaySet = useMemo(
    () => new Set(allSchedules.map((s) => s.day_of_week)),
    [allSchedules],
  );

  const restoreScrollAfterSheet = useCallback(() => {
    const y = savedScrollTopRef.current;
    // 微小偏移强制 ScrollView 应用 scrollTop，防止 BottomSheet 关闭后回顶
    setTimeout(() => {
      setScrollTop(y + 0.01);
    }, 80);
    setTimeout(() => {
      setScrollTop(y);
    }, 160);
  }, []);

  const openFreeCalendar = useCallback(() => {
    setFreeCalendarVisible(true);
  }, []);

  const closeFreeCalendar = useCallback(() => {
    setFreeCalendarVisible(false);
    restoreScrollAfterSheet();
  }, [restoreScrollAfterSheet]);
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

  const allowMultiTimeSlots = !(schedulingMode === 'rule' && repeatMode === 'alternate');

  /** 打开时间选择：空态新增 或 编辑已有时段 */
  const openTimePickerFlow = useCallback(
    (slotId?: number) => {
      if (slotId == null && !allowMultiTimeSlots && timeSlots.length >= 1) {
        Taro.showToast({ title: '隔天排课仅支持一组时间', icon: 'none' });
        return;
      }
      setEditingSlotId(slotId ?? null);
      setTimePickerPhase('start');
      setTimePickerTitle('选择开始时间');
      const existing = slotId != null ? timeSlots.find((t) => t.id === slotId) : null;
      const start = existing?.start || '09:00';
      setDraftStartTime(start);
      setTimePickerValue(start);
      setTimePickerVisible(true);
    },
    [allowMultiTimeSlots, timeSlots],
  );

  const handleTimePickerConfirm = useCallback(
    (time: string) => {
      if (timePickerPhase === 'start') {
        setDraftStartTime(time);
        setTimePickerPhase('end');
        setTimePickerTitle('选择结束时间');
        const existing =
          editingSlotId != null ? timeSlots.find((t) => t.id === editingSlotId) : null;
        const defaultEnd =
          existing?.end && existing.end > time
            ? existing.end
            : formatMinutesToTime(parseTimeToMinutes(time) + 60);
        setTimePickerValue(defaultEnd);
        chainingTimePickerRef.current = true;
        // TimePickerSheet 确认后会 onClose，下一帧再打开结束时间选择
        setTimeout(() => {
          setTimePickerVisible(true);
          chainingTimePickerRef.current = false;
        }, 80);
        return;
      }

      if (time <= draftStartTime) {
        Taro.showToast({ title: '结束时间需晚于开始时间', icon: 'none' });
        chainingTimePickerRef.current = true;
        setTimeout(() => {
          setTimePickerVisible(true);
          chainingTimePickerRef.current = false;
        }, 80);
        return;
      }

      if (editingSlotId != null) {
        setTimeSlots((prev) =>
          prev.map((ts) =>
            ts.id === editingSlotId ? { ...ts, start: draftStartTime, end: time } : ts,
          ),
        );
      } else {
        setTimeSlots((prev) => [...prev, { id: Date.now(), start: draftStartTime, end: time }]);
      }
      setEditingSlotId(null);
      setTimePickerPhase('start');
      // 仅恢复原滚动位置，不主动滚到时间区（避免弹窗关闭后滚动条跳动）
      restoreScrollAfterSheet();
    },
    [draftStartTime, editingSlotId, restoreScrollAfterSheet, timePickerPhase, timeSlots],
  );

  /** 删除一组时间（删光后回到中间加号空态） */
  const removeTimeSlot = useCallback((id: number) => {
    setTimeSlots((prev) => prev.filter((ts) => ts.id !== id));
  }, []);

  const handleTeacherConfirm = useCallback((v: string) => {
    setSelectedTeachingTeacherId(v);
    setTeacherPickerVisible(false);
  }, []);

  const handleAssistantConfirm = useCallback((v: string) => {
    setSelectedAssistantTeacherId(v);
    setAssistantPickerVisible(false);
  }, []);

  const toggleWeekday = useCallback((day: DayOfWeek) => {
    setSelectedDays((prev) => {
      if (prev.includes(day)) {
        if (prev.length === 1) return prev;
        return prev.filter((d) => d !== day).sort((a, b) => a - b) as DayOfWeek[];
      }
      return [...prev, day].sort((a, b) => a - b) as DayOfWeek[];
    });
  }, []);

  const openHolidaySettings = useCallback(() => {
    const cid = currentCampusId || campusId;
    Taro.navigateTo({
      url: `/package-settings/pages/campus-settings/holidays${
        cid ? `?campusId=${encodeURIComponent(cid)}` : ''
      }`,
    });
  }, [campusId, currentCampusId]);

  const removeFreeDate = useCallback((date: string) => {
    setFreeDates((prev) => prev.filter((d) => d !== date));
  }, []);

  const handleFreeDatesConfirm = useCallback(
    (dates: string[]) => {
      setFreeDates(dates);
      restoreScrollAfterSheet();
    },
    [restoreScrollAfterSheet],
  );

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
    [
      classId,
      classStudents,
      currentUserId,
      invalidateStudents,
      selectedClass?.name,
      profile?.currentContext?.role,
    ],
  );

  /** 调整授课老师 */
  /* 班级带出老师/助教只读，不再提供选择器 */

  /* ---- 提交校验 ---- */
  const submitBlockedReason = useMemo(
    () =>
      getScheduleFormSubmitBlockedReason({
        currentUserId,
        mode,
        classId,
        selectedTeachingTeacherId,
        isGroupMode,
        slotMaxCount,
        minOpenCount,
        timeSlots,
        schedulingMode,
        startDate,
        repeatMode,
        selectedDays,
        endMode,
        endDate,
        endCount,
        freeDates,
        selectedClass,
      }),
    [
      classId,
      currentUserId,
      endCount,
      endDate,
      endMode,
      freeDates,
      isGroupMode,
      minOpenCount,
      mode,
      repeatMode,
      schedulingMode,
      selectedDays,
      selectedTeachingTeacherId,
      selectedClass,
      slotMaxCount,
      startDate,
      timeSlots,
    ],
  );

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
          if (!p.parent_id) continue;
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
      const rescheduleError = validateRescheduleSaveInput({
        originalSchedule,
        sourceLessonDate: sourceLessonDateText,
        targetDate: selectedDateValue,
        startTime,
        endTime,
      });
      if (rescheduleError) {
        Taro.showToast({ title: rescheduleError, icon: 'none' });
        return;
      }
      const sd = sourceLessonDateText;
      const td = selectedDateValue;
      const adj: Schedule = { ...originalSchedule!, start_time: startTime, end_time: endTime };
      const conflictResult = await temporaryRescheduleService.checkDateConflict({
        teacherId: currentUserId,
        sourceDate: sd,
        targetDate: td,
        movingSchedules: [adj],
        allSchedules,
      });
      if (conflictResult.hasConflict) {
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
        const ot = formatRescheduleTimeLabel(
          sd,
          originalSchedule!.start_time,
          originalSchedule!.end_time,
        );
        const nt = formatRescheduleTimeLabel(td, startTime, endTime);
        if (mode === 'class' && classId) {
          const cs = await classService.getStudents(classId);
          for (const s of cs)
            await handleNotifyStudentAndParents(
              s.id,
              '调课通知',
              `${selectedClass?.name || '班级课程'} 已由 ${ot} 调整为 ${nt}，仅本次生效。`,
            );
        }
        try {
          Taro.setStorageSync('yunce:schedule:refresh', String(Date.now()));
        } catch (err) {
          logError('emit schedule refresh signal', err);
        }
        Taro.showToast({ title: '调课成功', icon: 'success', duration: 800 });
        void (async () => {
          try {
            await subscribeMessageService.runFlow('E07', {
              className: selectedClass?.name || '',
              role: profile?.currentContext?.role,
              campusId: profile?.currentContext?.campusId,
            });
          } catch (error) {
            logError('subscribe E07 after reschedule', error);
          }
          try {
            await calendarSyncService.maybePromptAfterScheduleSave({
              userId: currentUserId,
              teacherId: currentUserId,
              campusId: profile?.currentContext?.campusId,
              role: profile?.currentContext?.role,
            });
          } catch (error) {
            logError('calendar prompt after reschedule', error);
          }
        })();
        setTimeout(() => {
          Taro.navigateBack({
            fail: () => {
              void Taro.switchTab({ url: '/pages/schedule/index' });
            },
          });
        }, 500);
      } catch {
        Taro.showToast({ title: '调课失败', icon: 'none' });
      } finally {
        setSaving(false);
      }
      return;
    }

    /* 创建/编辑排课 */
    const buildRuleNote = () =>
      buildScheduleRuleNote({
        note,
        isGroupMode,
        autoOpenType,
        slotMaxCount,
        minOpenCount,
        schedulingMode,
        repeatMode,
        startDate,
        endMode,
        endDate,
        endCount,
        scheduleOnHoliday,
        consumedHours,
      });

    const targets = buildScheduleSaveTargets({
      schedulingMode,
      repeatMode,
      startDate,
      selectedDays,
      freeDates,
      timeSlots,
    });

    if (targets.length === 0) {
      Taro.showToast({ title: '请完善排课时间', icon: 'none' });
      return;
    }

    const roomName = rooms.find((r) => r.id === room)?.name || room || undefined;
    const teacherIdForCheck = selectedTeachingTeacherId || currentUserId;

    if (!ignoreConflictRef.current) {
      const results: ScheduleConflictResult[] = [];
      for (const t of targets) {
        results.push(
          await scheduleService.checkConflict({
            teacherId: teacherIdForCheck,
            dayOfWeek: t.dayOfWeek,
            startTime: t.start,
            endTime: t.end,
            classId: mode === 'class' ? classId : undefined,
            room: roomName,
            excludeId: isEdit ? scheduleId : undefined,
            dateHint: t.dateHint || (schedulingMode === 'rule' ? startDate : undefined),
          }),
        );
      }
      const merged = mergeScheduleConflictResults(results);
      if (merged.hasConflict) {
        setConflictResult(merged);
        setConflictDialogVisible(true);
        return;
      }
    }

    const primary = targets[0];
    const emitScheduleRefresh = () => {
      try {
        Taro.setStorageSync('yunce:schedule:refresh', String(Date.now()));
      } catch (err) {
        logError('emit schedule refresh signal', err);
      }
    };
    const goBackToSchedule = () => {
      Taro.navigateBack({
        fail: () => {
          void Taro.switchTab({ url: '/pages/schedule/index' });
        },
      });
    };

    const doSave = async () => {
      setSaving(true);
      try {
        // 团课：预约设置写回班级，与时段配置同源
        if (isGroupMode && mode === 'class' && classId) {
          await classService.update(classId, {
            auto_open_type: autoOpenType,
            min_open_count: Math.max(1, minOpenCount),
            student_count: Math.max(1, slotMaxCount),
          });
          if (currentUserId) {
            invalidateClasses(currentUserId, currentCampusId || undefined);
          }
          setClasses((prev) =>
            prev.map((c) =>
              c.id === classId
                ? {
                    ...c,
                    auto_open_type: autoOpenType,
                    min_open_count: Math.max(1, minOpenCount),
                    student_count: Math.max(1, slotMaxCount),
                  }
                : c,
            ),
          );
        }

        const baseNote = buildRuleNote();
        const ignoreConflict = ignoreConflictRef.current;
        const ruleStartDate = schedulingMode === 'rule' ? startDate : undefined;
        const ruleEndDate =
          schedulingMode === 'rule' && endMode === 'by_date' ? endDate : undefined;
        if (isEdit) {
          const data: Partial<Schedule> & {
            ignoreConflict?: boolean;
            start_date?: string;
            end_date?: string;
            maxOccurrences?: number;
          } = {
            teacher_id: selectedTeachingTeacherId || currentUserId,
            assistant_teacher_id: selectedAssistantTeacherId || undefined,
            student_id: mode === 'student' ? studentId : undefined,
            class_id: mode === 'class' ? classId : undefined,
            day_of_week: primary.dayOfWeek,
            start_time: primary.start,
            end_time: primary.end,
            room: roomName,
            color,
            note: baseNote,
            reminder_minutes: reminderMinutes,
            ignoreConflict,
            start_date: ruleStartDate || primary.dateHint,
            end_date: ruleEndDate,
            maxOccurrences:
              schedulingMode === 'rule' && endMode === 'by_count' ? endCount : undefined,
          };
          await scheduleService.update(scheduleId, data);
        } else {
          for (const t of targets) {
            const dateLine = t.dateHint ? `日期:${t.dateHint}` : '';
            const data: Omit<Schedule, 'id' | 'created_at' | 'updated_at'> & {
              ignoreConflict?: boolean;
              start_date?: string;
              end_date?: string;
              maxOccurrences?: number;
            } = {
              teacher_id: selectedTeachingTeacherId || currentUserId,
              assistant_teacher_id: selectedAssistantTeacherId || undefined,
              student_id: mode === 'student' ? studentId : undefined,
              class_id: mode === 'class' ? classId : undefined,
              day_of_week: t.dayOfWeek,
              start_time: t.start,
              end_time: t.end,
              room: roomName,
              color,
              note: [baseNote, dateLine].filter(Boolean).join('\n') || undefined,
              reminder_minutes: reminderMinutes,
              ignoreConflict,
              start_date: t.dateHint || ruleStartDate,
              end_date:
                ruleEndDate ||
                (t.dateHint && selectedClass?.type === 'limited' ? t.dateHint : undefined),
              maxOccurrences:
                schedulingMode === 'rule' && endMode === 'by_count'
                  ? endCount
                  : schedulingMode === 'free' && selectedClass?.type === 'limited'
                    ? 1
                    : undefined,
            };
            await scheduleService.create(data);
          }
        }
        ignoreConflictRef.current = false;
        emitScheduleRefresh();
        Taro.showToast({
          title: buildScheduleSaveSuccessTitle({ isEdit, targetCount: targets.length }),
          icon: 'success',
          duration: 800,
        });
        // 订阅授权后再询问日历同步；不阻断返回课表
        void (async () => {
          try {
            await subscribeMessageService.runFlow('E07', {
              className: selectedClass?.name || '',
              role: profile?.currentContext?.role,
              campusId: profile?.currentContext?.campusId,
            });
          } catch (error) {
            logError('subscribe E07 after schedule save', error);
          }
          try {
            await calendarSyncService.maybePromptAfterScheduleSave({
              userId: currentUserId,
              teacherId: currentUserId,
              campusId: profile?.currentContext?.campusId,
              role: profile?.currentContext?.role,
            });
          } catch (error) {
            logError('calendar prompt after schedule save', error);
          }
        })();
        setTimeout(goBackToSchedule, 500);
      } catch (err) {
        logError('schedule-form save', err);
        const message = err instanceof Error ? err.message : '';
        if (message.includes('冲突') || message.includes('409')) {
          Taro.showToast({ title: '存在排课冲突，请返回修改或忽略后重试', icon: 'none' });
        } else {
          Taro.showToast({
            title: message && message.length < 40 ? message : '保存失败，请稍后重试',
            icon: 'none',
          });
        }
      } finally {
        setSaving(false);
      }
    };
    await doSave();
  }, [
    allSchedules,
    classId,
    color,
    consumedHours,
    currentUserId,
    endCount,
    endDate,
    endMode,
    freeDates,
    handleNotifyStudentAndParents,
    isEdit,
    isGroupMode,
    isRescheduleMode,
    minOpenCount,
    autoOpenType,
    slotMaxCount,
    invalidateClasses,
    currentCampusId,
    mode,
    note,
    originalSchedule,
    profile?.currentContext?.campusId,
    profile?.currentContext?.role,
    reminderMinutes,
    repeatMode,
    room,
    rooms,
    saving,
    scheduleId,
    scheduleOnHoliday,
    schedulingMode,
    selectedAssistantTeacherId,
    selectedClass?.name,
    selectedDateValue,
    selectedDays,
    selectedTeachingTeacherId,
    startDate,
    startTime,
    endTime,
    studentId,
    submitBlockedReason,
    sourceLessonDateText,
    timeSlots,
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
  const renderTimeSlotsBlock = (title = '上课时间') => (
    <ScheduleFormTimeSlots
      title={title}
      schedulingMode={schedulingMode}
      hasRealTimeSlots={hasRealTimeSlots}
      timeSlots={timeSlots}
      timeDisplayDateLabel={timeDisplayDateLabel}
      allowMultiTimeSlots={allowMultiTimeSlots}
      onOpenFreeCalendar={openFreeCalendar}
      onOpenRuleCalendar={() => setCalendarVisible(true)}
      onOpenTimePicker={(slotId) => openTimePickerFlow(slotId)}
      onRemoveTimeSlot={removeTimeSlot}
    />
  );

  return (
    <PageContainer safeBottom className="bg-muted">
      <ScrollView
        scrollY
        className="h-screen"
        enhanced
        showScrollbar={false}
        scrollTop={scrollTop}
        scrollWithAnimation={false}
        onScroll={(e) => {
          const top = e.detail?.scrollTop;
          if (typeof top === 'number' && Number.isFinite(top)) {
            savedScrollTopRef.current = top;
          }
        }}
      >
        <View className="min-h-screen pb-[200rpx]">
          <ScheduleFormBaseCard
            isGroupMode={isGroupMode}
            selectedClassName={selectedClass?.name}
            selectedTeachingTeacherId={selectedTeachingTeacherId}
            selectedAssistantTeacherId={selectedAssistantTeacherId}
            teachingTeacherName={
              teacherById[selectedTeachingTeacherId]?.name || classInfoCard?.teacherName
            }
            assistantTeacherName={
              teacherById[selectedAssistantTeacherId]?.name || classInfoCard?.assistantName
            }
            classLevelLabel={classLevelLabel}
            selectedRoomName={selectedRoomName}
            hasRooms={rooms.length > 0}
            consumedHours={consumedHours}
            autoOpenType={autoOpenType}
            slotMaxCount={slotMaxCount}
            minOpenCount={minOpenCount}
            onOpenTypePicker={() => setTypePickerVisible(true)}
            onOpenClassPicker={() => setClassPickerVisible(true)}
            onOpenTeacherPicker={() => setTeacherPickerVisible(true)}
            onOpenAssistantPicker={() => setAssistantPickerVisible(true)}
            onOpenLevelPicker={() => setLevelPickerVisible(true)}
            onOpenRoomPicker={() => setRoomPickerVisible(true)}
            onConsumedHoursChange={setConsumedHours}
            onAutoOpenTypeChange={setAutoOpenType}
            onSlotMaxCountChange={setSlotMaxCount}
            onMinOpenCountChange={setMinOpenCount}
          />

          <ScheduleFormRuleCard
            schedulingMode={schedulingMode}
            startDate={startDate}
            repeatMode={repeatMode}
            selectedDays={selectedDays}
            endMode={endMode}
            endDate={endDate}
            endCount={endCount}
            scheduleOnHoliday={scheduleOnHoliday}
            freeDates={freeDates}
            onSchedulingModeChange={setSchedulingMode}
            onOpenStartCalendar={() => setCalendarVisible(true)}
            onRepeatModeChange={setRepeatMode}
            onToggleWeekday={toggleWeekday}
            onOpenEndModePicker={() => setEndModePickerVisible(true)}
            onOpenEndDateCalendar={() => setEndDateCalendarVisible(true)}
            onEndCountChange={setEndCount}
            onScheduleOnHolidayChange={setScheduleOnHoliday}
            onOpenHolidaySettings={openHolidaySettings}
            onOpenFreeCalendar={openFreeCalendar}
            onRemoveFreeDate={removeFreeDate}
          />

          {renderTimeSlotsBlock()}

          {selectedClass && !isGroupMode ? (
            <View className="mx-[24rpx] mt-[32rpx]">
              <ClassStudentsCard
                studentIds={classStudents.map((s) => s.id)}
                students={classStudents}
                allStudents={students}
                subjectId={selectedClass?.subject_id}
                subjects={subjects}
                onChange={handleStudentsChange}
              />
            </View>
          ) : null}

          {/* 备注置底（机构侧） */}
          <View className="mx-[24rpx] mt-[24rpx] overflow-hidden rounded-[20rpx] bg-card px-[32rpx] py-[28rpx]">
            <Text className="mb-[16rpx] block text-[28rpx] font-medium text-foreground">备注</Text>
            <Textarea
              className="min-h-[140rpx] w-full rounded-[12rpx] bg-muted px-[20rpx] py-[16rpx] text-[26rpx] text-foreground"
              placeholder="选填，仅机构可见"
              maxlength={200}
              value={note}
              onInput={(e) => setNote(e.detail.value || '')}
            />
          </View>
        </View>
      </ScrollView>

      {/* ====== 底部操作栏：抬高层级+不透明底，避免学员红叉滚动透出 ====== */}
      <View className="fixed bottom-0 left-0 right-0 z-200 border-t border-border bg-white px-[28rpx] pt-[10rpx] pb-safe-bar">
        {!canSubmit && submitBlockedReason && (
          <View className="absolute left-[28rpx] right-[28rpx] top-[-56rpx] z-200 rounded-[16rpx] bg-white px-[20rpx] py-[12rpx] shadow-soft">
            <Text className="text-[24rpx] text-muted-foreground">{submitBlockedReason}</Text>
          </View>
        )}
        <View
          className={cn(
            'flex h-[80rpx] w-full items-center justify-center rounded-full',
            !canSubmit || saving || deleting ? 'bg-muted' : 'bg-primary',
          )}
          onClick={
            !canSubmit || saving || deleting
              ? undefined
              : () => {
                  void handleSave();
                }
          }
        >
          <Text
            className={cn(
              'text-[30rpx] font-medium',
              !canSubmit || saving || deleting
                ? 'text-muted-foreground'
                : 'text-primary-foreground',
            )}
          >
            {saving ? '保存中...' : isEdit ? (isRescheduleMode ? '确认调课' : '保存修改') : '保存'}
          </Text>
        </View>
      </View>

      {/* 开始日期 */}
      <CalendarMonthSheet
        visible={calendarVisible}
        title="选择开始日期"
        selectedDate={dayjs(startDate)}
        onClose={() => {
          setCalendarVisible(false);
          restoreScrollAfterSheet();
        }}
        onSelect={(d) => {
          setStartDate(d.format('YYYY-MM-DD'));
          setSelectedDateValue(d.format('YYYY-MM-DD'));
          setDayOfWeek((d.day() || 7) as DayOfWeek);
        }}
        getDateDotType={getDateDotType}
        disablePastDates
      />

      {/* 结束日期 */}
      <CalendarMonthSheet
        visible={endDateCalendarVisible}
        title="选择结束日期"
        selectedDate={dayjs(endDate)}
        onClose={() => {
          setEndDateCalendarVisible(false);
          restoreScrollAfterSheet();
        }}
        onSelect={(d) => setEndDate(d.format('YYYY-MM-DD'))}
        disablePastDates
      />

      {/* 自由排课：课表同款月历多选 */}
      <CalendarMonthSheet
        visible={freeCalendarVisible}
        title="选择上课日期"
        selectedDate={dayjs(freeDates[freeDates.length - 1] || startDate)}
        selectedDates={freeDates}
        multiSelect
        onClose={closeFreeCalendar}
        onSelect={() => undefined}
        onSelectMulti={handleFreeDatesConfirm}
        getDateDotType={getDateDotType}
        disablePastDates
      />

      <PickerSheet
        visible={typePickerVisible}
        title="课程类型"
        options={[
          { label: '班课', value: 'class' },
          { label: '团课', value: 'group' },
        ]}
        value={isGroupMode ? 'group' : 'class'}
        onClose={() => setTypePickerVisible(false)}
        onConfirm={(v) => {
          const next = v === 'group' ? 'group' : 'class';
          setScheduleType(next);
          setClassId('');
          setTypePickerVisible(false);
        }}
      />

      <ClassPickerSheet
        visible={classPickerVisible}
        title={isGroupMode ? '选择团课班级' : '选择班级'}
        courseMode={isGroupMode ? 'group' : 'class'}
        classes={classes}
        scheduledClassIds={scheduledClassIds}
        value={classId}
        onClose={() => setClassPickerVisible(false)}
        onConfirm={(v) => setClassId(v)}
      />

      <PickerSheet
        visible={roomPickerVisible}
        title="选择上课教室"
        options={[
          { label: '不指定教室', value: '' },
          ...rooms.map((r): PickerOption => ({ label: r.name, value: r.id || r.name })),
        ]}
        value={room}
        onClose={() => setRoomPickerVisible(false)}
        onConfirm={(v) => setRoom(v)}
      />

      <PickerSheet
        visible={endModePickerVisible}
        title="结束方式"
        options={END_MODE_OPTIONS.map((o): PickerOption => ({ label: o.label, value: o.value }))}
        value={endMode}
        onClose={() => setEndModePickerVisible(false)}
        onConfirm={(v) => setEndMode(v as EndMode)}
      />

      <PickerSheet
        visible={teacherPickerVisible}
        title="选择老师"
        options={[
          { label: '请选择', value: '' },
          ...teachers
            .filter((t) => t.role !== 'assist' || t.id === selectedTeachingTeacherId)
            .map((t): PickerOption => ({ label: t.name, value: t.id })),
        ]}
        value={selectedTeachingTeacherId}
        onClose={() => setTeacherPickerVisible(false)}
        onConfirm={handleTeacherConfirm}
      />

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

      <PickerSheet
        visible={levelPickerVisible}
        title="课程难度"
        options={(Object.keys(CLASS_LEVEL_LABELS) as ClassLevel[]).map(
          (k): PickerOption => ({ label: CLASS_LEVEL_LABELS[k], value: k }),
        )}
        value={courseLevel}
        onClose={() => setLevelPickerVisible(false)}
        onConfirm={(v) => {
          setCourseLevel(v as ClassLevel);
          setLevelPickerVisible(false);
        }}
      />

      <TimePickerSheet
        visible={timePickerVisible}
        title={timePickerTitle}
        value={timePickerValue}
        onClose={() => {
          setTimePickerVisible(false);
          if (chainingTimePickerRef.current) return;
          setTimePickerPhase('start');
          setEditingSlotId(null);
          restoreScrollAfterSheet();
        }}
        onConfirm={handleTimePickerConfirm}
      />

      <ScheduleConflictDialog
        visible={conflictDialogVisible}
        conflictSummary={conflictResult?.conflictSummary || ''}
        conflicts={conflictResult?.conflicts || []}
        onModify={() => {
          ignoreConflictRef.current = false;
          setConflictDialogVisible(false);
        }}
        onIgnore={() => {
          ignoreConflictRef.current = true;
          setConflictDialogVisible(false);
          void handleSave();
        }}
      />
    </PageContainer>
  );
};

export default withRouteGuard(ScheduleForm);
