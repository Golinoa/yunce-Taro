/**
 * 点名页学员/签到操作 + 提交胶水（Q2-2）
 */
import Taro from '@tarojs/taro';
import {
  useCallback,
  useMemo,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import {
  memberCardService,
  lessonRecordService,
  classService,
  subjectService,
  subscribeMessageService,
} from '@/services';
import type { Subject } from '@/types/campus';
import type { Lead, LeadBooking } from '@/types/lead';
import type { LessonRecord } from '@/types/lesson-record';
import type { MemberCardDetail } from '@/types/member-card';
import type { Student } from '@/types/student';
import type { TeacherUIModel } from '@/types/teacher';
import { getMemberCardRemaining, pickMemberCardForLesson } from '@/utils/lesson-deduction-source';
import { logError } from '@/utils/logger';
import { emitScheduleRelatedRefresh } from '@/utils/refresh-signal';
import type { SubmitLock } from '@/utils/submit-lock';
import { resolveLessonSubmitKind } from './lesson-submit';
import { executeClassSubmit } from './lesson-submit-class';
import { executeSingleDeduct } from './lesson-submit-single';
import { executeIncrementalEditSave, executeSupplementSave } from './lesson-submit-supplement';
import type { CheckinStatus, ClassAttendanceMode } from './checkin-status';
import type { StudentEditSheetTarget } from './StudentEditSheet';

export interface UseLessonFormActionsParams {
  isEditEntryAttempt: boolean;
  mode: 'single' | 'class';
  isAlreadyChecked: boolean;
  attendanceMode: ClassAttendanceMode;
  selectedClassId: string;
  selectedClassName?: string;
  classStudents: Student[];
  allStudents: Student[];
  checkedStudentIds: Set<string>;
  leaveStudentIds: Set<string>;
  trialBookings: LeadBooking[];
  trialCheckinMap: Record<string, CheckinStatus>;
  trialLeadMap: Record<string, Lead>;
  recordByStudentId: Map<string, LessonRecord>;
  studentRemarkDrafts: Record<string, string>;
  detailSheetTarget: StudentEditSheetTarget | null;
  detailSheetRemark: string;
  addStudentSheetPurpose: 'attendance' | 'supplement';
  hoursUsed: number;
  lessonDate: string;
  /** 本节排课规则 ID：写进消课记录，用于区分「同班同一天的另一节课」 */
  scheduleId: string;
  selectedTeachingTeacherId: string;
  selectedAssistantTeacherId: string;
  /** 教师管理在册教师列表：提交前校验授课教师有效（防「教师不存在」） */
  teacherOptions: TeacherUIModel[];
  currentTeacherId: string;
  currentUserId: string;
  campusId: string;
  room: string;
  content: string;
  performance: number;
  homework: string;
  homeworkImages: string[];
  /** 学员会员卡（唯一账本，含卡种科目）：点名扣减来源 */
  studentMemberCards: Map<string, MemberCardDetail[]>;
  studentSubjects: Map<string, Subject | null>;
  makeupStudentIds: Set<string>;
  supplementStudentIds: Set<string>;
  attendanceBaseline: Map<string, CheckinStatus>;
  selectedStudent: Student | null;
  /** 单人模式当前选中的会员卡 */
  matchedCard: MemberCardDetail | null;
  profile?: {
    id?: string;
    name?: string;
    currentContext?: { role?: string } | null;
  } | null;
  submitLockRef: MutableRefObject<SubmitLock>;
  invalidateStudents: (userId?: string) => void;
  loadClassStudents: (classId: string, opts?: { force?: boolean }) => Promise<void> | void;
  loadLessonRecordsByDate: () => Promise<LessonRecord[]>;
  setCheckedStudentIds: Dispatch<SetStateAction<Set<string>>>;
  setLeaveStudentIds: Dispatch<SetStateAction<Set<string>>>;
  setTrialCheckinMap: Dispatch<SetStateAction<Record<string, CheckinStatus>>>;
  setDetailSheetTarget: Dispatch<SetStateAction<StudentEditSheetTarget | null>>;
  setDetailSheetRemark: Dispatch<SetStateAction<string>>;
  setShowStudentDetailSheet: Dispatch<SetStateAction<boolean>>;
  setStudentRemarkDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  setRecordByStudentId: Dispatch<SetStateAction<Map<string, LessonRecord>>>;
  setClassStudents: Dispatch<SetStateAction<Student[]>>;
  setStudentSubjects: Dispatch<SetStateAction<Map<string, Subject | null>>>;
  setStudentMemberCards: Dispatch<SetStateAction<Map<string, MemberCardDetail[]>>>;
  setShowAddStudentSheet: Dispatch<SetStateAction<boolean>>;
  setSupplementStudentIds: Dispatch<SetStateAction<Set<string>>>;
  setAttendanceMode: Dispatch<SetStateAction<ClassAttendanceMode>>;
  setSubmitting: Dispatch<SetStateAction<boolean>>;
}

export function useLessonFormActions(params: UseLessonFormActionsParams) {
  const {
    isEditEntryAttempt,
    mode,
    isAlreadyChecked,
    attendanceMode,
    selectedClassId,
    selectedClassName,
    classStudents,
    allStudents,
    checkedStudentIds,
    leaveStudentIds,
    trialBookings,
    trialCheckinMap,
    trialLeadMap,
    recordByStudentId,
    studentRemarkDrafts,
    detailSheetTarget,
    detailSheetRemark,
    addStudentSheetPurpose,
    hoursUsed,
    lessonDate,
    scheduleId,
    selectedTeachingTeacherId,
    selectedAssistantTeacherId,
    teacherOptions,
    currentTeacherId,
    currentUserId,
    campusId,
    room,
    content,
    performance,
    homework,
    homeworkImages,
    studentSubjects,
    studentMemberCards,
    makeupStudentIds,
    supplementStudentIds,
    attendanceBaseline,
    selectedStudent,
    matchedCard,
    profile,
    submitLockRef,
    invalidateStudents,
    loadClassStudents,
    loadLessonRecordsByDate,
    setCheckedStudentIds,
    setLeaveStudentIds,
    setTrialCheckinMap,
    setDetailSheetTarget,
    setDetailSheetRemark,
    setShowStudentDetailSheet,
    setStudentRemarkDrafts,
    setRecordByStudentId,
    setClassStudents,
    setStudentSubjects,
    setStudentMemberCards,
    setShowAddStudentSheet,
    setSupplementStudentIds,
    setAttendanceMode,
    setSubmitting,
  } = params;

  const emitScheduleRefreshSignal = useCallback(() => {
    emitScheduleRelatedRefresh();
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

      const goBack = () => {
        Taro.navigateBack({
          fail: () => {
            void Taro.switchTab({ url: '/pages/schedule/index' });
          },
        });
      };

      /**
       * 让成功提示播完再返回；E05 订阅补次数弹窗移到返回之后（fire-and-forget）。
       *
       * ⚠️ `runFlow('E05')` 的 Promise 只在用户点击订阅弹框时 resolve，
       * 之前 `await` 写在 `navigateBack` 之前 → 不点弹框就永远不返回（2026-09-25 FE-23 同类修复）。
       */
      setTimeout(
        () => {
          goBack();
          if (options?.renewSubscribe) {
            void (async () => {
              try {
                await subscribeMessageService.runFlow('E05', {
                  campusId: campusId || undefined,
                  role: profile?.currentContext?.role,
                });
              } catch (error) {
                logError('subscribe E05 after checkin', error);
              }
            })();
          }
        },
        Math.max(0, duration),
      );
    },
    [campusId, emitScheduleRefreshSignal, profile?.currentContext?.role],
  );

  /** 切换到指定状态：签到/请假/未到 */
  const handleSetStudentCheckin = useCallback(
    (studentId: string, nextStatus: CheckinStatus) => {
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
    },
    [setCheckedStudentIds, setLeaveStudentIds],
  );

  const handleSetTrialCheckin = useCallback(
    (bookingId: string, nextStatus: CheckinStatus) => {
      setTrialCheckinMap((prev) => ({ ...prev, [bookingId]: nextStatus }));
    },
    [setTrialCheckinMap],
  );

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

  /**
   * 提交前校验授课教师必须是「教师管理」在册教师（教师管理列表能找到的 Teacher.id）。
   *
   * 背景（用户口径 2026-09-30，问题 5）：班级教师解析失败 / 教师已软删除离职 /
   * 校长等无教师档账号兜底到 currentTeacherId（非 Teacher.id）时，消课请求会被后端
   * 以「教师不存在」拒绝，且逐条失败；这里提前拦截并给出可操作的提示。
   */
  const guardTeachingTeacher = useCallback((): boolean => {
    const valid =
      Boolean(selectedTeachingTeacherId) &&
      teacherOptions.some((teacher) => teacher.id === selectedTeachingTeacherId);
    if (!valid) {
      Taro.showToast({
        title: '授课老师无效或已离职，请重新选择授课老师后再保存',
        icon: 'none',
        duration: 3000,
      });
    }
    return valid;
  }, [selectedTeachingTeacherId, teacherOptions]);

  const addableStudents = useMemo(
    () =>
      allStudents.filter(
        (student) => !classStudents.some((currentStudent) => currentStudent.id === student.id),
      ),
    [allStudents, classStudents],
  );

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
      const saved = recordByStudentId.get(target.id)?.note || '';
      setDetailSheetRemark(studentRemarkDrafts[target.id] || saved);
      setShowStudentDetailSheet(true);
    },
    [
      recordByStudentId,
      setDetailSheetRemark,
      setDetailSheetTarget,
      setShowStudentDetailSheet,
      studentRemarkDrafts,
    ],
  );

  const handleCloseStudentDetailSheet = useCallback(() => {
    setShowStudentDetailSheet(false);
  }, [setShowStudentDetailSheet]);

  const handleConfirmStudentRemark = useCallback(async () => {
    if (!detailSheetTarget) {
      return;
    }
    const remark = detailSheetRemark.trim();
    const studentId = detailSheetTarget.id;

    setStudentRemarkDrafts((prev) => ({ ...prev, [studentId]: remark }));

    if (detailSheetTarget.type === 'trial') {
      Taro.showToast({ title: remark ? '备注已保存' : '备注已清除', icon: 'success' });
      return;
    }

    const record = recordByStudentId.get(studentId);
    if (record) {
      try {
        await lessonRecordService.update(record.id, {
          note: remark || undefined,
        });
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

    Taro.showToast({ title: '已保存，提交点名后生效', icon: 'none' });
  }, [
    detailSheetRemark,
    detailSheetTarget,
    recordByStudentId,
    setRecordByStudentId,
    setStudentRemarkDrafts,
  ]);

  const handleTransferStudent = useCallback(
    async (student: Student, targetClassId: string) => {
      if (!selectedClassId) {
        return;
      }
      try {
        await classService.transferStudent(selectedClassId, targetClassId, student.id);
        Taro.showToast({ title: '调班成功', icon: 'success' });
        setClassStudents((prev) => prev.filter((s) => s.id !== student.id));
        setShowStudentDetailSheet(false);
      } catch (err) {
        logError('transfer student', err);
        Taro.showToast({ title: '调班失败', icon: 'none' });
      }
    },
    [selectedClassId, setClassStudents, setShowStudentDetailSheet],
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
        setShowStudentDetailSheet(false);
      } catch (err) {
        logError('remove student', err);
        Taro.showToast({ title: '移除失败', icon: 'none' });
      }
    },
    [selectedClassId, setClassStudents, setShowStudentDetailSheet],
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

      /**
       * 点名名单加人 = 把学员正式加进这个班（与「移除学员立刻从班级移除」对称）。
       * 早先只改本地列表、不落库 ⇒ 退出页面人就没了，下次点名也不在名单里。
       * 补录名单（supplement）是「这节课临时来补」的性质，不改班级归属，保持本地。
       */
      const shouldPersistToClass = addStudentSheetPurpose === 'attendance';
      if (shouldPersistToClass) {
        if (!selectedClassId) {
          Taro.showToast({ title: '缺少班级信息', icon: 'none' });
          return;
        }
        try {
          await classService.addStudents(selectedClassId, ids);
        } catch (err) {
          logError('add students to class', err);
          Taro.showToast({ title: '添加失败，请重试', icon: 'none' });
          return;
        }
      }

      /**
       * 加人时并发取会员卡：取不到卡的学员提交时会被提示
       * 「无可扣课时」，所以取卡失败**不阻断加人**。
       */
      const cardEntries = await Promise.all(
        appendedStudents.map(async (student) => {
          const cards = await memberCardService
            .getByStudent(student.id)
            .catch(() => [] as MemberCardDetail[]);
          const subjectId = (cards ?? [])
            .map((card) => card.cardTypeSubjectId)
            .find((value): value is string => Boolean(value));
          const subject = subjectId ? await subjectService.getById(subjectId) : null;
          return { studentId: student.id, subject, cards: cards ?? [] };
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
      setStudentSubjects((prev) => {
        const next = new Map(prev);
        cardEntries.forEach(({ studentId, subject }) => {
          next.set(studentId, subject);
        });
        return next;
      });
      setStudentMemberCards((prev) => {
        const next = new Map(prev);
        cardEntries.forEach(({ studentId, cards }) => {
          next.set(studentId, cards);
        });
        return next;
      });
      setShowAddStudentSheet(false);

      if (addStudentSheetPurpose === 'supplement') {
        setSupplementStudentIds(new Set(ids));
        setAttendanceMode('supplement');
        return;
      }

      // 写库成功：发刷新信号（返回课表页会重拉），并强制重拉班级名单，
      // 避免本页还停留在写之前的旧名单快照上。
      emitScheduleRefreshSignal();
      Taro.showToast({ title: '已加入班级', icon: 'success' });
      if (selectedClassId) {
        await loadClassStudents(selectedClassId, { force: true });
      }
    },
    [
      addStudentSheetPurpose,
      addableStudents,
      emitScheduleRefreshSignal,
      leaveStudentIds,
      loadClassStudents,
      selectedClassId,
      setAttendanceMode,
      setCheckedStudentIds,
      setStudentMemberCards,
      setClassStudents,
      setShowAddStudentSheet,
      setStudentSubjects,
      setSupplementStudentIds,
    ],
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
  }, [allSelectableChecked, classStudents, leaveStudentIds, setCheckedStudentIds]);

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
        // 刚写完点名/补录：名单内存快照必须跳过（force），否则会读到写之前的旧名单
        await loadClassStudents(selectedClassId, { force: true });
      }
    },
    [emitScheduleRefreshSignal, loadClassStudents, selectedClassId],
  );

  const buildPersistShared = useCallback(
    () => ({
      lessonDate,
      scheduleId,
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
      studentSubjects,
      studentMemberCards,
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
      scheduleId,
      selectedAssistantTeacherId,
      selectedClassId,
      selectedTeachingTeacherId,
      studentMemberCards,
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
    [currentUserId, handleAttendanceSaveSuccess, invalidateStudents, setSubmitting, submitLockRef],
  );

  const handleSupplementSave = useCallback(async () => {
    if (!guardTeachingTeacher()) return;
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
    guardTeachingTeacher,
    hoursUsed,
    profile,
    recordByStudentId,
    selectedClassId,
    supplementStudentIds,
  ]);

  const handleIncrementalEditSave = useCallback(async () => {
    if (!guardTeachingTeacher()) return;
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
    guardTeachingTeacher,
    hoursUsed,
    recordByStudentId,
    selectedClassId,
    setAttendanceMode,
  ]);

  const handleSingleSubmit = useCallback(async () => {
    /**
     * 扣哪张卡由单人面板选定的会员卡决定。
     * 未选中时兜底按规则挑一张；取卡失败不阻断流程，由 executeSingleDeduct 统一提示。
     */
    let matchedMemberCard: MemberCardDetail | null = matchedCard;
    if (selectedStudent && !matchedMemberCard) {
      try {
        const cards = await memberCardService.getByStudent(selectedStudent.id);
        matchedMemberCard = pickMemberCardForLesson(cards, hoursUsed);
      } catch (err) {
        logError('lesson-form single deduct load member cards', err);
      }
    }
    await executeSingleDeduct({
      selectedStudent,
      matchedMemberCard,
      hoursUsed,
      lessonDate,
      scheduleId,
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
    matchedCard,
    hoursUsed,
    selectedTeachingTeacherId,
    currentTeacherId,
    currentUserId,
    lessonDate,
    scheduleId,
    content,
    performance,
    homework,
    homeworkImages,
    profile,
    invalidateStudents,
    handleSubmitSuccessReturn,
    campusId,
    room,
    setSubmitting,
    submitLockRef,
  ]);

  const handleClassSubmit = useCallback(async () => {
    if (!guardTeachingTeacher()) return;
    await executeClassSubmit({
      selectedClassId,
      selectedClassName,
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
      scheduleId,
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
      studentSubjects,
      studentMemberCards,
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
    guardTeachingTeacher,
    homework,
    homeworkImages,
    hoursUsed,
    invalidateStudents,
    handleSubmitSuccessReturn,
    lessonDate,
    scheduleId,
    loadLessonRecordsByDate,
    leaveStudents,
    absentStudents,
    performance,
    classStudents,
    presentStudents,
    profile?.id,
    selectedAssistantTeacherId,
    selectedClassName,
    selectedClassId,
    selectedTeachingTeacherId,
    classAbsentCount,
    studentMemberCards,
    studentRemarkDrafts,
    studentSubjects,
    trialBookings,
    presentTrialBookings,
    leaveTrialBookings,
    absentTrialBookings,
    trialLeadMap,
    campusId,
    room,
    setSubmitting,
    submitLockRef,
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

  const submitText = useMemo(() => {
    if (mode === 'single') {
      if (!selectedStudent || !matchedCard) return '确认消课';
      const isOwe = getMemberCardRemaining(matchedCard) < hoursUsed;
      return isOwe ? `确认消课（欠课${hoursUsed}课时）` : `确认消课 ${hoursUsed}课时`;
    }
    const totalPresent = presentStudents.length + presentTrialBookings.length;
    if (totalPresent === 0) return '确认消课';
    return `确认消课 ${totalPresent}人×${hoursUsed}课时`;
  }, [
    matchedCard,
    mode,
    presentStudents.length,
    presentTrialBookings.length,
    selectedStudent,
    hoursUsed,
  ]);

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

  return {
    handleSetStudentCheckin,
    handleSetTrialCheckin,
    presentTrialBookings,
    classCheckedCount,
    classLeaveCount,
    classAbsentCount,
    allSelectableChecked,
    addableStudents,
    handleOpenStudentDetailSheet,
    handleCloseStudentDetailSheet,
    handleConfirmStudentRemark,
    handleTransferStudent,
    handleRemoveStudent,
    handleConfirmAddStudents,
    handleToggleSelectAllStudents,
    handleSubmit,
    submitText,
    studentCheckinStatusMap,
  };
}
