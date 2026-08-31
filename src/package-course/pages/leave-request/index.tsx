import { View, Text, Textarea, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import ActionButton from '@/components/ActionButton';
import Card from '@/components/Card';
import Empty from '@/components/Empty';
import FormRow from '@/components/FormRow';
import Loading from '@/components/Loading';
import PageContainer from '@/components/PageContainer';
import PickerSheet from '@/components/PickerSheet';
import { studentService, leaveService, classService, homeService, scheduleService, notificationService, makeupBookingService, teacherService } from '@/services';
import type { Class } from '@/types/class';
import type { LeaveRequest, LeaveType, LeaveStatus } from '@/types/leave-request';
import type { Schedule } from '@/types/schedule';
import { isStaffRole, useAuth } from '@/utils/auth';
import { logError } from '@/utils/logger';
import {
  buildUpcomingFixedLessons,
  buildMakeupTargetLessons,
  formatLessonOptionLabel,
  type UpcomingClassLesson,
} from '@/utils/parent-leave-lessons';
import { withRouteGuard } from '@/utils/route-guard';

/** 状态标签配置 */
const STATUS_MAP: Record<LeaveStatus, { label: string; cls: string }> = {
  pending: { label: '待审批', cls: 'bg-amber-500/15 text-amber-500' },
  approved: { label: '已同意', cls: 'bg-primary/10 text-primary' },
  rejected: { label: '已拒绝', cls: 'bg-destructive/10 text-destructive' },
};

/** 类型标签 */
const TYPE_MAP: Record<LeaveType, { label: string; cls: string }> = {
  leave: { label: '请假', cls: 'bg-destructive/10 text-destructive' },
  reschedule: { label: '调课', cls: 'bg-primary/10 text-primary' },
};

/** mock 排课可能是 camelCase，统一成前端 Schedule */
function normalizeRawSchedule(raw: Record<string, unknown>): Schedule {
  if (typeof raw.day_of_week === 'number' && typeof raw.start_time === 'string') {
    return raw as unknown as Schedule;
  }
  return {
    id: String(raw.id || ''),
    teacher_id: String(raw.teacherId || raw.teacher_id || ''),
    class_id: (raw.classId || raw.class_id) as string | undefined,
    day_of_week: Number(raw.dayOfWeek || raw.day_of_week || 1) as Schedule['day_of_week'],
    start_time: String(raw.startTime || raw.start_time || ''),
    end_time: String(raw.endTime || raw.end_time || ''),
    room: (raw.room as string | undefined) || undefined,
    note: (raw.note as string | undefined) || undefined,
    created_at: '',
    updated_at: '',
  };
}

const LeaveRequestPage: React.FC = () => {
  const { profile } = useAuth();
  const currentUserId = profile?.id || '';
  const userRole = profile?.currentContext?.role || 'teacher';
  const isTeacher = isStaffRole(userRole);
  const requestId = useMemo(() => {
    const instance = Taro.getCurrentInstance();
    return decodeURIComponent(instance?.router?.params?.requestId || '');
  }, []);
  const queryStudentId = useMemo(() => {
    const instance = Taro.getCurrentInstance();
    return decodeURIComponent(instance?.router?.params?.studentId || '');
  }, []);
  const queryLessonKey = useMemo(() => {
    const instance = Taro.getCurrentInstance();
    return decodeURIComponent(instance?.router?.params?.lessonKey || '');
  }, []);

  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const { loading, setLoading } = useDelayedLoading();
  const [errorMsg, setErrorMsg] = useState('');
  const [processingId, setProcessingId] = useState<{
    id: string;
    action: 'approve' | 'reject';
  } | null>(null);

  const [children, setChildren] = useState<Array<{ id: string; name: string }>>([]);
  const [studentId, setStudentId] = useState('');
  const [childPickerVisible, setChildPickerVisible] = useState(false);
  const [leaveType, setLeaveType] = useState<LeaveType>('leave');
  const [lessons, setLessons] = useState<UpcomingClassLesson[]>([]);
  const [lessonsLoading, setLessonsLoading] = useState(false);
  const [studentClassIds, setStudentClassIds] = useState<string[]>([]);
  const [campusClasses, setCampusClasses] = useState<Class[]>([]);
  const [campusSchedules, setCampusSchedules] = useState<Schedule[]>([]);
  const [selectedLessonKey, setSelectedLessonKey] = useState('');
  const [targetLessonKey, setTargetLessonKey] = useState('');
  const [lessonPickerVisible, setLessonPickerVisible] = useState(false);
  const [targetPickerVisible, setTargetPickerVisible] = useState(false);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      if (isTeacher) {
        const list = await leaveService.getByTeacher(currentUserId);
        setLeaves(list);
      } else {
        const kids = await studentService.getByParent(currentUserId);
        setChildren(kids);
        if (kids.length > 0) {
          const preferred =
            (queryStudentId && kids.find((k) => k.id === queryStudentId)?.id) || kids[0].id;
          setStudentId(preferred);
        }
      }
    } catch (err) {
      logError('load leave data', err);
      setErrorMsg(isTeacher ? '请假申请加载失败，请稍后重试' : '孩子信息加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [isTeacher, currentUserId, queryStudentId, setLoading]);

  const loadLessons = useCallback(async (sid: string) => {
    if (!sid) {
      setLessons([]);
      setStudentClassIds([]);
      setCampusClasses([]);
      setCampusSchedules([]);
      return;
    }
    setLessonsLoading(true);
    setSelectedLessonKey('');
    setTargetLessonKey('');
    try {
      const student = await studentService.getById(sid);
      const classIds = student?.class_ids || [];
      setStudentClassIds(classIds);
      const classResults = await Promise.all(classIds.map((id) => classService.getById(id)));
      const classes = classResults.filter(Boolean) as Class[];
      const rawList = (await homeService.getSchedulesByStudent(sid)) as unknown as Record<
        string,
        unknown
      >[];
      const schedules = (rawList || []).map(normalizeRawSchedule);
      const upcoming = buildUpcomingFixedLessons({ schedules, classes, weeksAhead: 4 });
      setLessons(upcoming);
      if (queryLessonKey && upcoming.some((l) => l.key === queryLessonKey)) {
        setSelectedLessonKey(queryLessonKey);
      }

      const campusId = student?.campus_id || classes[0]?.campus_id || '';
      if (campusId) {
        const [peerClasses, peerSchedules] = await Promise.all([
          classService.getByCampus(campusId),
          scheduleService.getByCampus(campusId),
        ]);
        setCampusClasses(peerClasses);
        setCampusSchedules(peerSchedules);
      } else {
        setCampusClasses(classes);
        setCampusSchedules(schedules);
      }
    } catch (err) {
      logError('load leave lessons', err);
      setLessons([]);
      setCampusClasses([]);
      setCampusSchedules([]);
    } finally {
      setLessonsLoading(false);
    }
  }, [queryLessonKey]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!isTeacher && studentId) {
      void loadLessons(studentId);
    }
  }, [isTeacher, studentId, loadLessons]);

  useEffect(() => {
    Taro.setNavigationBarTitle({ title: isTeacher ? '请假/调课审批' : '请假调课' });
  }, [isTeacher]);

  const detailLeave = useMemo(() => {
    if (isTeacher && requestId) {
      return leaves.find((l) => l.id === requestId) || null;
    }
    return null;
  }, [isTeacher, requestId, leaves]);

  const selectedLesson = useMemo(
    () => lessons.find((l) => l.key === selectedLessonKey) || null,
    [lessons, selectedLessonKey],
  );

  const targetLessonOptions = useMemo(() => {
    if (!selectedLesson) return [];
    const originalClass =
      campusClasses.find((c) => c.id === selectedLesson.classId) ||
      ({
        id: selectedLesson.classId,
        name: selectedLesson.className,
        teacher_id: selectedLesson.teacherId,
        subject_id: selectedLesson.subjectId,
        campus_id: campusClasses[0]?.campus_id,
        status: 'active',
        type: 'unlimited',
        color: 'primary',
        used_lessons: 0,
        student_count: 0,
        created_at: '',
        updated_at: '',
      } as Class);

    return buildMakeupTargetLessons({
      schedules: campusSchedules,
      classes: campusClasses.length > 0 ? campusClasses : [originalClass],
      originalClass,
      excludeClassIds: studentClassIds.length > 0 ? studentClassIds : [selectedLesson.classId],
      weeksAhead: 1,
    });
  }, [selectedLesson, campusClasses, campusSchedules, studentClassIds]);

  const targetLesson = useMemo(
    () => targetLessonOptions.find((l) => l.key === targetLessonKey) || null,
    [targetLessonOptions, targetLessonKey],
  );

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    return dateStr.split('T')[0];
  };

  const formatDateRange = useCallback((start: string, end?: string) => {
    if (!start) return '';
    if (!end || end === start) return formatDate(start);
    return `${formatDate(start)} - ${formatDate(end)}`;
  }, []);

  const detailNotFound = isTeacher && Boolean(requestId) && !detailLeave && !loading && !errorMsg;

  const handleApprove = useCallback(
    async (id: string) => {
      if (processingId) return;
      const { confirm } = await Taro.showModal({
        title: '确认同意',
        content: '确认同意该请假申请？',
      });
      if (!confirm) return;
      setProcessingId({ id, action: 'approve' });
      try {
        await leaveService.updateStatus(id, 'approved');
        setLeaves((prev) => prev.map((l) => (l.id === id ? { ...l, status: 'approved' } : l)));
        Taro.showToast({ title: '已同意', icon: 'success' });
      } catch (err) {
        logError('approve leave', err);
        Taro.showToast({ title: '操作失败，请重试', icon: 'none' });
      } finally {
        setProcessingId(null);
      }
    },
    [processingId],
  );

  const handleReject = useCallback(
    async (id: string) => {
      if (processingId) return;
      const { confirm } = await Taro.showModal({
        title: '确认拒绝',
        content: '确认拒绝该请假申请？',
        confirmColor: '#ef4444',
      });
      if (!confirm) return;
      setProcessingId({ id, action: 'reject' });
      try {
        await leaveService.updateStatus(id, 'rejected');
        setLeaves((prev) => prev.map((l) => (l.id === id ? { ...l, status: 'rejected' } : l)));
        Taro.showToast({ title: '已拒绝', icon: 'success' });
      } catch (err) {
        logError('reject leave', err);
        Taro.showToast({ title: '操作失败，请重试', icon: 'none' });
      } finally {
        setProcessingId(null);
      }
    },
    [processingId],
  );

  const handleSubmit = useCallback(async () => {
    if (!studentId) {
      Taro.showToast({ title: '请选择学生', icon: 'none' });
      return;
    }
    if (!selectedLesson) {
      Taro.showToast({ title: '请选择要请假/调课的课程', icon: 'none' });
      return;
    }
    if (!reason.trim()) {
      Taro.showToast({ title: '请输入原因', icon: 'none' });
      return;
    }
    if (leaveType === 'reschedule' && !targetLesson) {
      Taro.showToast({ title: '请选择调整到的课程', icon: 'none' });
      return;
    }

    setSubmitting(true);
    try {
      const childName = children.find((c) => c.id === studentId)?.name || '学员';
      const created = await leaveService.create({
        parent_id: currentUserId,
        student_id: studentId,
        teacher_id: selectedLesson.teacherId,
        type: leaveType,
        original_date: selectedLesson.date,
        end_date: selectedLesson.date,
        new_date: leaveType === 'reschedule' && targetLesson ? targetLesson.date : undefined,
        reason:
          leaveType === 'reschedule' && targetLesson
            ? `${reason.trim()}（补课至 ${formatLessonOptionLabel(targetLesson)}）`
            : reason.trim(),
        status: 'pending',
      });

      if (leaveType === 'reschedule' && targetLesson) {
        await makeupBookingService.create({
          studentId,
          classId: targetLesson.classId,
          lessonDate: targetLesson.date,
          startTime: targetLesson.startTime,
          endTime: targetLesson.endTime,
          teacherId: targetLesson.teacherId,
          teacherName: targetLesson.teacherName,
          source: 'parent',
          leaveRequestId: created.id,
          originalClassId: selectedLesson.classId,
          note: reason.trim(),
          createdBy: currentUserId,
        });

        // 站内通知：原课老师、补课班老师、负责人（校长）
        const receiverIds = new Set<string>();
        if (selectedLesson.teacherId) receiverIds.add(selectedLesson.teacherId);
        if (targetLesson.teacherId) receiverIds.add(targetLesson.teacherId);
        try {
          const teachers = await teacherService.getList();
          teachers
            .filter((t) => t.identity === 'principal')
            .forEach((t) => receiverIds.add(t.id));
        } catch (err) {
          logError('load principals for makeup notify', err);
        }

        const notifyTitle = '补课申请';
        const notifyContent = `「${childName}」申请将 ${formatLessonOptionLabel(selectedLesson)} 调至 ${formatLessonOptionLabel(targetLesson)} 补课。原因：${reason.trim()}`;
        for (const receiverId of receiverIds) {
          try {
            await notificationService.send({
              sender_id: currentUserId,
              receiver_id: receiverId,
              title: notifyTitle,
              content: notifyContent,
              related_id: created.id,
              type: 'leave_request',
            });
          } catch (err) {
            logError('notify makeup receivers', err);
          }
        }
      }

      if (created.status === 'approved') {
        Taro.showToast({ title: '已自动审批通过', icon: 'success' });
      } else {
        Taro.showToast({ title: '已提交，待审批', icon: 'success' });
      }
      setTimeout(() => Taro.navigateBack(), 1500);
    } catch {
      Taro.showToast({ title: '提交失败', icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  }, [
    studentId,
    selectedLesson,
    targetLesson,
    leaveType,
    reason,
    currentUserId,
    children,
  ]);

  if (loading) {
    return (
      <PageContainer>
        <View className="flex items-center justify-center pt-[200rpx]">
          <Loading text="加载中..." />
        </View>
      </PageContainer>
    );
  }

  if (errorMsg && leaves.length === 0 && isTeacher) {
    return (
      <PageContainer>
        <View className="min-h-screen flex flex-col items-center justify-center gap-[32rpx] px-[32rpx]">
          <Empty icon="mdi-alert-circle" description={errorMsg} />
          <View
            className="bg-primary px-[48rpx] py-[16rpx] rounded-full active:opacity-90"
            onClick={() => void loadData()}
          >
            <Text className="text-[28rpx] text-white font-medium">重新加载</Text>
          </View>
        </View>
      </PageContainer>
    );
  }

  if (errorMsg && !isTeacher && children.length === 0) {
    return (
      <PageContainer>
        <View className="min-h-screen flex flex-col items-center justify-center gap-[32rpx] px-[32rpx]">
          <Empty icon="mdi-alert-circle" description={errorMsg} />
          <View
            className="bg-primary px-[48rpx] py-[16rpx] rounded-full active:opacity-90"
            onClick={() => void loadData()}
          >
            <Text className="text-[28rpx] text-white font-medium">重新加载</Text>
          </View>
        </View>
      </PageContainer>
    );
  }

  if (detailNotFound) {
    return (
      <PageContainer>
        <View className="min-h-screen flex flex-col items-center justify-center gap-[32rpx] px-[32rpx]">
          <Empty
            icon="mdi-close"
            description="未找到对应的请假申请"
            actionText="返回上一页"
            onAction={() => void Taro.navigateBack()}
          />
        </View>
      </PageContainer>
    );
  }

  if (detailLeave) {
    const typeInfo = TYPE_MAP[detailLeave.type];
    const statusInfo = STATUS_MAP[detailLeave.status];
    return (
      <PageContainer safeBottom>
        <ScrollView scrollY className="flex-1 min-h-0">
          <View className="px-[32rpx] py-[24rpx] pb-[180rpx] flex flex-col gap-[24rpx]">
            <Card className="p-[32rpx]">
              <View className="flex items-center gap-[20rpx] mb-[8rpx]">
                <View className="w-[72rpx] h-[72rpx] rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                  <Text className="text-primary text-[28rpx] font-bold">
                    {detailLeave.student?.name?.[0] || '学'}
                  </Text>
                </View>
                <View className="flex-1 min-w-0">
                  <Text className="text-[30rpx] font-semibold text-foreground">
                    {detailLeave.student?.name || '学生'}
                  </Text>
                </View>
                <View className={`py-[6rpx] px-[16rpx] rounded-full ${typeInfo.cls}`}>
                  <Text className="text-[22rpx] font-medium">{typeInfo.label}</Text>
                </View>
              </View>
              <FormRow label="日期" border>
                <Text className="text-[30rpx] text-foreground">
                  {formatDateRange(detailLeave.original_date, detailLeave.end_date)}
                </Text>
              </FormRow>
              {detailLeave.new_date ? (
                <FormRow label="调整至" border>
                  <Text className="text-[30rpx] text-foreground">
                    {formatDate(detailLeave.new_date)}
                  </Text>
                </FormRow>
              ) : null}
              <FormRow label="原因" border>
                <Text className="text-[30rpx] text-foreground text-right">
                  {detailLeave.reason || '无'}
                </Text>
              </FormRow>
              <FormRow label="状态" border={false}>
                <View className={`py-[6rpx] px-[16rpx] rounded-full ${statusInfo.cls}`}>
                  <Text className="text-[22rpx] font-medium">{statusInfo.label}</Text>
                </View>
              </FormRow>
            </Card>
          </View>
        </ScrollView>
        {detailLeave.status === 'pending' ? (
          <View className="fixed bottom-0 left-0 right-0 flex gap-[24rpx] px-[32rpx] py-[24rpx] bg-card border-t border-border pb-safe">
            <View
              className={`flex-1 py-[24rpx] rounded-full border border-destructive bg-card flex items-center justify-center ${
                processingId ? 'opacity-60' : 'active:opacity-90'
              }`}
              onClick={() => !processingId && void handleReject(detailLeave.id)}
            >
              <Text className="text-destructive text-[30rpx] font-semibold">
                {processingId?.id === detailLeave.id && processingId.action === 'reject'
                  ? '处理中...'
                  : '拒绝'}
              </Text>
            </View>
            <View
              className={`flex-1 py-[24rpx] rounded-full bg-primary flex items-center justify-center ${
                processingId ? 'opacity-60' : 'active:opacity-90'
              }`}
              onClick={() => !processingId && void handleApprove(detailLeave.id)}
            >
              <Text className="text-white text-[30rpx] font-semibold">
                {processingId?.id === detailLeave.id && processingId.action === 'approve'
                  ? '处理中...'
                  : '同意'}
              </Text>
            </View>
          </View>
        ) : null}
      </PageContainer>
    );
  }

  if (isTeacher) {
    return (
      <PageContainer>
        <ScrollView scrollY className="flex-1 min-h-0">
          <View className="px-[32rpx] py-[24rpx] pb-[48rpx] flex flex-col gap-[24rpx]">
            {leaves.length === 0 ? (
              <Empty icon="mdi-clipboard-text" description="暂无请假申请" />
            ) : (
              leaves.map((leave) => {
                const typeInfo = TYPE_MAP[leave.type];
                const statusInfo = STATUS_MAP[leave.status];
                return (
                  <Card key={leave.id} className="p-[32rpx]">
                    <View className="flex items-center justify-between mb-[12rpx]">
                      <Text className="text-[30rpx] font-semibold text-foreground">
                        {leave.student?.name || '学生'}
                      </Text>
                      <View className={`py-[6rpx] px-[16rpx] rounded-full ${typeInfo.cls}`}>
                        <Text className="text-[22rpx] font-medium">{typeInfo.label}</Text>
                      </View>
                    </View>
                    <Text className="text-[26rpx] text-muted-foreground block mb-[8rpx]">
                      {leave.reason || '无原因'}
                    </Text>
                    <Text className="text-[24rpx] text-muted-foreground block mb-[16rpx]">
                      {formatDateRange(leave.original_date, leave.end_date)}
                    </Text>
                    <View className="flex items-center justify-between">
                      <View className={`py-[6rpx] px-[16rpx] rounded-full ${statusInfo.cls}`}>
                        <Text className="text-[22rpx] font-medium">{statusInfo.label}</Text>
                      </View>
                      {leave.status === 'pending' ? (
                        <View className="flex gap-[16rpx]">
                          <View
                            className={`py-[12rpx] px-[28rpx] rounded-full bg-primary ${
                              processingId ? 'opacity-60' : 'active:opacity-90'
                            }`}
                            onClick={() => !processingId && void handleApprove(leave.id)}
                          >
                            <Text className="text-white text-[24rpx] font-medium">
                              {processingId?.id === leave.id && processingId.action === 'approve'
                                ? '处理中...'
                                : '同意'}
                            </Text>
                          </View>
                          <View
                            className={`py-[12rpx] px-[28rpx] rounded-full border border-destructive bg-card ${
                              processingId ? 'opacity-60' : 'active:opacity-90'
                            }`}
                            onClick={() => !processingId && void handleReject(leave.id)}
                          >
                            <Text className="text-destructive text-[24rpx] font-medium">
                              {processingId?.id === leave.id && processingId.action === 'reject'
                                ? '处理中...'
                                : '拒绝'}
                            </Text>
                          </View>
                        </View>
                      ) : null}
                    </View>
                  </Card>
                );
              })
            )}
          </View>
        </ScrollView>
      </PageContainer>
    );
  }

  const selectedChild = children.find((c) => c.id === studentId);
  const canOpenLessonPicker = !lessonsLoading && lessons.length > 0;

  return (
    <PageContainer className="h-screen flex flex-col overflow-hidden">
      <ScrollView scrollY className="flex-1 min-h-0">
        <View className="px-[32rpx] py-[24rpx] pb-[180rpx] flex flex-col gap-[24rpx]">
          <Card className="p-[32rpx]">
            {children.length > 1 ? (
              <FormRow label="选择孩子" required onClick={() => setChildPickerVisible(true)}>
                <Text
                  className={`text-[30rpx] ${selectedChild ? 'text-foreground' : 'text-muted-foreground'}`}
                >
                  {selectedChild?.name || '请选择'}
                </Text>
              </FormRow>
            ) : children.length === 1 ? (
              <FormRow label="学员" border>
                <Text className="text-[30rpx] text-foreground">{children[0].name}</Text>
              </FormRow>
            ) : null}

            <FormRow label="申请类型" required border={false}>
              <View className="flex flex-row gap-[16rpx]">
                {(['leave'] as LeaveType[]).map((type) => {
                  const active = leaveType === type;
                  return (
                    <View
                      key={type}
                      className={`px-[28rpx] py-[12rpx] rounded-full border ${
                        active ? 'bg-primary border-primary' : 'bg-card border-border'
                      }`}
                      onClick={() => {
                        setLeaveType(type);
                        setTargetLessonKey('');
                      }}
                    >
                      <Text
                        className={`text-[26rpx] font-medium ${
                          active ? 'text-white' : 'text-muted-foreground'
                        }`}
                      >
                        {TYPE_MAP[type].label}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </FormRow>
          </Card>

          <View className="px-[8rpx]">
            <Text className="text-[24rpx] text-muted-foreground leading-relaxed">
              请假适用于班课固定排课；调课可选择同科目其他班级未来一周的课次去补课。团课、私教请到「我的约课」直接取消预约。
            </Text>
          </View>

          <Card className="p-[32rpx]">
            {lessonsLoading ? (
              <View className="py-[40rpx] flex items-center justify-center">
                <Loading text="加载课次..." />
              </View>
            ) : lessons.length === 0 ? (
              <View className="py-[24rpx]">
                <Empty icon="mdi-calendar-remove" description="没有要上的课" />
              </View>
            ) : (
              <>
                <FormRow
                  label={leaveType === 'reschedule' ? '原课程' : '请假课程'}
                  required
                  onClick={() => {
                    if (canOpenLessonPicker) setLessonPickerVisible(true);
                  }}
                >
                  <Text
                    className={`text-[28rpx] text-right max-w-[420rpx] ${
                      selectedLesson ? 'text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    {selectedLesson ? formatLessonOptionLabel(selectedLesson) : '请选择课程'}
                  </Text>
                </FormRow>
                {leaveType === 'reschedule' ? (
                  <FormRow
                    label="调整至"
                    required
                    border={false}
                    onClick={() => {
                      if (!selectedLesson) {
                        Taro.showToast({ title: '请先选择原课程', icon: 'none' });
                        return;
                      }
                      if (targetLessonOptions.length === 0) {
                        Taro.showToast({ title: '暂无同科目可补课次', icon: 'none' });
                        return;
                      }
                      setTargetPickerVisible(true);
                    }}
                  >
                    <Text
                      className={`text-[28rpx] text-right max-w-[420rpx] ${
                        targetLesson ? 'text-foreground' : 'text-muted-foreground'
                      }`}
                    >
                      {targetLesson ? formatLessonOptionLabel(targetLesson) : '请选择课程'}
                    </Text>
                  </FormRow>
                ) : null}
              </>
            )}
          </Card>

          {lessons.length > 0 ? (
            <Card className="p-[32rpx]">
              <View className="flex flex-col py-[8rpx]">
                <Text className="text-[30rpx] text-foreground mb-[16rpx]">
                  {leaveType === 'reschedule' ? '调课原因' : '请假原因'}
                  <Text className="text-destructive"> *</Text>
                </Text>
                <View className="rounded-[16rpx] bg-muted/40 px-[20rpx] py-[16rpx] min-h-[160rpx]">
                  <Textarea
                    className="w-full text-[28rpx] text-foreground leading-relaxed min-h-[140rpx]"
                    placeholder="请简要说明原因"
                    value={reason}
                    onInput={(e) => setReason(e.detail.value || '')}
                    maxlength={200}
                  />
                </View>
              </View>
            </Card>
          ) : null}
        </View>
      </ScrollView>

      {lessons.length > 0 ? (
        <View className="fixed bottom-0 left-0 right-0 px-[32rpx] py-[24rpx] bg-card border-t border-border pb-safe">
          <ActionButton
            text={submitting ? '提交中...' : '提交申请'}
            onClick={() => void handleSubmit()}
            disabled={submitting}
            fixed={false}
          />
        </View>
      ) : null}

      <PickerSheet
        visible={childPickerVisible}
        title="选择孩子"
        options={children.map((c) => ({ label: c.name, value: c.id }))}
        value={studentId}
        onClose={() => setChildPickerVisible(false)}
        onConfirm={(v) => setStudentId(v)}
      />
      <PickerSheet
        visible={lessonPickerVisible}
        title="选择课程"
        options={lessons.map((l) => ({ label: formatLessonOptionLabel(l), value: l.key }))}
        value={selectedLessonKey}
        onClose={() => setLessonPickerVisible(false)}
        onConfirm={(v) => {
          setSelectedLessonKey(v);
          setTargetLessonKey('');
        }}
      />
      <PickerSheet
        visible={targetPickerVisible}
        title="调整至"
        options={targetLessonOptions.map((l) => ({
          label: formatLessonOptionLabel(l),
          value: l.key,
        }))}
        value={targetLessonKey}
        onClose={() => setTargetPickerVisible(false)}
        onConfirm={(v) => setTargetLessonKey(v)}
      />
    </PageContainer>
  );
};

export default withRouteGuard(LeaveRequestPage);
