import { View, Text, Input, Picker, Textarea, Image } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import cn from 'classnames';
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { createSubmitLock } from '@/utils/submit-lock';
import ActionButton from '@/components/ActionButton';
import Card from '@/components/Card';
import DatePickerSheet from '@/components/DatePickerSheet';
import FormRow from '@/components/FormRow';
import Icon from '@/components/Icon';
import ClassSelector from '@/components/lesson/ClassSelector';
import PageContainer from '@/components/PageContainer';
import PickerSheet, { PickerOption } from '@/components/PickerSheet';
import StarRating from '@/components/StarRating';
import Stepper from '@/components/Stepper';
import StudentAvatar from '@/components/student/StudentAvatar';
import StudentMultiSelectSheet from '@/components/StudentMultiSelectSheet';
import {
  studentService,
  packageService,
  lessonRecordService,
  leaveService,
  notificationService,
  classService,
  subjectService,
  uploadService,
  teacherService,
  leadService,
  subscribeMessageService,
  makeupBookingService,
} from '@/services';
import { auditLogService } from '@/services/audit-log';
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
import { CheckinCard } from './CheckinCard';
import {
  buildCheckinBaseline,
  CHECKIN_OPTION_STYLES,
  type CheckinStatus,
  type ClassAttendanceMode,
} from './checkin-status';
import StudentEditSheet from './StudentEditSheet';
/** 格式化日期为 YYYY-MM-DD */
function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 格式化时间为 HH:mm */
function formatTime(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function isDateWithinRange(targetDate: string, startDate?: string, endDate?: string) {
  if (!targetDate || !startDate) {
    return false;
  }
  const end = endDate || startDate;
  return targetDate >= startDate && targetDate <= end;
}

/** 根据日期返回星期几 */
function getWeekday(dateStr: string): string {
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return weekdays[date.getDay()];
}

const SCHEDULE_REFRESH_SIGNAL_KEY = 'yunce:schedule:refresh';
const FORM_CARD_CLASS_NAME = 'mx-[24rpx] mb-3 overflow-hidden rounded-[20rpx] bg-white shadow-soft';
/** 上课日起 30 天内可补录 / 修改；超时仅查看 */
const LESSON_OPERATE_WINDOW_DAYS = 30;

function isWithinLessonOperateWindow(lessonDateStr: string, now = new Date()): boolean {
  if (!lessonDateStr) return true;
  const lesson = new Date(`${lessonDateStr}T00:00:00`);
  if (Number.isNaN(lesson.getTime())) return true;
  const earliest = new Date(now);
  earliest.setHours(0, 0, 0, 0);
  earliest.setDate(earliest.getDate() - LESSON_OPERATE_WINDOW_DAYS);
  return lesson.getTime() >= earliest.getTime();
}

function getLessonRecordPriority(record?: LessonRecord): number {
  if (!record) {
    return 0;
  }
  switch (record.status) {
    case 'normal':
    case 'makeup':
      return 4;
    case 'leave':
    case 'absent':
      return 3;
    case 'cancelled':
      return 2;
    default:
      return 1;
  }
}

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
      if (!lessonDate || students.length === 0) {
        const emptySet = new Set<string>();
        setLeaveStudentIds(emptySet);
        return emptySet;
      }

      const leaveList = await leaveService.getByTeacher(currentTeacherId);
      const classStudentIds = new Set(students.map((student) => student.id));
      const nextLeaveStudentIds = new Set(
        leaveList
          .filter(
            (leave) =>
              leave.status === 'approved' &&
              classStudentIds.has(leave.student_id) &&
              isDateWithinRange(lessonDate, leave.original_date, leave.end_date),
          )
          .map((leave) => leave.student_id),
      );
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
      const trialStudentIds = new Set(classBookings.map((b) => b.trial_student_id));
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
      const trialRecords = trialExisting.filter(
        (record) =>
          record.class_id === selectedClassId &&
          record.lesson_date === lessonDate &&
          trialStudentIds.has(record.student_id),
      );
      const initMap: Record<string, CheckinStatus> = {};
      classBookings.forEach((b) => {
        const matched = trialRecords.find((r) => r.student_id === b.trial_student_id);
        if (matched) {
          initMap[b.id] =
            matched.status === 'leave'
              ? 'leave'
              : matched.status && !['absent', 'cancelled'].includes(matched.status)
                ? 'checked'
                : 'absent';
        } else {
          initMap[b.id] = 'absent';
        }
      });
      setTrialCheckinMap(initMap);
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
        const classRecords = existingRecords.filter(
          (record) =>
            record.class_id === classIdParam &&
            record.lesson_date === lessonDate &&
            students.some((student) => student.id === record.student_id),
        );
        setExistingClassRecords(classRecords);
        const nextChecked = new Set<string>();
        const nextLeave = new Set<string>();
        classRecords.forEach((record) => {
          if (record.status === 'leave') {
            nextLeave.add(record.student_id);
          } else if (record.status && !['absent', 'cancelled'].includes(record.status)) {
            nextChecked.add(record.student_id);
          }
        });
        const hasRecords = classRecords.length > 0;
        setIsAlreadyChecked(hasRecords);
        setCheckedStudentIds(nextChecked);
        setLeaveStudentIds(nextLeave);
        const nextRecordMap = new Map<string, LessonRecord>();
        classRecords.forEach((record) => {
          const current = nextRecordMap.get(record.student_id);
          if (getLessonRecordPriority(record) >= getLessonRecordPriority(current)) {
            nextRecordMap.set(record.student_id, record);
          }
        });
        setRecordByStudentId(nextRecordMap);
        setSupplementStudentIds(new Set());
        // 超时 / viewOnly：即使未点名也只读；窗口内未点名可正常提交
        const canOperate = !viewOnlyParam && isWithinLessonOperateWindow(lessonDate);
        setAttendanceMode(hasRecords || !canOperate ? 'view' : 'normal');

        // 为每个学员匹配课包
        const pkgMap = new Map<string, CoursePackage>();
        const subMap = new Map<string, Subject | null>();
        for (const stu of students) {
          const pkgs = await packageService.getActiveByStudent(stu.id);
          const best = pickBestPackage(pkgs, hoursUsed);
          if (best) {
            pkgMap.set(stu.id, best);
            if (best.subject_id) {
              const sub = await subjectService.getById(best.subject_id);
              subMap.set(stu.id, sub);
            } else {
              subMap.set(stu.id, null);
            }
          }
        }
        setStudentPackages(pkgMap);
        setStudentSubjects(subMap);
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
      const classRecords = existing.filter(
        (record) =>
          record.class_id === classId &&
          record.lesson_date === lessonDate &&
          mergedStudents.some((student) => student.id === record.student_id),
      );
      setExistingClassRecords(classRecords);
      const nextChecked = new Set<string>();
      const nextLeave = new Set<string>();
      classRecords.forEach((record) => {
        if (record.status === 'leave') {
          nextLeave.add(record.student_id);
        } else if (record.status && !['absent', 'cancelled'].includes(record.status)) {
          nextChecked.add(record.student_id);
        }
      });
      const hasRecords = classRecords.length > 0;
      setIsAlreadyChecked(hasRecords);
      setCheckedStudentIds(nextChecked);
      setLeaveStudentIds(nextLeave);
      const nextRecordMap = new Map<string, LessonRecord>();
      classRecords.forEach((record) => {
        const current = nextRecordMap.get(record.student_id);
        if (getLessonRecordPriority(record) >= getLessonRecordPriority(current)) {
          nextRecordMap.set(record.student_id, record);
        }
      });
      setRecordByStudentId(nextRecordMap);
      setSupplementStudentIds(new Set());
      // 已点名 → 查看；未点名且在 30 天窗口内 → 正常点名；超时 → 仅查看
      const canOperate = !viewOnlyParam && isWithinLessonOperateWindow(lessonDate);
      setAttendanceMode(hasRecords || !canOperate ? 'view' : 'normal');

      // 为每个学员匹配课包
      const pkgMap = new Map<string, CoursePackage>();
      const subMap = new Map<string, Subject | null>();
      for (const stu of mergedStudents) {
        const pkgs = await packageService.getActiveByStudent(stu.id);
        const best = pickBestPackage(pkgs, hoursUsed);
        if (best) {
          pkgMap.set(stu.id, best);
          if (best.subject_id) {
            const sub = await subjectService.getById(best.subject_id);
            subMap.set(stu.id, sub);
          } else {
            subMap.set(stu.id, null);
          }
        }
      }
      setStudentPackages(pkgMap);
      setStudentSubjects(subMap);
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

  const persistStudentAttendanceRecord = useCallback(
    async (
      student: Student,
      status: CheckinStatus,
      options: { isSupplement?: boolean } = {},
    ): Promise<void> => {
      const existingRecord = recordByStudentId.get(student.id);
      if (existingRecord) {
        await lessonRecordService.remove(existingRecord.id);
      }

      const lessonDateValue = lessonDate;
      const basePayload = {
        teacher_id: selectedTeachingTeacherId || currentTeacherId,
        operator_teacher_id: currentTeacherId || selectedTeachingTeacherId,
        assistant_teacher_id: selectedAssistantTeacherId || undefined,
        student_id: student.id,
        class_id: selectedClassId,
        lesson_date: lessonDateValue,
        campus_id: campusId || undefined,
        room: room || undefined,
      };

      if (status === 'checked') {
        const pkg = studentPackages.get(student.id);
        if (!pkg) {
          throw new Error(`${student.name}：无可用课包`);
        }

        const studentSubject = studentSubjects.get(student.id);
        const isCrossSubject =
          !!pkg.subject_id && !!studentSubject && pkg.subject_id !== studentSubject.id;

        const createdRecord = await lessonRecordService.create({
          ...basePayload,
          package_id: pkg.id,
          hours_used: hoursUsed,
          status: options.isSupplement || makeupStudentIds.has(student.id) ? 'makeup' : 'normal',
          is_cross_subject: isCrossSubject || undefined,
          package_subject: isCrossSubject ? pkg.name : undefined,
          class_subject: isCrossSubject ? studentSubject?.name : undefined,
          content: options.isSupplement ? '补录签到' : content.trim() || undefined,
          // 单学员备注：草稿优先，其次保留原记录的备注（增量编辑时记录被 remove 重建，不能丢）
          note: studentRemarkDrafts[student.id] || existingRecord?.note || undefined,
          performance: performance > 0 ? `${performance}星` : undefined,
          homework: homework.trim() || undefined,
          homework_images: homeworkImages.length > 0 ? homeworkImages : undefined,
        });

        const parents = await studentService.getParents(student.id);
        for (const binding of parents) {
          await notificationService.send({
            sender_id: profile?.id || '',
            receiver_id: binding.parent_id,
            title: options.isSupplement
              ? `${student.name} 已补录签到`
              : `${student.name} 课时已核销`,
            content: options.isSupplement
              ? `${lessonDateValue} 已补录 ${hoursUsed} 课时，剩余 ${
                  createdRecord.remaining_hours ?? Math.max(pkg.remaining_hours - hoursUsed, 0)
                } 课时`
              : `本次核销 ${hoursUsed} 课时，剩余 ${
                  createdRecord.remaining_hours ?? Math.max(pkg.remaining_hours - hoursUsed, 0)
                } 课时`,
            related_id: student.id,
          });
        }
        return;
      }

      if (status === 'leave') {
        await lessonRecordService.create({
          ...basePayload,
          package_id: '',
          hours_used: 0,
          status: 'leave',
          content: options.isSupplement ? '补录请假' : '家长已请假，本节课自动记为请假',
          note: studentRemarkDrafts[student.id] || existingRecord?.note || undefined,
        });
        return;
      }

      await lessonRecordService.create({
        ...basePayload,
        package_id: '',
        hours_used: 0,
        status: 'absent',
        content: options.isSupplement ? '补录未到' : '点名未到，待老师后续补录签到',
        note: studentRemarkDrafts[student.id] || existingRecord?.note || undefined,
      });
    },
    [
      campusId,
      content,
      currentTeacherId,
      homework,
      homeworkImages,
      hoursUsed,
      lessonDate,
      performance,
      profile?.id,
      recordByStudentId,
      room,
      selectedAssistantTeacherId,
      selectedClassId,
      selectedTeachingTeacherId,
      studentPackages,
      studentRemarkDrafts,
      studentSubjects,
      makeupStudentIds,
    ],
  );

  const handleSupplementSave = useCallback(async () => {
    if (!selectedClassId) {
      Taro.showToast({ title: '请选择班级', icon: 'none' });
      return;
    }
    if (supplementStudentIds.size === 0) {
      Taro.showToast({ title: '请先补录学员', icon: 'none' });
      return;
    }
    if (hoursUsed <= 0) {
      Taro.showToast({ title: '消课课时必须大于0', icon: 'none' });
      return;
    }

    const supplementStudents = classStudents.filter((student) =>
      supplementStudentIds.has(student.id),
    );
    const checkedCount = supplementStudents.filter((student) =>
      checkedStudentIds.has(student.id),
    ).length;

    const confirmResult = await Taro.showModal({
      title: '确认补录',
      content: `将为 ${supplementStudents.length} 名学员追加本节课记录（签到 ${checkedCount} 人），不影响原有已点名学员。`,
      confirmText: '保存补录',
      confirmColor: '#3B6EF5',
    });
    if (!confirmResult.confirm) {
      return;
    }

    if (!submitLockRef.current.tryAcquire()) return;
    setSubmitting(true);
    const successNames: string[] = [];
    const failList: { name: string; reason: string }[] = [];

    try {
      for (const student of supplementStudents) {
        const status = getStudentCheckinStatus(student.id);
        try {
          await persistStudentAttendanceRecord(student, status, { isSupplement: true });
          successNames.push(student.name);
        } catch (error) {
          logError('supplement single student', error);
          failList.push({
            name: student.name,
            reason: error instanceof Error ? error.message : '补录失败',
          });
        }
      }

      if (successNames.length > 0) {
        try {
          await auditLogService.record({
            action: 'lesson.record',
            operatorId: currentUserId || profile?.id || '',
            operatorName: profile?.name || '未知',
            operatorRole: profile?.currentContext?.role || 'unknown',
            targetType: 'lesson_record',
            detail: `补录签到：${successNames.join('、')}`,
            meta: { count: successNames.length, names: successNames, hours: hoursUsed },
          });
        } catch (error) {
          logError('audit supplement lesson.record', error);
        }
        invalidateStudents(currentUserId);
      }

      if (failList.length === 0) {
        await handleAttendanceSaveSuccess(`已补录 ${successNames.length} 人`);
      } else if (successNames.length === 0) {
        Taro.showToast({ title: failList[0]?.reason || '补录失败', icon: 'none' });
      } else {
        Taro.showToast({
          title: `${successNames.length}人成功，${failList.length}人失败`,
          icon: 'none',
          duration: 3000,
        });
        await handleAttendanceSaveSuccess(`已补录 ${successNames.length} 人`);
      }
    } catch (error) {
      logError('handleSupplementSave', error);
      Taro.showToast({ title: '补录失败，请重试', icon: 'none' });
    } finally {
      submitLockRef.current.release();
      setSubmitting(false);
    }
  }, [
    checkedStudentIds,
    classStudents,
    currentUserId,
    getStudentCheckinStatus,
    handleAttendanceSaveSuccess,
    hoursUsed,
    invalidateStudents,
    persistStudentAttendanceRecord,
    profile,
    selectedClassId,
    supplementStudentIds,
  ]);

  const handleIncrementalEditSave = useCallback(async () => {
    if (!selectedClassId) {
      Taro.showToast({ title: '请选择班级', icon: 'none' });
      return;
    }
    if (hoursUsed <= 0) {
      Taro.showToast({ title: '消课课时必须大于0', icon: 'none' });
      return;
    }

    const changedStudents = classStudents.filter((student) => {
      const currentStatus = getStudentCheckinStatus(student.id);
      const baselineStatus = attendanceBaseline.get(student.id) || 'absent';
      return currentStatus !== baselineStatus;
    });

    if (changedStudents.length === 0) {
      Taro.showToast({ title: '暂无变更', icon: 'none' });
      setAttendanceMode('view');
      return;
    }

    const confirmResult = await Taro.showModal({
      title: '确认保存修改',
      content: `将更新 ${changedStudents.length} 名学员的本节课出勤记录，不影响未变更学员。`,
      confirmText: '保存修改',
      confirmColor: '#2563eb',
    });
    if (!confirmResult.confirm) {
      return;
    }

    if (!submitLockRef.current.tryAcquire()) return;
    setSubmitting(true);
    const successNames: string[] = [];
    const failList: { name: string; reason: string }[] = [];

    try {
      for (const student of changedStudents) {
        const status = getStudentCheckinStatus(student.id);
        try {
          await persistStudentAttendanceRecord(student, status);
          successNames.push(student.name);
        } catch (error) {
          logError('incremental edit single student', error);
          failList.push({
            name: student.name,
            reason: error instanceof Error ? error.message : '保存失败',
          });
        }
      }

      if (successNames.length > 0) {
        invalidateStudents(currentUserId);
      }

      if (failList.length === 0) {
        await handleAttendanceSaveSuccess(`已更新 ${successNames.length} 人`);
      } else if (successNames.length === 0) {
        Taro.showToast({ title: failList[0]?.reason || '保存失败', icon: 'none' });
      } else {
        Taro.showToast({
          title: `${successNames.length}人成功，${failList.length}人失败`,
          icon: 'none',
          duration: 3000,
        });
        await handleAttendanceSaveSuccess(`已更新 ${successNames.length} 人`);
      }
    } catch (error) {
      logError('handleIncrementalEditSave', error);
      Taro.showToast({ title: '保存失败，请重试', icon: 'none' });
    } finally {
      submitLockRef.current.release();
      setSubmitting(false);
    }
  }, [
    attendanceBaseline,
    classStudents,
    currentUserId,
    getStudentCheckinStatus,
    handleAttendanceSaveSuccess,
    hoursUsed,
    invalidateStudents,
    persistStudentAttendanceRecord,
    selectedClassId,
  ]);
  const handleSingleSubmit = useCallback(async () => {
    if (!selectedStudent) {
      Taro.showToast({ title: '请选择学生', icon: 'none' });
      return;
    }
    if (!matchedPackage) {
      Taro.showToast({ title: '没有可用课包', icon: 'none' });
      return;
    }
    if (hoursUsed <= 0) {
      Taro.showToast({ title: '消课课时必须大于0', icon: 'none' });
      return;
    }

    if (!submitLockRef.current.tryAcquire()) return;
    setSubmitting(true);
    try {
      const lessonDateValue = lessonDate;

      // 单人快速消课无班级上下文，不存在「课包科目与班级不一致」
      const createdRecord = await lessonRecordService.create({
        teacher_id: selectedTeachingTeacherId || currentTeacherId,
        operator_teacher_id: currentTeacherId || selectedTeachingTeacherId,
        student_id: selectedStudent.id,
        package_id: matchedPackage.id,
        lesson_date: lessonDateValue,
        hours_used: hoursUsed,
        content: content.trim() || undefined,
        performance: performance > 0 ? `${performance}星` : undefined,
        homework: homework.trim() || undefined,
        homework_images: homeworkImages.length > 0 ? homeworkImages : undefined,
        campus_id: campusId || undefined,
        room: room || undefined,
      });

      const parents = await studentService.getParents(selectedStudent.id);
      for (const binding of parents) {
        await notificationService.send({
          sender_id: profile?.id || '',
          receiver_id: binding.parent_id,
          title: `${selectedStudent.name} 课时已消课`,
          content: `本次消课 ${hoursUsed} 课时，剩余 ${createdRecord.remaining_hours ?? Math.max(matchedPackage.remaining_hours - hoursUsed, 0)} 课时`,
          related_id: selectedStudent.id,
        });
      }

      invalidateStudents(currentUserId);
      // 审计日志（用户口径 2026-08-22）：单人消课属重要日志
      try {
        await auditLogService.record({
          action: 'lesson.record',
          operatorId: currentUserId || profile?.id || '',
          operatorName: profile?.name || '未知',
          operatorRole: profile?.currentContext?.role || 'unknown',
          targetType: 'lesson_record',
          targetId: createdRecord.id,
          detail: `单人消课：学员「${selectedStudent.name}」消课 ${hoursUsed} 课时（课包「${matchedPackage?.name || matchedPackage.id}」）`,
          meta: {
            studentId: selectedStudent.id,
            studentName: selectedStudent.name,
            packageId: matchedPackage.id,
            hours: hoursUsed,
          },
        });
      } catch (e) {
        logError('audit lesson.record', e);
      }
      // （预警提醒走首页待办事项：扣课时后剩余降到阈值 → 首页「课时续费提醒」待办，手动点已读）
      handleSubmitSuccessReturn('消课成功', 'success', 1800, { renewSubscribe: true });
    } catch (err) {
      logError('submit lesson', err);
      Taro.showToast({ title: '提交失败，请重试', icon: 'none' });
    } finally {
      submitLockRef.current.release();
      setSubmitting(false);
    }
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

  // ===== 班级模式：提交点名 =====
  const handleClassSubmit = useCallback(async () => {
    if (!selectedClassId) {
      Taro.showToast({ title: '请选择班级', icon: 'none' });
      return;
    }
    if (classStudents.length === 0 && trialBookings.length === 0) {
      Taro.showToast({ title: '班级内暂无学员', icon: 'none' });
      return;
    }
    if (hoursUsed <= 0) {
      Taro.showToast({ title: '消课课时必须大于0', icon: 'none' });
      return;
    }

    const trialSummary =
      trialBookings.length > 0
        ? `；试听学员签到${presentTrialBookings.length}名，未到${absentTrialBookings.length}名（不扣课时）`
        : '';
    const attendanceSummaryText =
      presentStudents.length > 0
        ? `签到${presentStudents.length}名，请假${leaveStudents.length}名，未到${classAbsentCount}名；签到学员每人消课${hoursUsed}课时${trialSummary}。`
        : `本次无签到学员，将记录请假${leaveStudents.length}名、未到${classAbsentCount}名，不扣减课时${trialSummary}。`;

    const confirmResult = await Taro.showModal({
      title: '确认消课',
      content: `确认提交“${selectedClass?.name || '该班级'}”点名结果？\n${attendanceSummaryText}`,
      confirmText: '确认消课',
      confirmColor: '#2563eb',
    });

    if (!confirmResult.confirm) {
      return;
    }

    if (!submitLockRef.current.tryAcquire()) return;
    setSubmitting(true);
    let successCount = 0;
    const failList: { name: string; reason: string }[] = [];

    try {
      const lessonDateValue = lessonDate;
      const existingRecords = await loadLessonRecordsByDate();
      const trialStudentIds = new Set(trialBookings.map((b) => b.trial_student_id));
      const existingSubmitRecords = existingRecords.filter(
        (record) =>
          record.class_id === selectedClassId &&
          record.lesson_date === lessonDateValue &&
          (classStudents.some((student) => student.id === record.student_id) ||
            trialStudentIds.has(record.student_id)),
      );

      // 点名页按当前表单结果重算整节课出勤，先清理本节课已存在的占位或签到记录，避免重复提交冲突。
      await Promise.all(
        existingSubmitRecords
          .filter((record) =>
            ['normal', 'makeup', 'leave', 'absent'].includes(record.status || 'normal'),
          )
          .map((record) => lessonRecordService.remove(record.id)),
      );

      for (const student of presentStudents) {
        const pkg = studentPackages.get(student.id);
        if (!pkg) {
          failList.push({ name: student.name, reason: '无可用课包' });
          continue;
        }

        try {
          // 检测跨科目：课包科目与学生其他课包科目不一致
          const studentSubject = studentSubjects.get(student.id);
          const isCrossSubject =
            !!pkg.subject_id && !!studentSubject && pkg.subject_id !== studentSubject.id;

          const createdRecord = await lessonRecordService.create({
            teacher_id: selectedTeachingTeacherId || currentTeacherId,
            operator_teacher_id: currentTeacherId || selectedTeachingTeacherId,
            assistant_teacher_id: selectedAssistantTeacherId || undefined,
            student_id: student.id,
            package_id: pkg.id,
            class_id: selectedClassId,
            lesson_date: lessonDateValue,
            hours_used: hoursUsed,
            is_cross_subject: isCrossSubject || undefined,
            package_subject: isCrossSubject ? pkg.name : undefined,
            class_subject: isCrossSubject ? studentSubject?.name : undefined,
            content: content.trim() || undefined,
            // 单学员备注：随提交写入（编辑弹窗输入的草稿）
            note: studentRemarkDrafts[student.id] || undefined,
            performance: performance > 0 ? `${performance}星` : undefined,
            homework: homework.trim() || undefined,
            homework_images: homeworkImages.length > 0 ? homeworkImages : undefined,
            campus_id: campusId || undefined,
            room: room || undefined,
          });

          if (isCrossSubject) {
            await notificationService.send({
              sender_id: profile?.id || '',
              receiver_id: 'principal',
              title: '跨科目消课提醒',
              content: `${student.name} 使用「${pkg.name}」课包消课 ${hoursUsed} 课时（班级科目：${studentSubject?.name || '通用'}）`,
              related_id: student.id,
            });
          }

          const parents = await studentService.getParents(student.id);
          for (const binding of parents) {
            await notificationService.send({
              sender_id: profile?.id || '',
              receiver_id: binding.parent_id,
              title: `${student.name} 课时已核销`,
              content: `本次核销 ${hoursUsed} 课时，剩余 ${createdRecord.remaining_hours ?? Math.max(pkg.remaining_hours - hoursUsed, 0)} 课时`,
              related_id: student.id,
            });
          }

          successCount += 1;
        } catch (err) {
          logError('classSubmit single student', err);
          failList.push({ name: student.name, reason: '消课失败' });
        }
      }

      for (const student of leaveStudents) {
        try {
          await lessonRecordService.create({
            teacher_id: selectedTeachingTeacherId || currentTeacherId,
            operator_teacher_id: currentTeacherId || selectedTeachingTeacherId,
            assistant_teacher_id: selectedAssistantTeacherId || undefined,
            student_id: student.id,
            package_id: '',
            class_id: selectedClassId,
            lesson_date: lessonDateValue,
            hours_used: 0,
            status: 'leave',
            content: '家长已请假，本节课自动记为请假',
            note: studentRemarkDrafts[student.id] || undefined,
            campus_id: campusId || undefined,
            room: room || undefined,
          });
          successCount += 1;
        } catch (err) {
          logError('classSubmit leave student', err);
          failList.push({ name: student.name, reason: '请假记录失败' });
        }
      }

      for (const student of absentStudents) {
        try {
          await lessonRecordService.create({
            teacher_id: selectedTeachingTeacherId || currentTeacherId,
            operator_teacher_id: currentTeacherId || selectedTeachingTeacherId,
            assistant_teacher_id: selectedAssistantTeacherId || undefined,
            student_id: student.id,
            package_id: '',
            class_id: selectedClassId,
            lesson_date: lessonDateValue,
            hours_used: 0,
            status: 'absent',
            content: '点名未到，待老师后续补录签到',
            note: studentRemarkDrafts[student.id] || undefined,
            campus_id: campusId || undefined,
            room: room || undefined,
          });
          successCount += 1;
        } catch (err) {
          logError('classSubmit absent student', err);
          failList.push({ name: student.name, reason: '未到记录失败' });
        }
      }

      // 试听学员：签到不扣课时，请假/未到也记录考勤
      for (const booking of presentTrialBookings) {
        const lead = trialLeadMap[booking.lead_id];
        try {
          await lessonRecordService.create({
            teacher_id: selectedTeachingTeacherId || currentTeacherId,
            operator_teacher_id: currentTeacherId || selectedTeachingTeacherId,
            assistant_teacher_id: selectedAssistantTeacherId || undefined,
            student_id: booking.trial_student_id,
            package_id: '',
            class_id: selectedClassId,
            lesson_date: lessonDateValue,
            hours_used: 0,
            status: 'normal',
            content: `试听签到${booking.note ? `（${booking.note}）` : ''}`,
            campus_id: campusId || undefined,
            room: room || undefined,
          });
          successCount += 1;
        } catch (err) {
          logError('classSubmit trial present', err);
          failList.push({ name: lead?.child_name || '试听学员', reason: '试听签到记录失败' });
        }
      }

      for (const booking of leaveTrialBookings) {
        const lead = trialLeadMap[booking.lead_id];
        try {
          await lessonRecordService.create({
            teacher_id: selectedTeachingTeacherId || currentTeacherId,
            operator_teacher_id: currentTeacherId || selectedTeachingTeacherId,
            assistant_teacher_id: selectedAssistantTeacherId || undefined,
            student_id: booking.trial_student_id,
            package_id: '',
            class_id: selectedClassId,
            lesson_date: lessonDateValue,
            hours_used: 0,
            status: 'leave',
            content: '试听学员请假',
            campus_id: campusId || undefined,
            room: room || undefined,
          });
          successCount += 1;
        } catch (err) {
          logError('classSubmit trial leave', err);
          failList.push({ name: lead?.child_name || '试听学员', reason: '试听请假记录失败' });
        }
      }

      for (const booking of absentTrialBookings) {
        const lead = trialLeadMap[booking.lead_id];
        try {
          await lessonRecordService.create({
            teacher_id: selectedTeachingTeacherId || currentTeacherId,
            operator_teacher_id: currentTeacherId || selectedTeachingTeacherId,
            assistant_teacher_id: selectedAssistantTeacherId || undefined,
            student_id: booking.trial_student_id,
            package_id: '',
            class_id: selectedClassId,
            lesson_date: lessonDateValue,
            hours_used: 0,
            status: 'absent',
            content: '试听预约未到',
            campus_id: campusId || undefined,
            room: room || undefined,
          });
          successCount += 1;
        } catch (err) {
          logError('classSubmit trial absent', err);
          failList.push({ name: lead?.child_name || '试听学员', reason: '试听未到记录失败' });
        }
      }

      if (failList.length === 0) {
        invalidateStudents(currentUserId);
        handleSubmitSuccessReturn(
          `签到${presentStudents.length + presentTrialBookings.length}人（含试听${presentTrialBookings.length}人），请假${leaveStudents.length}人，未到${classAbsentCount + absentTrialBookings.length}人`,
          'success',
          1800,
          { renewSubscribe: true },
        );
      } else if (successCount === 0) {
        Taro.showToast({ title: '全部消课失败', icon: 'none' });
      } else {
        invalidateStudents(currentUserId);
        handleSubmitSuccessReturn(
          `${successCount}条记录成功，${failList.length}条失败`,
          'none',
          3000,
          { renewSubscribe: true },
        );
      }
    } catch (err) {
      logError('class submit', err);
      Taro.showToast({ title: '提交失败，请重试', icon: 'none' });
    } finally {
      submitLockRef.current.release();
      setSubmitting(false);
    }
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

  // ===== 统一提交 =====
  const handleSubmit = useCallback(() => {
    if (isEditEntryAttempt) {
      Taro.showToast({ title: '历史消课记录不支持编辑', icon: 'none' });
      return;
    }

    if (mode === 'single') {
      handleSingleSubmit();
      return;
    }

    if (isAlreadyChecked && attendanceMode === 'supplement') {
      void handleSupplementSave();
      return;
    }

    if (isAlreadyChecked && attendanceMode === 'edit') {
      void handleIncrementalEditSave();
      return;
    }

    handleClassSubmit();
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
        {/* 自定义导航栏：标题居中，返回按钮与原生胶囊对齐 */}
        <View className="sticky top-0 z-50 border-b border-black/5 bg-white">
          <View className="pt-nav-safe">
            <View className="relative flex h-[88rpx] items-center justify-center">
              <View
                className="absolute left-[32rpx] flex h-[64rpx] w-[64rpx] items-center justify-center rounded-full active:bg-muted/60"
                onClick={handleBack}
              >
                <Icon name="mdi-chevron-left" size={40} color="foreground" />
              </View>
              <Text className="max-w-[60%] truncate text-[34rpx] font-bold text-foreground">
                {mode === 'class' ? selectedClass?.name || pageTitle : pageTitle}
              </Text>
            </View>
          </View>
        </View>

        {/* 模式切换 Tab - 白色背景+底部指示器 */}
        {shouldShowModeTabs ? (
          <View className="bg-white shadow-sm">
            <View className="flex">
              <View
                className="flex-1 flex items-center justify-center py-3_d5 relative"
                onClick={() => setMode('single')}
              >
                <Text
                  className={`text-base font-medium ${mode === 'single' ? 'text-primary' : 'text-muted-foreground'}`}
                >
                  学员消课
                </Text>
                {mode === 'single' && (
                  <View className="absolute bottom-0 left-0 right-0 h-0_d5 bg-primary" />
                )}
              </View>
              <View
                className="flex-1 flex items-center justify-center py-3_d5 relative"
                onClick={() => setMode('class')}
              >
                <Text
                  className={`text-base font-medium ${mode === 'class' ? 'text-primary' : 'text-muted-foreground'}`}
                >
                  班级消课
                </Text>
                {mode === 'class' && (
                  <View className="absolute bottom-0 left-0 right-0 h-0_d5 bg-primary" />
                )}
              </View>
            </View>
          </View>
        ) : null}

        {/* ====== 单人模式 ====== */}
        {mode === 'single' && (
          <View className="px-[32rpx] py-[24rpx] pb-[32rpx] flex flex-col gap-[24rpx]">
            {/* 选择学员 */}
            <Card className="p-[32rpx]" marginBottom={false}>
              <FormRow
                label="选择学员"
                required
                border={false}
                onClick={() => void handleOpenStudentPicker()}
              >
                {selectedStudent ? (
                  <View className="flex flex-row items-center gap-[12rpx] min-w-0">
                    <StudentAvatar
                      name={selectedStudent.name}
                      src={selectedStudent.avatar_url}
                      size="sm"
                    />
                    <View className="min-w-0 flex-1">
                      <Text className="block text-[30rpx] text-foreground truncate">
                        {selectedStudent.name}
                        {selectedStudent.nickname ? `（${selectedStudent.nickname}）` : ''}
                      </Text>
                    </View>
                    <Text className="text-[24rpx] text-primary shrink-0">更换</Text>
                  </View>
                ) : (
                  <Text className="text-[30rpx] text-muted-foreground">请选择学员</Text>
                )}
              </FormRow>
            </Card>

            {/* 消课信息（选学员后显示） */}
            {selectedStudent ? (
              <>
                <Card className="p-[32rpx]" marginBottom={false}>
                  <FormRow
                    label="消课课包"
                    required
                    border
                    helperText={
                      studentActivePackages.length > 1
                        ? `该学员有 ${studentActivePackages.length} 个课包，请选择本次消课课包`
                        : undefined
                    }
                    onClick={
                      studentActivePackages.length > 1
                        ? () => setSelector({ visible: true, type: 'package' })
                        : undefined
                    }
                  >
                    {matchedPackage ? (
                      <View className="min-w-0 flex-1">
                        <Text className="block text-[30rpx] text-foreground truncate text-right">
                          {matchedPackage.name}
                        </Text>
                        <Text className="block text-[22rpx] text-muted-foreground text-right mt-[4rpx]">
                          {matchedSubject?.name ? `${matchedSubject.name} · ` : ''}
                          剩余 {matchedPackage.remaining_hours} 课时
                          {matchedPackage.remaining_hours < hoursUsed ? ' · 将欠课' : ''}
                        </Text>
                      </View>
                    ) : (
                      <Text className="text-[30rpx] text-destructive">无可用课包</Text>
                    )}
                  </FormRow>

                  <FormRow
                    label="主讲老师"
                    required
                    border
                    onClick={() => setSelector({ visible: true, type: 'teacher' })}
                  >
                    <Text className="text-[30rpx] text-foreground truncate">
                      {selectedTeachingTeacher?.name || profile?.name || '请选择'}
                    </Text>
                  </FormRow>

                  <FormRow label="消课课时" required border>
                    <Stepper value={hoursUsed} min={0.5} step={0.5} onChange={setHoursUsed} />
                  </FormRow>

                  <FormRow label="上课日期" border onClick={() => setLessonDatePickerVisible(true)}>
                    <View className="flex flex-row items-center gap-[8rpx]">
                      <Text className="text-[30rpx] text-foreground">{lessonDate}</Text>
                      <Icon name="mdi-calendar" size="sm" color="muted" />
                    </View>
                  </FormRow>

                  <FormRow label="上课时间" border>
                    <Picker
                      mode="time"
                      value={lessonTime}
                      onChange={(e) => setLessonTime(e.detail.value || lessonTime)}
                    >
                      <View className="flex flex-row items-center gap-[8rpx]">
                        <Text className="text-[30rpx] text-foreground">{lessonTime}</Text>
                        <Icon name="mdi-clock-outline" size="sm" color="muted" />
                      </View>
                    </Picker>
                  </FormRow>

                  <FormRow
                    label="上课校区"
                    border
                    onClick={() => setSelector({ visible: true, type: 'campus' })}
                  >
                    <Text className="text-[30rpx] text-foreground truncate">
                      {campusOptions.find((item) => item.id === campusId)?.name || '请选择'}
                    </Text>
                  </FormRow>

                  <FormRow
                    label="上课教室"
                    border={false}
                    onClick={() => setSelector({ visible: true, type: 'room' })}
                  >
                    <Text
                      className={cn(
                        'text-[30rpx] truncate',
                        room ? 'text-foreground' : 'text-muted-foreground',
                      )}
                    >
                      {room || '请选择'}
                    </Text>
                  </FormRow>
                </Card>

                <Card className="p-[32rpx]" marginBottom={false}>
                  <View className="pb-[24rpx] border-b-[2rpx] border-border/30">
                    <Text className="mb-[12rpx] block text-[30rpx] text-foreground">教学内容</Text>
                    <Textarea
                      className="w-full p-[16rpx] bg-background rounded-[16rpx] text-[28rpx] text-foreground min-h-[100rpx]"
                      placeholder="选填"
                      value={content}
                      onInput={(e) => setContent(e.detail.value || '')}
                    />
                  </View>

                  <View className="py-[24rpx] border-b-[2rpx] border-border/30">
                    <Text className="mb-[12rpx] block text-[30rpx] text-foreground">学生表现</Text>
                    <StarRating value={performance} onChange={setPerformance} />
                  </View>

                  <View className="pt-[24rpx]">
                    <Text className="mb-[12rpx] block text-[30rpx] text-foreground">课后作业</Text>
                    <Textarea
                      className="w-full p-[16rpx] bg-background rounded-[16rpx] text-[28rpx] text-foreground min-h-[100rpx]"
                      placeholder="选填"
                      value={homework}
                      onInput={(e) => setHomework(e.detail.value || '')}
                    />
                    <View className="flex flex-wrap gap-3 mt-3">
                      {homeworkImages.map((img, idx) => (
                        <View key={idx} className="relative w-[120rpx] h-[120rpx]">
                          <Image
                            src={img}
                            mode="aspectFill"
                            className="w-[120rpx] h-[120rpx] rounded-xl"
                            lazyLoad
                          />
                          <View
                            className="absolute -top-2 -right-2 w-[36rpx] h-[36rpx] rounded-full bg-destructive flex items-center justify-center"
                            onClick={() => handleRemoveImage(idx)}
                          >
                            <Text className="text-white text-xs">×</Text>
                          </View>
                        </View>
                      ))}
                      {homeworkImages.length < 3 && (
                        <View
                          className={`w-[120rpx] h-[120rpx] rounded-xl border-2 border-dashed border-input flex items-center justify-center bg-background ${uploading ? 'state-loading' : 'press-scale'}`}
                          onClick={uploading ? undefined : handleUploadImage}
                        >
                          <Text className="text-xl text-muted-foreground">
                            {uploading ? '...' : '+'}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </Card>
              </>
            ) : null}
          </View>
        )}

        {/* ====== 班级模式 ====== */}
        {mode === 'class' && (
          <>
            {/* 头部信息卡片：当前时间 / 老师 / 助教 / 课程介绍 / 备注 */}
            {selectedClassId ? (
              <View className="mx-[24rpx] mt-3 rounded-[20rpx] bg-white px-[28rpx] py-[24rpx] shadow-soft">
                <View className="flex items-start justify-between gap-[20rpx]">
                  <View className="flex-1">
                    <Text className="block text-[44rpx] font-bold leading-[56rpx] text-foreground">
                      {displayLessonTime}
                    </Text>
                    <Text className="mt-[12rpx] block text-[24rpx] text-muted-foreground">
                      {lessonDate}（{getWeekday(lessonDate)}）
                    </Text>
                    <Text className="mt-[12rpx] block text-[24rpx] text-muted-foreground">
                      老师：{selectedTeachingTeacher?.name || profile?.name || '-'}
                    </Text>
                    <Text className="mt-[12rpx] block text-[24rpx] text-muted-foreground">
                      助教：{selectedAssistantTeacher?.name || '-'}
                    </Text>
                    <Text className="mt-[12rpx] block text-[24rpx] leading-[36rpx] text-muted-foreground">
                      课程介绍：{selectedClass?.note || '-'}
                    </Text>
                    <View className="mt-[12rpx] flex items-start gap-[8rpx]">
                      <Text className="shrink-0 text-[24rpx] leading-[44rpx] text-muted-foreground">
                        备注：
                      </Text>
                      <Input
                        className="min-h-[44rpx] flex-1 text-[24rpx] leading-[44rpx] text-foreground"
                        value={homework}
                        onInput={(e) => setHomework(e.detail.value || '')}
                        placeholder="可随时填写备注"
                        placeholderClass="text-muted-foreground"
                      />
                    </View>
                  </View>
                  {!isAlreadyChecked ? (
                    <View className="flex shrink-0 flex-row items-center gap-[12rpx]">
                      {canEditClass ? (
                        <View
                          className="flex items-center justify-center rounded-[12rpx] bg-primary px-[28rpx] py-[12rpx]"
                          onClick={() => {
                            if (!selectedClassId) {
                              Taro.showToast({ title: '缺少班级信息', icon: 'none' });
                              return;
                            }
                            Taro.navigateTo({
                              url: `/package-course/pages/course-form/index?id=${encodeURIComponent(selectedClassId)}&type=class`,
                            });
                          }}
                        >
                          <Text className="text-[24rpx] font-medium leading-none text-primary-foreground">
                            编辑
                          </Text>
                        </View>
                      ) : null}
                      <View
                        className={cn(
                          'flex items-center justify-center rounded-[12rpx] px-[28rpx] py-[12rpx]',
                          isClassPaused ? 'bg-primary' : 'border border-warning/30 bg-warning/10',
                        )}
                        onClick={() => void handleToggleClassPause()}
                      >
                        <Text
                          className={cn(
                            'text-[24rpx] font-medium leading-none',
                            isClassPaused ? 'text-primary-foreground' : 'text-warning',
                          )}
                        >
                          {isClassPaused ? '恢复' : '停课'}
                        </Text>
                      </View>
                    </View>
                  ) : null}
                </View>
              </View>
            ) : null}

            <View className="pt-3">
              {/* 班级选择（非直接进入时显示） */}
              {!isClassDirectEntry ? (
                <View className={FORM_CARD_CLASS_NAME}>
                  <View className="border-b border-black/5 px-4 py-3">
                    <View className="mb-[6rpx] flex items-center gap-1">
                      <Text className="text-[24rpx] text-foreground">班级</Text>
                      <Text className="text-[24rpx] text-destructive">*</Text>
                    </View>
                    <ClassSelector
                      classes={classes}
                      selectedClassId={selectedClassId}
                      scheduledClassIds={scheduledClassIds}
                      onSelect={handleSelectClass}
                    />
                  </View>
                </View>
              ) : null}

              {selectedClassId ? (
                <>
                  {/* 搜索框 */}
                  <View className={FORM_CARD_CLASS_NAME}>
                    <View className="flex items-center gap-[16rpx] px-4 py-3">
                      <Icon name="mdi-magnify" size="sm" color="muted" />
                      <Input
                        className="flex-1 text-[26rpx] text-foreground"
                        value={studentSearchKeyword}
                        onInput={(e) => setStudentSearchKeyword(e.detail.value || '')}
                        placeholder="请输入学员姓名"
                        placeholderClass="text-muted-foreground"
                      />
                    </View>
                  </View>

                  {/* 消耗课时 */}
                  <View className={FORM_CARD_CLASS_NAME}>
                    <View className="flex items-center justify-between px-4 py-3">
                      <Text className="text-[28rpx] text-foreground">消耗课时</Text>
                      <Stepper value={hoursUsed} min={0.5} step={0.5} onChange={setHoursUsed} />
                    </View>
                  </View>

                  {/* 授课扣费 */}
                  <View className={FORM_CARD_CLASS_NAME}>
                    <View className="flex items-center justify-between px-4 py-3">
                      <Text className="text-[28rpx] text-foreground">授课扣费</Text>
                      <View className="flex items-center gap-[8rpx]">
                        <Input
                          className="h-[72rpx] w-[160rpx] rounded-xl bg-background px-4 text-right text-[28rpx] leading-[72rpx] text-foreground"
                          type="digit"
                          value={feeAmount}
                          onInput={(e) => setFeeAmount(e.detail.value || '0')}
                          placeholder="0"
                          placeholderClass="text-muted-foreground"
                        />
                        <Text className="text-[26rpx] text-muted-foreground">元</Text>
                      </View>
                    </View>
                  </View>

                  {/* 考勤状态筛选 */}
                  <View className={FORM_CARD_CLASS_NAME}>
                    <View
                      className="flex items-center justify-between px-4 py-3"
                      onClick={() =>
                        Taro.showActionSheet({
                          itemList: ['全部', '签到', '请假', '未到'],
                          success: (res) => {
                            const map: Array<'all' | CheckinStatus> = [
                              'all',
                              'checked',
                              'leave',
                              'absent',
                            ];
                            setAttendanceFilter(map[res.tapIndex] || 'all');
                          },
                        })
                      }
                    >
                      <Text className="text-[28rpx] text-foreground">考勤状态</Text>
                      <View className="flex items-center gap-[8rpx]">
                        <Text className="text-[26rpx] text-muted-foreground">
                          {attendanceFilter === 'all'
                            ? '全部'
                            : CHECKIN_OPTION_STYLES[attendanceFilter].label}
                        </Text>
                        <Icon name="mdi-chevron-right" size="sm" color="muted" />
                      </View>
                    </View>
                  </View>

                  {/* 统计信息 */}
                  <View className="mx-[24rpx] mb-3">
                    <Text className="text-[24rpx] text-muted-foreground">
                      学员已选
                      <Text className="text-destructive">
                        {classCheckedCount + classLeaveCount + classAbsentCount}
                      </Text>
                      ，签到
                      <Text className="text-destructive">{classCheckedCount}</Text>
                      ，请假
                      <Text className="text-destructive">{classLeaveCount}</Text>
                      ，未到
                      <Text className="text-destructive">{classAbsentCount}</Text>
                    </Text>
                  </View>

                  {/* 学员列表 - 试听优先 */}
                  <View className="mx-[24rpx] mb-3">
                    <View className="mb-[16rpx] flex items-center justify-between">
                      <Text className="text-[26rpx] font-medium text-foreground">学员列表</Text>
                      {!isAlreadyChecked ? (
                        <View
                          className="flex items-center justify-center rounded-[12rpx] bg-muted px-[16rpx] py-[8rpx]"
                          onClick={handleOpenAddStudentSheet}
                        >
                          <Text className="text-[22rpx] font-medium leading-none text-muted-foreground">
                            添加学员
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <View className="grid grid-cols-2 gap-[16rpx]">
                      {mergedStudentList.map((item) => {
                        if (item.type === 'trial') {
                          const booking = item.booking;
                          const status = trialCheckinMap[booking.id] || 'absent';
                          const info = getTrialCardInfo();
                          return (
                            <CheckinCard
                              key={booking.id}
                              name={item.name}
                              status={status}
                              remaining={info.remaining}
                              deduct={info.deduct}
                              isTrial
                              disabled={isStudentCardDisabled(booking.id)}
                              onToggleStatus={(next) => handleSetTrialCheckin(booking.id, next)}
                              onOpenDetailSheet={() =>
                                handleOpenStudentDetailSheet({
                                  type: 'trial',
                                  id: booking.id,
                                  name: item.name,
                                  remaining: info.remaining,
                                  deduct: info.deduct,
                                  courseName: '试听',
                                })
                              }
                            />
                          );
                        }
                        const stu = item.student;
                        const status = studentCheckinStatusMap[stu.id] || 'absent';
                        const info = getStudentCardInfo(stu);
                        return (
                          <CheckinCard
                            key={stu.id}
                            name={stu.name}
                            status={status}
                            remaining={info.remaining}
                            deduct={info.deduct}
                            isMakeup={makeupStudentIds.has(stu.id)}
                            disabled={isStudentCardDisabled(stu.id)}
                            highlight={supplementStudentIds.has(stu.id)}
                            note={
                              studentRemarkDrafts[stu.id] || recordByStudentId.get(stu.id)?.note
                            }
                            onToggleStatus={(next) => handleSetStudentCheckin(stu.id, next)}
                            onOpenDetailSheet={() =>
                              handleOpenStudentDetailSheet({
                                type: 'formal',
                                id: stu.id,
                                name: stu.name,
                                remaining: info.remaining,
                                deduct: info.deduct,
                                courseName: info.courseName,
                                student: stu,
                              })
                            }
                          />
                        );
                      })}
                    </View>
                    {mergedStudentList.length === 0 ? (
                      <View className="rounded-[20rpx] bg-white px-[24rpx] py-[32rpx] shadow-soft">
                        <Text className="text-center text-[24rpx] text-muted-foreground">
                          暂无匹配学员
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </>
              ) : null}
            </View>
          </>
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
        {mode === 'class' ? (
          <View className="fixed bottom-0 left-0 right-0 z-100 border-t border-border bg-white px-[32rpx] pt-[20rpx] pb-safe-bar">
            <View className="flex items-center justify-between gap-[24rpx]">
              <View
                className={`flex items-center gap-[12rpx] ${attendanceMode === 'view' || attendanceMode === 'supplement' ? 'opacity-50' : ''}`}
                onClick={
                  attendanceMode === 'view' || attendanceMode === 'supplement'
                    ? undefined
                    : handleToggleSelectAllStudents
                }
              >
                <View
                  className={`flex h-[36rpx] w-[36rpx] items-center justify-center rounded-full border-2 ${allSelectableChecked ? 'border-primary bg-primary' : 'border-muted-foreground bg-white'}`}
                >
                  {allSelectableChecked ? <Icon name="mdi-check" size="xs" color="white" /> : null}
                </View>
                <Text className="text-[26rpx] text-foreground">全选签到</Text>
              </View>
              {isAlreadyChecked && attendanceMode === 'view' ? (
                canModifyLesson ? (
                  <View className="flex items-center gap-[16rpx]">
                    <View
                      className="rounded-[48rpx] border border-primary bg-white px-[36rpx] py-[22rpx]"
                      onClick={handleOpenSupplementSheet}
                    >
                      <Text className="text-center text-[28rpx] font-medium text-primary">
                        补录
                      </Text>
                    </View>
                    <View
                      className="rounded-[48rpx] bg-primary px-[36rpx] py-[22rpx]"
                      onClick={handleEnterEditMode}
                    >
                      <Text className="text-center text-[28rpx] font-medium text-primary-foreground">
                        修改
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View className="rounded-[48rpx] bg-muted px-[48rpx] py-[22rpx]">
                    <Text className="text-center text-[28rpx] font-medium text-white">已提交</Text>
                  </View>
                )
              ) : isAlreadyChecked && attendanceMode === 'supplement' ? (
                <View className="flex items-center gap-[16rpx]">
                  <View
                    className="rounded-[48rpx] border border-border bg-white px-[32rpx] py-[22rpx]"
                    onClick={handleCancelSupplement}
                  >
                    <Text className="text-center text-[28rpx] font-medium text-foreground">
                      取消
                    </Text>
                  </View>
                  <View
                    className={`rounded-[48rpx] px-[32rpx] py-[22rpx] ${submitting || supplementStudentIds.size === 0 ? 'bg-muted' : 'bg-primary'}`}
                    onClick={
                      submitting || supplementStudentIds.size === 0 ? undefined : handleSubmit
                    }
                  >
                    <Text className="text-center text-[28rpx] font-medium text-white">
                      {submitting ? '保存中...' : '保存补录'}
                    </Text>
                  </View>
                </View>
              ) : isAlreadyChecked && attendanceMode === 'edit' ? (
                <View
                  className={`rounded-[48rpx] px-[48rpx] py-[22rpx] ${submitting ? 'bg-muted' : 'bg-primary'}`}
                  onClick={submitting ? undefined : handleSubmit}
                >
                  <Text className="text-center text-[28rpx] font-medium text-primary-foreground">
                    {submitting ? '保存中...' : '保存修改'}
                  </Text>
                </View>
              ) : !canModifyLesson ? (
                <View className="rounded-[48rpx] bg-muted px-[48rpx] py-[22rpx]">
                  <Text className="text-center text-[28rpx] font-medium text-white">仅查看</Text>
                </View>
              ) : (
                <View
                  className={`rounded-[48rpx] px-[48rpx] py-[22rpx] ${submitting || !selectedClassId || isClassPaused ? 'bg-muted' : 'bg-primary'}`}
                  onClick={
                    submitting || !selectedClassId || isClassPaused
                      ? () => {
                          if (isClassPaused) {
                            Taro.showToast({ title: '班级已停课，请先恢复上课', icon: 'none' });
                          }
                        }
                      : handleSubmit
                  }
                >
                  <Text className="text-center text-[28rpx] font-medium text-primary-foreground">
                    {submitting ? '提交中...' : isClassPaused ? '已停课' : '提交点名'}
                  </Text>
                </View>
              )}
            </View>
          </View>
        ) : (
          <ActionButton
            text={submitText}
            disabled={submitting || !selectedStudent}
            onClick={handleSubmit}
          />
        )}
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
