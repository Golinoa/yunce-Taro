import { View } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { createSubmitLock } from '@/utils/submit-lock';
import PageContainer from '@/components/PageContainer';
import { useStudentStore, useClassStore } from '@/stores';
import { useCampusStore } from '@/stores/campus';
import { useThemeStore } from '@/stores/theme';
import type { CampusUIModel, Room, Subject } from '@/types/campus';
import type { Class } from '@/types/class';
import type { CoursePackage } from '@/types/course-package';
import type { Lead, LeadBooking } from '@/types/lead';
import type { LessonRecord } from '@/types/lesson-record';
import type { Student } from '@/types/student';
import type { TeacherUIModel } from '@/types/teacher';
import { useAuth } from '@/utils/auth';
import { withRouteGuard } from '@/utils/route-guard';
import ClassLessonPanel from './ClassLessonPanel';
import {
  buildCheckinBaseline,
  type CheckinStatus,
  type ClassAttendanceMode,
} from './checkin-status';
import LessonFormFooter from './LessonFormFooter';
import LessonFormHeader from './LessonFormHeader';
import LessonFormSheets from './LessonFormSheets';
import { formatDate, formatTime } from './lesson-form-datetime';
import type { StudentEditSheetTarget } from './StudentEditSheet';
import SingleLessonPanel from './SingleLessonPanel';
import { useLessonFormActions } from './use-lesson-form-actions';
import { useLessonFormHelpers } from './use-lesson-form-helpers';
import { useLessonFormLoaders } from './use-lesson-form-loaders';

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
  const [detailSheetTarget, setDetailSheetTarget] = useState<StudentEditSheetTarget | null>(null);
  const [detailSheetRemark, setDetailSheetRemark] = useState('');
  // 单学员备注草稿：studentId → 备注。优先落库到消课记录（record.note）；
  // 学员尚无考勤记录时先暂存于此，随下次提交点名写入记录，保证输入不丢失。
  const [studentRemarkDrafts, setStudentRemarkDrafts] = useState<Record<string, string>>({});

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

  const { applyMatchedPackage, autoMatchPackage, loadClassStudents, loadLessonRecordsByDate } =
    useLessonFormLoaders({
      isEditEntryAttempt,
      classIdParam,
      studentIdParam,
      viewOnlyParam,
      currentTeacherId,
      currentUserId,
      attendanceRecordActorId,
      profileName: profile?.name,
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
    });

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

  const handleBack = useCallback(() => {
    Taro.navigateBack({
      fail: () => {
        void Taro.switchTab({ url: '/pages/schedule/index' });
      },
    });
  }, []);

  const handleConfirmSelector = useCallback(
    (v: string) => {
      if (selector.type === 'teacher') setSelectedTeachingTeacherId(v);
      else if (selector.type === 'campus') {
        setCampusId(v);
        setRoom('');
      } else if (selector.type === 'package') {
        void handlePickPackage(v);
      } else setRoom(v);
      setSelector((prev) => ({ ...prev, visible: false }));
    },
    [handlePickPackage, selector.type],
  );

  const {
    handleSetStudentCheckin,
    handleSetTrialCheckin,
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
  } = useLessonFormActions({
    isEditEntryAttempt,
    mode,
    isAlreadyChecked,
    attendanceMode,
    selectedClassId,
    selectedClassName: selectedClass?.name,
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
  });

  const {
    isClassPaused,
    handleToggleClassPause,
    isClassDirectEntry,
    shouldShowModeTabs,
    displayLessonTime,
    canModifyLesson,
    pageTitle,
    handleUploadImage,
    handleRemoveImage,
    mergedStudentList,
    getTrialCardInfo,
    getStudentCardInfo,
  } = useLessonFormHelpers({
    classIdParam,
    recordIdParam,
    mode,
    viewOnlyParam,
    lessonDate,
    lessonTime,
    selectedClass,
    selectedClassId,
    homeworkImages,
    setHomeworkImages,
    setUploading,
    setClasses,
    themeActiveTheme: themeStore.activeTheme,
    classStudents,
    studentSearchKeyword,
    attendanceFilter,
    studentCheckinStatusMap,
    trialBookings,
    trialLeadMap,
    trialCheckinMap,
    studentPackages,
    studentSubjects,
    hoursUsed,
  });

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

      {/* ====== 弹层：学员多选 / 编辑 / Picker / 日期 ====== */}
      <LessonFormSheets
        showStudentPicker={showStudentPicker}
        allStudents={allStudents}
        selectedStudent={selectedStudent}
        subjectOptions={subjectOptions}
        onCloseStudentPicker={() => setShowStudentPicker(false)}
        onConfirmSingleStudent={handleConfirmSingleStudent}
        showAddStudentSheet={showAddStudentSheet}
        addableStudents={addableStudents}
        selectedClass={selectedClass}
        addStudentSheetPurpose={addStudentSheetPurpose}
        onCloseAddStudentSheet={() => setShowAddStudentSheet(false)}
        onConfirmAddStudents={(ids) => void handleConfirmAddStudents(ids)}
        showStudentDetailSheet={showStudentDetailSheet}
        detailSheetTarget={detailSheetTarget}
        detailSheetRemark={detailSheetRemark}
        classes={classes}
        selectedClassId={selectedClassId}
        onRemarkChange={setDetailSheetRemark}
        onCloseStudentDetailSheet={handleCloseStudentDetailSheet}
        onTransferStudent={handleTransferStudent}
        onRemoveStudent={handleRemoveStudent}
        onConfirmStudentRemark={handleConfirmStudentRemark}
        selector={selector}
        teacherOptions={teacherOptions}
        campusOptions={campusOptions}
        rooms={rooms}
        studentActivePackages={studentActivePackages}
        selectedTeachingTeacherId={selectedTeachingTeacherId}
        campusId={campusId}
        matchedPackageId={matchedPackage?.id || ''}
        room={room}
        onCloseSelector={() => setSelector((prev) => ({ ...prev, visible: false }))}
        onConfirmSelector={handleConfirmSelector}
        lessonDatePickerVisible={lessonDatePickerVisible}
        lessonDate={lessonDate}
        onCloseLessonDatePicker={() => setLessonDatePickerVisible(false)}
        onConfirmLessonDate={(date) => {
          setLessonDate(date);
          setLessonDatePickerVisible(false);
        }}
      />
    </PageContainer>
  );
};

export default withRouteGuard(LessonForm);
