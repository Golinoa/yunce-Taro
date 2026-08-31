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
import ClassPickerSheet from '@/components/course/ClassPickerSheet';
import ClassStudentsCard from '@/components/course/ClassStudentsCard';
import CalendarMonthSheet from '@/components/CalendarMonthSheet';
import type { CalendarDotType } from '@/components/CalendarWeekSelector';
import Empty from '@/components/Empty';
import Icon from '@/components/Icon';
import Loading from '@/components/Loading';
import PageContainer from '@/components/PageContainer';
import PickerSheet, { PickerOption } from '@/components/PickerSheet';
import ScheduleConflictDialog from '@/components/schedule/ScheduleConflictDialog';
import Stepper from '@/components/Stepper';
import TimePickerSheet from '@/components/TimePickerSheet';
import type { ScheduleConflictResult } from '@/types/schedule-conflict';
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
import type { Class, ClassLevel } from '@/types/class';
import { CLASS_LEVEL_LABELS } from '@/types/class';
import type { Schedule, ScheduleColor, DayOfWeek } from '@/types/schedule';
import type { Student } from '@/types/student';
import type { TeacherUIModel } from '@/types/teacher';
import { useAuth } from '@/utils/auth';
import { logError } from '@/utils/logger';
import { getDefaultRescheduleTargetDate } from '@/utils/reschedule-date';
import { withRouteGuard } from '@/utils/route-guard';

/* ======================== 常量 ======================== */

const MIN_DURATION_MINUTES = 30;

/** 与时段配置 class-slot-config 一致的预约设置选项 */
type AutoOpenType = NonNullable<Class['auto_open_type']>;
const AUTO_OPEN_OPTIONS: { key: AutoOpenType; label: string }[] = [
  { key: 'manual', label: '手动开班' },
  { key: 'full', label: '约满开班' },
  { key: 'time', label: '到时间自动开班' },
  { key: 'full_or_time', label: '约满或到时间' },
];
const SLOT_MAX_COUNT_OPTIONS = ['1', '2', '3', '4', '5', '6', '8', '10', '12', '15', '20'] as const;

/** 课程类型选项 */
const SCHEDULE_TYPE_OPTIONS = ['班课', '团课'] as const;

type SchedulingMode = 'rule' | 'free';
type RepeatMode = 'weekly' | 'biweekly' | 'alternate';
type EndMode = 'never' | 'by_date' | 'by_count';

const WEEKDAY_OPTIONS: { label: string; value: DayOfWeek }[] = [
  { label: '一', value: 1 },
  { label: '二', value: 2 },
  { label: '三', value: 3 },
  { label: '四', value: 4 },
  { label: '五', value: 5 },
  { label: '六', value: 6 },
  { label: '日', value: 7 },
];

const REPEAT_OPTIONS: { label: string; value: RepeatMode }[] = [
  { label: '每周', value: 'weekly' },
  { label: '隔周', value: 'biweekly' },
  { label: '隔天', value: 'alternate' },
];

const END_MODE_OPTIONS: { label: string; value: EndMode }[] = [
  { label: '不结束', value: 'never' },
  { label: '限日期', value: 'by_date' },
  { label: '按次数', value: 'by_count' },
];

/** 是/否分段开关（节假日是否排课） */
const YesNoToggle: React.FC<{
  value: boolean;
  onChange: (v: boolean) => void;
}> = ({ value, onChange }) => (
  <View className="flex items-center rounded-full bg-muted p-[4rpx]">
    <View
      className={cn(
        'min-w-[72rpx] rounded-full px-[20rpx] py-[10rpx] text-center transition-colors',
        value ? 'bg-primary' : 'bg-transparent',
      )}
      onClick={() => onChange(true)}
    >
      <Text className={cn('text-[24rpx] font-medium', value ? 'text-white' : 'text-muted-foreground')}>
        是
      </Text>
    </View>
    <View
      className={cn(
        'min-w-[72rpx] rounded-full px-[20rpx] py-[10rpx] text-center transition-colors',
        !value ? 'bg-[#64748B]' : 'bg-transparent',
      )}
      onClick={() => onChange(false)}
    >
      <Text
        className={cn('text-[24rpx] font-medium', !value ? 'text-white' : 'text-muted-foreground')}
      >
        否
      </Text>
    </View>
  </View>
);

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
        const noteMin =
          rawNote.match(/最少开班:(\d+)/) || rawNote.match(/满人开课人数:(\d+)/);
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
  }, [currentUserId, currentCampusId, isEdit, isRescheduleMode, lessonDateParam, scheduleId, sourceMode]);

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

  const classLevelLabel = useMemo(
    () => CLASS_LEVEL_LABELS[courseLevel] || '所有人',
    [courseLevel],
  );

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
    const max =
      selectedClass.student_count > 0 ? selectedClass.student_count : 6;
    setSlotMaxCount(max);
    setMinOpenCount(
      selectedClass.min_open_count || selectedClass.student_count || 5,
    );
  }, [isGroupMode, selectedClass?.id, selectedClass?.auto_open_type, selectedClass?.min_open_count, selectedClass?.student_count]);

  const selectedRoomName = useMemo(
    () => rooms.find((r) => r.id === room || r.name === room)?.name || room || '',
    [room, rooms],
  );

  const timeDisplayDateLabel = useMemo(() => {
    const raw =
      schedulingMode === 'free' && freeDates.length > 0 ? freeDates[0] : startDate;
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
        setTimeSlots((prev) => [
          ...prev,
          { id: Date.now(), start: draftStartTime, end: time },
        ]);
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
    [classId, classStudents, currentUserId, invalidateStudents, selectedClass?.name, profile?.currentContext?.role],
  );

  /** 调整授课老师 */
  /* 班级带出老师/助教只读，不再提供选择器 */

  /* ---- 提交校验 ---- */
  const submitBlockedReason = useMemo(() => {
    if (!currentUserId) return '未获取到登录信息';
    if (mode === 'student') return '真实联调仅支持班级排课';
    if (mode === 'class' && !classId) return '请选择班级';
    if (!selectedTeachingTeacherId) return '请选择主讲老师';
    if (isGroupMode) {
      if (!Number.isFinite(slotMaxCount) || slotMaxCount < 1) {
        return '请设置每时段可约人数';
      }
      if (!Number.isFinite(minOpenCount) || minOpenCount < 1) {
        return '请设置最少开班人数';
      }
      if (minOpenCount > slotMaxCount) {
        return '最少开班人数不能大于每时段可约人数';
      }
    }
    if (timeSlots.length === 0) return '请添加上课时间';
    if (timeSlots.some((ts) => !ts.start || !ts.end)) return '请填写完整的上课时间';
    if (timeSlots.some((ts) => ts.start >= ts.end)) return '结束时间需晚于开始时间';
    if (schedulingMode === 'rule') {
      if (!startDate) return '请选择开始日期';
      if (repeatMode !== 'alternate' && selectedDays.length === 0) return '请至少选择一个上课周几';
      if (repeatMode === 'alternate' && timeSlots.length !== 1) return '隔天排课仅支持一组时间';
      if (endMode === 'by_date' && !endDate) return '请选择结束日期';
      if (endMode === 'by_date' && dayjs(endDate).isBefore(dayjs(startDate), 'day')) {
        return '结束日期不能早于开始日期';
      }
      if (endMode === 'by_count' && endCount < 1) return '按次数至少为 1';
      // 结束班级（limited）与排课时间限制联动
      if (selectedClass?.type === 'limited') {
        const total = selectedClass.total_lessons ?? 0;
        const used = selectedClass.used_lessons ?? 0;
        const remaining = Math.max(0, total - used);
        if (remaining <= 0) return '该班级课时已用完，无法继续排课';
        if (endMode === 'never') return '该班级已开启结束课时限制，请选择限日期或按次数';
        if (endMode === 'by_count' && endCount > remaining) {
          return `按次数不能超过剩余课时（剩余 ${remaining}）`;
        }
        if (endMode === 'by_date' && startDate && endDate && selectedDays.length > 0) {
          let projected = 0;
          let cursor = dayjs(startDate);
          const end = dayjs(endDate);
          const daySet = new Set(selectedDays);
          while (cursor.isBefore(end) || cursor.isSame(end, 'day')) {
            const appDay = (cursor.day() || 7) as DayOfWeek;
            if (daySet.has(appDay)) projected += 1;
            cursor = cursor.add(1, 'day');
          }
          if (projected > remaining) {
            return `日期范围内预计 ${projected} 次课，超过剩余课时 ${remaining}`;
          }
        }
      }
    } else if (freeDates.length === 0) {
      return '请选择上课日期';
    } else if (selectedClass?.type === 'limited') {
      const total = selectedClass.total_lessons ?? 0;
      const used = selectedClass.used_lessons ?? 0;
      const remaining = Math.max(0, total - used);
      if (remaining <= 0) return '该班级课时已用完，无法继续排课';
      if (freeDates.length > remaining) {
        return `自由排课选了 ${freeDates.length} 天，超过剩余课时 ${remaining}`;
      }
    }
    return '';
  }, [
    classId,
    currentUserId,
    endCount,
    endDate,
    endMode,
    freeDates.length,
    isGroupMode,
    minOpenCount,
    mode,
    repeatMode,
    schedulingMode,
    selectedDays,
    selectedDays.length,
    selectedTeachingTeacherId,
    selectedClass?.type,
    selectedClass?.total_lessons,
    selectedClass?.used_lessons,
    slotMaxCount,
    startDate,
    timeSlots,
  ]);

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
    const buildRuleNote = () => {
      const userNote = note.trim();
      const needFull =
        autoOpenType === 'full' || autoOpenType === 'full_or_time';
      const meta = [
        isGroupMode ? '类型:团课' : '类型:班课',
        isGroupMode
          ? [
              `自动开班:${autoOpenType}`,
              `每时段可约:${slotMaxCount}`,
              `最少开班:${Math.max(1, minOpenCount)}`,
              needFull
                ? `满人开课:是 | 满人开课人数:${Math.max(1, minOpenCount)}`
                : '满人开课:否',
            ].join(' | ')
          : null,
        schedulingMode === 'rule' ? `规则:${repeatMode}` : null,
        schedulingMode === 'rule' ? `开始:${startDate}` : null,
        schedulingMode === 'rule' && endMode === 'by_date' ? `结束日期:${endDate}` : null,
        schedulingMode === 'rule' && endMode === 'by_count' ? `次数:${endCount}` : null,
        schedulingMode === 'rule' && endMode === 'never' ? '结束:不结束' : null,
        schedulingMode === 'rule' ? `节假日排课:${scheduleOnHoliday ? '是' : '否'}` : null,
        `消耗课时:${consumedHours}`,
      ]
        .filter(Boolean)
        .join(' | ');
      return userNote ? `${userNote}\n${meta}` : meta;
    };

    const targets: { dayOfWeek: DayOfWeek; start: string; end: string; dateHint?: string }[] =
      [];
    if (schedulingMode === 'rule') {
      const days =
        repeatMode === 'alternate'
          ? [((dayjs(startDate).day() || 7) as DayOfWeek)]
          : selectedDays;
      for (const dow of days) {
        for (const ts of timeSlots) {
          targets.push({ dayOfWeek: dow, start: ts.start, end: ts.end });
        }
      }
    } else {
      for (const d of freeDates) {
        const dow = (dayjs(d).day() || 7) as DayOfWeek;
        for (const ts of timeSlots) {
          targets.push({ dayOfWeek: dow, start: ts.start, end: ts.end, dateHint: d });
        }
      }
    }

    if (targets.length === 0) {
      Taro.showToast({ title: '请完善排课时间', icon: 'none' });
      return;
    }

    const roomName = rooms.find((r) => r.id === room)?.name || room || undefined;
    const teacherIdForCheck = selectedTeachingTeacherId || currentUserId;

    if (!ignoreConflictRef.current) {
      const merged: ScheduleConflictResult = {
        hasConflict: false,
        conflictSummary: '',
        conflicts: [],
      };
      const seen = new Set<string>();
      for (const t of targets) {
        const result = await scheduleService.checkConflict({
          teacherId: teacherIdForCheck,
          dayOfWeek: t.dayOfWeek,
          startTime: t.start,
          endTime: t.end,
          classId: mode === 'class' ? classId : undefined,
          room: roomName,
          excludeId: isEdit ? scheduleId : undefined,
          dateHint:
            t.dateHint ||
            (schedulingMode === 'rule' ? startDate : undefined),
        });
        if (!result.hasConflict) continue;
        merged.hasConflict = true;
        for (const c of result.conflicts) {
          if (seen.has(c.id)) continue;
          seen.add(c.id);
          merged.conflicts.push(c);
        }
        if (!merged.conflictSummary && result.conflictSummary) {
          merged.conflictSummary = result.conflictSummary;
        }
      }
      if (merged.hasConflict) {
        const typeSet = new Set(merged.conflicts.flatMap((c) => c.conflictTypes));
        const labelMap = {
          time: '时间冲突',
          teacher: '老师冲突',
          room: '教室冲突',
          class: '班级冲突',
        } as const;
        merged.conflictSummary = (['time', 'teacher', 'room', 'class'] as const)
          .filter((k) => typeSet.has(k))
          .map((k) => labelMap[k])
          .join('、');
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
              end_date: ruleEndDate || (t.dateHint && selectedClass?.type === 'limited' ? t.dateHint : undefined),
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
          title: isEdit
            ? '保存成功'
            : targets.length > 1
              ? `已添加 ${targets.length} 条排课`
              : '保存成功',
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
    <View
      id="schedule-time-block"
      className="mx-[24rpx] mt-[24rpx] overflow-hidden rounded-[20rpx] bg-card px-[32rpx] py-[28rpx]"
    >
      <Text className="mb-[20rpx] block text-[28rpx] font-medium text-foreground">{title}</Text>
      {hasRealTimeSlots ? (
        <>
          <View className="overflow-hidden rounded-[16rpx] bg-muted/70">
            <View
              className="flex items-center justify-between border-b border-border/50 px-[24rpx] py-[22rpx]"
              onClick={() => {
                if (schedulingMode === 'free') {
                  openFreeCalendar();
                } else {
                  setCalendarVisible(true);
                }
              }}
            >
              <View className="flex items-center gap-[12rpx]">
                <Icon name="mdi-calendar" size={28} color="mutedForeground" />
                <Text className="text-[28rpx] text-foreground">日期</Text>
              </View>
              <View className="rounded-[12rpx] bg-card px-[20rpx] py-[12rpx]">
                <Text className="text-[26rpx] text-foreground">{timeDisplayDateLabel}</Text>
              </View>
            </View>
            {timeSlots.map((ts, index) => (
              <View
                key={ts.id}
                className={cn(
                  'flex items-center justify-between px-[24rpx] py-[22rpx]',
                  index < timeSlots.length - 1 && 'border-b border-border/50',
                )}
              >
                <View className="flex items-center gap-[12rpx]">
                  <Icon name="mdi-clock-outline" size={28} color="mutedForeground" />
                  <Text className="text-[28rpx] text-foreground">
                    {timeSlots.length > 1 ? `时间${index + 1}` : '时间'}
                  </Text>
                </View>
                  <View className="flex items-center gap-[12rpx]">
                  <View
                    className="rounded-[12rpx] bg-card px-[20rpx] py-[12rpx]"
                    onClick={() => openTimePickerFlow(ts.id)}
                  >
                    <Text className="text-[26rpx] text-foreground">
                      {ts.start}-{ts.end}
                    </Text>
                  </View>
                  {timeSlots.length > 1 ? (
                    <View
                      className="flex h-[44rpx] w-[44rpx] items-center justify-center rounded-full bg-error/10"
                      onClick={() => removeTimeSlot(ts.id)}
                    >
                      <Icon name="mdi-close" size={20} color="error" />
                    </View>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
          <Text className="mt-[16rpx] block text-[22rpx] text-muted-foreground">
            点击上方日期或时间进行单独修改。
          </Text>
          {allowMultiTimeSlots ? (
            <View
              className="mt-[16rpx] flex items-center justify-center gap-[8rpx] py-[8rpx]"
              onClick={() => openTimePickerFlow()}
            >
              <Icon name="mdi-plus" size={28} color="primary" />
              <Text className="text-[26rpx] text-primary">添加时间段</Text>
            </View>
          ) : null}
        </>
      ) : (
        <View
          className="flex min-h-[260rpx] flex-col items-center justify-center rounded-[16rpx] border-[2rpx] border-dashed border-border bg-muted/60"
          onClick={() => openTimePickerFlow()}
        >
          <View className="flex h-[88rpx] w-[88rpx] items-center justify-center rounded-full bg-primary shadow-md">
            <Icon name="mdi-plus" size={40} color="#ffffff" />
          </View>
          <Text className="mt-[20rpx] text-[26rpx] text-muted-foreground">添加上课时间</Text>
        </View>
      )}
    </View>
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
          {/* 基础信息卡 */}
          <View className="mx-[24rpx] mt-[24rpx] overflow-hidden rounded-[20rpx] bg-card">
            <View className="flex items-center justify-between border-b border-border/60 px-[32rpx] py-[24rpx]">
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

            <View className="flex items-center justify-between border-b border-border/60 px-[32rpx] py-[24rpx]">
              <Text className="text-[28rpx] text-foreground">班级名称</Text>
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

            <View
              className="flex items-center justify-between border-b border-border/60 px-[32rpx] py-[24rpx]"
              onClick={() => setTeacherPickerVisible(true)}
            >
              <Text className="text-[28rpx] text-foreground">老师</Text>
              <View className="flex items-center gap-[8rpx]">
                <Text
                  className={cn(
                    'text-[28rpx]',
                    selectedTeachingTeacherId ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {teacherById[selectedTeachingTeacherId]?.name ||
                    classInfoCard?.teacherName ||
                    '请选择'}
                </Text>
                <Icon name="mdi-chevron-right" size={24} color="mutedForeground" />
              </View>
            </View>
            <View
              className="flex items-center justify-between border-b border-border/60 px-[32rpx] py-[24rpx]"
              onClick={() => setAssistantPickerVisible(true)}
            >
              <Text className="text-[28rpx] text-foreground">助教</Text>
              <View className="flex items-center gap-[8rpx]">
                <Text
                  className={cn(
                    'text-[28rpx]',
                    selectedAssistantTeacherId ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {teacherById[selectedAssistantTeacherId]?.name ||
                    classInfoCard?.assistantName ||
                    '请选择'}
                </Text>
                <Icon name="mdi-chevron-right" size={24} color="mutedForeground" />
              </View>
            </View>
            <View
              className="flex items-center justify-between border-b border-border/60 px-[32rpx] py-[24rpx]"
              onClick={() => setLevelPickerVisible(true)}
            >
              <Text className="text-[28rpx] text-foreground">课程难度</Text>
              <View className="flex items-center gap-[8rpx]">
                <View className="rounded-[8rpx] border border-primary px-[16rpx] py-[6rpx]">
                  <Text className="text-[24rpx] text-primary">{classLevelLabel}</Text>
                </View>
                <Icon name="mdi-chevron-right" size={24} color="mutedForeground" />
              </View>
            </View>

            <View
              className="flex items-center justify-between border-b border-border/60 px-[32rpx] py-[24rpx]"
              onClick={() => setRoomPickerVisible(true)}
            >
              <Text className="text-[28rpx] text-foreground">上课教室</Text>
              <View className="flex items-center gap-[8rpx]">
                <Text
                  className={cn(
                    'text-[28rpx]',
                    selectedRoomName ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {selectedRoomName || (rooms.length ? '请选择' : '当前校区暂无教室')}
                </Text>
                <Icon name="mdi-chevron-right" size={24} color="mutedForeground" />
              </View>
            </View>

            <View
              className={cn(
                'flex items-center justify-between px-[32rpx] py-[24rpx]',
                isGroupMode ? 'border-b border-border/60' : '',
              )}
            >
              <Text className="text-[28rpx] text-foreground">消耗课时</Text>
              <Stepper
                value={consumedHours}
                min={0.5}
                max={99}
                step={0.5}
                onChange={setConsumedHours}
              />
            </View>

            {isGroupMode ? (
              <>
                <View className="border-b border-border/60 px-[32rpx] py-[20rpx]">
                  <Text className="block text-[28rpx] font-medium text-foreground">
                    预约设置
                  </Text>
                  <Text className="mt-[6rpx] block text-[22rpx] text-muted-foreground">
                    与时段配置同步，保存后两边一致
                  </Text>
                </View>
                <View
                  className="flex items-center justify-between border-b border-border/60 px-[32rpx] py-[24rpx] active:opacity-70"
                  onClick={() => {
                    void Taro.showActionSheet({
                      itemList: AUTO_OPEN_OPTIONS.map((item) => item.label),
                    })
                      .then((result) => {
                        const next = AUTO_OPEN_OPTIONS[result.tapIndex]?.key;
                        if (next) setAutoOpenType(next);
                      })
                      .catch(() => undefined);
                  }}
                >
                  <Text className="text-[28rpx] text-foreground">自动开班条件</Text>
                  <View className="flex items-center gap-[8rpx]">
                    <Text className="text-[28rpx] text-muted-foreground">
                      {AUTO_OPEN_OPTIONS.find((item) => item.key === autoOpenType)?.label}
                    </Text>
                    <Icon name="mdi-chevron-right" size={24} color="mutedForeground" />
                  </View>
                </View>
                <View
                  className="flex items-center justify-between border-b border-border/60 px-[32rpx] py-[24rpx] active:opacity-70"
                  onClick={() => {
                    void Taro.showActionSheet({
                      itemList: [...SLOT_MAX_COUNT_OPTIONS],
                    })
                      .then((result) => {
                        const num = Number(SLOT_MAX_COUNT_OPTIONS[result.tapIndex]);
                        if (!Number.isFinite(num)) return;
                        setSlotMaxCount(num);
                        if (minOpenCount > num) setMinOpenCount(num);
                      })
                      .catch(() => undefined);
                  }}
                >
                  <Text className="text-[28rpx] text-foreground">每时段可约人数</Text>
                  <View className="flex items-center gap-[8rpx]">
                    <Text className="text-[28rpx] text-muted-foreground">{slotMaxCount} 人</Text>
                    <Icon name="mdi-chevron-right" size={24} color="mutedForeground" />
                  </View>
                </View>
                <View
                  className="flex items-center justify-between px-[32rpx] py-[24rpx] active:opacity-70"
                  onClick={() => {
                    const options = Array.from({ length: slotMaxCount }, (_, i) =>
                      String(i + 1),
                    );
                    void Taro.showActionSheet({ itemList: options })
                      .then((result) => {
                        const num = Number(options[result.tapIndex]);
                        if (Number.isFinite(num) && num >= 1) setMinOpenCount(num);
                      })
                      .catch(() => undefined);
                  }}
                >
                  <Text className="text-[28rpx] text-foreground">最少开班人数</Text>
                  <View className="flex items-center gap-[8rpx]">
                    <Text className="text-[28rpx] text-muted-foreground">{minOpenCount} 人</Text>
                    <Icon name="mdi-chevron-right" size={24} color="mutedForeground" />
                  </View>
                </View>
              </>
            ) : null}
          </View>

          {/* 排课规则卡 */}
          <View className="mx-[24rpx] mt-[24rpx] overflow-hidden rounded-[20rpx] bg-card px-[32rpx] py-[28rpx]">
            <Text className="mb-[20rpx] block text-[28rpx] font-medium text-foreground">
              排课规则
            </Text>
            <View className="flex gap-[16rpx]">
              {(
                [
                  { label: '规则排课', value: 'rule' as const },
                  { label: '自由排课', value: 'free' as const },
                ] as const
              ).map((opt) => {
                const active = schedulingMode === opt.value;
                return (
                  <View
                    key={opt.value}
                    className={cn(
                      'flex-1 rounded-[16rpx] py-[20rpx] text-center',
                      active ? 'bg-primary' : 'bg-muted',
                    )}
                    onClick={() => setSchedulingMode(opt.value)}
                  >
                    <Text
                      className={cn(
                        'text-[28rpx] font-medium',
                        active ? 'text-white' : 'text-foreground',
                      )}
                    >
                      {opt.label}
                    </Text>
                  </View>
                );
              })}
            </View>

            {schedulingMode === 'rule' ? (
              <View className="mt-[8rpx]">
                <View
                  className="flex items-center justify-between border-b border-border/60 py-[24rpx]"
                  onClick={() => setCalendarVisible(true)}
                >
                  <Text className="text-[28rpx] text-foreground">开始日期</Text>
                  <View className="flex items-center gap-[8rpx]">
                    <Text className="text-[28rpx] text-foreground">{startDate}</Text>
                    <Icon name="mdi-chevron-right" size={24} color="mutedForeground" />
                  </View>
                </View>

                <View className="border-b border-border/60 py-[24rpx]">
                  <Text className="mb-[16rpx] block text-[28rpx] text-foreground">重复方式</Text>
                  <View className="flex gap-[12rpx]">
                    {REPEAT_OPTIONS.map((opt) => {
                      const active = repeatMode === opt.value;
                      return (
                        <View
                          key={opt.value}
                          className={cn(
                            'flex-1 rounded-full py-[14rpx] text-center',
                            active ? 'bg-primary' : 'bg-muted',
                          )}
                          onClick={() => setRepeatMode(opt.value)}
                        >
                          <Text
                            className={cn(
                              'text-[26rpx]',
                              active ? 'text-white' : 'text-foreground',
                            )}
                          >
                            {opt.label}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>

                {repeatMode !== 'alternate' ? (
                  <View className="border-b border-border/60 py-[24rpx]">
                    <Text className="mb-[16rpx] block text-[28rpx] text-foreground">上课周几</Text>
                    <View className="flex flex-wrap gap-[12rpx]">
                      {WEEKDAY_OPTIONS.map((opt) => {
                        const active = selectedDays.includes(opt.value);
                        return (
                          <View
                            key={opt.value}
                            className={cn(
                              'h-[64rpx] w-[64rpx] rounded-full center flex items-center justify-center',
                              active ? 'bg-primary' : 'bg-muted',
                            )}
                            onClick={() => toggleWeekday(opt.value)}
                          >
                            <Text
                              className={cn(
                                'text-[26rpx]',
                                active ? 'text-white' : 'text-foreground',
                              )}
                            >
                              {opt.label}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                ) : null}

                <View
                  className="flex items-center justify-between border-b border-border/60 py-[24rpx]"
                  onClick={() => setEndModePickerVisible(true)}
                >
                  <Text className="text-[28rpx] text-foreground">结束方式</Text>
                  <View className="flex items-center gap-[8rpx]">
                    <Text className="text-[28rpx] text-foreground">
                      {END_MODE_OPTIONS.find((o) => o.value === endMode)?.label || '不结束'}
                    </Text>
                    <Icon name="mdi-chevron-right" size={24} color="mutedForeground" />
                  </View>
                </View>

                {endMode === 'by_date' ? (
                  <View
                    className="flex items-center justify-between border-b border-border/60 py-[24rpx]"
                    onClick={() => setEndDateCalendarVisible(true)}
                  >
                    <Text className="text-[28rpx] text-foreground">结束日期</Text>
                    <View className="flex items-center gap-[8rpx]">
                      <Text className="text-[28rpx] text-foreground">{endDate}</Text>
                      <Icon name="mdi-chevron-right" size={24} color="mutedForeground" />
                    </View>
                  </View>
                ) : null}

                {endMode === 'by_count' ? (
                  <View className="flex items-center justify-between border-b border-border/60 py-[24rpx]">
                    <Text className="text-[28rpx] text-foreground">上课次数</Text>
                    <Stepper value={endCount} min={1} max={999} step={1} onChange={setEndCount} />
                  </View>
                ) : null}

                <View className="flex items-center justify-between py-[24rpx]">
                  <View className="flex items-center gap-[16rpx]">
                    <Text className="text-[28rpx] text-foreground">节假日是否排课</Text>
                    <Text className="text-[24rpx] text-primary" onClick={openHolidaySettings}>
                      设置
                    </Text>
                  </View>
                  <YesNoToggle value={scheduleOnHoliday} onChange={setScheduleOnHoliday} />
                </View>
              </View>
            ) : (
              <View id="schedule-free-dates" className="mt-[8rpx]">
                <View
                  className="flex items-center justify-between border-b border-border/60 py-[24rpx]"
                  onClick={openFreeCalendar}
                >
                  <Text className="text-[28rpx] text-foreground">上课日期</Text>
                  <View className="flex items-center gap-[8rpx]">
                    <Text className="text-[28rpx] text-primary">
                      {freeDates.length > 0 ? `已选 ${freeDates.length} 天` : '多选日期'}
                    </Text>
                    <Icon name="mdi-chevron-right" size={24} color="mutedForeground" />
                  </View>
                </View>
                {freeDates.length > 0 ? (
                  <View className="flex flex-wrap gap-[12rpx] pt-[20rpx]">
                    {freeDates.map((d) => (
                      <View
                        key={d}
                        className="flex items-center gap-[8rpx] rounded-full bg-primary/10 px-[16rpx] py-[10rpx]"
                        onClick={() => removeFreeDate(d)}
                      >
                        <Text className="text-[24rpx] text-primary">
                          {dayjs(d).format('MM/DD')}
                        </Text>
                        <Icon name="mdi-close" size={18} color="primary" />
                      </View>
                    ))}
                    <View
                      className="flex items-center gap-[6rpx] rounded-full border border-dashed border-primary/40 px-[16rpx] py-[10rpx]"
                      onClick={openFreeCalendar}
                    >
                      <Icon name="mdi-plus" size={18} color="primary" />
                      <Text className="text-[24rpx] text-primary">继续选</Text>
                    </View>
                  </View>
                ) : null}
              </View>
            )}
          </View>

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
              !canSubmit || saving || deleting ? 'text-muted-foreground' : 'text-primary-foreground',
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
