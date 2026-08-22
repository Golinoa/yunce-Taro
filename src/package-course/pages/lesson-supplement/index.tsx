import { View, Text, Textarea, Input, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import BottomSheet from '@/components/BottomSheet';
import Icon from '@/components/Icon';
import Loading from '@/components/Loading';
import PageContainer from '@/components/PageContainer';
import Stepper from '@/components/Stepper';
import StudentAvatar from '@/components/student/StudentAvatar';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import {
  classService,
  lessonRecordService,
  notificationService,
  packageService,
  scheduleService,
  studentService,
} from '@/services';
import { auditLogService } from '@/services/audit-log';
import { useStudentStore } from '@/stores';
import type { Class } from '@/types/class';
import type { CoursePackage } from '@/types/course-package';
import type { LessonRecord } from '@/types/lesson-record';
import type { Schedule } from '@/types/schedule';
import type { Student } from '@/types/student';
import { useAuth } from '@/utils/auth';
import { logError } from '@/utils/logger';
import { hasTrialPackage, pickBestPackage } from '@/utils/package-helper';
import { withRouteGuard } from '@/utils/route-guard';

const SCHEDULE_REFRESH_SIGNAL_KEY = 'yunce:schedule:refresh';

function getRecordPriority(record?: LessonRecord) {
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

const LessonSupplementPage: React.FC = () => {
  const { profile } = useAuth();
  const currentUserId = profile?.id || '';
  const currentTeacherId = profile?.teacher_profile?.id || currentUserId;
  const invalidateStudents = useStudentStore((state) => state.invalidate);

  const routeParams = useMemo(() => {
    const instance = Taro.getCurrentInstance();
    return instance?.router?.params || {};
  }, []);

  const classId = useMemo(() => decodeURIComponent(routeParams.classId || ''), [routeParams]);
  const scheduleId = useMemo(() => decodeURIComponent(routeParams.scheduleId || ''), [routeParams]);
  const classNameParam = useMemo(
    () => decodeURIComponent(routeParams.className || ''),
    [routeParams],
  );
  const lessonDate = useMemo(() => decodeURIComponent(routeParams.lessonDate || ''), [routeParams]);
  const lessonTime = useMemo(() => decodeURIComponent(routeParams.lessonTime || ''), [routeParams]);
  const leadTeacherNameParam = useMemo(
    () => decodeURIComponent(routeParams.leadTeacherName || ''),
    [routeParams],
  );
  const assistantTeacherNameParam = useMemo(
    () => decodeURIComponent(routeParams.assistantTeacherName || ''),
    [routeParams],
  );

  const [classInfo, setClassInfo] = useState<Class | null>(null);
  const [scheduleInfo, setScheduleInfo] = useState<Schedule | null>(null);
  const [classStudents, setClassStudents] = useState<Student[]>([]);
  const [teacherStudents, setTeacherStudents] = useState<Student[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [studentPackages, setStudentPackages] = useState<Map<string, CoursePackage[]>>(new Map());
  const [recordByStudentId, setRecordByStudentId] = useState<Map<string, LessonRecord>>(new Map());
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [showAddStudentSheet, setShowAddStudentSheet] = useState(false);
  const [pendingAddStudentIds, setPendingAddStudentIds] = useState<Set<string>>(new Set());
  const [addStudentKeyword, setAddStudentKeyword] = useState('');
  const [hoursUsed, setHoursUsed] = useState(1);
  const [note, setNote] = useState('');
  const { loading, setLoading } = useDelayedLoading();
  const [submitting, setSubmitting] = useState(false);

  const handleSafeGoBack = useCallback(() => {
    if (Taro.getCurrentPages().length > 1) {
      void Taro.navigateBack({
        fail: () => {
          void Taro.switchTab({ url: '/pages/schedule/index' });
        },
      });
      return;
    }

    void Taro.switchTab({ url: '/pages/schedule/index' });
  }, []);

  const loadData = useCallback(async () => {
    if (!classId || !lessonDate) {
      Taro.showToast({ title: '缺少补录信息', icon: 'none' });
      setTimeout(() => {
        handleSafeGoBack();
      }, 300);
      return;
    }

    setLoading(true);
    try {
      const [cls, schedule, currentClassStudents, currentTeacherStudents] = await Promise.all([
        classService.getById(classId),
        scheduleId ? scheduleService.getById(scheduleId) : Promise.resolve(null),
        classService.getStudents(classId),
        currentUserId ? studentService.getByTeacher(currentUserId) : Promise.resolve([]),
      ]);

      const recordQueryTeacherId = schedule?.teacher_id || currentUserId;
      const records = recordQueryTeacherId
        ? await lessonRecordService.getByTeacherAndRange(
            recordQueryTeacherId,
            lessonDate,
            lessonDate,
          )
        : [];

      const recordsByStudent = new Map<string, LessonRecord>();
      records
        .filter((record) => record.class_id === classId && record.lesson_date === lessonDate)
        .forEach((record) => {
          const currentRecord = recordsByStudent.get(record.student_id);
          if (getRecordPriority(record) >= getRecordPriority(currentRecord)) {
            recordsByStudent.set(record.student_id, record);
          }
        });

      const allStudents = [
        ...currentClassStudents,
        ...currentTeacherStudents.filter(
          (student) => !currentClassStudents.some((classStudent) => classStudent.id === student.id),
        ),
      ];
      const packageEntries = await Promise.all(
        allStudents.map(async (student) => {
          const packages = await packageService.getActiveByStudent(student.id);
          return [student.id, packages] as const;
        }),
      );

      setClassInfo(cls);
      setScheduleInfo(schedule);
      setClassStudents(currentClassStudents);
      setTeacherStudents(currentTeacherStudents);
      setStudents(currentClassStudents);
      setRecordByStudentId(recordsByStudent);
      setStudentPackages(new Map(packageEntries));
    } catch (error) {
      logError('LessonSupplement loadData', error);
      Taro.showToast({ title: '补录信息加载失败', icon: 'none' });
    } finally {
      setLoading(false);
    }
  }, [classId, currentUserId, handleSafeGoBack, lessonDate, scheduleId, setLoading]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const matchedPackageByStudent = useMemo(() => {
    const result = new Map<string, CoursePackage | null>();
    studentPackages.forEach((packages, studentId) => {
      result.set(studentId, pickBestPackage(packages, hoursUsed) || null);
    });
    return result;
  }, [hoursUsed, studentPackages]);

  const alreadySignedStudents = useMemo(
    () =>
      students.filter((student) => {
        const record = recordByStudentId.get(student.id);
        return record?.status === 'normal' || record?.status === 'makeup';
      }),
    [recordByStudentId, students],
  );

  const selectableStudents = useMemo(
    () =>
      students.filter((student) => {
        const record = recordByStudentId.get(student.id);
        return !record || !['normal', 'makeup'].includes(record.status || 'normal');
      }),
    [recordByStudentId, students],
  );

  const selectedStudents = useMemo(
    () => students.filter((student) => selectedStudentIds.has(student.id)),
    [selectedStudentIds, students],
  );

  const addableStudents = useMemo(
    () =>
      teacherStudents.filter(
        (student) =>
          !students.some((currentStudent) => currentStudent.id === student.id) &&
          !selectedStudentIds.has(student.id),
      ),
    [selectedStudentIds, students, teacherStudents],
  );

  const filteredAddableStudents = useMemo(() => {
    const keyword = addStudentKeyword.trim().toLowerCase();
    if (!keyword) {
      return addableStudents;
    }

    return addableStudents.filter((student) => {
      const searchText =
        `${student.name}${student.nickname || ''}${student.phone || ''}`.toLowerCase();
      return searchText.includes(keyword);
    });
  }, [addStudentKeyword, addableStudents]);

  useEffect(() => {
    setSelectedStudentIds((prev) => {
      const next = new Set<string>();
      prev.forEach((studentId) => {
        const record = recordByStudentId.get(studentId);
        if (!record || !['normal', 'makeup'].includes(record.status || 'normal')) {
          next.add(studentId);
        }
      });
      return next;
    });
  }, [recordByStudentId]);

  const displayClassName = classInfo?.name || classNameParam || '班级课程';
  const displayLeadTeacherName =
    leadTeacherNameParam || scheduleInfo?.teacher_name || profile?.name || '未设置';
  const displayAssistantTeacherName =
    assistantTeacherNameParam || scheduleInfo?.assistant_teacher_name || '';

  const toggleStudent = useCallback(
    (studentId: string) => {
      const record = recordByStudentId.get(studentId);
      if (record && ['normal', 'makeup'].includes(record.status || 'normal')) {
        return;
      }

      setSelectedStudentIds((prev) => {
        const next = new Set(prev);
        if (next.has(studentId)) {
          next.delete(studentId);
        } else {
          next.add(studentId);
        }
        return next;
      });
    },
    [recordByStudentId],
  );

  const handleOpenAddStudentSheet = useCallback(() => {
    if (addableStudents.length === 0) {
      Taro.showToast({ title: '暂无可添加学员', icon: 'none' });
      return;
    }

    setAddStudentKeyword('');
    setPendingAddStudentIds(new Set());
    setShowAddStudentSheet(true);
  }, [addableStudents.length]);

  const handleTogglePendingStudent = useCallback((studentId: string) => {
    setPendingAddStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  }, []);

  const handleConfirmAddStudents = useCallback(() => {
    if (pendingAddStudentIds.size === 0) {
      Taro.showToast({ title: '请选择学员', icon: 'none' });
      return;
    }

    const appendedStudents = addableStudents.filter((student) =>
      pendingAddStudentIds.has(student.id),
    );
    setStudents((prev) => [...prev, ...appendedStudents]);
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      pendingAddStudentIds.forEach((studentId) => next.add(studentId));
      return next;
    });
    setShowAddStudentSheet(false);
    setPendingAddStudentIds(new Set());
  }, [addableStudents, pendingAddStudentIds]);

  const handleSubmit = useCallback(async () => {
    if (!classId) {
      Taro.showToast({ title: '缺少班级信息', icon: 'none' });
      return;
    }
    if (!lessonDate) {
      Taro.showToast({ title: '缺少上课日期', icon: 'none' });
      return;
    }
    if (selectedStudents.length === 0) {
      Taro.showToast({ title: '请选择要补录的学生', icon: 'none' });
      return;
    }

    const confirmResult = await Taro.showModal({
      title: '确认补录',
      content: `将为 ${selectedStudents.length} 名学员追加一条 ${lessonDate} ${lessonTime} 的班级消课记录。若该学员已有本节课的请假/未到记录，系统会先自动撤销再补录签到。`,
      confirmText: '确认补录',
      confirmColor: '#3B6EF5',
    });

    if (!confirmResult.confirm) {
      return;
    }

    setSubmitting(true);
    const successList: string[] = [];
    const failList: { name: string; reason: string }[] = [];
    const contentText = note.trim() ? `补录签到：${note.trim()}` : '补录签到';

    try {
      const existingRecords =
        currentUserId || currentTeacherId
          ? await lessonRecordService.getByTeacherAndRange(
              currentUserId || currentTeacherId,
              lessonDate,
              lessonDate,
            )
          : [];

      for (const student of selectedStudents) {
        const matchedPackage = matchedPackageByStudent.get(student.id);
        const placeholderRecords = existingRecords.filter(
          (record) =>
            record.class_id === classId &&
            record.lesson_date === lessonDate &&
            record.student_id === student.id &&
            ['leave', 'absent'].includes(record.status || 'normal'),
        );

        try {
          if (placeholderRecords.length > 0) {
            await Promise.all(
              placeholderRecords.map((record) => lessonRecordService.remove(record.id)),
            );
          }

          const createdRecord = await lessonRecordService.create({
            teacher_id: scheduleInfo?.teacher_id || currentTeacherId,
            operator_teacher_id: currentTeacherId || scheduleInfo?.teacher_id,
            assistant_teacher_id: scheduleInfo?.assistant_teacher_id || undefined,
            student_id: student.id,
            package_id: matchedPackage?.id || '',
            class_id: classId,
            lesson_date: lessonDate,
            hours_used: hoursUsed,
            status: 'makeup',
            content: matchedPackage ? contentText : `${contentText}（欠课时）`,
          });

          const parents = await studentService.getParents(student.id);
          for (const binding of parents) {
            await notificationService.send({
              sender_id: profile?.id || '',
              receiver_id: binding.parent_id,
              title: `${displayClassName}已补录签到`,
              content: matchedPackage
                ? `${lessonDate} ${lessonTime} 已补录 ${hoursUsed} 课时，剩余 ${
                    createdRecord.remaining_hours ??
                    Math.max(matchedPackage.remaining_hours - hoursUsed, 0)
                  } 课时`
                : `${lessonDate} ${lessonTime} 已补录 ${hoursUsed} 课时，当前暂无可扣课包，已记为欠课时`,
              related_id: student.id,
            });
          }

          successList.push(student.name);
        } catch (error) {
          logError('LessonSupplement create single record', error);
          failList.push({ name: student.name, reason: '补录失败' });
        }
      }

      // 审计日志（用户口径 2026-08-22）：单人补课/补录属重要日志（循环后汇总一条）
      if (successList.length > 0) {
        try {
          await auditLogService.record({
            action: 'lesson.record',
            operatorId: currentUserId || profile?.id || '',
            operatorName: profile?.name || '未知',
            operatorRole: profile?.currentContext?.role || 'unknown',
            targetType: 'lesson_record',
            detail: `补课登记：${successList.length > 1 ? `学员 ${successList.join('、')}` : `学员「${successList[0]}」`} 补课 ${hoursUsed} 课时`,
            meta: { count: successList.length, names: successList, hours: hoursUsed },
          });
        } catch (e) {
          logError('audit lesson.record', e);
        }
      }

      // 预警：补课扣课时后剩余降到阈值 → 立即提醒一次（去重）
      // （预警提醒走首页待办事项：补课扣课时后剩余降到阈值 → 首页「课时续费提醒」待办，手动点已读）
      if (failList.length === 0) {
        Taro.showToast({ title: `已补录 ${successList.length} 人`, icon: 'success' });
      } else if (successList.length === 0) {
        Taro.showToast({ title: '补录失败，请重试', icon: 'none' });
      } else {
        Taro.showToast({
          title: `${successList.length}人成功，${failList.length}人失败`,
          icon: 'none',
          duration: 3000,
        });
      }

      if (currentUserId) {
        invalidateStudents(currentUserId);
      }
      try {
        Taro.setStorageSync(SCHEDULE_REFRESH_SIGNAL_KEY, String(Date.now()));
      } catch (error) {
        logError('LessonSupplement emit schedule refresh signal', error);
      }
      setTimeout(() => {
        handleSafeGoBack();
      }, 1600);
    } catch (error) {
      logError('LessonSupplement submit', error);
      Taro.showToast({ title: '补录失败，请重试', icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  }, [
    classId,
    currentTeacherId,
    currentUserId,
    displayClassName,
    handleSafeGoBack,
    hoursUsed,
    invalidateStudents,
    lessonDate,
    lessonTime,
    matchedPackageByStudent,
    note,
    profile,
    scheduleInfo?.assistant_teacher_id,
    scheduleInfo?.teacher_id,
    selectedStudents,
  ]);

  if (loading) {
    return (
      <PageContainer>
        <View className="min-h-screen flex items-center justify-center bg-background">
          <Loading text="加载补录信息中..." />
        </View>
      </PageContainer>
    );
  }

  return (
    <PageContainer safeBottom>
      <View className="min-h-screen bg-background px-[32rpx] pb-[220rpx]">
        <View className="pt-[24rpx]">
          <View className="rounded-[28rpx] bg-white px-[28rpx] py-[28rpx] shadow-sm">
            <Text className="block text-[34rpx] font-semibold text-foreground">补录签到</Text>
            <Text className="mt-[12rpx] block text-[24rpx] leading-[36rpx] text-muted-foreground">
              这里只会为这个班级追加新的消课记录，不会修改这节课原来已经签到的学生。
            </Text>

            <View className="mt-[24rpx] flex flex-col gap-[16rpx]">
              <View className="flex items-start justify-between gap-[16rpx]">
                <Text className="text-[24rpx] text-muted-foreground">班级</Text>
                <Text className="flex-1 text-right text-[26rpx] font-medium text-foreground">
                  {displayClassName}
                </Text>
              </View>
              <View className="flex items-start justify-between gap-[16rpx]">
                <Text className="text-[24rpx] text-muted-foreground">上课时间</Text>
                <Text className="flex-1 text-right text-[26rpx] font-medium text-foreground">
                  {lessonDate} {lessonTime}
                </Text>
              </View>
              <View className="flex items-start justify-between gap-[16rpx]">
                <Text className="text-[24rpx] text-muted-foreground">主讲老师</Text>
                <Text className="flex-1 text-right text-[26rpx] font-medium text-foreground">
                  {displayLeadTeacherName}
                </Text>
              </View>
              {displayAssistantTeacherName ? (
                <View className="flex items-start justify-between gap-[16rpx]">
                  <Text className="text-[24rpx] text-muted-foreground">助教老师</Text>
                  <Text className="flex-1 text-right text-[26rpx] font-medium text-foreground">
                    {displayAssistantTeacherName}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          <View className="mt-[24rpx] rounded-[28rpx] bg-white px-[28rpx] py-[28rpx] shadow-sm">
            <View className="flex items-start justify-between gap-[20rpx]">
              <Text className="text-[28rpx] font-medium text-foreground">补录设置</Text>
            </View>

            <View className="mt-[20rpx] flex items-center justify-between rounded-[20rpx] bg-muted px-[20rpx] py-[16rpx]">
              <Text className="text-[24rpx] text-muted-foreground">补录课时</Text>
              <Stepper value={hoursUsed} min={1} max={10} onChange={setHoursUsed} />
            </View>

            <View className="mt-[20rpx] rounded-[20rpx] bg-muted px-[20rpx] py-[18rpx]">
              <Text className="text-[24rpx] leading-[34rpx] text-muted-foreground">
                当前表单 {students.length} 人，班级原有 {classStudents.length} 人，已签到{' '}
                {alreadySignedStudents.length} 人。
              </Text>
            </View>

            <View className="mt-[20rpx]">
              <Text className="mb-[12rpx] block text-[28rpx] font-medium text-foreground">
                补录说明
              </Text>
              <Textarea
                className="min-h-[140rpx] w-full rounded-[20rpx] bg-muted px-[24rpx] py-[20rpx] text-[28rpx] text-foreground"
                value={note}
                onInput={(event) => setNote(event.detail.value)}
                maxlength={120}
                placeholder="选填，例如：漏签补录"
                placeholderClass="input-placeholder"
                disableDefaultPadding
                autoHeight
              />
            </View>
          </View>

          <View className="mt-[24rpx] rounded-[28rpx] bg-white px-[28rpx] py-[28rpx] shadow-sm">
            <View className="flex items-center justify-between">
              <View>
                <Text className="text-[28rpx] font-medium text-foreground">可补录学员</Text>
              </View>
              <View className="flex items-center gap-[16rpx]">
                <Text className="text-[24rpx] text-muted-foreground">
                  已选 {selectedStudentIds.size} 人
                </Text>
                <View
                  className="rounded-[18rpx] bg-muted px-[20rpx] py-[10rpx]"
                  onClick={handleOpenAddStudentSheet}
                >
                  <Text className="text-[24rpx] text-muted-foreground">添加学员</Text>
                </View>
              </View>
            </View>

            <View className="mt-[20rpx] flex flex-col gap-[16rpx]">
              {selectableStudents.map((student) => {
                const selected = selectedStudentIds.has(student.id);
                const matchedPackage = matchedPackageByStudent.get(student.id);
                const isTrialStudent = hasTrialPackage(studentPackages.get(student.id));
                const record = recordByStudentId.get(student.id);
                const isDebtByInsufficient = Boolean(
                  matchedPackage && matchedPackage.remaining_hours < hoursUsed,
                );

                let secondaryText = '';
                let secondaryClassName = 'text-muted-foreground';
                let statusTagText = '可补录';
                let statusTagClassName = 'bg-primary/10 text-primary';

                if (record?.status === 'cancelled') {
                  secondaryText = '原记录已取消，可重新补录';
                  statusTagText = '取消后补录';
                  statusTagClassName = 'bg-amber-50 text-amber-600';
                } else if (record?.status === 'leave') {
                  secondaryText = '原记录为请假，本次可补录';
                  statusTagText = '请假转补录';
                  statusTagClassName = 'bg-info/10 text-info';
                } else if (record?.status === 'absent') {
                  secondaryText = '原记录为缺勤，本次可补录';
                  statusTagText = '缺勤转补录';
                  statusTagClassName = 'bg-warning/10 text-warning';
                } else if (matchedPackage && !isDebtByInsufficient) {
                  secondaryText = `使用课包 ${matchedPackage.name}，剩余 ${matchedPackage.remaining_hours} 课时`;
                } else if (matchedPackage) {
                  secondaryText = `课包 ${matchedPackage.name} 仅剩 ${matchedPackage.remaining_hours} 课时，补录后记为欠课时`;
                  secondaryClassName = 'text-warning';
                  statusTagText = '欠课时';
                  statusTagClassName = 'bg-warning/10 text-warning';
                } else {
                  secondaryText = '当前无可用课时包，补录后记为欠课时';
                  secondaryClassName = 'text-warning';
                  statusTagText = '欠课时';
                  statusTagClassName = 'bg-warning/10 text-warning';
                }

                return (
                  <View
                    key={student.id}
                    className={`rounded-[24rpx] border px-[24rpx] py-[22rpx] ${
                      selected ? 'border-primary bg-primary/5' : 'border-border bg-white'
                    }`}
                    onClick={() => toggleStudent(student.id)}
                  >
                    <View className="flex items-center gap-[20rpx]">
                      <StudentAvatar name={student.name} size="sm" />
                      <View className="min-w-0 flex-1">
                        <View className="flex items-center gap-[12rpx]">
                          <Text className="shrink-0 text-[28rpx] font-medium text-foreground">
                            {student.name}
                          </Text>
                          {isTrialStudent ? (
                            <View className="rounded-[8rpx] bg-error/10 px-[12rpx] py-[4rpx]">
                              <Text className="text-center text-[20rpx] font-medium text-error">
                                试听
                              </Text>
                            </View>
                          ) : null}
                          <View
                            className={`rounded-[8rpx] px-[12rpx] py-[4rpx] ${statusTagClassName}`}
                          >
                            <Text className="text-center text-[20rpx] font-medium">
                              {statusTagText}
                            </Text>
                          </View>
                        </View>
                        <Text className={`mt-[6rpx] block text-[24rpx] ${secondaryClassName}`}>
                          {secondaryText}
                        </Text>
                      </View>
                      <Icon
                        name={selected ? 'mdi-check-circle' : 'mdi-checkbox-blank-circle-outline'}
                        size="sm"
                        color={selected ? '#3B6EF5' : '#c7ced9'}
                      />
                    </View>
                  </View>
                );
              })}
            </View>

            {alreadySignedStudents.length > 0 && (
              <View className="mt-[28rpx] border-t border-border/70 pt-[24rpx]">
                <View className="flex items-center gap-[12rpx]">
                  <Text className="block text-[26rpx] font-medium text-muted-foreground">
                    已签到学员
                  </Text>
                  <View className="rounded-[8rpx] bg-muted px-[12rpx] py-[4rpx]">
                    <Text className="text-center text-[20rpx] text-muted-foreground">只读</Text>
                  </View>
                </View>
                <Text className="mt-[8rpx] block text-[24rpx] leading-[34rpx] text-muted-foreground">
                  以下学员这节课已经有记录，默认不选，仅供查看。
                </Text>

                <View className="mt-[18rpx] flex flex-col gap-[16rpx]">
                  {alreadySignedStudents.map((student) => {
                    const record = recordByStudentId.get(student.id);
                    const isTrialStudent = hasTrialPackage(studentPackages.get(student.id));
                    const tagText = record?.status === 'makeup' ? '已补录' : '已签到';
                    const descText =
                      record?.status === 'makeup'
                        ? '本节课已补录过，无需重复补录'
                        : '已签到，本次无需补录';

                    return (
                      <View
                        key={student.id}
                        className="rounded-[24rpx] border border-border bg-muted/60 px-[24rpx] py-[22rpx]"
                      >
                        <View className="flex items-center gap-[20rpx]">
                          <StudentAvatar name={student.name} size="sm" />
                          <View className="min-w-0 flex-1">
                            <View className="flex items-center gap-[12rpx]">
                              <Text className="shrink-0 text-[28rpx] font-medium text-foreground">
                                {student.name}
                              </Text>
                              {isTrialStudent ? (
                                <View className="rounded-[8rpx] bg-error/10 px-[12rpx] py-[4rpx]">
                                  <Text className="text-center text-[20rpx] font-medium text-error">
                                    试听
                                  </Text>
                                </View>
                              ) : null}
                              <View className="rounded-[8rpx] bg-white px-[12rpx] py-[4rpx]">
                                <Text className="text-center text-[20rpx] text-muted-foreground">
                                  {tagText}
                                </Text>
                              </View>
                            </View>
                            <Text className="mt-[6rpx] block text-[24rpx] text-muted-foreground">
                              {descText}
                            </Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}
          </View>
        </View>

        <View className="fixed bottom-0 left-0 right-0 border-t border-border bg-white/96 px-[32rpx] py-[24rpx]">
          <View
            className={`rounded-[48rpx] py-[26rpx] text-center ${
              selectedStudentIds.size > 0 && !submitting ? 'bg-primary' : 'bg-border'
            }`}
            onClick={selectedStudentIds.size > 0 && !submitting ? handleSubmit : undefined}
          >
            <Text className="text-[30rpx] font-semibold text-white">
              {submitting ? '补录中...' : `确认补录 ${selectedStudentIds.size} 人`}
            </Text>
          </View>
        </View>

        <BottomSheet
          visible={showAddStudentSheet}
          title="添加学员到补录名单"
          maxHeight="78vh"
          scrollable={false}
          onClose={() => {
            setShowAddStudentSheet(false);
            setAddStudentKeyword('');
            setPendingAddStudentIds(new Set());
          }}
        >
          <View className="flex flex-col bg-white" style={{ height: 'calc(78vh - 120rpx)' }}>
            <View className="border-b border-border/70 px-[32rpx] pb-[20rpx] pt-[8rpx]">
              <View className="flex items-center gap-[16rpx] rounded-[22rpx] bg-muted px-[24rpx] py-[18rpx]">
                <Icon name="mdi-magnify" size="sm" color="#94a3b8" />
                <Input
                  className="flex-1 text-[26rpx] text-foreground"
                  value={addStudentKeyword}
                  onInput={(event) => setAddStudentKeyword(event.detail.value)}
                  placeholder="搜索学员姓名 / 昵称 / 手机号"
                  placeholderClass="input-placeholder"
                  confirmType="search"
                />
              </View>
            </View>

            <ScrollView scrollY className="min-h-0 flex-1 bg-white px-[32rpx] py-[24rpx]">
              <View className="flex flex-col gap-[16rpx] pb-[12rpx]">
                {filteredAddableStudents.map((student) => {
                  const checked = pendingAddStudentIds.has(student.id);
                  const matchedPackage = matchedPackageByStudent.get(student.id);
                  const isTrialStudent = hasTrialPackage(studentPackages.get(student.id));
                  const record = recordByStudentId.get(student.id);
                  const isDebtByInsufficient = Boolean(
                    matchedPackage && matchedPackage.remaining_hours < hoursUsed,
                  );

                  let secondaryText = '';
                  let secondaryClassName = 'text-muted-foreground';
                  let statusTagText = '可补录';
                  let statusTagClassName = 'bg-primary/10 text-primary';

                  if (record?.status === 'cancelled') {
                    secondaryText = '原记录已取消，可重新补录';
                    statusTagText = '已取消';
                    statusTagClassName = 'bg-amber-50 text-amber-600';
                  } else if (record?.status === 'leave') {
                    secondaryText = '原记录为请假，本次可补录';
                    statusTagText = '请假';
                    statusTagClassName = 'bg-info/10 text-info';
                  } else if (record?.status === 'absent') {
                    secondaryText = '原记录为缺勤，本次可补录';
                    statusTagText = '缺勤';
                    statusTagClassName = 'bg-warning/10 text-warning';
                  } else if (matchedPackage && !isDebtByInsufficient) {
                    secondaryText = `使用课包 ${matchedPackage.name}，剩余 ${matchedPackage.remaining_hours} 课时`;
                  } else if (matchedPackage) {
                    secondaryText = `课包 ${matchedPackage.name} 仅剩 ${matchedPackage.remaining_hours} 课时，补录后记为欠课时`;
                    secondaryClassName = 'text-warning';
                    statusTagText = '欠课时';
                    statusTagClassName = 'bg-warning/10 text-warning';
                  } else {
                    secondaryText = '当前无可用课时包，补录后记为欠课时';
                    secondaryClassName = 'text-warning';
                    statusTagText = '欠课时';
                    statusTagClassName = 'bg-warning/10 text-warning';
                  }

                  return (
                    <View
                      key={student.id}
                      className={`rounded-[24rpx] border px-[24rpx] py-[22rpx] ${
                        checked ? 'border-primary bg-primary/5' : 'border-border bg-white'
                      }`}
                      onClick={() => handleTogglePendingStudent(student.id)}
                    >
                      <View className="flex items-center gap-[20rpx]">
                        <StudentAvatar name={student.name} size="sm" />
                        <View className="min-w-0 flex-1">
                          <View className="flex items-center gap-[12rpx]">
                            <Text className="shrink-0 text-[28rpx] font-medium text-foreground">
                              {student.name}
                            </Text>
                            {isTrialStudent ? (
                              <View className="rounded-[8rpx] bg-error/10 px-[12rpx] py-[4rpx]">
                                <Text className="text-center text-[20rpx] font-medium text-error">
                                  试听
                                </Text>
                              </View>
                            ) : null}
                            <View
                              className={`rounded-[8rpx] px-[12rpx] py-[4rpx] ${statusTagClassName}`}
                            >
                              <Text className="text-center text-[20rpx] font-medium">
                                {statusTagText}
                              </Text>
                            </View>
                          </View>
                          <Text className={`mt-[6rpx] block text-[24rpx] ${secondaryClassName}`}>
                            {secondaryText}
                          </Text>
                        </View>
                        <Icon
                          name={checked ? 'mdi-check-circle' : 'mdi-checkbox-blank-circle-outline'}
                          size="sm"
                          color={checked ? '#3B6EF5' : '#c7ced9'}
                        />
                      </View>
                    </View>
                  );
                })}

                {filteredAddableStudents.length === 0 && (
                  <View className="rounded-[20rpx] bg-muted px-[24rpx] py-[24rpx]">
                    <Text className="text-[24rpx] text-muted-foreground">
                      {addStudentKeyword.trim() ? '没有找到匹配的学员。' : '当前没有可添加的学员。'}
                    </Text>
                  </View>
                )}
              </View>
            </ScrollView>

            <View className="border-t border-border bg-white px-[32rpx] pb-[32rpx] pt-[20rpx]">
              <View
                className={`rounded-[48rpx] py-[24rpx] text-center ${
                  pendingAddStudentIds.size > 0 ? 'bg-primary' : 'bg-border'
                }`}
                onClick={pendingAddStudentIds.size > 0 ? handleConfirmAddStudents : undefined}
              >
                <Text className="text-[28rpx] font-semibold text-white">
                  确认添加 {pendingAddStudentIds.size} 人
                </Text>
              </View>
            </View>
          </View>
        </BottomSheet>
      </View>
    </PageContainer>
  );
};

export default withRouteGuard(LessonSupplementPage);
