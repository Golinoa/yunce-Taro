import { View, Text, Input, Picker, Textarea, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import ActionButton from '@/components/ActionButton';
import BottomSheet from '@/components/BottomSheet';
import Icon from '@/components/Icon';
import ClassSelector from '@/components/lesson/ClassSelector';
import LessonPreviewSheet from '@/components/lesson/LessonPreviewSheet';
import type { PreviewItem } from '@/components/lesson/LessonPreviewSheet';
import StudentCard from '@/components/lesson/StudentCard';
import StudentCheckinList from '@/components/lesson/StudentCheckinList';
import PageContainer from '@/components/PageContainer';
import PickerItem from '@/components/PickerItem';
import StarRating from '@/components/StarRating';
import Stepper from '@/components/Stepper';
import {
  studentService,
  packageService,
  lessonRecordService,
  notificationService,
  classService,
  subjectService,
  uploadService,
  teacherService,
} from '@/services';
import { useStudentStore, useClassStore } from '@/stores';
import type { Class } from '@/types/class';
import type { CoursePackage } from '@/types/course-package';
import type { Student } from '@/types/student';
import type { Subject } from '@/types/subject';
import type { TeacherUIModel } from '@/types/teacher';
import { useAuth } from '@/utils/auth';
import { logError } from '@/utils/logger';
import { pickBestPackage } from '@/utils/package-helper';
import { withRouteGuard } from '@/utils/route-guard';

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

const LessonForm: React.FC = () => {
  const { profile } = useAuth();

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

  // ===== 班级模式状态 =====
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClassId, setSelectedClassId] = useState(classIdParam);
  const [classStudents, setClassStudents] = useState<Student[]>([]);
  const [checkedStudentIds, setCheckedStudentIds] = useState<Set<string>>(new Set());
  const [studentPackages, setStudentPackages] = useState<Map<string, CoursePackage>>(new Map());
  const [studentSubjects, setStudentSubjects] = useState<Map<string, Subject | null>>(new Map());
  const [classActionMode, setClassActionMode] = useState<'consume' | 'cancel'>('consume');
  const [cancelReason, setCancelReason] = useState('');

  // ===== 当前身份 =====
  const currentUserId = profile?.id || '';
  const currentTeacherId = profile?.teacher_profile?.id || currentUserId;
  const [teacherOptions, setTeacherOptions] = useState<TeacherUIModel[]>([]);
  const [selectedTeachingTeacherId, setSelectedTeachingTeacherId] = useState('');
  const [selectedAssistantTeacherId, setSelectedAssistantTeacherId] = useState('');

  // ===== 课程信息 =====
  const now = useMemo(() => new Date(), []);
  const [lessonDate, setLessonDate] = useState(formatDate(now));
  const [lessonTime, setLessonTime] = useState(formatTime(now));
  const [hoursUsed, setHoursUsed] = useState(1);
  const [content, setContent] = useState('');
  const [performance, setPerformance] = useState(0);
  const [homework, setHomework] = useState('');
  const [homeworkImages, setHomeworkImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showPreviewSheet, setShowPreviewSheet] = useState(false);
  const [previewItems, setPreviewItems] = useState<PreviewItem[]>([]);

  // ===== 初始化加载 =====
  useEffect(() => {
    const loadData = async () => {
      const [classList, teacherList] = await Promise.all([
        fetchClassesByTeacher(currentUserId),
        teacherService.getList(),
      ]);
      setClasses(classList);
      setTeacherOptions(teacherList);
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
        applyClassTeacherDefaults(classInfo, teacherList);
        setClassStudents(students);
        setCheckedStudentIds(new Set(students.map((s) => s.id)));
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
    profile?.name,
    studentIdParam,
  ]);

  // ===== 单人模式：自动匹配课包 =====
  const autoMatchPackage = useCallback(
    async (studentId: string) => {
      const pkgs = await packageService.getActiveByStudent(studentId);
      const best = pickBestPackage(pkgs, hoursUsed);
      setMatchedPackage(best);

      if (best?.subject_id) {
        const sub = await subjectService.getById(best.subject_id);
        setMatchedSubject(sub);
      } else {
        setMatchedSubject(null);
      }
    },
    [hoursUsed],
  );

  // 课时变化时重新匹配
  useEffect(() => {
    if (selectedStudent && mode === 'single') {
      autoMatchPackage(selectedStudent.id);
    }
  }, [hoursUsed, selectedStudent, mode, autoMatchPackage]);

  // ===== 单人模式：选择学生 =====
  const handleOpenStudentPicker = useCallback(async () => {
    if (allStudents.length === 0) {
      const list = await fetchStudentsByTeacher(currentUserId);
      setAllStudents(list);
    }
    setShowStudentPicker(true);
  }, [allStudents.length, currentUserId, fetchStudentsByTeacher]);

  const handleSelectStudent = useCallback(
    async (stu: Student) => {
      setSelectedStudent(stu);
      setShowStudentPicker(false);
      await autoMatchPackage(stu.id);
    },
    [autoMatchPackage],
  );

  const selectedTeachingTeacher = useMemo(
    () => teacherOptions.find((teacher) => teacher.id === selectedTeachingTeacherId) || null,
    [teacherOptions, selectedTeachingTeacherId],
  );

  const selectedTeachingTeacherIndex = useMemo(
    () => Math.max(0, teacherOptions.findIndex((teacher) => teacher.id === selectedTeachingTeacherId)),
    [teacherOptions, selectedTeachingTeacherId],
  );

  const assistantTeacherOptions = useMemo(
    () =>
      teacherOptions.filter(
        (teacher) => teacher.role === 'assist' || teacher.id === selectedAssistantTeacherId,
      ),
    [selectedAssistantTeacherId, teacherOptions],
  );

  const selectedAssistantTeacher = useMemo(
    () => assistantTeacherOptions.find((teacher) => teacher.id === selectedAssistantTeacherId) || null,
    [assistantTeacherOptions, selectedAssistantTeacherId],
  );

  const selectedAssistantTeacherIndex = useMemo(
    () =>
      Math.max(
        0,
        assistantTeacherOptions.findIndex((teacher) => teacher.id === selectedAssistantTeacherId),
      ),
    [assistantTeacherOptions, selectedAssistantTeacherId],
  );

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
        configuredTeachers.find((teacher) => teacher.role !== 'assist') ||
        configuredTeachers[0] ||
        options.find((teacher) => teacher.id === classInfo.teacher_id) ||
        options.find((teacher) => teacher.id === currentTeacherId) ||
        null;
      const assistantTeacher =
        configuredTeachers.find((teacher) => teacher.role === 'assist' && teacher.id !== leadTeacher?.id) ||
        null;

      setSelectedTeachingTeacherId(leadTeacher?.id || currentTeacherId);
      setSelectedAssistantTeacherId(assistantTeacher?.id || '');
    },
    [currentTeacherId],
  );

  // ===== 班级模式：加载班级学员 =====
  const loadClassStudents = useCallback(
    async (classId: string) => {
      setSelectedClassId(classId);
      const [classInfo, students] = await Promise.all([
        classService.getById(classId),
        classService.getStudents(classId),
      ]);
      applyClassTeacherDefaults(classInfo, teacherOptions);
      setClassStudents(students);
      // 默认全部签到
      setCheckedStudentIds(new Set(students.map((s) => s.id)));

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
    },
    [applyClassTeacherDefaults, hoursUsed, teacherOptions],
  );

  // ===== 班级模式：切换班级 =====
  const handleSelectClass = useCallback(
    (classId: string) => {
      loadClassStudents(classId);
    },
    [loadClassStudents],
  );

  // ===== 班级模式：切换签到 =====
  const handleToggleCheckin = useCallback((studentId: string) => {
    setCheckedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  }, []);

  // ===== 班级模式：出勤学员 =====
  const presentStudents = useMemo(
    () => classStudents.filter((s) => checkedStudentIds.has(s.id)),
    [classStudents, checkedStudentIds],
  );

  // ===== 图片上传 =====
  const handleUploadImage = useCallback(async () => {
    if (homeworkImages.length >= 3) {
      Taro.showToast({ title: '最多上传3张图片', icon: 'none' });
      return;
    }
    try {
      const res = await Taro.chooseImage({
        count: Math.min(3 - homeworkImages.length, 3),
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
      });
      setUploading(true);
      const tempPaths = res.tempFilePaths || [];
      // 通过 uploadService 上传，mock 阶段返回固定 URL
      const results = await uploadService.uploadBatch(tempPaths);
      const urls = results.map((r) => r.url);
      setHomeworkImages((prev) => [...prev, ...urls]);
      if (urls.length > 0) {
        Taro.showToast({ title: `上传成功 ${urls.length} 张`, icon: 'success' });
      }
    } catch {
      // 用户取消或上传失败
    } finally {
      setUploading(false);
    }
  }, [homeworkImages]);

  const handleRemoveImage = useCallback((index: number) => {
    setHomeworkImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // ===== 单人模式提交 =====
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

    setSubmitting(true);
    try {
      const lessonDateValue = lessonDate;

      // 检测跨科目：课包科目与学生其他课包科目不一致
      const isCrossSubject =
        !!matchedPackage.subject_id &&
        !!matchedSubject &&
        studentSubjects.get(selectedStudent.id)?.id !== matchedPackage.subject_id;

      // 真实后端会在创建消课时自动扣减课时，前端不能重复调用扣减接口。
      const createdRecord = await lessonRecordService.create({
        teacher_id: selectedTeachingTeacherId || currentTeacherId,
        operator_teacher_id: currentTeacherId || selectedTeachingTeacherId,
        student_id: selectedStudent.id,
        package_id: matchedPackage.id,
        lesson_date: lessonDateValue,
        hours_used: hoursUsed,
        is_cross_subject: isCrossSubject || undefined,
        package_subject: isCrossSubject ? matchedSubject?.name : undefined,
        class_subject: isCrossSubject ? studentSubjects.get(selectedStudent.id)?.name : undefined,
        content: content.trim() || undefined,
        performance: performance > 0 ? `${performance}星` : undefined,
        homework: homework.trim() || undefined,
        homework_images: homeworkImages.length > 0 ? homeworkImages : undefined,
      });

      // 跨科目消课通知校长
      if (isCrossSubject) {
        // TODO: 联调时替换为真实校长 ID
        await notificationService.send({
          sender_id: profile?.id || '',
          receiver_id: 'principal',
          title: '跨科目消课提醒',
          content: `${selectedStudent.name} 使用「${matchedSubject?.name}」课包消课 ${hoursUsed} 课时（班级科目：${studentSubjects.get(selectedStudent.id)?.name || '通用'}）`,
          related_id: selectedStudent.id,
        });
      }

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

      Taro.showToast({ title: '消课成功', icon: 'success' });
      invalidateStudents(currentUserId);
      setTimeout(() => Taro.navigateBack(), 1500);
    } catch (err) {
      logError('submit lesson', err);
      Taro.showToast({ title: '提交失败，请重试', icon: 'none' });
    } finally {
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
    lessonTime,
    content,
    performance,
    homework,
    homeworkImages,
    profile,
    invalidateStudents,
    matchedSubject,
    studentSubjects,
  ]);

  // ===== 班级模式：生成预览数据 =====
  const handleClassSubmit = useCallback(() => {
    if (!selectedClassId) {
      Taro.showToast({ title: '请选择班级', icon: 'none' });
      return;
    }
    if (presentStudents.length === 0) {
      Taro.showToast({ title: '至少需要一名学生签到', icon: 'none' });
      return;
    }
    if (hoursUsed <= 0) {
      Taro.showToast({ title: '消课课时必须大于0', icon: 'none' });
      return;
    }

    // 收集每位学员的课包匹配结果，生成预览数据
    const items: PreviewItem[] = presentStudents.map((student) => {
      const pkg = studentPackages.get(student.id);
      if (!pkg) {
        return {
          studentId: student.id,
          studentName: student.name,
          packageName: '',
          deductHours: hoursUsed,
          purchasedBefore: 0,
          bonusBefore: 0,
          purchasedAfter: 0,
          bonusAfter: 0,
          remainingAfter: 0,
          status: 'error' as const,
          warningText: '无可用课包',
          skipped: true,
        };
      }

      // 模拟 FIFO 扣减预览
      let remaining = hoursUsed;
      let purchasedAfter = pkg.purchased_remaining;
      let bonusAfter = pkg.bonus_remaining;

      if (remaining > 0 && purchasedAfter > 0) {
        const deduct = Math.min(remaining, purchasedAfter);
        purchasedAfter -= deduct;
        remaining -= deduct;
      }
      if (remaining > 0 && bonusAfter > 0) {
        const deduct = Math.min(remaining, bonusAfter);
        bonusAfter -= deduct;
        remaining -= deduct;
      }

      const remainingAfter = purchasedAfter + bonusAfter;
      const isInsufficient = pkg.remaining_hours < hoursUsed;

      return {
        studentId: student.id,
        studentName: student.name,
        packageName: pkg.name,
        deductHours: hoursUsed,
        purchasedBefore: pkg.purchased_remaining,
        bonusBefore: pkg.bonus_remaining,
        purchasedAfter,
        bonusAfter,
        remainingAfter,
        status: isInsufficient ? ('warning' as const) : ('ok' as const),
        warningText: isInsufficient ? `课时不足！仅剩${pkg.remaining_hours}课时` : undefined,
        skipped: false,
      };
    });

    setPreviewItems(items);
    setShowPreviewSheet(true);
  }, [selectedClassId, presentStudents, studentPackages, hoursUsed]);

  const handleClassCancelSubmit = useCallback(async () => {
    if (!selectedClassId) {
      Taro.showToast({ title: '请选择班级', icon: 'none' });
      return;
    }
    if (classStudents.length === 0) {
      Taro.showToast({ title: '当前班级没有学员', icon: 'none' });
      return;
    }

    const reasonText = cancelReason.trim();
    if (!reasonText) {
      Taro.showToast({ title: '请填写取消原因', icon: 'none' });
      return;
    }

    const selectedClass = classes.find((item) => item.id === selectedClassId);
    const confirmResult = await Taro.showModal({
      title: '确认取消本次课程',
      content: `将为 ${classStudents.length} 名学员生成“已取消”记录，默认不扣课时。`,
      confirmText: '确认取消',
      confirmColor: '#ef4444',
    });

    if (!confirmResult.confirm) {
      return;
    }

    setSubmitting(true);
    const successList: string[] = [];
    const failList: { name: string; reason: string }[] = [];

    try {
      for (const student of classStudents) {
        const pkg = studentPackages.get(student.id);

        try {
          await lessonRecordService.create({
            teacher_id: selectedTeachingTeacherId || currentTeacherId,
            operator_teacher_id: currentTeacherId || selectedTeachingTeacherId,
            assistant_teacher_id: selectedAssistantTeacherId || undefined,
            student_id: student.id,
            package_id: pkg?.id || '',
            class_id: selectedClassId,
            lesson_date: lessonDate,
            hours_used: 0,
            status: 'cancelled',
            content: `取消开课：${reasonText}`,
          });

          const parents = await studentService.getParents(student.id);
          for (const binding of parents) {
            await notificationService.send({
              sender_id: profile?.id || '',
              receiver_id: binding.parent_id,
              title: `${selectedClass?.name || '班级课程'}已取消`,
              content: `${lessonDate} ${lessonTime} 的课程已取消，原因：${reasonText}`,
              related_id: student.id,
            });
          }

          successList.push(student.name);
        } catch (err) {
          logError('class cancel single student', err);
          failList.push({ name: student.name, reason: '生成取消记录失败' });
        }
      }

      if (failList.length === 0) {
        Taro.showToast({ title: `已取消 ${successList.length} 名学员课程`, icon: 'success' });
      } else if (successList.length === 0) {
        Taro.showToast({ title: '取消失败，请重试', icon: 'none' });
      } else {
        Taro.showToast({
          title: `${successList.length}人已取消，${failList.length}人失败`,
          icon: 'none',
          duration: 3000,
        });
      }

      invalidateStudents(currentUserId);
      setTimeout(() => Taro.navigateBack(), 1800);
    } catch (err) {
      logError('class cancel submit', err);
      Taro.showToast({ title: '取消失败，请重试', icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  }, [
    cancelReason,
    classStudents,
    classes,
    currentTeacherId,
    currentUserId,
    invalidateStudents,
    lessonDate,
    lessonTime,
    profile,
    selectedAssistantTeacherId,
    selectedClassId,
    selectedTeachingTeacherId,
    studentPackages,
  ]);

  // ===== 班级模式：确认预览后执行消课 =====
  const handleConfirmPreview = useCallback(
    async (skippedIds: string[]) => {
      setShowPreviewSheet(false);
      setSubmitting(true);
      const successList: string[] = [];
      const failList: { name: string; reason: string }[] = [];
      const skippedSet = new Set(skippedIds);

      try {
        const lessonDateValue = lessonDate;

        for (const student of presentStudents) {
          // 跳过用户标记跳过的学员
          if (skippedSet.has(student.id)) continue;

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
              performance: performance > 0 ? `${performance}星` : undefined,
              homework: homework.trim() || undefined,
              homework_images: homeworkImages.length > 0 ? homeworkImages : undefined,
            });

            // 跨科目消课通知校长
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

            successList.push(student.name);
          } catch (err) {
            logError('classSubmit single student', err);
            failList.push({ name: student.name, reason: '消课失败' });
          }
        }

        // 汇总结果提示
        const skipCount = skippedIds.length;
        if (failList.length === 0 && skipCount === 0) {
          Taro.showToast({ title: `已完成 ${successList.length} 名学生消课`, icon: 'success' });
        } else if (successList.length === 0) {
          Taro.showToast({ title: '全部消课失败', icon: 'none' });
        } else {
          const parts = [`${successList.length}人成功`];
          if (failList.length > 0) parts.push(`${failList.length}人失败`);
          if (skipCount > 0) parts.push(`${skipCount}人跳过`);
          Taro.showToast({ title: parts.join('，'), icon: 'none', duration: 3000 });
        }

        invalidateStudents(currentUserId);
        setTimeout(() => Taro.navigateBack(), 1800);
      } catch (err) {
        logError('class submit', err);
        Taro.showToast({ title: '提交失败，请重试', icon: 'none' });
      } finally {
        setSubmitting(false);
      }
    },
    [
      presentStudents,
      studentPackages,
      studentSubjects,
      hoursUsed,
      selectedTeachingTeacherId,
      selectedAssistantTeacherId,
      currentTeacherId,
      currentUserId,
      lessonDate,
      lessonTime,
      content,
      performance,
      homework,
      homeworkImages,
      profile,
      invalidateStudents,
    ],
  );

  // ===== 统一提交 =====
  const handleSubmit = useCallback(() => {
    if (mode === 'single') {
      handleSingleSubmit();
    } else {
      if (classActionMode === 'cancel') {
        handleClassCancelSubmit();
      } else {
        handleClassSubmit();
      }
    }
  }, [classActionMode, handleClassCancelSubmit, handleClassSubmit, handleSingleSubmit, mode]);

  // ===== 提交按钮文案 =====
  const submitText = useMemo(() => {
    if (mode === 'single') {
      if (!selectedStudent || !matchedPackage) return '确认消课';
      const isOwe = matchedPackage.remaining_hours < hoursUsed;
      return isOwe ? `确认消课（欠课${hoursUsed}课时）` : `确认消课 ${hoursUsed}课时`;
    }
    if (classActionMode === 'cancel') {
      if (!selectedClassId) return '确认取消本次课程';
      return `确认取消本次课程（${classStudents.length}人）`;
    }
    if (presentStudents.length === 0) return '确认消课';
    return `确认消课 ${presentStudents.length}人×${hoursUsed}课时`;
  }, [
    classActionMode,
    classStudents.length,
    matchedPackage,
    mode,
    presentStudents.length,
    selectedClassId,
    selectedStudent,
    hoursUsed,
  ]);

  // ===== 班级学员签到列表数据 =====
  const checkinItems = useMemo(
    () =>
      classStudents.map((stu) => ({
        student: stu,
        package: studentPackages.get(stu.id) || null,
        subject: studentSubjects.get(stu.id),
        hoursNeeded: hoursUsed,
      })),
    [classStudents, studentPackages, studentSubjects, hoursUsed],
  );

  return (
    <PageContainer safeBottom>
      <View className="min-h-screen bg-gradient-subtle pb-28">
        {/* ====== 渐变头部 ====== */}
        <View className="bg-gradient-primary px-5 pt-10 pb-5">
          <Text className="text-2xl font-bold text-white">课时消课</Text>
        </View>

        {/* 模式切换 Tab - 白色背景+底部指示器 */}
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

        {/* ====== 单人模式 ====== */}
        {mode === 'single' && (
          <>
            {/* 选择学员 */}
            <View className="mx-8 mt-6 mb-6">
              <View className="flex items-center gap-1 mb-3">
                <Text className="text-lg text-foreground">选择学员</Text>
                <Text className="text-lg text-destructive">*</Text>
              </View>

              {selectedStudent ? (
                <>
                  <StudentCard
                    name={selectedStudent.name}
                    nickname={selectedStudent.nickname}
                    avatarUrl={selectedStudent.avatar_url}
                    matchedPackage={matchedPackage}
                    subject={matchedSubject}
                    hoursNeeded={hoursUsed}
                    onChange={() => setShowStudentPicker(true)}
                  />
                  {/* 跨科目提示 */}
                  {matchedPackage?.subject_id &&
                    matchedSubject &&
                    studentSubjects.get(selectedStudent.id)?.id !== matchedPackage.subject_id && (
                      <View className="mt-2 px-4 py-3 rounded-xl bg-warning/10 border border-warning/30">
                        <Text className="text-[26rpx] text-warning">
                          该课包科目与班级不一致，消课将标记为跨科目
                        </Text>
                      </View>
                    )}
                </>
              ) : (
                <View
                  className="btn-secondary border-2 border-dashed border-primary/40 gap-2 bg-primary/5 py-3"
                  onClick={handleOpenStudentPicker}
                >
                  <Text className="text-2xl text-primary font-bold">+</Text>
                  <Text className="text-base text-primary">点击选择学员</Text>
                </View>
              )}
            </View>

            {/* 消课信息（选学员后显示） */}
            {selectedStudent && (
              <>
                {/* 主讲老师 */}
                <View className="mx-8 mb-6 bg-white rounded-2xl p-5 shadow-soft">
                  <View className="flex items-center gap-1 mb-3">
                    <Text className="text-lg text-foreground">主讲老师</Text>
                    <Text className="text-lg text-destructive">*</Text>
                  </View>
                  <Picker
                    mode="selector"
                    range={teacherOptions.map((teacher) => teacher.name)}
                    value={selectedTeachingTeacherIndex}
                    onChange={(e) => {
                      const nextTeacher = teacherOptions[Number(e.detail.value || 0)];
                      if (nextTeacher?.id) {
                        setSelectedTeachingTeacherId(nextTeacher.id);
                      }
                    }}
                  >
                    <View className="border-2 border-input rounded-2xl py-3 px-5 bg-background shadow-soft flex items-center justify-between overflow-hidden">
                      <View className="flex-1 min-w-0">
                        <Text className="text-lg text-foreground truncate block">
                          {selectedTeachingTeacher?.name || profile?.name || '请选择主讲老师'}
                        </Text>
                        <Text className="text-[22rpx] text-muted-foreground mt-[4rpx] block truncate">
                          默认当前操作人，可改为其他老师
                        </Text>
                      </View>
                      <Icon name="mdi-chevron-right" size="sm" color="muted" />
                    </View>
                  </Picker>
                </View>

                {/* 消课课时 */}
                <View className="mx-8 mb-6 bg-white rounded-2xl p-5 shadow-soft">
                  <View className="flex items-center gap-1 mb-3">
                    <Text className="text-lg text-foreground">消课课时</Text>
                    <Text className="text-lg text-destructive">*</Text>
                  </View>
                  <Stepper value={hoursUsed} min={0.5} step={0.5} onChange={setHoursUsed} />
                </View>

                {/* 上课时间 */}
                <View className="mx-8 mb-6 bg-white rounded-2xl p-5 shadow-soft">
                  <Text className="text-lg text-foreground">上课时间</Text>
                  <View className="flex gap-5 mt-3">
                    <Picker
                      mode="date"
                      value={lessonDate}
                      onChange={(e) => setLessonDate(e.detail.value || lessonDate)}
                    >
                      <View className="flex-1 border-2 border-input rounded-2xl py-3 px-5 bg-background shadow-soft flex items-center justify-between overflow-hidden">
                        <Text className="text-lg text-foreground">{lessonDate}</Text>
                        <Icon name="mdi-calendar" size="sm" color="muted" />
                      </View>
                    </Picker>
                    <Picker
                      mode="time"
                      value={lessonTime}
                      onChange={(e) => setLessonTime(e.detail.value || lessonTime)}
                    >
                      <View className="flex-1 border-2 border-input rounded-2xl py-3 px-5 bg-background shadow-soft flex items-center justify-between overflow-hidden">
                        <Text className="text-lg text-foreground">{lessonTime}</Text>
                        <Icon name="mdi-clock-outline" size="sm" color="muted" />
                      </View>
                    </Picker>
                  </View>
                </View>

                {/* 教学内容 */}
                <View className="mx-8 mb-6 bg-white rounded-2xl p-5 shadow-soft">
                  <Text className="text-lg text-foreground">教学内容</Text>
                  <Textarea
                    className="w-full mt-3 p-4 bg-background rounded-2xl text-base text-foreground min-h-[120rpx]"
                    placeholder="选填"
                    value={content}
                    onInput={(e) => setContent(e.detail.value || '')}
                  />
                </View>

                {/* 学生表现 */}
                <View className="mx-8 mb-6 bg-white rounded-2xl p-5 shadow-soft">
                  <Text className="text-lg text-foreground">学生表现</Text>
                  <View className="mt-3">
                    <StarRating value={performance} onChange={setPerformance} />
                  </View>
                </View>

                {/* 课后作业 */}
                <View className="mx-8 mb-6 bg-white rounded-2xl p-5 shadow-soft">
                  <Text className="text-lg text-foreground">课后作业</Text>
                  <Textarea
                    className="w-full mt-3 p-4 bg-background rounded-2xl text-base text-foreground min-h-[120rpx]"
                    placeholder="选填"
                    value={homework}
                    onInput={(e) => setHomework(e.detail.value || '')}
                  />
                  {/* 图片上传 */}
                  <View className="flex flex-wrap gap-3 mt-3">
                    {homeworkImages.map((img, idx) => (
                      <View key={idx} className="relative w-[160rpx] h-[160rpx]">
                        <Image
                          src={img}
                          mode="aspectFill"
                          className="w-[160rpx] h-[160rpx] rounded-xl"
                        />
                        <View
                          className="absolute -top-2 -right-2 w-[40rpx] h-[40rpx] rounded-full bg-destructive flex items-center justify-center"
                          onClick={() => handleRemoveImage(idx)}
                        >
                          <Text className="text-white text-xs">×</Text>
                        </View>
                      </View>
                    ))}
                    {homeworkImages.length < 3 && (
                      <View
                        className={`w-[160rpx] h-[160rpx] rounded-xl border-2 border-dashed border-input flex items-center justify-center bg-background ${uploading ? 'state-loading' : 'press-scale'}`}
                        onClick={uploading ? undefined : handleUploadImage}
                      >
                        <Text className="text-2xl text-muted-foreground">
                          {uploading ? '...' : '+'}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </>
            )}
          </>
        )}

        {/* ====== 班级模式 ====== */}
        {mode === 'class' && (
          <>
            {/* 选择班级 */}
            <View className="mx-8 mt-6 mb-6">
              <View className="flex items-center gap-1 mb-3">
                <Text className="text-lg text-foreground">选择班级</Text>
                <Text className="text-lg text-destructive">*</Text>
              </View>
              <ClassSelector
                classes={classes}
                selectedClassId={selectedClassId}
                onSelect={handleSelectClass}
              />
            </View>

            {/* 操作类型 */}
            {selectedClassId && (
              <View className="mx-8 mb-6 bg-white rounded-2xl p-5 shadow-soft">
                <Text className="text-lg text-foreground mb-3 block">操作类型</Text>
                <View className="flex gap-3">
                  <View
                    className={`flex-1 rounded-2xl border-2 px-4 py-3 items-center ${classActionMode === 'consume' ? 'border-primary bg-primary/5' : 'border-input bg-background'}`}
                    onClick={() => setClassActionMode('consume')}
                  >
                    <Text
                      className={`text-base font-medium ${classActionMode === 'consume' ? 'text-primary' : 'text-foreground'}`}
                    >
                      正常消课
                    </Text>
                  </View>
                  <View
                    className={`flex-1 rounded-2xl border-2 px-4 py-3 items-center ${classActionMode === 'cancel' ? 'border-destructive bg-destructive/5' : 'border-input bg-background'}`}
                    onClick={() => setClassActionMode('cancel')}
                  >
                    <Text
                      className={`text-base font-medium ${classActionMode === 'cancel' ? 'text-destructive' : 'text-foreground'}`}
                    >
                      取消本次课程
                    </Text>
                  </View>
                </View>
                <Text className="text-[22rpx] text-muted-foreground mt-[12rpx] block">
                  {classActionMode === 'cancel'
                    ? '取消开课默认作用于全班，会生成已取消记录，但不会扣减课时'
                    : '正常消课时按签到学员生成记录并扣减课时'}
                </Text>
              </View>
            )}

            {/* 主讲老师 */}
            {selectedClassId && (
              <View className="mx-8 mb-6 bg-white rounded-2xl p-5 shadow-soft">
                <View className="flex items-center gap-1 mb-3">
                  <Text className="text-lg text-foreground">主讲老师</Text>
                  <Text className="text-lg text-destructive">*</Text>
                </View>
                <Picker
                  mode="selector"
                  range={teacherOptions.map((teacher) => teacher.name)}
                  value={selectedTeachingTeacherIndex}
                  onChange={(e) => {
                    const nextTeacher = teacherOptions[Number(e.detail.value || 0)];
                    if (nextTeacher?.id) {
                      setSelectedTeachingTeacherId(nextTeacher.id);
                    }
                  }}
                >
                  <View className="border-2 border-input rounded-2xl py-3 px-5 bg-background shadow-soft flex items-center justify-between overflow-hidden">
                    <View className="flex-1 min-w-0">
                      <Text className="text-lg text-foreground truncate block">
                        {selectedTeachingTeacher?.name || profile?.name || '请选择主讲老师'}
                      </Text>
                      <Text className="text-[22rpx] text-muted-foreground mt-[4rpx] block truncate">
                        默认当前操作人，可改为其他老师
                      </Text>
                    </View>
                    <Icon name="mdi-chevron-right" size="sm" color="muted" />
                  </View>
                </Picker>
              </View>
            )}

            {/* 助教老师 */}
            {selectedClassId && (
              <View className="mx-8 mb-6 bg-white rounded-2xl p-5 shadow-soft">
                <Text className="text-lg text-foreground mb-3 block">助教老师</Text>
                {assistantTeacherOptions.length > 0 ? (
                  <Picker
                    mode="selector"
                    range={assistantTeacherOptions.map((teacher) => teacher.name)}
                    value={selectedAssistantTeacherIndex}
                    onChange={(e) => {
                      const nextTeacher =
                        assistantTeacherOptions[Number(e.detail.value || 0)];
                      setSelectedAssistantTeacherId(nextTeacher?.id || '');
                    }}
                  >
                    <View className="border-2 border-input rounded-2xl py-3 px-5 bg-background shadow-soft flex items-center justify-between overflow-hidden">
                      <View className="flex-1 min-w-0">
                        <Text className="text-lg text-foreground truncate block">
                          {selectedAssistantTeacher?.name || '请选择助教老师'}
                        </Text>
                        <Text className="text-[22rpx] text-muted-foreground mt-[4rpx] block truncate">
                          默认带出班级预设助教，可手动改为其他助教
                        </Text>
                      </View>
                      <Icon name="mdi-chevron-right" size="sm" color="muted" />
                    </View>
                  </Picker>
                ) : (
                  <View className="border-2 border-dashed border-input rounded-2xl py-3 px-5 bg-background">
                    <Text className="text-base text-muted-foreground">
                      当前班级未预设助教，可在班级配置中补充
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* 学员签到列表 */}
            {classStudents.length > 0 && (
              <View className="mx-8 mb-6">
                {classActionMode === 'cancel' && (
                  <View className="mb-3 px-4 py-3 rounded-2xl bg-destructive/5 border border-destructive/20">
                    <Text className="text-[24rpx] text-destructive block">
                      当前为取消开课，默认对全班生效，下方名单仅用于查看本次受影响学员
                    </Text>
                  </View>
                )}
                <StudentCheckinList
                  items={checkinItems}
                  checkedIds={
                    classActionMode === 'cancel'
                      ? new Set(classStudents.map((student) => student.id))
                      : checkedStudentIds
                  }
                  onToggle={classActionMode === 'cancel' ? () => {} : handleToggleCheckin}
                />
              </View>
            )}

            {/* 消课课时 */}
            {selectedClassId && classActionMode === 'consume' && (
              <View className="mx-8 mb-6 bg-white rounded-2xl p-5 shadow-soft">
                <View className="flex items-center gap-1 mb-3">
                  <Text className="text-lg text-foreground">消课课时</Text>
                  <Text className="text-lg text-destructive">*</Text>
                </View>
                <Stepper value={hoursUsed} min={0.5} step={0.5} onChange={setHoursUsed} />
              </View>
            )}

            {/* 上课时间 */}
            {selectedClassId && (
              <View className="mx-8 mb-6 bg-white rounded-2xl p-5 shadow-soft">
                <Text className="text-lg text-foreground">上课时间</Text>
                <View className="flex gap-5 mt-3">
                  <Picker
                    mode="date"
                    value={lessonDate}
                    onChange={(e) => setLessonDate(e.detail.value || lessonDate)}
                  >
                    <View className="flex-1 border-2 border-input rounded-2xl py-3 px-5 bg-background shadow-soft flex items-center justify-between overflow-hidden">
                      <Text className="text-base text-foreground">{lessonDate}</Text>
                      <Icon name="mdi-calendar" size="sm" color="muted" />
                    </View>
                  </Picker>
                  <Picker
                    mode="time"
                    value={lessonTime}
                    onChange={(e) => setLessonTime(e.detail.value || lessonTime)}
                  >
                    <View className="flex-1 border-2 border-input rounded-2xl py-3 px-5 bg-background shadow-soft flex items-center justify-between overflow-hidden">
                      <Text className="text-base text-foreground">{lessonTime}</Text>
                      <Icon name="mdi-clock-outline" size="sm" color="muted" />
                    </View>
                  </Picker>
                </View>
              </View>
            )}

            {/* 教学内容 */}
            {selectedClassId && classActionMode === 'consume' && (
              <View className="mx-8 mb-6 bg-white rounded-2xl p-5 shadow-soft">
                <Text className="text-lg text-foreground">教学内容</Text>
                <Textarea
                  className="w-full mt-3 p-4 bg-background rounded-2xl text-base text-foreground min-h-[120rpx]"
                  placeholder="选填"
                  value={content}
                  onInput={(e) => setContent(e.detail.value || '')}
                />
              </View>
            )}

            {/* 取消原因 */}
            {selectedClassId && classActionMode === 'cancel' && (
              <View className="mx-8 mb-6 bg-white rounded-2xl p-5 shadow-soft">
                <View className="flex items-center gap-1 mb-3">
                  <Text className="text-lg text-foreground">取消原因</Text>
                  <Text className="text-lg text-destructive">*</Text>
                </View>
                <Textarea
                  className="w-full mt-3 p-4 bg-background rounded-2xl text-base text-foreground min-h-[120rpx]"
                  placeholder="请填写取消原因，如场地临时调整、老师请假等"
                  value={cancelReason}
                  onInput={(e) => setCancelReason(e.detail.value || '')}
                />
              </View>
            )}
          </>
        )}

        {/* ====== 学员选择弹窗 ====== */}
        <BottomSheet
          show={showStudentPicker}
          visible={showStudentPicker}
          title="选择学员"
          onClose={() => setShowStudentPicker(false)}
        >
          <View className="p-5">
            {/* 搜索框 */}
            <View className="flex items-center gap-3 mb-3 px-3 py-2 bg-muted rounded-xl">
              <Icon name="mdi-magnify" size="sm" color="muted" />
              <Input
                className="flex-1 text-sm text-foreground bg-transparent"
                placeholder="搜索学员姓名或手机号"
                placeholderClass="text-muted-foreground"
              />
            </View>

            {/* 学员列表 */}
            <View className="flex flex-col gap-1">
              {allStudents.map((stu) => (
                <PickerItem
                  key={stu.id}
                  iconType="avatar"
                  avatarBgColor="#5EC8A8"
                  avatarUrl={stu.avatar_url}
                  avatarChar={stu.name[0]}
                  title={stu.name}
                  subtitle={stu.phone || ''}
                  selected={selectedStudent?.id === stu.id}
                  right={{
                    type: 'check-icon',
                    checked: selectedStudent?.id === stu.id,
                  }}
                  onClick={() => handleSelectStudent(stu)}
                />
              ))}
            </View>
          </View>
        </BottomSheet>

        {/* ====== 底部提交按钮 ====== */}
        <ActionButton
          text={submitText}
          disabled={
            submitting ||
            (mode === 'single' && !selectedStudent) ||
            (mode === 'class' &&
              (classActionMode === 'cancel'
                ? !selectedClassId || classStudents.length === 0 || !cancelReason.trim()
                : !selectedClassId || presentStudents.length === 0))
          }
          onClick={handleSubmit}
        />
      </View>

      {/* 班级消课预览弹窗 */}
      <LessonPreviewSheet
        visible={showPreviewSheet}
        items={previewItems}
        onConfirm={handleConfirmPreview}
        onClose={() => setShowPreviewSheet(false)}
      />
    </PageContainer>
  );
};

export default withRouteGuard(LessonForm);
