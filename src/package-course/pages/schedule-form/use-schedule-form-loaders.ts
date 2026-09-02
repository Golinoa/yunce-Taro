/**
 * 排课表单数据加载：初始化 / 校区教室 / 班级联动同步 / 学员变更（Q2-3）
 */
import Taro from '@tarojs/taro';
import dayjs from 'dayjs';
import {
  useCallback,
  useEffect,
  useMemo,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import {
  classService,
  roomService,
  campusService,
  scheduleService,
  teacherService,
  subscribeMessageService,
} from '@/services';
import { subjectService } from '@/services/campus';
import type { CampusUIModel, Room, Subject } from '@/types/campus';
import type { Class, ClassLevel } from '@/types/class';
import type { DayOfWeek, Schedule, ScheduleColor } from '@/types/schedule';
import type { Student } from '@/types/student';
import type { TeacherUIModel } from '@/types/teacher';
import type { UserRole } from '@/types/profile';
import { logError } from '@/utils/logger';
import { getDefaultRescheduleTargetDate } from '@/utils/reschedule-date';
import { getTeacherSelectionInfo } from './teacher-selection';
import { getNextDateByDayOfWeek } from './time';
import type { AutoOpenType, TimeSlotPair } from './schedule-form-constants';

export interface UseScheduleFormLoadersParams {
  currentUserId: string;
  currentTeacherName: string;
  currentCampusId: string;
  profileRole?: UserRole | null;
  isEdit: boolean;
  isRescheduleMode: boolean;
  isGroupMode: boolean;
  scheduleId: string;
  lessonDateParam: string;
  sourceMode: string;
  loading: boolean;
  setLoading: (v: boolean) => void;
  setLoadError: Dispatch<SetStateAction<string>>;
  setNotFound: Dispatch<SetStateAction<boolean>>;
  setOriginalSchedule: Dispatch<SetStateAction<Schedule | null>>;
  setClasses: Dispatch<SetStateAction<Class[]>>;
  setAllSchedules: Dispatch<SetStateAction<Schedule[]>>;
  setTeachers: Dispatch<SetStateAction<TeacherUIModel[]>>;
  setCampusOptions: Dispatch<SetStateAction<CampusUIModel[]>>;
  setStudents: Dispatch<SetStateAction<Student[]>>;
  setSubjects: Dispatch<SetStateAction<Subject[]>>;
  setClassStudents: Dispatch<SetStateAction<Student[]>>;
  classStudents: Student[];
  setClassId: Dispatch<SetStateAction<string>>;
  classId: string;
  setStartDate: Dispatch<SetStateAction<string>>;
  setSelectedDays: Dispatch<SetStateAction<DayOfWeek[]>>;
  setTimeSlots: Dispatch<SetStateAction<TimeSlotPair[]>>;
  setScheduleType: Dispatch<SetStateAction<'class' | 'group'>>;
  setAutoOpenType: Dispatch<SetStateAction<AutoOpenType>>;
  setSlotMaxCount: Dispatch<SetStateAction<number>>;
  setMinOpenCount: Dispatch<SetStateAction<number>>;
  setCourseLevel: Dispatch<SetStateAction<ClassLevel>>;
  setCampusId: Dispatch<SetStateAction<string>>;
  campusId: string;
  setRooms: Dispatch<SetStateAction<Room[]>>;
  setRoom: Dispatch<SetStateAction<string>>;
  setMode: Dispatch<SetStateAction<'student' | 'class'>>;
  mode: 'student' | 'class';
  setStudentId: Dispatch<SetStateAction<string>>;
  setDayOfWeek: Dispatch<SetStateAction<DayOfWeek>>;
  setSelectedDateValue: Dispatch<SetStateAction<string>>;
  setStartTime: Dispatch<SetStateAction<string>>;
  setEndTime: Dispatch<SetStateAction<string>>;
  setSelectedTeachingTeacherId: Dispatch<SetStateAction<string>>;
  setSelectedAssistantTeacherId: Dispatch<SetStateAction<string>>;
  setColor: Dispatch<SetStateAction<ScheduleColor>>;
  setNote: Dispatch<SetStateAction<string>>;
  setReminderMinutes: Dispatch<SetStateAction<number>>;
  setClassPickerVisible: Dispatch<SetStateAction<boolean>>;
  autoOpenedClassPickerRef: MutableRefObject<boolean>;
  classes: Class[];
  teachers: TeacherUIModel[];
  originalSchedule: Schedule | null;
  fetchStudentsByTeacher: (teacherId: string) => Promise<Student[]>;
  fetchClassesByTeacher: (teacherId: string) => Promise<Class[]>;
  invalidateStudents: (teacherId: string) => void;
}

export function useScheduleFormLoaders(params: UseScheduleFormLoadersParams) {
  const {
    currentUserId,
    currentTeacherName,
    currentCampusId,
    profileRole,
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
  } = params;

  const selectedClass = useMemo(
    () => classes.find((c) => c.id === classId) || null,
    [classId, classes],
  );

  const teacherById = useMemo(
    () =>
      teachers.reduce<Record<string, TeacherUIModel>>((a, t) => {
        a[t.id] = t;
        return a;
      }, {}),
    [teachers],
  );

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
    fetchStudentsByTeacher,
    fetchClassesByTeacher,
    setLoading,
    setLoadError,
    setNotFound,
    setStudents,
    setSubjects,
    setClasses,
    setAllSchedules,
    setTeachers,
    setCampusOptions,
    setOriginalSchedule,
    setMode,
    setStudentId,
    setClassId,
    setDayOfWeek,
    setSelectedDateValue,
    setStartTime,
    setEndTime,
    setTimeSlots,
    setSelectedDays,
    setStartDate,
    setSelectedTeachingTeacherId,
    setSelectedAssistantTeacherId,
    setColor,
    setScheduleType,
    setAutoOpenType,
    setSlotMaxCount,
    setMinOpenCount,
    setNote,
    setReminderMinutes,
    setCampusId,
    setRoom,
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
  }, [
    loading,
    isEdit,
    isRescheduleMode,
    classId,
    classes.length,
    autoOpenedClassPickerRef,
    setClassPickerVisible,
  ]);

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
  }, [campusId, currentCampusId, setCampusId, setRooms]);

  /* 班级切换 → 同步难度 */
  useEffect(() => {
    if (selectedClass?.level) {
      setCourseLevel(selectedClass.level);
    }
  }, [selectedClass?.id, selectedClass?.level, setCourseLevel]);

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
    setAutoOpenType,
    setSlotMaxCount,
    setMinOpenCount,
  ]);

  /* 班级切换 → 同步校区（班级校区优先，但仍落在当前机构上下文） */
  useEffect(() => {
    if (mode !== 'class') return;
    const cc = selectedClass?.campus_id;
    if (cc && cc !== campusId) {
      setCampusId(cc);
      setRoom('');
    }
  }, [mode, selectedClass, campusId, setCampusId, setRoom]);

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
    setSelectedTeachingTeacherId,
    setSelectedAssistantTeacherId,
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
  }, [classId, setClassStudents]);

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
              role: profileRole,
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
      profileRole,
      setClassStudents,
    ],
  );

  return { loadFormData, handleStudentsChange, selectedClass, teacherById };
}
