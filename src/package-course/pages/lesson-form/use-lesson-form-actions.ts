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
  packageService,
  lessonRecordService,
  classService,
  subjectService,
  subscribeMessageService,
} from '@/services';
import type { Subject } from '@/types/campus';
import type { CoursePackage } from '@/types/course-package';
import type { Lead, LeadBooking } from '@/types/lead';
import type { LessonRecord } from '@/types/lesson-record';
import type { Student } from '@/types/student';
import { logError } from '@/utils/logger';
import { pickBestPackage } from '@/utils/package-helper';
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
  selectedTeachingTeacherId: string;
  selectedAssistantTeacherId: string;
  currentTeacherId: string;
  currentUserId: string;
  campusId: string;
  room: string;
  content: string;
  performance: number;
  homework: string;
  homeworkImages: string[];
  studentPackages: Map<string, CoursePackage>;
  studentSubjects: Map<string, Subject | null>;
  makeupStudentIds: Set<string>;
  supplementStudentIds: Set<string>;
  attendanceBaseline: Map<string, CheckinStatus>;
  selectedStudent: Student | null;
  matchedPackage: CoursePackage | null;
  profile?: {
    id?: string;
    name?: string;
    currentContext?: { role?: string } | null;
  } | null;
  submitLockRef: MutableRefObject<SubmitLock>;
  invalidateStudents: (userId?: string) => void;
  loadClassStudents: (classId: string) => Promise<void> | void;
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
  setStudentPackages: Dispatch<SetStateAction<Map<string, CoursePackage>>>;
  setStudentSubjects: Dispatch<SetStateAction<Map<string, Subject | null>>>;
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
    selectedTeachingTeacherId,
    selectedAssistantTeacherId,
    currentTeacherId,
    currentUserId,
    campusId,
    room,
    content,
    performance,
    homework,
    homeworkImages,
    studentPackages,
    studentSubjects,
    makeupStudentIds,
    supplementStudentIds,
    attendanceBaseline,
    selectedStudent,
    matchedPackage,
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
    setStudentPackages,
    setStudentSubjects,
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
    [selectedClassId, setClassStudents, setShowStudentDetailSheet, setStudentPackages],
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
    [selectedClassId, setClassStudents, setShowStudentDetailSheet, setStudentPackages],
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
    [
      addStudentSheetPurpose,
      addableStudents,
      hoursUsed,
      leaveStudentIds,
      setAttendanceMode,
      setCheckedStudentIds,
      setClassStudents,
      setShowAddStudentSheet,
      setStudentPackages,
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
    [currentUserId, handleAttendanceSaveSuccess, invalidateStudents, setSubmitting, submitLockRef],
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
    setAttendanceMode,
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
    setSubmitting,
    submitLockRef,
  ]);

  const handleClassSubmit = useCallback(async () => {
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
    selectedClassName,
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
