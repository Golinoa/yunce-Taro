import { View } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { createSubmitLock } from '@/utils/submit-lock';
import DatePickerSheet from '@/components/DatePickerSheet';
import PageContainer from '@/components/PageContainer';
import PickerSheet, { PickerOption } from '@/components/PickerSheet';
import StudentMultiSelectSheet from '@/components/StudentMultiSelectSheet';
import {
  studentService,
  packageService,
  lessonRecordService,
  classService,
  subjectService,
  uploadService,
  teacherService,
  leadService,
  subscribeMessageService,
  makeupBookingService,
} from '@/services';
import { campusService, roomService } from '@/services/campus';
import { useStudentStore, useClassStore } from '@/stores';
import { useCampusStore } from '@/stores/campus';
import { useThemeStore } from '@/stores/theme';
import { getThemeHexColors } from '@/theme';
import type { CampusUIModel, Room, Subject } from '@/types/campus';
import type { Class } from '@/types/class';
import type { CoursePackage } from '@/types/course-package';
import type { Lead, LeadBooking } from '@/types/lead';
import type { LessonRecord } from '@/types/lesson-record';
import type { Student } from '@/types/student';
import type { TeacherUIModel } from '@/types/teacher';
import { useAuth } from '@/utils/auth';
import { chooseImageTemp } from '@/utils/image-upload';
import { logError } from '@/utils/logger';
import { pickBestPackage } from '@/utils/package-helper';
import { withRouteGuard } from '@/utils/route-guard';
import { runImageUploadFlow } from '@/utils/upload-flow';
import ClassLessonPanel from './ClassLessonPanel';
import {
  buildCheckinBaseline,
  type CheckinStatus,
  type ClassAttendanceMode,
} from './checkin-status';
import LessonFormFooter from './LessonFormFooter';
import LessonFormHeader from './LessonFormHeader';
import { formatDate, formatTime } from './lesson-form-datetime';
import StudentEditSheet from './StudentEditSheet';
import SingleLessonPanel from './SingleLessonPanel';
import { isWithinLessonOperateWindow } from './lesson-operate';
import { executeClassSubmit } from './lesson-submit-class';
import { executeSingleDeduct } from './lesson-submit-single';
import {
  executeIncrementalEditSave,
  executeSupplementSave,
} from './lesson-submit-supplement';
import { resolveLessonSubmitKind } from './lesson-submit';
import {
  buildClassAttendanceState,
  buildTrialCheckinMap,
  fetchApprovedLeaveStudentIds,
  loadPackageMapsForStudents,
  resolveClassAttendanceMode,
} from './lesson-attendance-load';

const SCHEDULE_REFRESH_SIGNAL_KEY = 'yunce:schedule:refresh';

const LessonForm: React.FC = () => {
  const { profile, currentRole } = useAuth();
  const canEditClass = currentRole === 'admin' || currentRole === 'principal';
  const themeStore = useThemeStore();

  const routeParams = useMemo(() => {
    const instance = Taro.getCurrentInstance();
    return instance?.router?.params || {};
  }, []);

  const studentIdParam = useMemo(() => {
    const v = routeParams.studentId || '';
    return v ? decodeURIComponent(v) : '';
  }, [routeParams]);

  const classIdParam = useMemo(() => {
    const v = routeParams.classId || '';
    return v ? decodeURIComponent(v) : '';
  }, [routeParams]);

  const lessonDateParam = useMemo(() => {
    const v = routeParams.lessonDate || '';
    return v ? decodeURIComponent(v) : '';
  }, [routeParams]);

  const lessonTimeParam = useMemo(() => {
    const v = routeParams.lessonTime || '';
    return v ? decodeURIComponent(v) : '';
  }, [routeParams]);

  const recordIdParam = useMemo(() => {
    const v = routeParams.recordId || '';
    return v ? decodeURIComponent(v) : '';
  }, [routeParams]);

  /** 课表卡片「补录」入口：加载完成后自动打开补录选人 */
  const actionParam = useMemo(() => {
    const v = routeParams.action || '';
    return v ? decodeURIComponent(v) : '';
  }, [routeParams]);

  /** 课表超时历史卡：强制仅查看 */
  const viewOnlyParam = useMemo(() => {
    const v = routeParams.viewOnly || '';
    return (v ? decodeURIComponent(v) : '') === '1';
  }, [routeParams]);

  const pendingSupplementActionRef = React.useRef(actionParam === 'supplement');

  const modeParam = useMemo(() => {
    const v = routeParams.mode || '';
    return v ? decodeURIComponent(v) : '';
  }, [routeParams]);

  const isEditEntryAttempt = Boolean(recordIdParam) || modeParam === 'edit';

  // ===== 模式切换 =====
  const [mode, setMode] = useState<'single' | 'class'>(classIdParam ? 'class' : 'single');

  const fetchStudentsByTeacher = useStudentStore((state) => state.fetchByTeacher);
  const invalidateStudents = useStudentStore((state) => state.invalidate);
  const fetchClassesByTeacher = useClassStore((state) => state.fetchByTeacher);

  // ===== 单人模式状态 =====
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [showStudentPicker, setShowStudentPicker] = useState(false);
  const [matchedPackage, setMatchedPackage] = useState<CoursePackage | null>(null);
  const [matchedSubject, setMatchedSubject] = useState<Subject | null>(null);
  /** 单人消课：学员当前可用课包列表（多个时需手动选择） */
  const [studentActivePackages, setStudentActivePackages] = useState<CoursePackage[]>([]);
  /** 用户是否手动选过课包（避免改课时时被自动匹配冲掉） */
  const packageManualRef = React.useRef(false);

  // ===== 班级模式状态 =====
  const [classes, setClasses] = useState<Class[]>([]);
  const [scheduledClassIds, setScheduledClassIds] = useState<Set<string>>(new Set());
  const [selectedClassId, setSelectedClassId] = useState(classIdParam);
  const [classStudents, setClassStudents] = useState<Student[]>([]);
  const [checkedStudentIds, setCheckedStudentIds] = useState<Set<string>>(new Set());
  const [leaveStudentIds, setLeaveStudentIds] = useState<Set<string>>(new Set());
  const [studentPackages, setStudentPackages] = useState<Map<string, CoursePackage>>(new Map());
  const [studentSubjects, setStudentSubjects] = useState<Map<string, Subject | null>>(new Map());
  const [showAddStudentSheet, setShowAddStudentSheet] = useState(false);
  const [addStudentSheetPurpose, setAddStudentSheetPurpose] = useState<'attendance' | 'supplement'>(
    'attendance',
  );
  const [subjectOptions, setSubjectOptions] = useState<Subject[]>([]);

  // ===== 已点名 / 查看 / 修改模式（班级模式） =====
  /** 该班级该日期已存在的点名/消课记录 */
  const [existingClassRecords, setExistingClassRecords] = useState<LessonRecord[]>([]);
  /** 是否已点名（存在落库记录） */
  const [isAlreadyChecked, setIsAlreadyChecked] = useState(false);
  /** 已点名后的交互模式：查看 / 修改 / 补录 */
  const [attendanceMode, setAttendanceMode] = useState<ClassAttendanceMode>('normal');
  /** 本次补录新增的学员 ID（仅这些卡片在补录态可编辑） */
  const [supplementStudentIds, setSupplementStudentIds] = useState<Set<string>>(new Set());
  /** 本节课补课学员 ID（左上角「补」标签） */
  const [makeupStudentIds, setMakeupStudentIds] = useState<Set<string>>(new Set());
  /** 学员 → 当次课节落库记录（用于增量修改） */
  const [recordByStudentId, setRecordByStudentId] = useState<Map<string, LessonRecord>>(new Map());
  /** 进入修改态时的出勤快照（用于增量提交） */
  const [attendanceBaseline, setAttendanceBaseline] = useState<Map<string, CheckinStatus>>(
    new Map(),
  );

  // ===== 试听学员状态（团课约试听） =====
  const [trialBookings, setTrialBookings] = useState<LeadBooking[]>([]);
  /** 试听学员签到状态映射：bookingId → CheckinStatus */
  const [trialCheckinMap, setTrialCheckinMap] = useState<Record<string, CheckinStatus>>({});
  const [trialLeadMap, setTrialLeadMap] = useState<Record<string, Lead>>({});

  // ===== 当前身份 =====
  const currentUserId = profile?.id || '';
  const currentTeacherId = profile?.teacher_profile?.id || currentUserId;
  const attendanceRecordActorId = currentUserId || currentTeacherId;
  const [teacherOptions, setTeacherOptions] = useState<TeacherUIModel[]>([]);
  const [selectedTeachingTeacherId, setSelectedTeachingTeacherId] = useState('');
  const [selectedAssistantTeacherId, setSelectedAssistantTeacherId] = useState('');

  // ===== 课程信息 =====
  const now = useMemo(() => new Date(), []);
  const [lessonDate, setLessonDate] = useState(lessonDateParam || formatDate(now));
  const [lessonDatePickerVisible, setLessonDatePickerVisible] = useState(false);
  const [lessonTime, setLessonTime] = useState(lessonTimeParam || formatTime(now));
  const [hoursUsed, setHoursUsed] = useState(1);
  const [content, setContent] = useState('');
  const [performance, setPerformance] = useState(0);
  const [homework, setHomework] = useState('');
  const [homeworkImages, setHomeworkImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  /** G1-1：同步锁，挡住 setState 生效前的连点双提交 */
  const submitLockRef = useRef(createSubmitLock());

  // ===== 校区 / 教室 =====
  const { currentCampusId } = useCampusStore();
  const [campusOptions, setCampusOptions] = useState<CampusUIModel[]>([]);
  const [campusId, setCampusId] = useState(currentCampusId);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [room, setRoom] = useState('');
  /** 统一弹窗选择器（PickerSheet 标准组件）：teacher/campus/room/package */
  const [selector, setSelector] = useState<{
    visible: boolean;
    type: 'teacher' | 'campus' | 'room' | 'package' | null;
  }>({ visible: false, type: null });

  // ===== 班级模式：搜索/扣费/筛选 =====
  const [studentSearchKeyword, setStudentSearchKeyword] = useState('');
  const [feeAmount, setFeeAmount] = useState<string>('0');
  const [attendanceFilter, setAttendanceFilter] = useState<'all' | CheckinStatus>('all');

  // ===== 学员卡片编辑弹窗 =====
  const [showStudentDetailSheet, setShowStudentDetailSheet] = useState(false);
  const [detailSheetTarget, setDetailSheetTarget] = useState<{
    type: 'formal' | 'trial';
    id: string;
    name: string;
    remaining: string;
    deduct: string;
    courseName?: string;
    student?: Student;
  } | null>(null);
  const [detailSheetRemark, setDetailSheetRemark] = useState('');
  // 单学员备注草稿：studentId → 备注。优先落库到消课记录（record.note）；
  // 学员尚无考勤记录时先暂存于此，随下次提交点名写入记录，保证输入不丢失。
  const [studentRemarkDrafts, setStudentRemarkDrafts] = useState<Record<string, string>>({});

  const applyClassTeacherDefaults = useCallback(
    (classInfo: Class | null, options: TeacherUIModel[]) => {
      if (!classInfo) {
        setSelectedTeachingTeacherId(currentTeacherId);
        setSelectedAssistantTeacherId('');
        return;
      }

      const configuredTeacherIds = classInfo.teachers?.length
        ? classInfo.teachers
        : classInfo.teacher_id
          ? [classInfo.teacher_id]
          : [];
      const configuredTeachers = configuredTeacherIds
        .map((id) => options.find((teacher) => teacher.id === id))
        .filter((teacher): teacher is TeacherUIModel => Boolean(teacher));
      const leadTeacher =
        configuredTeachers.find((teacher) => teacher.id === classInfo.teacher_id) ||
        configuredTeachers.find((teacher) => teacher.role !== 'assist') ||
        configuredTeachers[0] ||
        options.find((teacher) => teacher.id === classInfo.teacher_id) ||
        options.find((teacher) => teacher.id === currentTeacherId) ||
        null;
      const assistantTeacherId = configuredTeacherIds.find((id) => id !== leadTeacher?.id);
      const assistantTeacher = assistantTeacherId
        ? options.find((teacher) => teacher.id === assistantTeacherId) || null
        : configuredTeachers.find(
            (teacher) => teacher.role === 'assist' && teacher.id !== leadTeacher?.id,
          ) || null;

      setSelectedTeachingTeacherId(leadTeacher?.id || currentTeacherId);
      setSelectedAssistantTeacherId(assistantTeacher?.id || '');
    },
    [currentTeacherId],
  );

  /** 从班级默认配置预填本次消课课时与扣费 */
  const applyClassLessonDefaults = useCallback((classInfo: Class | null) => {
    if (!classInfo) {
      return;
    }
    setHoursUsed(classInfo.hours_per_lesson ?? 1);
    setFeeAmount(String(classInfo.pricePerLesson ?? 0));
  }, []);

  useEffect(() => {
    if (classIdParam) {
      setMode('class');
    }
    if (lessonDateParam) {
      setLessonDate(lessonDateParam);
    }
    if (lessonTimeParam) {
      setLessonTime(lessonTimeParam);
    }
  }, [classIdParam, lessonDateParam, lessonTimeParam]);

  useEffect(() => {
    if (!isEditEntryAttempt) {
      return;
    }

    Taro.showToast({
      title: '历史消课记录不支持编辑',
      icon: 'none',
    });

    const goSchedulePage = () => {
      Taro.switchTab({ url: '/pages/schedule/index' }).catch(() => {});
    };

    const timer = setTimeout(() => {
      if (Taro.getCurrentPages().length > 1) {
        Taro.navigateBack().catch(() => {
          goSchedulePage();
        });
        return;
      }

      goSchedulePage();
    }, 250);

    return () => clearTimeout(timer);
  }, [isEditEntryAttempt]);

  const loadApprovedLeaveStudentIds = useCallback(
    async (students: Student[]) => {
      const nextLeaveStudentIds = await fetchApprovedLeaveStudentIds({
        teacherId: currentTeacherId,
        students,
        lessonDate,
      });
      setLeaveStudentIds(nextLeaveStudentIds);
      return nextLeaveStudentIds;
    },
    [currentTeacherId, lessonDate],
  );

  /** 加载该班级/日期的试听预约学员 */
  const loadTrialBookings = useCallback(async () => {
    if (!selectedClassId || !lessonDate || !currentTeacherId) {
      setTrialBookings([]);
      setTrialCheckinMap({});
      setTrialLeadMap({});
      return;
    }

    try {
      const bookings = await leadService.getLeadBookingsByTeacher(currentTeacherId, {
        startDate: lessonDate,
        endDate: lessonDate,
        status: 'confirmed',
      });
      const classBookings = bookings.filter(
        (b) => b.class_id === selectedClassId && b.lesson_date === lessonDate,
      );
      setTrialBookings(classBookings);

      const leadIds = [...new Set(classBookings.map((b) => b.lead_id))];
      const leads = await Promise.all(leadIds.map((id) => leadService.getLeadById(id)));
      const nextLeadMap: Record<string, Lead> = {};
      leads.forEach((lead) => {
        if (lead) {
          nextLeadMap[lead.id] = lead;
        }
      });
      setTrialLeadMap(nextLeadMap);
      // 回填试听学员已有点名记录；无记录默认"未到"
      let trialExisting: LessonRecord[] = [];
      try {
        trialExisting = await lessonRecordService.getByTeacherAndRange(
          attendanceRecordActorId,
          lessonDate,
          lessonDate,
        );
      } catch (err) {
        logError('loadTrialBookings records', err);
      }
      setTrialCheckinMap(
        buildTrialCheckinMap({
          bookings: classBookings,
          records: trialExisting,
          classId: selectedClassId,
          lessonDate,
        }),
      );
    } catch (err) {
      logError('loadTrialBookings', err);
      setTrialBookings([]);
      setTrialLeadMap({});
      setTrialCheckinMap({});
    }
  }, [attendanceRecordActorId, currentTeacherId, lessonDate, selectedClassId]);

  // ===== 初始化加载 =====
  useEffect(() => {
    if (isEditEntryAttempt) {
      return;
    }

    const loadData = async () => {
      const [classList, teacherList, campusList, scheduledIds] = await Promise.all([
        fetchClassesByTeacher(currentTeacherId),
        teacherService.getList(),
        campusService.getList(),
        classService.getScheduledClassIds(),
      ]);
      setClasses(classList.filter((item) => item.status === 'active' || item.status === 'paused'));
      setScheduledClassIds(new Set(scheduledIds));
      setTeacherOptions(teacherList);
      setCampusOptions(campusList);
      const mainCampusId = campusList.find((campus) => campus.isMain)?.id || '';
      setCampusId((prev) => prev || mainCampusId);
      setSelectedTeachingTeacherId((prev) => {
        if (prev) return prev;
        const matchedTeacher =
          teacherList.find((teacher) => teacher.id === currentTeacherId) ||
          teacherList.find((teacher) => teacher.name === profile?.name);
        return matchedTeacher?.id || currentTeacherId;
      });

      if (studentIdParam) {
        const stu = await studentService.getById(studentIdParam);
        if (stu) {
          setSelectedStudent(stu);
          setCampusId(stu.campus_id || mainCampusId);
          // 内联匹配逻辑，避免依赖 autoMatchPackage
          const pkgs = await packageService.getActiveByStudent(stu.id);
          const best = pickBestPackage(pkgs, hoursUsed);
          setMatchedPackage(best);
          if (best?.subject_id) {
            const sub = await subjectService.getById(best.subject_id);
            setMatchedSubject(sub);
          } else {
            setMatchedSubject(null);
          }
        }
      }

      if (classIdParam) {
        const [classInfo, students] = await Promise.all([
          classService.getById(classIdParam),
          classService.getStudents(classIdParam),
        ]);
        setSelectedClassId(classIdParam);
        setCampusId(classInfo?.campus_id || mainCampusId);
        applyClassTeacherDefaults(classInfo, teacherList);
        applyClassLessonDefaults(classInfo);
        setClassStudents(students);
        await loadApprovedLeaveStudentIds(students);

        // 加载该班级/日期已有点名记录 → 判定是否已点名并回填学员状态（查看模式）
        const existingRecords = await loadLessonRecordsByDate();
        const attendance = buildClassAttendanceState({
          records: existingRecords,
          classId: classIdParam,
          lessonDate,
          studentIds: students.map((student) => student.id),
        });
        setExistingClassRecords(attendance.classRecords);
        setIsAlreadyChecked(attendance.hasRecords);
        setCheckedStudentIds(attendance.checkedStudentIds);
        setLeaveStudentIds(attendance.leaveStudentIds);
        setRecordByStudentId(attendance.recordByStudentId);
        setSupplementStudentIds(new Set());
        setAttendanceMode(
          resolveClassAttendanceMode({
            hasRecords: attendance.hasRecords,
            viewOnly: viewOnlyParam,
            lessonDate,
          }),
        );

        const { packages, subjects } = await loadPackageMapsForStudents(students, hoursUsed);
        setStudentPackages(packages);
        setStudentSubjects(subjects);
      }
    };
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅在 URL 参数变化时初始化
  }, [
    classIdParam,
    currentTeacherId,
    currentUserId,
    fetchClassesByTeacher,
    applyClassTeacherDefaults,
    applyClassLessonDefaults,
    isEditEntryAttempt,
    loadApprovedLeaveStudentIds,
    profile?.name,
    studentIdParam,
    viewOnlyParam,
    lessonDate,
  ]);

  // 班级/日期变化时重新加载试听学员
  useEffect(() => {
    void loadTrialBookings();
  }, [loadTrialBookings]);

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
        logError('lesson-form load rooms', err);
        setRooms([]);
      }
    };
    loadRooms();
  }, [campusId]);

  // ===== 单人模式：加载课包并匹配（多课包时保留手动选择） =====
  const applyMatchedPackage = useCallback(async (pkg: CoursePackage | null) => {
    setMatchedPackage(pkg);
    if (pkg?.subject_id) {
      const sub = await subjectService.getById(pkg.subject_id);
      setMatchedSubject(sub);
    } else {
      setMatchedSubject(null);
    }
  }, []);

  const autoMatchPackage = useCallback(
    async (studentId: string, opts?: { promptIfMultiple?: boolean }) => {
      const pkgs = await packageService.getActiveByStudent(studentId);
      setStudentActivePackages(pkgs);

      let next: CoursePackage | null = null;
      if (packageManualRef.current && matchedPackage?.id) {
        next = pkgs.find((p) => p.id === matchedPackage.id) || null;
      }
      if (!next) {
        next = pickBestPackage(pkgs, hoursUsed);
        packageManualRef.current = false;
      }
      await applyMatchedPackage(next);

      if (opts?.promptIfMultiple && pkgs.length > 1) {
        setSelector({ visible: true, type: 'package' });
      }
    },
    [applyMatchedPackage, hoursUsed, matchedPackage?.id],
  );

  // 课时变化时重新匹配
  useEffect(() => {
    if (selectedStudent && mode === 'single') {
      autoMatchPackage(selectedStudent.id);
    }
  }, [hoursUsed, selectedStudent, mode, autoMatchPackage]);

  // ===== 单人模式：选择学生 =====
  const loadAllStudentsIfNeeded = useCallback(async () => {
    if (allStudents.length === 0) {
      const list = await fetchStudentsByTeacher(currentUserId);
      setAllStudents(list);
    }
  }, [allStudents.length, currentUserId, fetchStudentsByTeacher]);

  const handleOpenStudentPicker = useCallback(async () => {
    await loadAllStudentsIfNeeded();
    setShowStudentPicker(true);
  }, [loadAllStudentsIfNeeded]);

  const handleOpenAddStudentSheet = useCallback(async () => {
    await loadAllStudentsIfNeeded();
    setAddStudentSheetPurpose('attendance');
    setShowAddStudentSheet(true);
  }, [loadAllStudentsIfNeeded]);

  const handleOpenSupplementSheet = useCallback(async () => {
    await loadAllStudentsIfNeeded();
    setAddStudentSheetPurpose('supplement');
    setShowAddStudentSheet(true);
  }, [loadAllStudentsIfNeeded]);

  const handleEnterEditMode = useCallback(() => {
    setAttendanceBaseline(
      buildCheckinBaseline(
        classStudents.map((s) => s.id),
        checkedStudentIds,
        leaveStudentIds,
      ),
    );
    setAttendanceMode('edit');
  }, [checkedStudentIds, classStudents, leaveStudentIds]);

  const handleCancelSupplement = useCallback(() => {
    setClassStudents((prev) => prev.filter((student) => !supplementStudentIds.has(student.id)));
    setCheckedStudentIds((prev) => {
      const next = new Set(prev);
      supplementStudentIds.forEach((studentId) => next.delete(studentId));
      return next;
    });
    setLeaveStudentIds((prev) => {
      const next = new Set(prev);
      supplementStudentIds.forEach((studentId) => next.delete(studentId));
      return next;
    });
    setSupplementStudentIds(new Set());
    setAttendanceMode('view');
  }, [supplementStudentIds]);

  const isStudentCardDisabled = useCallback(
    (studentId: string) => {
      if (!isAlreadyChecked) {
        return false;
      }
      if (attendanceMode === 'view') {
        return true;
      }
      if (attendanceMode === 'supplement') {
        return !supplementStudentIds.has(studentId);
      }
      return false;
    },
    [attendanceMode, isAlreadyChecked, supplementStudentIds],
  );

  const handleSelectStudent = useCallback(
    async (stu: Student) => {
      packageManualRef.current = false;
      setSelectedStudent(stu);
      setCampusId(stu.campus_id || campusId);
      setShowStudentPicker(false);
      await autoMatchPackage(stu.id, { promptIfMultiple: true });
    },
    [autoMatchPackage, campusId],
  );

  const handlePickPackage = useCallback(
    async (packageId: string) => {
      const pkg = studentActivePackages.find((p) => p.id === packageId) || null;
      if (!pkg) return;
      packageManualRef.current = true;
      await applyMatchedPackage(pkg);
    },
    [applyMatchedPackage, studentActivePackages],
  );

  const handleConfirmSingleStudent = useCallback(
    (ids: string[]) => {
      const id = ids[0];
      if (!id) return;
      const stu = allStudents.find((item) => item.id === id);
      if (!stu) {
        Taro.showToast({ title: '学员不存在', icon: 'none' });
        return;
      }
      void handleSelectStudent(stu);
    },
    [allStudents, handleSelectStudent],
  );

  const selectedTeachingTeacher = useMemo(
    () => teacherOptions.find((teacher) => teacher.id === selectedTeachingTeacherId) || null,
    [teacherOptions, selectedTeachingTeacherId],
  );
  const selectedAssistantTeacher = useMemo(
    () => teacherOptions.find((teacher) => teacher.id === selectedAssistantTeacherId) || null,
    [teacherOptions, selectedAssistantTeacherId],
  );

  const selectedClass = useMemo(
    () => classes.find((item) => item.id === selectedClassId) || null,
    [classes, selectedClassId],
  );
  const isClassPaused = selectedClass?.status === 'paused';

  const handleToggleClassPause = useCallback(async () => {
    if (!selectedClassId || !selectedClass) {
      Taro.showToast({ title: '缺少班级信息', icon: 'none' });
      return;
    }
    const pausing = selectedClass.status !== 'paused';
    const confirmResult = await Taro.showModal({
      title: pausing ? '停课确认' : '恢复上课',
      content: pausing
        ? `确定暂停【${selectedClass.name}】？停课后课表不再展示该班排课/开放时段，可随时恢复。`
        : `确定恢复【${selectedClass.name}】上课？`,
      confirmText: pausing ? '确认停课' : '恢复上课',
      confirmColor: getThemeHexColors(themeStore.activeTheme).primary,
    });
    if (!confirmResult.confirm) return;

    try {
      const updated = pausing
        ? await classService.pause(selectedClassId)
        : await classService.resume(selectedClassId);
      if (!updated) {
        Taro.showToast({ title: pausing ? '停课失败' : '恢复失败', icon: 'none' });
        return;
      }
      setClasses((prev) =>
        prev.map((item) =>
          item.id === selectedClassId ? { ...item, status: pausing ? 'paused' : 'active' } : item,
        ),
      );
      Taro.showToast({ title: pausing ? '已停课' : '已恢复上课', icon: 'success' });
      if (pausing) {
        setTimeout(() => Taro.navigateBack(), 500);
      }
    } catch (err) {
      logError('LessonForm toggle class pause', err);
      Taro.showToast({ title: '操作失败，请重试', icon: 'none' });
    }
  }, [selectedClass, selectedClassId, themeStore.activeTheme]);
  const isClassDirectEntry = Boolean(classIdParam);
  const shouldShowModeTabs = !isClassDirectEntry;

  /** 手动消课：展示当前操作时间（不使用班级固定上课时间） */
  const displayLessonTime = lessonTime || formatTime(new Date());

  /** 30 天操作窗口：可补录 / 修改；超时或 viewOnly 仅查看 */
  const canModifyLesson = useMemo(() => {
    if (viewOnlyParam) {
      return false;
    }
    return isWithinLessonOperateWindow(lessonDate);
  }, [lessonDate, viewOnlyParam]);

  /** 课表卡片带 action=supplement 进入：已点名后自动打开补录选人（须在 30 天窗口内） */
  useEffect(() => {
    if (!pendingSupplementActionRef.current) return;
    if (!canModifyLesson) {
      pendingSupplementActionRef.current = false;
      return;
    }
    if (mode !== 'class' || !isAlreadyChecked || attendanceMode !== 'view') return;
    pendingSupplementActionRef.current = false;
    const timer = setTimeout(() => {
      void handleOpenSupplementSheet();
    }, 120);
    return () => clearTimeout(timer);
  }, [attendanceMode, canModifyLesson, handleOpenSupplementSheet, isAlreadyChecked, mode]);

  const pageTitle = useMemo(() => {
    return mode === 'class' ? '班级消课' : '课时消课';
  }, [mode]);

  // ===== 班级模式：加载班级学员 =====
  const loadLessonRecordsByDate = useCallback(async () => {
    if (!attendanceRecordActorId || !lessonDate) {
      return [] as LessonRecord[];
    }
    return lessonRecordService.getByTeacherAndRange(
      attendanceRecordActorId,
      lessonDate,
      lessonDate,
    );
  }, [attendanceRecordActorId, lessonDate]);

  const loadClassStudents = useCallback(
    async (classId: string) => {
      setSelectedClassId(classId);
      const [classInfo, students] = await Promise.all([
        classService.getById(classId),
        classService.getStudents(classId),
      ]);
      if (classInfo?.campus_id) {
        setCampusId(classInfo.campus_id);
      }
      if (classInfo?.room) {
        setRoom(classInfo.room);
      }
      if (classInfo) {
        setClasses((prev) => {
          const index = prev.findIndex((item) => item.id === classId);
          if (index === -1) {
            return prev;
          }
          const next = [...prev];
          next[index] = classInfo;
          return next;
        });
      }
      applyClassTeacherDefaults(classInfo, teacherOptions);
      applyClassLessonDefaults(classInfo);

      // 合并补课学员（非本班正式学员）到点名名单
      let mergedStudents = students;
      const nextMakeupIds = new Set<string>();
      try {
        const makeupBookings = await makeupBookingService.getByClassDate({
          classId,
          lessonDate,
        });
        if (makeupBookings.length > 0) {
          const formalIds = new Set(students.map((s) => s.id));
          const extra: Student[] = [];
          for (const booking of makeupBookings) {
            nextMakeupIds.add(booking.student_id);
            if (formalIds.has(booking.student_id)) continue;
            try {
              const stu = await studentService.getById(booking.student_id);
              if (stu) {
                extra.push(stu);
                formalIds.add(stu.id);
              }
            } catch (err) {
              logError('load makeup student', err);
            }
          }
          if (extra.length > 0) {
            mergedStudents = [...extra, ...students];
          }
        }
      } catch (err) {
        logError('load makeup bookings', err);
      }
      setMakeupStudentIds(nextMakeupIds);
      setClassStudents(mergedStudents);
      await loadApprovedLeaveStudentIds(mergedStudents);

      // 加载该班级/日期已有点名记录 → 判定是否已点名并回填学员状态（查看模式）
      const existing = await loadLessonRecordsByDate();
      const attendance = buildClassAttendanceState({
        records: existing,
        classId,
        lessonDate,
        studentIds: mergedStudents.map((student) => student.id),
      });
      setExistingClassRecords(attendance.classRecords);
      setIsAlreadyChecked(attendance.hasRecords);
      setCheckedStudentIds(attendance.checkedStudentIds);
      setLeaveStudentIds(attendance.leaveStudentIds);
      setRecordByStudentId(attendance.recordByStudentId);
      setSupplementStudentIds(new Set());
      setAttendanceMode(
        resolveClassAttendanceMode({
          hasRecords: attendance.hasRecords,
          viewOnly: viewOnlyParam,
          lessonDate,
        }),
      );

      const { packages, subjects } = await loadPackageMapsForStudents(mergedStudents, hoursUsed);
      setStudentPackages(packages);
      setStudentSubjects(subjects);
    },
    [
      applyClassTeacherDefaults,
      applyClassLessonDefaults,
      hoursUsed,
      loadApprovedLeaveStudentIds,
      loadLessonRecordsByDate,
      lessonDate,
      teacherOptions,
      viewOnlyParam,
    ],
  );

  // ===== 班级模式：切换班级 =====
  const handleSelectClass = useCallback(
    (classId: string) => {
      loadClassStudents(classId);
    },
    [loadClassStudents],
  );

  // 从课程编辑页返回后刷新班级学员与点名状态（跳过首次进入，避免与初始化重复请求）
  const skipDidShowReloadRef = React.useRef(true);
  useDidShow(() => {
    if (skipDidShowReloadRef.current) {
      skipDidShowReloadRef.current = false;
      return;
    }
    if (mode === 'class' && selectedClassId) {
      void loadClassStudents(selectedClassId);
    }
  });

  useEffect(() => {
    if (mode !== 'class' || classStudents.length === 0) {
      return;
    }

    const syncLeaveStudents = async () => {
      const approvedLeaveIds = await loadApprovedLeaveStudentIds(classStudents);
      // 合并：审批请假 + 已落库记录中的请假，保证请假状态完整展示
      const recordLeaveIds = new Set(
        existingClassRecords
          .filter((record) => record.status === 'leave')
          .map((record) => record.student_id),
      );
      const mergedLeaveIds = new Set<string>([...approvedLeaveIds, ...recordLeaveIds]);
      setLeaveStudentIds(mergedLeaveIds);
      setCheckedStudentIds((prev) => {
        const next = new Set<string>();
        classStudents.forEach((student) => {
          if (mergedLeaveIds.has(student.id)) {
            return;
          }
          if (prev.has(student.id)) {
            next.add(student.id);
          }
        });
        return next;
      });
    };

    void syncLeaveStudents();
  }, [classStudents, existingClassRecords, loadApprovedLeaveStudentIds, mode]);

  const handleBack = useCallback(() => {
    Taro.navigateBack({
      fail: () => {
        void Taro.switchTab({ url: '/pages/schedule/index' });
      },
    });
  }, []);

  const emitScheduleRefreshSignal = useCallback(() => {
    try {
      Taro.setStorageSync(SCHEDULE_REFRESH_SIGNAL_KEY, String(Date.now()));
    } catch (err) {
      logError('emit schedule refresh signal', err);
    }
  }, []);

  const handleSubmitSuccessReturn = useCallback(
    async (
      title: string,
      icon: 'success' | 'none' = 'success',
      duration = 1800,
      options?: { renewSubscribe?: boolean },
    ) => {
      emitScheduleRefreshSignal();
      Taro.showToast({ title, icon, duration });
      // E05：点名成功后底部弹窗补充可发送次数（不阻断返回）
      if (options?.renewSubscribe) {
        try {
          Taro.hideToast();
          await subscribeMessageService.runFlow('E05', {
            campusId: campusId || undefined,
            role: profile?.currentContext?.role,
          });
        } catch (error) {
          logError('subscribe E05 after checkin', error);
        }
      }
      Taro.navigateBack({
        fail: () => {
          void Taro.switchTab({ url: '/pages/schedule/index' });
        },
      });
    },
    [campusId, emitScheduleRefreshSignal, profile?.currentContext?.role],
  );

  // ===== 班级模式：切换签到状态 =====
  /** 切换到指定状态：签到/请假/未到 */
  const handleSetStudentCheckin = useCallback((studentId: string, nextStatus: CheckinStatus) => {
    if (nextStatus === 'checked') {
      setCheckedStudentIds((prev) => {
        const next = new Set(prev);
        next.add(studentId);
        return next;
      });
      setLeaveStudentIds((prev) => {
        const next = new Set(prev);
        next.delete(studentId);
        return next;
      });
    } else if (nextStatus === 'leave') {
      setCheckedStudentIds((prev) => {
        const next = new Set(prev);
        next.delete(studentId);
        return next;
      });
      setLeaveStudentIds((prev) => {
        const next = new Set(prev);
        next.add(studentId);
        return next;
      });
    } else {
      // 未到：从 checked 和 leave 都移除
      setCheckedStudentIds((prev) => {
        const next = new Set(prev);
        next.delete(studentId);
        return next;
      });
      setLeaveStudentIds((prev) => {
        const next = new Set(prev);
        next.delete(studentId);
        return next;
      });
    }
  }, []);

  // ===== 试听学员签到状态切换 =====
  const handleSetTrialCheckin = useCallback((bookingId: string, nextStatus: CheckinStatus) => {
    setTrialCheckinMap((prev) => ({ ...prev, [bookingId]: nextStatus }));
  }, []);

  const presentTrialBookings = useMemo(
    () => trialBookings.filter((b) => trialCheckinMap[b.id] === 'checked'),
    [trialBookings, trialCheckinMap],
  );
  const leaveTrialBookings = useMemo(
    () => trialBookings.filter((b) => trialCheckinMap[b.id] === 'leave'),
    [trialBookings, trialCheckinMap],
  );
  const absentTrialBookings = useMemo(
    () => trialBookings.filter((b) => trialCheckinMap[b.id] === 'absent'),
    [trialBookings, trialCheckinMap],
  );

  // ===== 班级模式：出勤学员 =====
  const presentStudents = useMemo(
    () => classStudents.filter((s) => checkedStudentIds.has(s.id)),
    [classStudents, checkedStudentIds],
  );
  const leaveStudents = useMemo(
    () => classStudents.filter((student) => leaveStudentIds.has(student.id)),
    [classStudents, leaveStudentIds],
  );
  const absentStudents = useMemo(
    () =>
      classStudents.filter(
        (student) => !checkedStudentIds.has(student.id) && !leaveStudentIds.has(student.id),
      ),
    [checkedStudentIds, classStudents, leaveStudentIds],
  );
  const classCheckedCount = presentStudents.length;
  const classLeaveCount = leaveStudents.length;
  const classAbsentCount = absentStudents.length;
  const allSelectableChecked =
    classStudents.length > 0 && classCheckedCount === classStudents.length;

  const addableStudents = useMemo(
    () =>
      allStudents.filter(
        (student) => !classStudents.some((currentStudent) => currentStudent.id === student.id),
      ),
    [allStudents, classStudents],
  );

  useEffect(() => {
    void subjectService
      .getList()
      .then(setSubjectOptions)
      .catch((err) => logError('lesson-form load subjects', err));
  }, []);

  // ===== 图片上传 =====
  const handleUploadImage = useCallback(async () => {
    // 统一流程：chooseMedia + 隐私预检 + 压缩（一次一张），取消静默、失败有 toast
    await runImageUploadFlow({
      currentCount: homeworkImages.length,
      maxCount: 3,
      choose: () => chooseImageTemp({ maxSizeMB: 5, cropScale: '16:9' }),
      upload: async (path) => {
        const result = await uploadService.upload(path, { type: 'courseware' });
        return result.url;
      },
      onSuccess: (url) => setHomeworkImages((prev) => [...prev, url]),
      onUploadingChange: setUploading,
      successToastTitle: '上传成功',
    });
  }, [homeworkImages]);

  const handleRemoveImage = useCallback((index: number) => {
    setHomeworkImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleOpenStudentDetailSheet = useCallback(
    (target: {
      type: 'formal' | 'trial';
      id: string;
      name: string;
      remaining: string;
      deduct: string;
      courseName?: string;
      student?: Student;
    }) => {
      setDetailSheetTarget(target);
      // 预填备注：草稿优先（最新输入），否则取已落库的消课记录备注
      const saved = recordByStudentId.get(target.id)?.note || '';
      setDetailSheetRemark(studentRemarkDrafts[target.id] || saved);
      setShowStudentDetailSheet(true);
    },
    [recordByStudentId, studentRemarkDrafts],
  );

  const handleCloseStudentDetailSheet = useCallback(() => {
    setShowStudentDetailSheet(false);
  }, []);

  const handleTransferStudent = useCallback(
    async (student: Student, targetClassId: string) => {
      if (!selectedClassId) {
        return;
      }
      try {
        await classService.transferStudent(selectedClassId, targetClassId, student.id);
        Taro.showToast({ title: '调班成功', icon: 'success' });
        setClassStudents((prev) => prev.filter((s) => s.id !== student.id));
        setStudentPackages((prev) => {
          const next = new Map(prev);
          next.delete(student.id);
          return next;
        });
        setShowStudentDetailSheet(false);
      } catch (err) {
        logError('transfer student', err);
        Taro.showToast({ title: '调班失败', icon: 'none' });
      }
    },
    [selectedClassId],
  );

  const handleRemoveStudent = useCallback(
    async (student: Student) => {
      if (!selectedClassId) {
        return;
      }
      const res = await Taro.showModal({
        title: '确认移除',
        content: `确定将 ${student.name} 从班级移除吗？`,
        confirmText: '移除',
        confirmColor: '#ef4444',
      });
      if (!res.confirm) {
        return;
      }
      try {
        await classService.removeStudent(selectedClassId, student.id);
        Taro.showToast({ title: '移除成功', icon: 'success' });
        setClassStudents((prev) => prev.filter((s) => s.id !== student.id));
        setStudentPackages((prev) => {
          const next = new Map(prev);
          next.delete(student.id);
          return next;
        });
        setShowStudentDetailSheet(false);
      } catch (err) {
        logError('remove student', err);
        Taro.showToast({ title: '移除失败', icon: 'none' });
      }
    },
    [selectedClassId],
  );

  const handleConfirmAddStudents = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) {
        Taro.showToast({ title: '请选择学员', icon: 'none' });
        return;
      }

      const appendedStudents = addableStudents.filter((student) => ids.includes(student.id));
      if (appendedStudents.length === 0) {
        Taro.showToast({ title: '暂无可添加学员', icon: 'none' });
        return;
      }

      const packageEntries = await Promise.all(
        appendedStudents.map(async (student) => {
          const pkgs = await packageService.getActiveByStudent(student.id);
          const best = pickBestPackage(pkgs, hoursUsed);
          if (!best) {
            return { studentId: student.id, pkg: null, subject: null };
          }

          const subject = best.subject_id ? await subjectService.getById(best.subject_id) : null;
          return { studentId: student.id, pkg: best, subject };
        }),
      );

      setClassStudents((prev) => [...prev, ...appendedStudents]);
      setCheckedStudentIds((prev) => {
        const next = new Set(prev);
        ids.forEach((studentId) => {
          if (!leaveStudentIds.has(studentId)) {
            next.add(studentId);
          }
        });
        return next;
      });
      setStudentPackages((prev) => {
        const next = new Map(prev);
        packageEntries.forEach(({ studentId, pkg }) => {
          if (pkg) {
            next.set(studentId, pkg);
          }
        });
        return next;
      });
      setStudentSubjects((prev) => {
        const next = new Map(prev);
        packageEntries.forEach(({ studentId, pkg, subject }) => {
          if (pkg) {
            next.set(studentId, subject);
          }
        });
        return next;
      });
      setShowAddStudentSheet(false);

      if (addStudentSheetPurpose === 'supplement') {
        setSupplementStudentIds(new Set(ids));
        setAttendanceMode('supplement');
      }
    },
    [addStudentSheetPurpose, addableStudents, hoursUsed, leaveStudentIds],
  );

  const handleToggleSelectAllStudents = useCallback(() => {
    if (allSelectableChecked) {
      setCheckedStudentIds(new Set());
      return;
    }
    setCheckedStudentIds(
      new Set(
        classStudents
          .filter((student) => !leaveStudentIds.has(student.id))
          .map((student) => student.id),
      ),
    );
  }, [allSelectableChecked, classStudents, leaveStudentIds]);

  const getStudentCheckinStatus = useCallback(
    (studentId: string): CheckinStatus => {
      if (leaveStudentIds.has(studentId)) {
        return 'leave';
      }
      if (checkedStudentIds.has(studentId)) {
        return 'checked';
      }
      return 'absent';
    },
    [checkedStudentIds, leaveStudentIds],
  );

  const handleAttendanceSaveSuccess = useCallback(
    async (title: string) => {
      emitScheduleRefreshSignal();
      Taro.showToast({ title, icon: 'success' });
      if (selectedClassId) {
        await loadClassStudents(selectedClassId);
      }
    },
    [emitScheduleRefreshSignal, loadClassStudents, selectedClassId],
  );

  const buildPersistShared = useCallback(
    () => ({
      lessonDate,
      hoursUsed,
      selectedClassId,
      selectedTeachingTeacherId,
      currentTeacherId,
      selectedAssistantTeacherId,
      campusId,
      room,
      content,
      performance,
      homework,
      homeworkImages,
      studentPackages,
      studentSubjects,
      studentRemarkDrafts,
      makeupStudentIds,
      senderId: profile?.id || '',
    }),
    [
      campusId,
      content,
      currentTeacherId,
      homework,
      homeworkImages,
      hoursUsed,
      lessonDate,
      makeupStudentIds,
      performance,
      profile?.id,
      room,
      selectedAssistantTeacherId,
      selectedClassId,
      selectedTeachingTeacherId,
      studentPackages,
      studentRemarkDrafts,
      studentSubjects,
    ],
  );

  const batchSaveUi = useMemo(
    () => ({
      submitLock: submitLockRef.current,
      setSubmitting,
      invalidateStudents,
      currentUserId,
      onSuccess: handleAttendanceSaveSuccess,
    }),
    [currentUserId, handleAttendanceSaveSuccess, invalidateStudents],
  );

  const handleSupplementSave = useCallback(async () => {
    await executeSupplementSave({
      selectedClassId,
      supplementStudentIds,
      checkedStudentIds,
      classStudents,
      hoursUsed,
      getStatus: getStudentCheckinStatus,
      getExistingRecord: (studentId) => recordByStudentId.get(studentId),
      shared: buildPersistShared(),
      operator: {
        id: currentUserId || profile?.id || '',
        name: profile?.name || '未知',
        role: profile?.currentContext?.role || 'unknown',
      },
      ui: batchSaveUi,
    });
  }, [
    batchSaveUi,
    buildPersistShared,
    checkedStudentIds,
    classStudents,
    currentUserId,
    getStudentCheckinStatus,
    hoursUsed,
    profile,
    recordByStudentId,
    selectedClassId,
    supplementStudentIds,
  ]);

  const handleIncrementalEditSave = useCallback(async () => {
    await executeIncrementalEditSave({
      selectedClassId,
      classStudents,
      hoursUsed,
      attendanceBaseline,
      getStatus: getStudentCheckinStatus,
      getExistingRecord: (studentId) => recordByStudentId.get(studentId),
      shared: buildPersistShared(),
      onNoChange: () => setAttendanceMode('view'),
      ui: batchSaveUi,
    });
  }, [
    attendanceBaseline,
    batchSaveUi,
    buildPersistShared,
    classStudents,
    getStudentCheckinStatus,
    hoursUsed,
    recordByStudentId,
    selectedClassId,
  ]);

  const handleSingleSubmit = useCallback(async () => {
    await executeSingleDeduct({
      selectedStudent,
      matchedPackage,
      hoursUsed,
      lessonDate,
      selectedTeachingTeacherId,
      currentTeacherId,
      currentUserId,
      content,
      performance,
      homework,
      homeworkImages,
      campusId,
      room,
      profile,
      submitLock: submitLockRef.current,
      setSubmitting,
      invalidateStudents,
      onSuccess: () => {
        void handleSubmitSuccessReturn('消课成功', 'success', 1800, { renewSubscribe: true });
      },
    });
  }, [
    selectedStudent,
    matchedPackage,
    hoursUsed,
    selectedTeachingTeacherId,
    currentTeacherId,
    currentUserId,
    lessonDate,
    content,
    performance,
    homework,
    homeworkImages,
    profile,
    invalidateStudents,
    handleSubmitSuccessReturn,
    campusId,
    room,
  ]);

  const handleClassSubmit = useCallback(async () => {
    await executeClassSubmit({
      selectedClassId,
      selectedClassName: selectedClass?.name,
      classStudents,
      trialBookings,
      presentStudents,
      leaveStudents,
      absentStudents,
      presentTrialBookings,
      leaveTrialBookings,
      absentTrialBookings,
      classAbsentCount,
      hoursUsed,
      lessonDate,
      selectedTeachingTeacherId,
      currentTeacherId,
      selectedAssistantTeacherId,
      currentUserId,
      content,
      performance,
      homework,
      homeworkImages,
      campusId,
      room,
      studentPackages,
      studentSubjects,
      studentRemarkDrafts,
      trialLeadMap,
      profileId: profile?.id,
      loadLessonRecordsByDate,
      submitLock: submitLockRef.current,
      setSubmitting,
      invalidateStudents,
      onSuccess: (title, icon, duration, options) => {
        void handleSubmitSuccessReturn(title, icon, duration, options);
      },
    });
  }, [
    content,
    currentTeacherId,
    currentUserId,
    homework,
    homeworkImages,
    hoursUsed,
    invalidateStudents,
    handleSubmitSuccessReturn,
    lessonDate,
    loadLessonRecordsByDate,
    leaveStudents,
    absentStudents,
    performance,
    classStudents,
    presentStudents,
    profile?.id,
    selectedAssistantTeacherId,
    selectedClass?.name,
    selectedClassId,
    selectedTeachingTeacherId,
    classAbsentCount,
    studentPackages,
    studentRemarkDrafts,
    studentSubjects,
    trialBookings,
    presentTrialBookings,
    leaveTrialBookings,
    absentTrialBookings,
    trialLeadMap,
    campusId,
    room,
  ]);

  const handleSubmit = useCallback(() => {
    const kind = resolveLessonSubmitKind({
      isEditEntryAttempt,
      mode,
      isAlreadyChecked,
      attendanceMode,
    });
    if (kind === 'blocked-edit') {
      Taro.showToast({ title: '历史消课记录不支持编辑', icon: 'none' });
      return;
    }
    if (kind === 'single') {
      void handleSingleSubmit();
      return;
    }
    if (kind === 'supplement') {
      void handleSupplementSave();
      return;
    }
    if (kind === 'edit') {
      void handleIncrementalEditSave();
      return;
    }
    void handleClassSubmit();
  }, [
    attendanceMode,
    handleClassSubmit,
    handleIncrementalEditSave,
    handleSingleSubmit,
    handleSupplementSave,
    isAlreadyChecked,
    isEditEntryAttempt,
    mode,
  ]);

  // ===== 提交按钮文案 =====
  const submitText = useMemo(() => {
    if (mode === 'single') {
      if (!selectedStudent || !matchedPackage) return '确认消课';
      const isOwe = matchedPackage.remaining_hours < hoursUsed;
      return isOwe ? `确认消课（欠课${hoursUsed}课时）` : `确认消课 ${hoursUsed}课时`;
    }
    const totalPresent = presentStudents.length + presentTrialBookings.length;
    if (totalPresent === 0) return '确认消课';
    return `确认消课 ${totalPresent}人×${hoursUsed}课时`;
  }, [
    matchedPackage,
    mode,
    presentStudents.length,
    presentTrialBookings.length,
    selectedStudent,
    hoursUsed,
  ]);

  // ===== 班级学员签到状态映射（给卡片用） =====
  const studentCheckinStatusMap = useMemo(() => {
    const map: Record<string, CheckinStatus> = {};
    classStudents.forEach((stu) => {
      if (leaveStudentIds.has(stu.id)) {
        map[stu.id] = 'leave';
      } else if (checkedStudentIds.has(stu.id)) {
        map[stu.id] = 'checked';
      } else {
        map[stu.id] = 'absent';
      }
    });
    return map;
  }, [classStudents, checkedStudentIds, leaveStudentIds]);

  /** 过滤后的正式学员列表（搜索+考勤筛选） */
  const filteredClassStudents = useMemo(() => {
    let result = classStudents;
    const keyword = studentSearchKeyword.trim().toLowerCase();
    if (keyword) {
      result = result.filter((stu) => stu.name.toLowerCase().includes(keyword));
    }
    if (attendanceFilter !== 'all') {
      result = result.filter((stu) => {
        const status = studentCheckinStatusMap[stu.id] || 'absent';
        return attendanceFilter === 'absent'
          ? status === 'absent' || status === 'leave'
          : status === attendanceFilter;
      });
    }
    return result;
  }, [attendanceFilter, classStudents, studentCheckinStatusMap, studentSearchKeyword]);

  /** 过滤后的试听学员列表（搜索+考勤筛选） */
  const filteredTrialBookings = useMemo(() => {
    let result = trialBookings;
    const keyword = studentSearchKeyword.trim().toLowerCase();
    if (keyword) {
      result = result.filter((booking) => {
        const lead = trialLeadMap[booking.lead_id];
        return (lead?.child_name || '').toLowerCase().includes(keyword);
      });
    }
    if (attendanceFilter !== 'all') {
      result = result.filter((booking) => {
        const status = trialCheckinMap[booking.id] || 'absent';
        return attendanceFilter === 'absent'
          ? status === 'absent' || status === 'leave'
          : status === attendanceFilter;
      });
    }
    return result;
  }, [attendanceFilter, trialBookings, trialLeadMap, studentSearchKeyword, trialCheckinMap]);

  /** 合并学员列表：试听优先 */
  const mergedStudentList = useMemo(() => {
    const trials = filteredTrialBookings.map((booking) => ({
      type: 'trial' as const,
      id: booking.id,
      booking,
      name: trialLeadMap[booking.lead_id]?.child_name || '未知学员',
    }));
    const formals = filteredClassStudents.map((student) => ({
      type: 'formal' as const,
      id: student.id,
      student,
    }));
    return [...trials, ...formals];
  }, [filteredClassStudents, filteredTrialBookings, trialLeadMap]);

  /** 试听课剩余/扣课显示 */
  const getTrialCardInfo = useCallback(() => {
    return { remaining: '试听', deduct: '0课时' };
  }, []);

  /** 学员扣课/剩余/课程显示 */
  const getStudentCardInfo = useCallback(
    (student: Student) => {
      const pkg = studentPackages.get(student.id);
      if (!pkg) {
        return { courseName: '无课包', remaining: '无课包', deduct: '0课时' };
      }
      const remainingText =
        pkg.expiry_date && !pkg.remaining_hours
          ? `${Math.max(0, Math.ceil((new Date(pkg.expiry_date).getTime() - Date.now()) / 86400000))}天`
          : `${pkg.remaining_hours}课时`;
      const subject = studentSubjects.get(student.id);
      return {
        courseName: subject?.name || pkg.name || '未命名课程',
        remaining: remainingText,
        deduct: `${hoursUsed}课时`,
      };
    },
    [hoursUsed, studentPackages, studentSubjects],
  );

  return (
    <PageContainer safeBottom>
      <View className="min-h-screen bg-background pb-28">
        <LessonFormHeader
          mode={mode}
          pageTitle={pageTitle}
          selectedClassName={selectedClass?.name}
          shouldShowModeTabs={shouldShowModeTabs}
          onBack={handleBack}
          onModeChange={setMode}
        />

        {/* ====== 单人模式 ====== */}
        {mode === 'single' && (
          <SingleLessonPanel
            selectedStudent={selectedStudent}
            studentActivePackages={studentActivePackages}
            matchedPackage={matchedPackage}
            matchedSubject={matchedSubject}
            hoursUsed={hoursUsed}
            lessonDate={lessonDate}
            lessonTime={lessonTime}
            campusId={campusId}
            campusOptions={campusOptions}
            room={room}
            selectedTeachingTeacher={selectedTeachingTeacher}
            profileName={profile?.name}
            content={content}
            performance={performance}
            homework={homework}
            homeworkImages={homeworkImages}
            uploading={uploading}
            onOpenStudentPicker={() => void handleOpenStudentPicker()}
            onOpenPackageSelector={() => setSelector({ visible: true, type: 'package' })}
            onOpenTeacherSelector={() => setSelector({ visible: true, type: 'teacher' })}
            onHoursChange={setHoursUsed}
            onOpenDatePicker={() => setLessonDatePickerVisible(true)}
            onLessonTimeChange={setLessonTime}
            onOpenCampusSelector={() => setSelector({ visible: true, type: 'campus' })}
            onOpenRoomSelector={() => setSelector({ visible: true, type: 'room' })}
            onContentChange={setContent}
            onPerformanceChange={setPerformance}
            onHomeworkChange={setHomework}
            onRemoveImage={handleRemoveImage}
            onUploadImage={handleUploadImage}
          />
        )}

        {/* ====== 班级模式 ====== */}
        {mode === 'class' && (
          <ClassLessonPanel
            selectedClassId={selectedClassId}
            selectedClass={selectedClass}
            classes={classes}
            scheduledClassIds={scheduledClassIds}
            isClassDirectEntry={isClassDirectEntry}
            displayLessonTime={displayLessonTime}
            lessonDate={lessonDate}
            selectedTeachingTeacher={selectedTeachingTeacher}
            selectedAssistantTeacher={selectedAssistantTeacher}
            profileName={profile?.name}
            homework={homework}
            isAlreadyChecked={isAlreadyChecked}
            canEditClass={canEditClass}
            isClassPaused={isClassPaused}
            studentSearchKeyword={studentSearchKeyword}
            hoursUsed={hoursUsed}
            feeAmount={feeAmount}
            attendanceFilter={attendanceFilter}
            classCheckedCount={classCheckedCount}
            classLeaveCount={classLeaveCount}
            classAbsentCount={classAbsentCount}
            mergedStudentList={mergedStudentList}
            trialCheckinMap={trialCheckinMap}
            studentCheckinStatusMap={studentCheckinStatusMap}
            makeupStudentIds={makeupStudentIds}
            supplementStudentIds={supplementStudentIds}
            studentRemarkDrafts={studentRemarkDrafts}
            recordByStudentId={recordByStudentId}
            onHomeworkChange={setHomework}
            onToggleClassPause={() => void handleToggleClassPause()}
            onSelectClass={handleSelectClass}
            onStudentSearchChange={setStudentSearchKeyword}
            onHoursChange={setHoursUsed}
            onFeeAmountChange={setFeeAmount}
            onAttendanceFilterChange={setAttendanceFilter}
            onOpenAddStudentSheet={handleOpenAddStudentSheet}
            getTrialCardInfo={getTrialCardInfo}
            getStudentCardInfo={getStudentCardInfo}
            isStudentCardDisabled={isStudentCardDisabled}
            onSetTrialCheckin={handleSetTrialCheckin}
            onSetStudentCheckin={handleSetStudentCheckin}
            onOpenStudentDetailSheet={handleOpenStudentDetailSheet}
          />
        )}

        {/* ====== 学员选择弹窗：与课程管理 ClassStudentsCard「选择上课学员」同款 ====== */}
        <StudentMultiSelectSheet
          visible={showStudentPicker}
          students={allStudents}
          selectedIds={selectedStudent ? [selectedStudent.id] : []}
          subjects={subjectOptions}
          maxSelectable={1}
          showUnscheduledFilter
          title="选择上课学员"
          onClose={() => setShowStudentPicker(false)}
          onConfirm={handleConfirmSingleStudent}
        />

        <StudentMultiSelectSheet
          visible={showAddStudentSheet}
          students={addableStudents}
          selectedIds={[]}
          subjects={subjectOptions}
          subjectId={selectedClass?.subject_id}
          title={addStudentSheetPurpose === 'supplement' ? '选择补录学员' : '添加学员到点名名单'}
          onClose={() => setShowAddStudentSheet(false)}
          onConfirm={(ids) => void handleConfirmAddStudents(ids)}
        />

        {/* ====== 学员编辑弹窗 ====== */}
        <StudentEditSheet
          visible={showStudentDetailSheet}
          target={detailSheetTarget}
          remark={detailSheetRemark}
          classes={classes}
          selectedClassId={selectedClassId}
          onRemarkChange={setDetailSheetRemark}
          onClose={handleCloseStudentDetailSheet}
          onTransfer={handleTransferStudent}
          onRemove={handleRemoveStudent}
          onConfirm={async () => {
            if (!detailSheetTarget) {
              return;
            }
            const remark = detailSheetRemark.trim();
            const studentId = detailSheetTarget.id;

            // 统一先落草稿（作为 UI 呈现与提交携带的唯一事实源）
            setStudentRemarkDrafts((prev) => ({ ...prev, [studentId]: remark }));

            // 试听学员：仅暂存草稿，随下次提交点名写入记录
            if (detailSheetTarget.type === 'trial') {
              Taro.showToast({ title: remark ? '备注已保存' : '备注已清除', icon: 'success' });
              return;
            }

            // 正式学员：已有点名记录 → 立即写入消课记录
            const record = recordByStudentId.get(studentId);
            if (record) {
              try {
                await lessonRecordService.update(record.id, {
                  note: remark || undefined,
                });
                // 同步本地记录，保证卡片备注即时呈现
                setRecordByStudentId((prev) => {
                  const next = new Map(prev);
                  const current = next.get(studentId);
                  if (current) {
                    next.set(studentId, { ...current, note: remark || undefined });
                  }
                  return next;
                });
                Taro.showToast({ title: '备注已保存', icon: 'success' });
              } catch (err) {
                logError('save student remark', err);
                Taro.showToast({ title: '备注保存失败，请重试', icon: 'none' });
              }
              return;
            }

            // 尚无考勤记录：草稿已在提交点名时随 create 写入
            Taro.showToast({ title: '已保存，提交点名后生效', icon: 'none' });
          }}
        />

        {/* ====== 底部操作栏 ====== */}
        <LessonFormFooter
          mode={mode}
          attendanceMode={attendanceMode}
          allSelectableChecked={allSelectableChecked}
          isAlreadyChecked={isAlreadyChecked}
          canModifyLesson={canModifyLesson}
          submitting={submitting}
          supplementStudentIdsSize={supplementStudentIds.size}
          selectedClassId={selectedClassId}
          isClassPaused={isClassPaused}
          selectedStudent={Boolean(selectedStudent)}
          submitText={submitText}
          onToggleSelectAllStudents={handleToggleSelectAllStudents}
          onOpenSupplementSheet={handleOpenSupplementSheet}
          onEnterEditMode={handleEnterEditMode}
          onCancelSupplement={handleCancelSupplement}
          onSubmit={handleSubmit}
        />
      </View>

      {/* 统一弹窗选择器（PickerSheet 标准组件） */}
      <PickerSheet
        visible={selector.visible}
        title={
          selector.type === 'teacher'
            ? '选择主讲老师'
            : selector.type === 'campus'
              ? '选择校区'
              : selector.type === 'package'
                ? '选择消课课包'
                : '选择教室'
        }
        options={
          selector.type === 'teacher'
            ? teacherOptions.map((t): PickerOption => ({ label: t.name, value: t.id }))
            : selector.type === 'campus'
              ? [
                  { label: '请选择', value: '' },
                  ...campusOptions.map((c): PickerOption => ({ label: c.name, value: c.id })),
                ]
              : selector.type === 'package'
                ? studentActivePackages.map(
                    (p): PickerOption => ({
                      label: `${p.name}（剩 ${p.remaining_hours} 课时）`,
                      value: p.id,
                    }),
                  )
                : [
                    { label: '请选择', value: '' },
                    ...rooms
                      .filter((r) => r.status === 'active')
                      .map((r): PickerOption => ({ label: r.name, value: r.name })),
                  ]
        }
        value={
          selector.type === 'teacher'
            ? selectedTeachingTeacherId
            : selector.type === 'campus'
              ? campusId
              : selector.type === 'package'
                ? matchedPackage?.id || ''
                : room
        }
        onClose={() => setSelector((prev) => ({ ...prev, visible: false }))}
        onConfirm={(v) => {
          if (selector.type === 'teacher') setSelectedTeachingTeacherId(v);
          else if (selector.type === 'campus') {
            setCampusId(v);
            setRoom('');
          } else if (selector.type === 'package') {
            void handlePickPackage(v);
          } else setRoom(v);
          setSelector((prev) => ({ ...prev, visible: false }));
        }}
      />

      <DatePickerSheet
        visible={lessonDatePickerVisible}
        title="选择上课日期"
        value={lessonDate}
        onClose={() => setLessonDatePickerVisible(false)}
        onConfirm={(date) => {
          setLessonDate(date);
          setLessonDatePickerVisible(false);
        }}
      />
    </PageContainer>
  );
};

export default withRouteGuard(LessonForm);
