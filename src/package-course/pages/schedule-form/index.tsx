import { View, Text, Picker } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import ActionButton from '@/components/ActionButton';
import Empty from '@/components/Empty';
import Icon from '@/components/Icon';
import Loading from '@/components/Loading';
import PageContainer from '@/components/PageContainer';
import { classService, notificationService, scheduleService, studentService } from '@/services';
import { useStudentStore, useClassStore } from '@/stores';
import type { Class } from '@/types/class';
import type { Schedule, ScheduleColor, DayOfWeek } from '@/types/schedule';
import type { Student } from '@/types/student';
import { useAuth } from '@/utils/auth';
import { logError } from '@/utils/logger';
import { withRouteGuard } from '@/utils/route-guard';

const DAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const DAY_VALUES: DayOfWeek[] = [1, 2, 3, 4, 5, 6, 7];

const COLOR_OPTIONS: { key: ScheduleColor; label: string; emoji: string }[] = [
  { key: 'primary', label: '薄荷绿', emoji: '🟢' },
  { key: 'info', label: '天空蓝', emoji: '🔵' },
  { key: 'accent', label: '棉花粉', emoji: '🩷' },
  { key: 'lavender', label: '珍珠紫', emoji: '🟣' },
];

const REMINDER_OPTIONS = [
  { value: 0, label: '不提醒' },
  { value: 5, label: '提前5分钟' },
  { value: 15, label: '提前15分钟' },
  { value: 30, label: '提前30分钟' },
  { value: 60, label: '提前1小时' },
];

const USE_MOCK =
  typeof process !== 'undefined' && typeof process.env !== 'undefined'
    ? process.env.VITE_USE_MOCK !== 'false'
    : true;

const ScheduleForm: React.FC = () => {
  const { profile } = useAuth();
  const currentUserId = profile?.id || '';
  const fetchStudentsByTeacher = useStudentStore((state) => state.fetchByTeacher);
  const fetchClassesByTeacher = useClassStore((state) => state.fetchByTeacher);
  const routerParams = useMemo(() => {
    const instance = Taro.getCurrentInstance();
    return instance?.router?.params || {};
  }, []);
  const scheduleId = useMemo(() => decodeURIComponent(routerParams.id || ''), [routerParams]);
  const formMode = useMemo(() => decodeURIComponent(routerParams.mode || ''), [routerParams]);
  const isEdit = !!scheduleId;
  const isRescheduleMode = isEdit && formMode === 'reschedule';

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [originalSchedule, setOriginalSchedule] = useState<Schedule | null>(null);

  // 基础数据
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);

  // 表单状态
  const [mode, setMode] = useState<'student' | 'class'>('student');
  const [studentId, setStudentId] = useState('');
  const [classId, setClassId] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState<DayOfWeek>(1);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:30');
  const [color, setColor] = useState<ScheduleColor>('primary');
  const [note, setNote] = useState('');
  const [reminderMinutes, setReminderMinutes] = useState(0);

  const loadFormData = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    setNotFound(false);

    if (!currentUserId) {
      setLoadError('未获取到登录信息，请重新进入页面');
      setLoading(false);
      return;
    }

    try {
      const [stuList, clsList] = await Promise.all([
        fetchStudentsByTeacher(currentUserId),
        fetchClassesByTeacher(currentUserId),
      ]);
      setStudents(stuList);
      setClasses(clsList);

      if (isEdit && scheduleId) {
        const sch = await scheduleService.getById(scheduleId);
        if (!sch) {
          setNotFound(true);
          return;
        }

        // 如果是调课模式，检查是否是过去的课程
        if (isRescheduleMode) {
          const today = dayjs().startOf('day');
          const originalDate = today.day(sch.day_of_week === 7 ? 0 : sch.day_of_week);
          if (originalDate.isBefore(today)) {
            Taro.showToast({ title: '已结束的课程不支持调课', icon: 'none', duration: 2000 });
            setTimeout(() => Taro.navigateBack(), 1500);
            setLoading(false);
            return;
          }
        }

        setOriginalSchedule(sch);
        setMode(!USE_MOCK || sch.class_id ? 'class' : 'student');
        if (sch.student_id) setStudentId(sch.student_id);
        if (sch.class_id) setClassId(sch.class_id);
        setDayOfWeek(sch.day_of_week);
        setStartTime(sch.start_time);
        setEndTime(sch.end_time);
        setColor(sch.color || 'primary');
        setNote(sch.note || '');
        setReminderMinutes(sch.reminder_minutes || 0);
      } else {
        setOriginalSchedule(null);
        if (stuList.length > 0) setStudentId(stuList[0].id);
        if (clsList.length > 0) setClassId(clsList[0].id);
        if (!USE_MOCK) setMode('class');
      }
    } catch (err) {
      logError('init schedule form', err);
      setLoadError('排课表单初始化失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [currentUserId, isEdit, scheduleId, fetchStudentsByTeacher, fetchClassesByTeacher, isRescheduleMode]);

  useEffect(() => {
    void loadFormData();
  }, [loadFormData]);

  const handleModeChange = useCallback((nextMode: 'student' | 'class') => {
    if (!USE_MOCK && nextMode === 'student') {
      Taro.showToast({ title: '真实联调阶段仅支持班级排课', icon: 'none' });
      return;
    }
    setMode(nextMode);
  }, []);

  // 学生/班级选择器数据
  const studentPickerData = useMemo(() => students.map((s) => s.name), [students]);
  const classPickerData = useMemo(() => classes.map((c) => c.name), [classes]);
  const selectedStudentIdx = useMemo(
    () => students.findIndex((s) => s.id === studentId),
    [students, studentId],
  );
  const selectedClassIdx = useMemo(
    () => classes.findIndex((c) => c.id === classId),
    [classes, classId],
  );
  const selectedClass = useMemo(
    () => classes.find((item) => item.id === classId) || null,
    [classId, classes],
  );
  const selectedStudent = useMemo(
    () => students.find((item) => item.id === studentId) || null,
    [studentId, students],
  );
  const originalTargetName = useMemo(() => {
    if (!originalSchedule) {
      return '';
    }
    if (originalSchedule.class_id) {
      return (
        classes.find((item) => item.id === originalSchedule.class_id)?.name ||
        originalSchedule.class_info?.name ||
        '未命名班级'
      );
    }
    if (originalSchedule.student_id) {
      return students.find((item) => item.id === originalSchedule.student_id)?.name || '未命名学员';
    }
    return '未命名课程';
  }, [classes, originalSchedule, students]);
  const originalScheduleText = useMemo(() => {
    if (!originalSchedule) {
      return '';
    }
    return `${DAY_LABELS[originalSchedule.day_of_week - 1]} ${originalSchedule.start_time}-${originalSchedule.end_time}`;
  }, [originalSchedule]);
  const nextScheduleText = useMemo(
    () => `${DAY_LABELS[dayOfWeek - 1]} ${startTime}-${endTime}`,
    [dayOfWeek, endTime, startTime],
  );
  const currentTargetName = useMemo(() => {
    if (mode === 'class') {
      return selectedClass?.name || '请选择班级';
    }
    return selectedStudent?.name || '请选择学员';
  }, [mode, selectedClass, selectedStudent]);

  const submitBlockedReason = useMemo(() => {
    if (!currentUserId) return '未获取到登录信息，请重新进入页面';
    if (mode === 'student' && !USE_MOCK) return '真实联调阶段仅支持班级排课';
    if (mode === 'student' && !students.length) return '暂无可排学员';
    if (mode === 'student' && !studentId) return '请选择学生';
    if (mode === 'class' && !classes.length && !classId) return '暂无可排班级';
    if (mode === 'class' && !classId) return '请选择班级';
    if (!startTime || !endTime) return '请选择完整的上课时间';
    if (startTime >= endTime) return '结束时间需晚于开始时间';
    return '';
  }, [classId, classes.length, currentUserId, endTime, mode, startTime, studentId, students.length]);

  const canSubmit = useMemo(
    () => !loading && !loadError && !notFound && !submitBlockedReason,
    [loadError, loading, notFound, submitBlockedReason],
  );
  const pageTitle = useMemo(() => {
    if (isRescheduleMode) {
      return '调课';
    }
    return isEdit ? '编辑排课' : '创建排课';
  }, [isEdit, isRescheduleMode]);
  const submitButtonText = useMemo(() => {
    if (saving) {
      return isRescheduleMode ? '调课中...' : '保存中...';
    }
    return isRescheduleMode ? '确认调课' : '保存';
  }, [isRescheduleMode, saving]);
  const handleNotifyStudentAndParents = useCallback(
    async (targetStudentId: string, title: string, content: string) => {
      try {
        await notificationService.send({
          sender_id: currentUserId,
          receiver_id: targetStudentId,
          title,
          content,
          related_id: targetStudentId,
        });
      } catch (err) {
        logError('scheduleForm notify student', err);
      }

      try {
        const parents = await studentService.getParents(targetStudentId);
        for (const binding of parents) {
          await notificationService.send({
            sender_id: currentUserId,
            receiver_id: binding.parent_id,
            title,
            content,
            related_id: targetStudentId,
          });
        }
      } catch (err) {
        logError('scheduleForm notify parents', err);
      }
    },
    [currentUserId],
  );

  // 保存
  const handleSave = useCallback(async () => {
    if (saving) {
      return;
    }

    if (submitBlockedReason) {
      Taro.showToast({ title: submitBlockedReason, icon: 'none' });
      return;
    }

    // 冲突检测
    const hasConflict = await scheduleService.checkConflict(
      currentUserId,
      dayOfWeek,
      startTime,
      endTime,
      isEdit ? scheduleId : undefined,
    );

    const doSave = async () => {
      setSaving(true);
      try {
        const data = {
          teacher_id: currentUserId,
          student_id: mode === 'student' ? studentId : undefined,
          class_id: mode === 'class' ? classId : undefined,
          day_of_week: dayOfWeek,
          start_time: startTime,
          end_time: endTime,
          color,
          note: note.trim() || undefined,
          reminder_minutes: reminderMinutes,
        };

        if (isEdit) {
          await scheduleService.update(scheduleId, data);
          if (isRescheduleMode) {
            const originalText = originalScheduleText || '原排课';
            const updatedText = `${DAY_LABELS[dayOfWeek - 1]} ${startTime}-${endTime}`;
            if (mode === 'class' && classId) {
              const classStudents = await classService.getStudents(classId);
              const title = '调课通知';
              const content = `${selectedClass?.name || '班级课程'} 已由 ${originalText} 调整为 ${updatedText}，请留意最新上课安排。`;
              for (const student of classStudents) {
                await handleNotifyStudentAndParents(student.id, title, content);
              }
            }
            if (mode === 'student' && studentId) {
              await handleNotifyStudentAndParents(
                studentId,
                '调课通知',
                `${selectedStudent?.name || '您的课程'} 已由 ${originalText} 调整为 ${updatedText}，请留意最新上课安排。`,
              );
            }
          }
          Taro.showToast({ title: isRescheduleMode ? '调课成功' : '更新成功', icon: 'success' });
        } else {
          await scheduleService.create(data);
          Taro.showToast({ title: '添加成功', icon: 'success' });
        }
        setTimeout(() => Taro.navigateBack(), 1200);
      } catch (err: unknown) {
        Taro.showToast({ title: '保存失败，请重试', icon: 'none' });
      } finally {
        setSaving(false);
      }
    };

    if (hasConflict) {
      const { confirm } = await Taro.showModal({
        title: '时间冲突',
        content: '该时间段已有课程安排，是否继续保存？',
      });
      if (!confirm) return;
    }
    await doSave();
  }, [
    mode,
    studentId,
    classId,
    dayOfWeek,
    handleNotifyStudentAndParents,
    startTime,
    endTime,
    color,
    note,
    reminderMinutes,
    submitBlockedReason,
    isEdit,
    isRescheduleMode,
    originalScheduleText,
    scheduleId,
    currentUserId,
    saving,
    selectedClass?.name,
    selectedStudent?.name,
    studentId,
  ]);

  // 删除
  const handleDelete = useCallback(async () => {
    if (deleting) {
      return;
    }

    const { confirm } = await Taro.showModal({
      title: '确认删除',
      content: '删除后课程数据将无法恢复，是否确认删除？',
      confirmColor: '#ef4444',
    });
    if (!confirm) return;

    setDeleting(true);
    try {
      await scheduleService.remove(scheduleId);
      Taro.showToast({ title: '已删除', icon: 'success' });
      setTimeout(() => Taro.navigateBack(), 1200);
    } catch {
      Taro.showToast({ title: '删除失败', icon: 'none' });
    } finally {
      setDeleting(false);
    }
  }, [deleting, scheduleId]);

  if (loading) {
    return (
      <PageContainer>
        <View className="flex items-center justify-center pt-[200rpx]">
          <Loading text="加载中..." />
        </View>
      </PageContainer>
    );
  }

  if (loadError) {
    return (
      <PageContainer>
        <View className="min-h-screen bg-gradient-subtle px-8 flex items-center justify-center">
          <Empty
            icon="mdi-alert-circle"
            description={loadError}
            actionText="重新加载"
            onAction={() => void loadFormData()}
          />
        </View>
      </PageContainer>
    );
  }

  if (notFound) {
    return (
      <PageContainer>
        <View className="min-h-screen bg-gradient-subtle px-8 flex items-center justify-center">
          <Empty
            icon="mdi-calendar-blank"
            description="未找到对应排课信息"
            actionText="返回上一页"
            onAction={() => Taro.navigateBack()}
          />
        </View>
      </PageContainer>
    );
  }

  return (
    <PageContainer safeBottom>
      <View className="min-h-screen bg-gradient-subtle pb-[200rpx]">
        {/* 标题 */}
        <View className="px-8 pt-8 pb-4">
          <Text className="text-[40rpx] font-bold text-foreground block">
            {pageTitle}
          </Text>
          {isRescheduleMode ? (
            <Text className="mt-[12rpx] block text-[24rpx] text-muted-foreground">
              已回填当前班级排课信息，可灵活调整上课日、时间和其他排课设置
            </Text>
          ) : null}
        </View>

        <View className="px-8">
          {isRescheduleMode ? (
            <View className="mb-7 rounded-[28rpx] bg-white shadow-soft overflow-hidden">
              <View className="bg-gradient-primary px-[28rpx] py-[24rpx]">
                <View className="flex items-center gap-[12rpx]">
                  <Icon name="mdi-swap-horizontal" size="sm" color="white" />
                  <Text className="text-[30rpx] font-semibold text-white">调课预览</Text>
                </View>
                <Text className="mt-[10rpx] block text-[24rpx] text-white/85">
                  调整后会自动通知受影响学员与家长
                </Text>
              </View>
              <View className="px-[28rpx] py-[24rpx]">
                <View className="rounded-[22rpx] bg-muted px-[24rpx] py-[22rpx]">
                  <Text className="text-[24rpx] text-muted-foreground block">原排课</Text>
                  <Text className="mt-[10rpx] block text-[32rpx] font-semibold text-foreground">
                    {originalTargetName || '未命名课程'}
                  </Text>
                  <View className="mt-[14rpx] flex items-center gap-[10rpx]">
                    <Icon name="mdi-calendar-clock" size="xs" color="mutedForeground" />
                    <Text className="text-[24rpx] text-foreground-secondary">
                      {originalScheduleText || '未设置'}
                    </Text>
                  </View>
                </View>
                <View className="flex items-center justify-center py-[20rpx]">
                  <View className="flex h-[56rpx] w-[56rpx] items-center justify-center rounded-full bg-primary-10">
                    <Icon name="mdi-arrow-right" size="sm" color="primary" />
                  </View>
                </View>
                <View className="rounded-[22rpx] border-[2rpx] border-solid border-primary/30 bg-primary-5 px-[24rpx] py-[22rpx]">
                  <Text className="text-[24rpx] text-primary block">调整后</Text>
                  <Text className="mt-[10rpx] block text-[32rpx] font-semibold text-foreground">
                    {currentTargetName}
                  </Text>
                  <View className="mt-[14rpx] flex items-center gap-[10rpx]">
                    <Icon name="mdi-calendar-check-outline" size="xs" color="primary" />
                    <Text className="text-[24rpx] text-foreground-secondary">
                      {nextScheduleText}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          ) : null}

          {/* ====== 排课类型 ====== */}
          <View className="mb-7">
            <Text className="text-lg text-foreground font-medium block mb-3">
              {isRescheduleMode ? '调课对象类型' : '课程类型'}
            </Text>
            <View className="flex gap-4">
              <View
                className={`flex-1 py-6 rounded-[24rpx] border-[4rpx] bg-white flex items-center justify-center shadow-soft ${mode === 'student' ? 'border-primary bg-gradient-primary shadow-elegant' : 'border-input'}`}
                onClick={() => handleModeChange('student')}
              >
                <Text
                  className={`text-lg font-medium ${mode === 'student' ? 'text-white' : 'text-muted-foreground'}`}
                >
                  {mode === 'student' ? '👤 ' : ''}单人课程
                </Text>
              </View>
              <View
                className={`flex-1 py-6 rounded-[24rpx] border-[4rpx] bg-white flex items-center justify-center shadow-soft ${mode === 'class' ? 'border-primary bg-gradient-primary shadow-elegant' : 'border-input'}`}
                onClick={() => handleModeChange('class')}
              >
                <Text
                  className={`text-lg font-medium ${mode === 'class' ? 'text-white' : 'text-muted-foreground'}`}
                >
                  {mode === 'class' ? '👥 ' : ''}班级课程
                </Text>
              </View>
            </View>
            {!USE_MOCK && (
              <View className="mt-3 py-3 px-4 rounded-[20rpx] bg-warning/10 border border-warning/30">
                <Text className="text-sm text-warning">当前联调阶段仅开放班级排课，单人排课暂保留为 mock 能力</Text>
              </View>
            )}
          </View>

          {/* ====== 选择对象 ====== */}
          <View className="mb-7">
            <Text className="text-lg text-foreground font-medium block mb-3">
              {mode === 'student'
                ? isRescheduleMode
                  ? '调整后的学生'
                  : '选择学生'
                : isRescheduleMode
                  ? '调整后的班级'
                  : '选择班级'}
            </Text>
            {mode === 'student' ? (
              <Picker
                mode="selector"
                range={studentPickerData}
                value={selectedStudentIdx >= 0 ? selectedStudentIdx : 0}
                onChange={(e) => {
                  const idx = Number(e.detail.value);
                  if (students[idx]) setStudentId(students[idx].id);
                }}
              >
                <View className="flex items-center justify-between py-6 px-7 rounded-[24rpx] border-[2rpx] border-input bg-white shadow-soft">
                  <Text className="text-lg text-foreground">
                    {selectedStudentIdx >= 0 ? students[selectedStudentIdx].name : '请选择学生'}
                  </Text>
                  <Text className="text-sm text-muted-foreground">▼</Text>
                </View>
              </Picker>
            ) : (
              <Picker
                mode="selector"
                range={classPickerData}
                value={selectedClassIdx >= 0 ? selectedClassIdx : 0}
                onChange={(e) => {
                  const idx = Number(e.detail.value);
                  if (classes[idx]) setClassId(classes[idx].id);
                }}
              >
                <View className="flex items-center justify-between py-6 px-7 rounded-[24rpx] border-[2rpx] border-input bg-white shadow-soft">
                  <Text className="text-lg text-foreground">
                    {selectedClassIdx >= 0 ? classes[selectedClassIdx].name : '请选择班级'}
                  </Text>
                  <Text className="text-sm text-muted-foreground">▼</Text>
                </View>
              </Picker>
            )}
          </View>

          {/* ====== 星期几 ====== */}
          <View className="mb-7">
            <Text className="text-lg text-foreground font-medium block mb-3">
              {isRescheduleMode ? '调整到' : '上课日'}
            </Text>
            <View className="flex gap-2">
              {DAY_VALUES.map((d, i) => (
                <View
                  key={d}
                  className={`flex-1 py-[20rpx] rounded-[20rpx] border-[2rpx] bg-white flex items-center justify-center ${dayOfWeek === d ? 'border-primary bg-gradient-primary' : 'border-input'}`}
                  onClick={() => setDayOfWeek(d)}
                >
                  <Text
                    className={`text-md font-medium ${dayOfWeek === d ? 'text-white' : 'text-muted-foreground'}`}
                  >
                    {DAY_LABELS[i]}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* ====== 时间设置 ====== */}
          <View className="mb-7">
            <Text className="text-lg text-foreground font-medium block mb-3">
              {isRescheduleMode ? '调整后时间' : '上课时间'}
            </Text>
            <View className="flex items-center gap-4">
              <Picker mode="time" value={startTime} onChange={(e) => setStartTime(e.detail.value)}>
                <View className="flex-1 py-6 px-7 rounded-[24rpx] border-[2rpx] border-input bg-white flex items-center justify-center shadow-soft">
                  <Text className="text-[40rpx] font-bold text-foreground tracking-[2rpx]">
                    {startTime}
                  </Text>
                </View>
              </Picker>
              <Text className="text-xl text-muted-foreground">—</Text>
              <Picker mode="time" value={endTime} onChange={(e) => setEndTime(e.detail.value)}>
                <View className="flex-1 py-6 px-7 rounded-[24rpx] border-[2rpx] border-input bg-white flex items-center justify-center shadow-soft">
                  <Text className="text-[40rpx] font-bold text-foreground tracking-[2rpx]">
                    {endTime}
                  </Text>
                </View>
              </Picker>
            </View>
          </View>

          {/* ====== 颜色主题 ====== */}
          <View className="mb-7">
            <Text className="text-lg text-foreground font-medium block mb-3">
              {isRescheduleMode ? '课程标签' : '颜色标签'}
            </Text>
            <View className="flex gap-3">
              {COLOR_OPTIONS.map((c) => (
                <View
                  key={c.key}
                  className={`flex-1 py-[20rpx] px-3 rounded-[20rpx] border-[4rpx] bg-white flex flex-col items-center gap-1 ${color === c.key ? 'border-primary bg-primary-5' : 'border-input'}`}
                  onClick={() => setColor(c.key)}
                >
                  <Text className="text-[36rpx]">{c.emoji}</Text>
                  <Text className="text-xs text-muted-foreground">{c.label}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* ====== 提醒设置 ====== */}
          <View className="mb-7">
            <Text className="text-lg text-foreground font-medium block mb-3">课前提醒</Text>
            <View className="flex flex-wrap gap-3">
              {REMINDER_OPTIONS.map((r) => (
                <View
                  key={r.value}
                  className={`py-4 px-6 rounded-[16rpx] border-[2rpx] bg-white ${reminderMinutes === r.value ? 'border-primary bg-primary-10' : 'border-input'}`}
                  onClick={() => setReminderMinutes(r.value)}
                >
                  <Text
                    className={`text-md ${reminderMinutes === r.value ? 'text-primary font-medium' : 'text-muted-foreground'}`}
                  >
                    {r.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* ====== 备注 ====== */}
          <View className="mb-7">
            <Text className="text-lg text-foreground font-medium block mb-3">
              {isRescheduleMode ? '调课备注' : '备注'}
            </Text>
            <View className="py-6 px-7 rounded-[24rpx] border-[2rpx] border-input bg-white shadow-soft mb-3">
              <Text className={note ? 'text-lg text-foreground' : 'text-lg text-muted-foreground'}>
                {note || (isRescheduleMode ? '可填写调课原因或说明' : '可选备注')}
              </Text>
            </View>
            <View className="flex flex-wrap gap-3">
              {['钢琴课', '声乐课', '乐理课', '舞蹈课'].map((tag) => (
                <View
                  key={tag}
                  className="py-3 px-6 rounded-[16rpx] bg-muted"
                  onClick={() => setNote(tag)}
                >
                  <Text className="text-sm text-muted-foreground">{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* ====== 底部按钮 ====== */}
        <View className="fixed bottom-0 left-0 right-0 px-8 py-6 bg-white/95 backdrop-blur-sm border-t-[2rpx] border-input flex gap-4 pb-safe-bar">
          {!canSubmit && submitBlockedReason ? (
            <View className="absolute left-8 right-8 top-[-64rpx] rounded-[16rpx] bg-white/95 px-4 py-3 shadow-soft">
              <Text className="text-sm text-muted-foreground">{submitBlockedReason}</Text>
            </View>
          ) : null}
          <ActionButton
            text={submitButtonText}
            fixed={false}
            onClick={handleSave}
            disabled={!canSubmit || saving || deleting}
          />
          {isEdit && !isRescheduleMode && (
            <View
              className={`py-7 px-8 rounded-[24rpx] border-2 flex items-center justify-center ${saving || deleting ? 'border-border bg-muted' : 'border-destructive bg-white'}`}
              onClick={saving || deleting ? undefined : handleDelete}
            >
              <Text className={`text-lg font-medium ${saving || deleting ? 'text-muted-foreground' : 'text-destructive'}`}>
                {deleting ? '删除中...' : '删除排课'}
              </Text>
            </View>
          )}
        </View>
      </View>
    </PageContainer>
  );
};

export default withRouteGuard(ScheduleForm);
