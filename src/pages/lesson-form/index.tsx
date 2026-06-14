import { View, Text, Input, Picker, Textarea, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import ActionButton from '@/components/ActionButton';
import BottomSheet from '@/components/BottomSheet';
import Icon from '@/components/Icon';
import ClassSelector from '@/components/lesson/ClassSelector';
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
} from '@/services';
import { useStudentStore, useClassStore } from '@/stores';
import type { Class } from '@/types/class';
import type { CoursePackage } from '@/types/course-package';
import type { Student } from '@/types/student';
import type { Subject } from '@/types/subject';
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

  const studentStore = useStudentStore();
  const classStore = useClassStore();

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

  // ===== 教师ID =====
  const teacherId = profile?.id || '';

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

  // ===== 初始化加载 =====
  useEffect(() => {
    const loadData = async () => {
      const classList = await classStore.fetchByTeacher(teacherId);
      setClasses(classList);

      if (studentIdParam) {
        const stu = await studentService.getById(studentIdParam);
        if (stu) {
          setSelectedStudent(stu);
          await autoMatchPackage(stu.id);
        }
      }

      if (classIdParam) {
        await loadClassStudents(classIdParam);
      }
    };
    loadData();
  }, [studentIdParam, classIdParam]);

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
  }, [hoursUsed]);

  // ===== 单人模式：选择学生 =====
  const handleOpenStudentPicker = useCallback(async () => {
    if (allStudents.length === 0) {
      const list = await studentStore.fetchByTeacher(teacherId);
      setAllStudents(list);
    }
    setShowStudentPicker(true);
  }, [allStudents]);

  const handleSelectStudent = useCallback(
    async (stu: Student) => {
      setSelectedStudent(stu);
      setShowStudentPicker(false);
      await autoMatchPackage(stu.id);
    },
    [autoMatchPackage],
  );

  // ===== 班级模式：加载班级学员 =====
  const loadClassStudents = useCallback(
    async (classId: string) => {
      setSelectedClassId(classId);
      const students = await classService.getStudents(classId);
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
    [hoursUsed],
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
      await new Promise((r) => setTimeout(r, 500));
      const newImages = res.tempFilePaths || [];
      setHomeworkImages((prev) => [...prev, ...newImages]);
      if (newImages.length > 0) {
        Taro.showToast({ title: `上传成功 ${newImages.length} 张`, icon: 'success' });
      }
    } catch {
      // 用户取消
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

    setSubmitting(true);
    try {
      const lessonDateTime = new Date(`${lessonDate}T${lessonTime}:00`).toISOString();

      await lessonRecordService.create({
        teacher_id: teacherId,
        student_id: selectedStudent.id,
        package_id: matchedPackage.id,
        lesson_date: lessonDateTime,
        hours_used: hoursUsed,
        content: content.trim() || undefined,
        performance: performance > 0 ? `${performance}星` : undefined,
        homework: homework.trim() || undefined,
        homework_images: homeworkImages.length > 0 ? homeworkImages : undefined,
      });

      const updatedPkg = await packageService.deductHours(matchedPackage.id, hoursUsed);

      const parents = await studentService.getParents(selectedStudent.id);
      const remainAfter = updatedPkg?.remaining_hours ?? matchedPackage.remaining_hours - hoursUsed;
      for (const binding of parents) {
        await notificationService.send({
          sender_id: profile?.id || '',
          receiver_id: binding.parent_id,
          title: `${selectedStudent.name} 课时已消课`,
          content: `本次消课 ${hoursUsed} 课时，剩余 ${remainAfter} 课时`,
          related_id: selectedStudent.id,
        });
      }

      Taro.showToast({ title: '消课成功', icon: 'success' });
      studentStore.invalidate(teacherId);
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
    teacherId,
    lessonDate,
    lessonTime,
    content,
    performance,
    homework,
    homeworkImages,
    profile,
  ]);

  // ===== 班级模式提交 =====
  const handleClassSubmit = useCallback(async () => {
    if (!selectedClassId) {
      Taro.showToast({ title: '请选择班级', icon: 'none' });
      return;
    }
    if (presentStudents.length === 0) {
      Taro.showToast({ title: '至少需要一名学生签到', icon: 'none' });
      return;
    }

    setSubmitting(true);
    try {
      const lessonDateTime = new Date(`${lessonDate}T${lessonTime}:00`).toISOString();
      let successCount = 0;

      for (const student of presentStudents) {
        const pkg = studentPackages.get(student.id);
        if (!pkg) {
          Taro.showToast({ title: `${student.name} 无可用课包，已跳过`, icon: 'none' });
          continue;
        }
        if (pkg.remaining_hours < hoursUsed) {
          Taro.showToast({ title: `${student.name} 课时不足，已跳过`, icon: 'none' });
          continue;
        }

        await lessonRecordService.create({
          teacher_id: teacherId,
          student_id: student.id,
          package_id: pkg.id,
          lesson_date: lessonDateTime,
          hours_used: hoursUsed,
          content: content.trim() || undefined,
          performance: performance > 0 ? `${performance}星` : undefined,
          homework: homework.trim() || undefined,
          homework_images: homeworkImages.length > 0 ? homeworkImages : undefined,
        });

        const updatedPkg = await packageService.deductHours(pkg.id, hoursUsed);

        const parents = await studentService.getParents(student.id);
        for (const binding of parents) {
          await notificationService.send({
            sender_id: profile?.id || '',
            receiver_id: binding.parent_id,
            title: `${student.name} 课时已核销`,
            content: `本次核销 ${hoursUsed} 课时，剩余 ${updatedPkg?.remaining_hours ?? pkg.remaining_hours - hoursUsed} 课时`,
            related_id: student.id,
          });
        }

        successCount++;
      }

      Taro.showToast({ title: `已完成 ${successCount} 名学生消课`, icon: 'success' });
      studentStore.invalidate(teacherId);
      setTimeout(() => Taro.navigateBack(), 1800);
    } catch (err) {
      logError('class submit', err);
      Taro.showToast({ title: '提交失败，请重试', icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  }, [
    selectedClassId,
    presentStudents,
    studentPackages,
    hoursUsed,
    teacherId,
    lessonDate,
    lessonTime,
    content,
    performance,
    homework,
    homeworkImages,
    profile,
  ]);

  // ===== 统一提交 =====
  const handleSubmit = useCallback(() => {
    if (mode === 'single') {
      handleSingleSubmit();
    } else {
      handleClassSubmit();
    }
  }, [mode, handleSingleSubmit, handleClassSubmit]);

  // ===== 提交按钮文案 =====
  const submitText = useMemo(() => {
    if (mode === 'single') {
      if (!selectedStudent || !matchedPackage) return '确认消课';
      const isOwe = matchedPackage.remaining_hours < hoursUsed;
      return isOwe ? `确认消课（欠课${hoursUsed}课时）` : `确认消课 ${hoursUsed}课时`;
    }
    if (presentStudents.length === 0) return '确认消课';
    return `确认消课 ${presentStudents.length}人×${hoursUsed}课时`;
  }, [mode, selectedStudent, matchedPackage, hoursUsed, presentStudents.length]);

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
                <StudentCard
                  name={selectedStudent.name}
                  nickname={selectedStudent.nickname}
                  avatarUrl={selectedStudent.avatar_url}
                  matchedPackage={matchedPackage}
                  subject={matchedSubject}
                  hoursNeeded={hoursUsed}
                  onChange={() => setShowStudentPicker(true)}
                />
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

            {/* 学员签到列表 */}
            {classStudents.length > 0 && (
              <View className="mx-8 mb-6">
                <StudentCheckinList
                  items={checkinItems}
                  checkedIds={checkedStudentIds}
                  onToggle={handleToggleCheckin}
                />
              </View>
            )}

            {/* 消课课时 */}
            {selectedClassId && (
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
            {selectedClassId && (
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
            (mode === 'class' && (!selectedClassId || presentStudents.length === 0))
          }
          onClick={handleSubmit}
        />
      </View>
    </PageContainer>
  );
};

export default withRouteGuard(LessonForm);
