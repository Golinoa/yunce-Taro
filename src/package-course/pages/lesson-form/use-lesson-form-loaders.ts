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
import { withCache } from '@/utils/cache-helpers';
import { TTL } from '@/utils/data-freshness';
import { isBookingOfLesson } from '@/utils/lesson-identity';
import { isRecordOfLesson } from '@/utils/lesson-record-scope';
import {
  buildLessonRosterKey,
  readLessonRoster,
  writeLessonRoster,
  type LessonRosterSnapshot,
} from '@/utils/lesson-roster-cache';
import { logError } from '@/utils/logger';
import { pickBestPackage } from '@/utils/package-helper';
import { parseLessonStartTime } from '@/utils/schedule-card-build';
import {
  buildClassAttendanceState,
  buildTrialCheckinMap,
  fetchApprovedLeaveStudentIds,
  loadPackageMapsForStudents,
  resolveClassAttendanceMode,
} from './lesson-attendance-load';
import type { CheckinStatus, ClassAttendanceMode } from './checkin-status';

/**
 * 把「已落库补录学员」并入班级名单快照。
 *
 * 补录（status:'makeup' 的消课记录）学员不在 roster 快照（正式 + 当日补课预约）内，
 * 导致「添加补录学员后保存刷新 / 重新进入详情页」看不到该学员。
 * 这里从本节课已落库记录里挑出 status='makeup' 且既非正式、也非当日补课预约的学员，
 * 拉取真实档案后并入名单，并把其 id 交给 supplementStudentIds 用于高亮。
 */
async function resolveRosterWithSupplement(
  roster: LessonRosterSnapshot,
  existing: LessonRecord[],
  classId: string,
  lessonDate: string,
  scheduleId?: string,
): Promise<{ students: Student[]; supplementIds: Set<string> }> {
  const rosterMakeupIds = new Set(roster.makeupStudentIds);
  const formalIds = new Set(roster.students.map((student) => student.id));
  const supplementIds = new Set(
    existing
      .filter(
        (record) =>
          isRecordOfLesson(record, { classId, lessonDate, scheduleId }) &&
          record.status === 'makeup' &&
          !rosterMakeupIds.has(record.student_id) &&
          !formalIds.has(record.student_id),
      )
      .map((record) => record.student_id),
  );
  if (supplementIds.size === 0) {
    return { students: roster.students, supplementIds: new Set() };
  }
  try {
    const extras = await Promise.all(
      [...supplementIds].map(async (studentId) => {
        try {
          return await studentService.getById(studentId);
        } catch (err) {
          logError('load supplement student for roster', err);
          return null;
        }
      }),
    );
    const extraStudents = extras.filter((student): student is Student => Boolean(student));
    return {
      students: [...roster.students, ...extraStudents],
      supplementIds,
    };
  } catch (err) {
    logError('resolve roster supplement students', err);
    return { students: roster.students, supplementIds: new Set() };
  }
}

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
  fetchClassesByTeacher: (teacherId: string, campusId?: string) => Promise<Class[]>;
  setMode: Dispatch<SetStateAction<'single' | 'class'>>;
  setLessonDate: Dispatch<SetStateAction<string>>;
  setLessonTime: Dispatch<SetStateAction<string>>;
  lessonDateParam: string;
  lessonTimeParam: string;
  /** 本节排课规则 ID（URL 参数）；同班同一天多节课时用它隔离考勤/补课记录 */
  scheduleIdParam: string;
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
  /** 学员列表加载态（首次进入 / 切班时展示占位，避免空白误判为"无学员"） */
  setClassStudentsLoading: Dispatch<SetStateAction<boolean>>;
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
    scheduleIdParam,
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
    setClassStudentsLoading,
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

  /**
   * 本节开始时段（`09:00`）。用于把试听/补课预约收窄到「这一节」：
   * 同一班同一天可能排多节课，只按班级+日期合并会让别的课也带上这些学员。
   * 页面未带 lessonTime（从班级列表进入等）时为空串 ⇒ 过滤函数自动放行。
   */
  const lessonStartTime = parseLessonStartTime(lessonTimeParam);

  /**
   * 本节排课规则 ID：消课记录靠它区分「同班同一天的另一节课」。
   * 从班级列表等入口进来时为空 ⇒ 判定函数自动放行（不区分）。
   */
  const lessonScheduleId = scheduleIdParam.trim();

  const applyClassTeacherDefaults = useCallback(
    (classInfo: Class | null, options: TeacherUIModel[]) => {
      if (!classInfo) {
        setSelectedTeachingTeacherId(currentTeacherId);
        setSelectedAssistantTeacherId('');
        return;
      }

      /**
       * 归一化班级老师 id。
       *
       * `Class.teachers` 前端类型写的是 `string[]`，但后端同一字段历史上存过**两种形态**：
       * 字符串数组，以及 `{ id }` 对象数组（后端自己的读取处 `class.service.ts` 也兼容两种）。
       * 之前这里直接 `.map(id => options.find(t => t.id === id))`：一旦是对象形态，查找必然
       * 全部落空，于是回落到 `teacher_id`（后端更新班级时**不写这一列**，拿到的是旧值），
       * 再兜底到 `currentTeacherId` —— 表现为「在班级编辑页改了老师，点名页还是旧老师、
       * 甚至显示成当前登录人」。
       */
      const rawTeachers = Array.isArray(classInfo.teachers) ? classInfo.teachers : [];
      const normalizedTeacherIds = rawTeachers
        .map((item) =>
          typeof item === 'string' ? item : (item as unknown as { id?: string })?.id || '',
        )
        .filter(Boolean);
      const configuredTeacherIds = normalizedTeacherIds.length
        ? normalizedTeacherIds
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
      const classBookings = bookings.filter((b) =>
        // 归属 + 日期 + 「哪一节」统一走真源：编号优先、时段兜底。
        // 这样这节课被同日调课改了时段，调课前下的试听预约仍在名单里。
        isBookingOfLesson(
          {
            class_id: b.class_id,
            lesson_date: b.lesson_date,
            schedule_id: b.reference_schedule_id,
            start_time: b.start_time,
          },
          {
            classId: selectedClassId,
            lessonDate,
            startTime: lessonStartTime,
            scheduleId: lessonScheduleId,
          },
        ),
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
      setTrialCheckinMap(
        buildTrialCheckinMap({
          bookings: classBookings,
          // 班级初始化已经加载了当天记录，复用它，避免进入点名页重复请求同一日期。
          records: existingClassRecords,
          classId: selectedClassId,
          lessonDate,
          scheduleId: lessonScheduleId,
        }),
      );
    } catch (err) {
      logError('loadTrialBookings', err);
      setTrialBookings([]);
      setTrialLeadMap({});
      setTrialCheckinMap({});
    }
  }, [
    currentTeacherId,
    existingClassRecords,
    lessonDate,
    lessonScheduleId,
    lessonStartTime,
    selectedClassId,
    setTrialBookings,
    setTrialCheckinMap,
    setTrialLeadMap,
  ]);

  /**
   * 拉取「班级名单」（班级信息 + 正式学员 + 当日已确认补课学员）——**慢变部分，走内存快照**。
   *
   * 点名记录 / 课包 / 科目 / 请假审批仍在调用方单独直拉：它们属资损域（§1.1 D1），不进缓存。
   * `force: true` 用于"我刚写完数据"的场景（点名/补录保存后刷新），跳过缓存直接回源。
   */
  const fetchClassRoster = useCallback(
    async (classId: string, opts?: { force?: boolean }): Promise<LessonRosterSnapshot> => {
      const cacheKey = buildLessonRosterKey({
        userId: currentUserId,
        classId,
        lessonDate,
        // 名单已按时段收窄：同班同一天两节课的名单不同，key 必须带上时段
        startTime: lessonStartTime,
      });
      if (!opts?.force) {
        const cached = readLessonRoster(cacheKey);
        if (cached) {
          return cached;
        }
      }

      // 课包由 loadPackageMapsForStudents 统一按学员并发拉取；
      // 这里显式关掉 getStudents 的默认补包，避免同一批学员被重复请求一遍（N+1）。
      const [classInfo, formalStudents] = await Promise.all([
        classService.getById(classId),
        classService.getStudents(classId, { includePackages: false }),
      ]);

      // 点名入口必须把当天已确认的补课学员并入列表；否则会出现
      //「课表预约成功，但点名页看不到补课学员」。
      const makeupStudentIds: string[] = [];
      let students = formalStudents;
      try {
        const makeupBookings = await makeupBookingService.getByClassDate({
          classId,
          lessonDate,
          // 只并「本节」的补课学员：同班同一天多节课时，别把别的课的补课学员并进来
          startTime: lessonStartTime || undefined,
          // 排课编号：有了它，这节课被同日调课改了时段，补课学员也不会丢
          scheduleId: lessonScheduleId || undefined,
        });
        const formalIds = new Set(formalStudents.map((student) => student.id));
        const extraStudents = await Promise.all(
          makeupBookings
            .filter((booking) => {
              makeupStudentIds.push(booking.student_id);
              return !formalIds.has(booking.student_id);
            })
            .map(async (booking) => {
              try {
                return await studentService.getById(booking.student_id);
              } catch (err) {
                logError('load makeup student', err);
                return null;
              }
            }),
        );
        students = [
          ...extraStudents.filter((student): student is Student => Boolean(student)),
          ...formalStudents,
        ];
      } catch (err) {
        logError('load class makeup students', err);
      }

      const snapshot: LessonRosterSnapshot = { classInfo, students, makeupStudentIds };
      // 班级信息取不到（不存在 / 无权限 / 请求失败）时不落缓存：
      // 否则一次瞬时失败会把「空名单」锁住整个 TTL，老师会看到"这个班没学员"。
      // 注意空学员是合法状态（新建班），只以 classInfo 是否存在为准。
      if (classInfo) {
        writeLessonRoster(cacheKey, snapshot);
      }
      return snapshot;
    },
    [currentUserId, lessonDate, lessonStartTime, lessonScheduleId],
  );

  useEffect(() => {
    if (isEditEntryAttempt) {
      return;
    }

    const loadData = async () => {
      const [classList, teacherList, campusList, scheduledIds] = await Promise.all([
        // L3：显式传当前校区，班级列表按所选校区返回（store 内已带 TTL 缓存）
        fetchClassesByTeacher(currentTeacherId, campusId),
        // 以下三项为慢变字典，走仓库统一的 withCache 持久缓存：
        // 重进详情页不再重复打后端，缩短「进入即加载」的体感。
        withCache('lesson-form', 'teacher-list', TTL.list, () => teacherService.getList()),
        withCache('lesson-form', 'campus-list', TTL.campus, () => campusService.getList()),
        withCache('lesson-form', 'scheduled-class-ids', TTL.list, () =>
          classService.getScheduledClassIds(),
        ),
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

      // 选中班级的基础信息（名称/教室/老师/校区）已在 classList 缓存里，
      // 提前同步写出，让详情页头部在点名名单返回前就渲染出来，避免整页空白/加载感。
      // 名单回来后会用 classService.getById 的新鲜 classInfo 再覆盖一次，不引入陈旧值。
      const prefetchedClass = classIdParam
        ? classList.find((item) => item.id === classIdParam) || null
        : null;
      if (prefetchedClass) {
        setSelectedClassId(classIdParam);
        setCampusId((prev) => prev || prefetchedClass.campus_id || mainCampusId);
        applyClassTeacherDefaults(prefetchedClass, teacherList);
        applyClassLessonDefaults(prefetchedClass);
      }

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
        setClassStudentsLoading(true);
        try {
          // 名单（班级信息 + 正式学员 + 当日补课学员）走内存快照：
          // 短窗口内重复进同一班级直接复用，不再重打 getById / getStudents / 补课预约。
          const roster = await fetchClassRoster(classIdParam);
          setMakeupStudentIds(new Set(roster.makeupStudentIds));
          setSelectedClassId(classIdParam);
          setCampusId(roster.classInfo?.campus_id || mainCampusId);
          applyClassTeacherDefaults(roster.classInfo, teacherList);
          applyClassLessonDefaults(roster.classInfo);
          const approvedLeaveIds = await loadApprovedLeaveStudentIds(roster.students);

          const existingRecords = await loadLessonRecordsByDate();
          const { students: withSupplement, supplementIds } = await resolveRosterWithSupplement(
            roster,
            existingRecords,
            classIdParam,
            lessonDate,
            lessonScheduleId,
          );
          setClassStudents(withSupplement);
          const attendance = buildClassAttendanceState({
            records: existingRecords,
            classId: classIdParam,
            lessonDate,
            studentIds: withSupplement.map((student) => student.id),
            scheduleId: lessonScheduleId,
          });
          setExistingClassRecords(attendance.classRecords);
          setIsAlreadyChecked(attendance.hasRecords);
          setCheckedStudentIds(attendance.checkedStudentIds);
          setLeaveStudentIds(new Set([...attendance.leaveStudentIds, ...approvedLeaveIds]));
          setRecordByStudentId(attendance.recordByStudentId);
          setSupplementStudentIds(supplementIds);
          setAttendanceMode(
            resolveClassAttendanceMode({
              hasRecords: attendance.hasRecords,
              viewOnly: viewOnlyParam,
              lessonDate,
            }),
          );

          const { packages, subjects } = await loadPackageMapsForStudents(
            withSupplement,
            hoursUsed,
          );
          setStudentPackages(packages);
          setStudentSubjects(subjects);
        } finally {
          setClassStudentsLoading(false);
        }
      }
    };
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅在 URL 参数变化时初始化
  }, [
    classIdParam,
    currentTeacherId,
    currentUserId,
    fetchClassesByTeacher,
    fetchClassRoster,
    applyClassTeacherDefaults,
    applyClassLessonDefaults,
    isEditEntryAttempt,
    loadApprovedLeaveStudentIds,
    profileName,
    studentIdParam,
    viewOnlyParam,
    lessonDate,
    setClassStudentsLoading,
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
    async (classId: string, opts?: { force?: boolean }) => {
      setSelectedClassId(classId);
      setClassStudentsLoading(true);
      try {
        // 名单（班级信息 + 正式学员 + 当日补课学员）走内存快照；
        // `force: true` 用于"我刚写完"的刷新场景（点名/补录保存后），跳过缓存直接回源。
        const roster = await fetchClassRoster(classId, opts);
        const classInfo = roster.classInfo;
        const mergedStudents = roster.students;
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

        setMakeupStudentIds(new Set(roster.makeupStudentIds));
        const approvedLeaveIds = await loadApprovedLeaveStudentIds(mergedStudents);

        const existing = await loadLessonRecordsByDate();
        /**
         * 这里可能是在表单里**换成了另一个班级**：URL 上的 scheduleId 只属于 URL 那个班，
         * 套到别的班会把该班真实记录误判成「另一节」而被过滤掉 ⇒ 换班时不带 scheduleId。
         */
        const rosterScheduleId = classId === classIdParam ? lessonScheduleId : '';
        const { students: withSupplement, supplementIds } = await resolveRosterWithSupplement(
          roster,
          existing,
          classId,
          lessonDate,
          rosterScheduleId,
        );
        const attendance = buildClassAttendanceState({
          records: existing,
          classId,
          lessonDate,
          studentIds: withSupplement.map((student) => student.id),
          scheduleId: rosterScheduleId,
        });
        setClassStudents(withSupplement);
        setExistingClassRecords(attendance.classRecords);
        setIsAlreadyChecked(attendance.hasRecords);
        setCheckedStudentIds(attendance.checkedStudentIds);
        setLeaveStudentIds(new Set([...attendance.leaveStudentIds, ...approvedLeaveIds]));
        setRecordByStudentId(attendance.recordByStudentId);
        setSupplementStudentIds(supplementIds);
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
      } finally {
        setClassStudentsLoading(false);
      }
    },
    [
      applyClassTeacherDefaults,
      applyClassLessonDefaults,
      classIdParam,
      fetchClassRoster,
      hoursUsed,
      lessonScheduleId,
      loadApprovedLeaveStudentIds,
      loadLessonRecordsByDate,
      lessonDate,
      setAttendanceMode,
      setCampusId,
      setCheckedStudentIds,
      setClassStudents,
      setClassStudentsLoading,
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
