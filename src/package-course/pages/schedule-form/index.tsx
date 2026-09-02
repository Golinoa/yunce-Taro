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
import dayjs from 'dayjs';
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { CalendarDotType } from '@/components/CalendarWeekSelector';
import ClassStudentsCard from '@/components/course/ClassStudentsCard';
import Empty from '@/components/Empty';
import Loading from '@/components/Loading';
import PageContainer from '@/components/PageContainer';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
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
import { withRouteGuard } from '@/utils/route-guard';
import { getTeacherSelectionInfo } from './teacher-selection';
import {
  formatMinutesToTime,
  getNextDateByDayOfWeek,
  MIN_DURATION_MINUTES,
  parseTimeToMinutes,
} from './time';
import { getScheduleFormSubmitBlockedReason } from './schedule-form-validate';
import {
  type AutoOpenType,
  type EndMode,
  type RepeatMode,
  type SchedulingMode,
  type TimeSlotPair,
} from './schedule-form-constants';
import ScheduleFormBaseCard from './ScheduleFormBaseCard';
import ScheduleFormFooter from './ScheduleFormFooter';
import ScheduleFormRuleCard from './ScheduleFormRuleCard';
import ScheduleFormSheets from './ScheduleFormSheets';
import ScheduleFormTimeSlots from './ScheduleFormTimeSlots';
import { useScheduleFormLoaders } from './use-schedule-form-loaders';
import { useScheduleFormSave } from './use-schedule-form-save';
import { useScheduleFormTime } from './use-schedule-form-time';

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

  /* ---- 数据加载 / 班级联动 / 学员同步 ---- */
  const { loadFormData, handleStudentsChange, selectedClass, teacherById } =
    useScheduleFormLoaders({
      currentUserId,
      currentTeacherName,
      currentCampusId,
      profileRole: profile?.currentContext?.role,
      isEdit,
      isRescheduleMode,
      isGroupMode,
      scheduleId,
      lessonDateParam,
      sourceMode,
      loading,
      setLoading,
      setLoadError,
      setNotFound,
      setOriginalSchedule,
      setClasses,
      setAllSchedules,
      setTeachers,
      setCampusOptions,
      setStudents,
      setSubjects,
      setClassStudents,
      classStudents,
      setClassId,
      classId,
      setStartDate,
      setSelectedDays,
      setTimeSlots,
      setScheduleType,
      setAutoOpenType,
      setSlotMaxCount,
      setMinOpenCount,
      setCourseLevel,
      setCampusId,
      campusId,
      setRooms,
      setRoom,
      setMode,
      mode,
      setStudentId,
      setDayOfWeek,
      setSelectedDateValue,
      setStartTime,
      setEndTime,
      setSelectedTeachingTeacherId,
      setSelectedAssistantTeacherId,
      setColor,
      setNote,
      setReminderMinutes,
      setClassPickerVisible,
      autoOpenedClassPickerRef,
      classes,
      teachers,
      originalSchedule,
      fetchStudentsByTeacher,
      fetchClassesByTeacher,
      invalidateStudents,
    });

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
  const classLevelLabel = useMemo(() => CLASS_LEVEL_LABELS[courseLevel] || '所有人', [courseLevel]);

  const selectedRoomName = useMemo(
    () => rooms.find((r) => r.id === room || r.name === room)?.name || room || '',
    [room, rooms],
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

  /* ---- 时间段 / 自由日期 / 滚动恢复 ---- */
  const {
    scrollTop,
    timePickerVisible,
    timePickerTitle,
    timePickerValue,
    allowMultiTimeSlots,
    hasRealTimeSlots,
    timeDisplayDateLabel,
    restoreScrollAfterSheet,
    openFreeCalendar,
    closeFreeCalendar,
    openTimePickerFlow,
    handleTimePickerConfirm,
    closeTimePicker,
    removeTimeSlot,
    removeFreeDate,
    handleFreeDatesConfirm,
    onScrollCapture,
  } = useScheduleFormTime({
    schedulingMode,
    repeatMode,
    timeSlots,
    setTimeSlots,
    freeDates,
    setFreeDates,
    startDate,
    setFreeCalendarVisible,
  });

  /* ---- 操作方法 ---- */
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

  /* ---- 保存编排（调课 / 冲突 / 落库） ---- */
  const { handleSave } = useScheduleFormSave({
    saving,
    setSaving,
    submitBlockedReason,
    isRescheduleMode,
    isEdit,
    isGroupMode,
    originalSchedule,
    sourceLessonDateText,
    selectedDateValue,
    startTime,
    endTime,
    currentUserId,
    allSchedules,
    mode,
    classId,
    selectedClass,
    profileRole: profile?.currentContext?.role,
    profileCampusId: profile?.currentContext?.campusId,
    note,
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
    selectedDays,
    freeDates,
    timeSlots,
    rooms,
    room,
    selectedTeachingTeacherId,
    selectedAssistantTeacherId,
    studentId,
    scheduleId,
    color,
    reminderMinutes,
    ignoreConflictRef,
    setConflictResult,
    setConflictDialogVisible,
    invalidateClasses,
    currentCampusId,
    setClasses,
  });

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
      <ScrollView
        scrollY
        className="h-screen"
        enhanced
        showScrollbar={false}
        scrollTop={scrollTop}
        scrollWithAnimation={false}
        onScroll={(e) => {
          const top = e.detail?.scrollTop;
          if (typeof top === 'number') onScrollCapture(top);
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

          <ScheduleFormTimeSlots
            title="上课时间"
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
      <ScheduleFormFooter
        canSubmit={canSubmit}
        submitBlockedReason={submitBlockedReason}
        saving={saving}
        deleting={deleting}
        isEdit={isEdit}
        isRescheduleMode={isRescheduleMode}
        onSave={() => {
          void handleSave();
        }}
      />

      <ScheduleFormSheets
        calendarVisible={calendarVisible}
        startDate={startDate}
        onCloseCalendar={() => {
          setCalendarVisible(false);
          restoreScrollAfterSheet();
        }}
        onSelectStartDate={(date, dow) => {
          setStartDate(date);
          setSelectedDateValue(date);
          setDayOfWeek(dow);
        }}
        getDateDotType={getDateDotType}
        endDateCalendarVisible={endDateCalendarVisible}
        endDate={endDate}
        onCloseEndDateCalendar={() => {
          setEndDateCalendarVisible(false);
          restoreScrollAfterSheet();
        }}
        onSelectEndDate={setEndDate}
        freeCalendarVisible={freeCalendarVisible}
        freeDates={freeDates}
        onCloseFreeCalendar={closeFreeCalendar}
        onSelectFreeDates={handleFreeDatesConfirm}
        typePickerVisible={typePickerVisible}
        isGroupMode={isGroupMode}
        onCloseTypePicker={() => setTypePickerVisible(false)}
        onConfirmType={(next) => {
          setScheduleType(next);
          setClassId('');
          setTypePickerVisible(false);
        }}
        classPickerVisible={classPickerVisible}
        classes={classes}
        scheduledClassIds={scheduledClassIds}
        classId={classId}
        onCloseClassPicker={() => setClassPickerVisible(false)}
        onConfirmClass={setClassId}
        roomPickerVisible={roomPickerVisible}
        rooms={rooms}
        room={room}
        onCloseRoomPicker={() => setRoomPickerVisible(false)}
        onConfirmRoom={setRoom}
        endModePickerVisible={endModePickerVisible}
        endMode={endMode}
        onCloseEndModePicker={() => setEndModePickerVisible(false)}
        onConfirmEndMode={setEndMode}
        teacherPickerVisible={teacherPickerVisible}
        teachers={teachers}
        selectedTeachingTeacherId={selectedTeachingTeacherId}
        onCloseTeacherPicker={() => setTeacherPickerVisible(false)}
        onConfirmTeacher={handleTeacherConfirm}
        assistantPickerVisible={assistantPickerVisible}
        selectedAssistantTeacherId={selectedAssistantTeacherId}
        onCloseAssistantPicker={() => setAssistantPickerVisible(false)}
        onConfirmAssistant={handleAssistantConfirm}
        levelPickerVisible={levelPickerVisible}
        courseLevel={courseLevel}
        onCloseLevelPicker={() => setLevelPickerVisible(false)}
        onConfirmLevel={(level) => {
          setCourseLevel(level);
          setLevelPickerVisible(false);
        }}
        timePickerVisible={timePickerVisible}
        timePickerTitle={timePickerTitle}
        timePickerValue={timePickerValue}
        onCloseTimePicker={closeTimePicker}
        onConfirmTime={handleTimePickerConfirm}
        conflictDialogVisible={conflictDialogVisible}
        conflictSummary={conflictResult?.conflictSummary || ''}
        conflicts={conflictResult?.conflicts || []}
        onConflictModify={() => {
          ignoreConflictRef.current = false;
          setConflictDialogVisible(false);
        }}
        onConflictIgnore={() => {
          ignoreConflictRef.current = true;
          setConflictDialogVisible(false);
          void handleSave();
        }}
      />
    </PageContainer>
  );
};

export default withRouteGuard(ScheduleForm);
