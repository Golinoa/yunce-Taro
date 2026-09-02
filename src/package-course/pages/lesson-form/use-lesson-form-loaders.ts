/**
 * 点名页数据加载：初始化 / 班级学员 / 试听 / 请假 / 课包 / 教室（Q2-2）
 */
import {
  useCallback,
  useEffect,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import {
  studentService,
  packageService,
  lessonRecordService,
  classService,
  subjectService,
  teacherService,
  leadService,
  makeupBookingService,
} from '@/services';
import { campusService, roomService } from '@/services/campus';
import type { CampusUIModel, Room, Subject } from '@/types/campus';
import type { Class } from '@/types/class';
import type { CoursePackage } from '@/types/course-package';
import type { Lead, LeadBooking } from '@/types/lead';
import type { LessonRecord } from '@/types/lesson-record';
import type { Student } from '@/types/student';
import type { TeacherUIModel } from '@/types/teacher';
import { logError } from '@/utils/logger';
import { pickBestPackage } from '@/utils/package-helper';
import {
  buildClassAttendanceState,
  buildTrialCheckinMap,
  fetchApprovedLeaveStudentIds,
  loadPackageMapsForStudents,
  resolveClassAttendanceMode,
} from './lesson-attendance-load';
import type { CheckinStatus, ClassAttendanceMode } from './checkin-status';

export interface UseLessonFormLoadersParams {
  isEditEntryAttempt: boolean;
  classIdParam: string;
  studentIdParam: string;
  viewOnlyParam: boolean;
  currentTeacherId: string;
  currentUserId: string;
  attendanceRecordActorId: string;
  profileName?: string;
  mode: 'single' | 'class';
  lessonDate: string;
  hoursUsed: number;
  selectedClassId: string;
  selectedStudent: Student | null;
  classStudents: Student[];
  existingClassRecords: LessonRecord[];
  teacherOptions: TeacherUIModel[];
  matchedPackage: CoursePackage | null;
  packageManualRef: MutableRefObject<boolean>;
  fetchClassesByTeacher: (teacherId: string) => Promise<Class[]>;
  setMode: Dispatch<SetStateAction<'single' | 'class'>>;
  setLessonDate: Dispatch<SetStateAction<string>>;
  setLessonTime: Dispatch<SetStateAction<string>>;
  lessonDateParam: string;
  lessonTimeParam: string;
  setClasses: Dispatch<SetStateAction<Class[]>>;
  setScheduledClassIds: Dispatch<SetStateAction<Set<string>>>;
  setTeacherOptions: Dispatch<SetStateAction<TeacherUIModel[]>>;
  setCampusOptions: Dispatch<SetStateAction<CampusUIModel[]>>;
  setCampusId: Dispatch<SetStateAction<string>>;
  setSelectedTeachingTeacherId: Dispatch<SetStateAction<string>>;
  setSelectedAssistantTeacherId: Dispatch<SetStateAction<string>>;
  setSelectedStudent: Dispatch<SetStateAction<Student | null>>;
  setMatchedPackage: Dispatch<SetStateAction<CoursePackage | null>>;
  setMatchedSubject: Dispatch<SetStateAction<Subject | null>>;
  setSelectedClassId: Dispatch<SetStateAction<string>>;
  setClassStudents: Dispatch<SetStateAction<Student[]>>;
  setLeaveStudentIds: Dispatch<SetStateAction<Set<string>>>;
  setExistingClassRecords: Dispatch<SetStateAction<LessonRecord[]>>;
  setIsAlreadyChecked: Dispatch<SetStateAction<boolean>>;
  setCheckedStudentIds: Dispatch<SetStateAction<Set<string>>>;
  setRecordByStudentId: Dispatch<SetStateAction<Map<string, LessonRecord>>>;
  setSupplementStudentIds: Dispatch<SetStateAction<Set<string>>>;
  setAttendanceMode: Dispatch<SetStateAction<ClassAttendanceMode>>;
  setStudentPackages: Dispatch<SetStateAction<Map<string, CoursePackage>>>;
  setStudentSubjects: Dispatch<SetStateAction<Map<string, Subject | null>>>;
  setTrialBookings: Dispatch<SetStateAction<LeadBooking[]>>;
  setTrialCheckinMap: Dispatch<SetStateAction<Record<string, CheckinStatus>>>;
  setTrialLeadMap: Dispatch<SetStateAction<Record<string, Lead>>>;
  setRooms: Dispatch<SetStateAction<Room[]>>;
  campusId: string;
  setRoom: Dispatch<SetStateAction<string>>;
  setHoursUsed: Dispatch<SetStateAction<number>>;
  setFeeAmount: Dispatch<SetStateAction<string>>;
  setMakeupStudentIds: Dispatch<SetStateAction<Set<string>>>;
  setStudentActivePackages: Dispatch<SetStateAction<CoursePackage[]>>;
  setSelector: Dispatch<
    SetStateAction<{
      visible: boolean;
      type: 'teacher' | 'campus' | 'room' | 'package' | null;
    }>
  >;
  setSubjectOptions: Dispatch<SetStateAction<Subject[]>>;
}

export function useLessonFormLoaders(params: UseLessonFormLoadersParams) {
  const {
    isEditEntryAttempt,
    classIdParam,
    studentIdParam,
    viewOnlyParam,
    currentTeacherId,
    currentUserId,
    attendanceRecordActorId,
    profileName,
    mode,
    lessonDate,
    hoursUsed,
    selectedClassId,
    selectedStudent,
    classStudents,
    existingClassRecords,
    teacherOptions,
    matchedPackage,
    packageManualRef,
    fetchClassesByTeacher,
    setMode,
    setLessonDate,
    setLessonTime,
    lessonDateParam,
    lessonTimeParam,
    setClasses,
    setScheduledClassIds,
    setTeacherOptions,
    setCampusOptions,
    setCampusId,
    setSelectedTeachingTeacherId,
    setSelectedAssistantTeacherId,
    setSelectedStudent,
    setMatchedPackage,
    setMatchedSubject,
    setSelectedClassId,
    setClassStudents,
    setLeaveStudentIds,
    setExistingClassRecords,
    setIsAlreadyChecked,
    setCheckedStudentIds,
    setRecordByStudentId,
    setSupplementStudentIds,
    setAttendanceMode,
    setStudentPackages,
    setStudentSubjects,
    setTrialBookings,
    setTrialCheckinMap,
    setTrialLeadMap,
    setRooms,
    campusId,
    setRoom,
    setHoursUsed,
    setFeeAmount,
    setMakeupStudentIds,
    setStudentActivePackages,
    setSelector,
    setSubjectOptions,
  } = params;

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
    [currentTeacherId, setSelectedAssistantTeacherId, setSelectedTeachingTeacherId],
  );

  const applyClassLessonDefaults = useCallback(
    (classInfo: Class | null) => {
      if (!classInfo) {
        return;
      }
      setHoursUsed(classInfo.hours_per_lesson ?? 1);
      setFeeAmount(String(classInfo.pricePerLesson ?? 0));
    },
    [setFeeAmount, setHoursUsed],
  );

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
  }, [classIdParam, lessonDateParam, lessonTimeParam, setLessonDate, setLessonTime, setMode]);

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
    [currentTeacherId, lessonDate, setLeaveStudentIds],
  );

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
  }, [
    attendanceRecordActorId,
    currentTeacherId,
    lessonDate,
    selectedClassId,
    setTrialBookings,
    setTrialCheckinMap,
    setTrialLeadMap,
  ]);

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
          teacherList.find((teacher) => teacher.name === profileName);
        return matchedTeacher?.id || currentTeacherId;
      });

      if (studentIdParam) {
        const stu = await studentService.getById(studentIdParam);
        if (stu) {
          setSelectedStudent(stu);
          setCampusId(stu.campus_id || mainCampusId);
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
    profileName,
    studentIdParam,
    viewOnlyParam,
    lessonDate,
  ]);

  useEffect(() => {
    void loadTrialBookings();
  }, [loadTrialBookings]);

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
  }, [campusId, setRooms]);

  const applyMatchedPackage = useCallback(
    async (pkg: CoursePackage | null) => {
      setMatchedPackage(pkg);
      if (pkg?.subject_id) {
        const sub = await subjectService.getById(pkg.subject_id);
        setMatchedSubject(sub);
      } else {
        setMatchedSubject(null);
      }
    },
    [setMatchedPackage, setMatchedSubject],
  );

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
    [
      applyMatchedPackage,
      hoursUsed,
      matchedPackage?.id,
      packageManualRef,
      setSelector,
      setStudentActivePackages,
    ],
  );

  useEffect(() => {
    if (selectedStudent && mode === 'single') {
      autoMatchPackage(selectedStudent.id);
    }
  }, [hoursUsed, selectedStudent, mode, autoMatchPackage]);

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
      setAttendanceMode,
      setCampusId,
      setCheckedStudentIds,
      setClassStudents,
      setClasses,
      setExistingClassRecords,
      setIsAlreadyChecked,
      setLeaveStudentIds,
      setMakeupStudentIds,
      setRecordByStudentId,
      setRoom,
      setSelectedClassId,
      setStudentPackages,
      setStudentSubjects,
      setSupplementStudentIds,
      teacherOptions,
      viewOnlyParam,
    ],
  );

  useEffect(() => {
    if (mode !== 'class' || classStudents.length === 0) {
      return;
    }

    const syncLeaveStudents = async () => {
      const approvedLeaveIds = await loadApprovedLeaveStudentIds(classStudents);
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
  }, [
    classStudents,
    existingClassRecords,
    loadApprovedLeaveStudentIds,
    mode,
    setCheckedStudentIds,
    setLeaveStudentIds,
  ]);

  useEffect(() => {
    void subjectService
      .getList()
      .then(setSubjectOptions)
      .catch((err) => logError('lesson-form load subjects', err));
  }, [setSubjectOptions]);

  return {
    applyMatchedPackage,
    autoMatchPackage,
    loadClassStudents,
    loadLessonRecordsByDate,
  };
}
