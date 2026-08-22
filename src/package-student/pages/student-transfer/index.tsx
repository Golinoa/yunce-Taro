import { ScrollView, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Empty from '@/components/Empty';
import Icon from '@/components/Icon';
import Loading from '@/components/Loading';
import PageContainer from '@/components/PageContainer';
import WorkflowHeaderCard from '@/components/reschedule/WorkflowHeaderCard';
import StudentAvatar from '@/components/student/StudentAvatar';
import { classService, studentService } from '@/services';
import { auditLogService } from '@/services/audit-log';
import { useClassStore, useStudentStore } from '@/stores';
import { useCampusStore } from '@/stores/campus';
import type { Class } from '@/types/class';
import type { Student } from '@/types/student';
import { useAuth } from '@/utils/auth';
import { logError } from '@/utils/logger';
import { withRouteGuard } from '@/utils/route-guard';

const StudentTransferPage: React.FC = () => {
  const { profile } = useAuth();
  const currentUserId = profile?.id || '';
  const currentCampusId = useCampusStore((state) => state.currentCampusId);
  const fetchClassesByTeacher = useClassStore((state) => state.fetchByTeacher);
  const invalidateClasses = useClassStore((state) => state.invalidate);
  const invalidateStudents = useStudentStore((state) => state.invalidate);

  const studentId = useMemo(() => {
    const instance = Taro.getCurrentInstance();
    return decodeURIComponent(instance?.router?.params?.id || '');
  }, []);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [student, setStudent] = useState<Student | null>(null);
  const [currentClass, setCurrentClass] = useState<Class | null>(null);
  const [availableClasses, setAvailableClasses] = useState<Class[]>([]);
  const [targetClassId, setTargetClassId] = useState('');

  const selectedTargetClass = useMemo(
    () => availableClasses.find((item) => item.id === targetClassId) || null,
    [availableClasses, targetClassId],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    setNotFound(false);

    if (!studentId) {
      setNotFound(true);
      setStudent(null);
      setCurrentClass(null);
      setAvailableClasses([]);
      setTargetClassId('');
      setLoading(false);
      return;
    }

    if (!currentUserId) {
      setLoadError('未获取到登录信息，请重新进入页面');
      setLoading(false);
      return;
    }

    try {
      const [studentInfo, classList] = await Promise.all([
        studentService.getById(studentId),
        fetchClassesByTeacher(currentUserId, currentCampusId, true),
      ]);

      if (!studentInfo) {
        setNotFound(true);
        setStudent(null);
        setCurrentClass(null);
        setAvailableClasses([]);
        setTargetClassId('');
        return;
      }

      setStudent(studentInfo);

      // 逐个班级核对成员，兼容当前学生详情没有直接班级字段的情况
      const classScanResults = await Promise.allSettled(
        classList.map(async (item) => {
          const classStudents = await classService.getStudents(item.id);
          return classStudents.some((classStudent) => classStudent.id === studentId) ? item : null;
        }),
      );

      const matchedClasses = classScanResults.flatMap((result) =>
        result.status === 'fulfilled' && result.value ? [result.value] : [],
      );
      const nextCurrentClass =
        matchedClasses.find((item) => item.status !== 'ended') || matchedClasses[0] || null;
      const nextAvailableClasses = classList.filter(
        (item) => item.id !== nextCurrentClass?.id && item.status !== 'ended',
      );

      setCurrentClass(nextCurrentClass);
      setAvailableClasses(nextAvailableClasses);
      setTargetClassId((prev) =>
        nextAvailableClasses.some((item) => item.id === prev)
          ? prev
          : (nextAvailableClasses[0]?.id ?? ''),
      );
    } catch (error) {
      logError('StudentTransfer loadData', error);
      setLoadError('调班信息加载失败，请稍后重试');
      setStudent(null);
      setCurrentClass(null);
      setAvailableClasses([]);
      setTargetClassId('');
    } finally {
      setLoading(false);
    }
  }, [currentUserId, currentCampusId, fetchClassesByTeacher, studentId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = useCallback(async () => {
    if (!student || !currentClass || !selectedTargetClass || submitting) {
      return;
    }

    const { confirm } = await Taro.showModal({
      title: '确认调班',
      content: `将「${student.name}」从「${currentClass.name}」调至「${selectedTargetClass.name}」？`,
      confirmText: '确认调班',
      confirmColor: '#16a34a',
    });

    if (!confirm) {
      return;
    }

    setSubmitting(true);
    try {
      await classService.transferStudent(currentClass.id, selectedTargetClass.id, student.id);
      // 审计日志（用户口径 2026-08-22）：学员调班属重要运营数据
      try {
        await auditLogService.record({
          action: 'student.transfer',
          operatorId: currentUserId || profile?.id || '',
          operatorName: profile?.name || '未知',
          operatorRole: profile?.currentContext?.role || 'unknown',
          targetType: 'student',
          targetId: student.id,
          detail: `学员调班：「${student.name}」从「${currentClass.name}」调入「${selectedTargetClass.name}」`,
          meta: {
            studentId: student.id,
            studentName: student.name,
            fromClass: currentClass.id,
            toClass: selectedTargetClass.id,
          },
        });
      } catch (e) {
        logError('audit student.transfer', e);
      }
      invalidateClasses(currentUserId);
      invalidateStudents(currentUserId);
      Taro.showToast({ title: '调班成功', icon: 'success' });
      setTimeout(() => {
        Taro.navigateBack();
      }, 500);
    } catch (error) {
      logError('StudentTransfer handleSubmit', error);
      Taro.showToast({ title: '调班失败，请重试', icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  }, [
    currentClass,
    currentUserId,
    invalidateClasses,
    invalidateStudents,
    selectedTargetClass,
    student,
    submitting,
    profile,
  ]);

  if (loading) {
    return (
      <PageContainer className="bg-[#f6f8fc]">
        <View className="min-h-screen flex items-center justify-center">
          <Loading text="加载调班信息中..." />
        </View>
      </PageContainer>
    );
  }

  if (loadError) {
    return (
      <PageContainer className="bg-[#f6f8fc]">
        <View className="px-[24rpx] py-[40rpx]">
          <Empty
            icon="mdi-alert-circle"
            description={loadError}
            actionText="重新加载"
            onAction={loadData}
          />
        </View>
      </PageContainer>
    );
  }

  if (notFound || !student) {
    return (
      <PageContainer className="bg-[#f6f8fc]">
        <View className="px-[24rpx] py-[40rpx]">
          <Empty
            icon="mdi-account-search"
            description="未找到该学员信息"
            actionText="返回上一页"
            onAction={() => Taro.navigateBack()}
          />
        </View>
      </PageContainer>
    );
  }

  const canSubmit = Boolean(currentClass && selectedTargetClass && !submitting);

  return (
    <PageContainer safeBottom className="bg-[#f6f8fc]">
      <View className="min-h-screen bg-[#f6f8fc] px-[24rpx] pt-[24rpx] pb-[220rpx]">
        <WorkflowHeaderCard
          eyebrow="学员调班"
          title="确认调班"
          tone="green"
          hintLines={['仅调整当前所属班级，不影响历史课时记录', '确认后学员会进入新的班级安排']}
        >
          <View className="flex items-center gap-[16rpx] rounded-[20rpx] bg-[#f4fffa] px-[18rpx] py-[18rpx]">
            <StudentAvatar name={student.name} size="sm" />
            <View className="min-w-0 flex-1">
              <Text className="block truncate text-[30rpx] font-semibold text-foreground">
                {student.name}
              </Text>
              <Text className="mt-[6rpx] block text-[22rpx] font-mono text-[#16a34a]">
                学员编号 {student.id}
              </Text>
            </View>
          </View>

          <View className="mt-[14rpx] rounded-[24rpx] border border-[#dff3e8] bg-[#f4fffa] px-[22rpx] py-[22rpx]">
            <View className="flex items-center justify-between gap-[12rpx]">
              <View className="min-w-0 flex-1">
                <Text className="block text-[22rpx] text-muted-foreground">当前班级</Text>
                <Text className="mt-[6rpx] block truncate text-[34rpx] font-semibold text-foreground">
                  {currentClass?.name || '暂未找到所在班级'}
                </Text>
              </View>
              {currentClass ? (
                <View className="rounded-full bg-[#edfdf3] px-[16rpx] py-[8rpx]">
                  <Text className="text-[22rpx] font-medium text-[#16a34a]">
                    {currentClass.student_count}人
                  </Text>
                </View>
              ) : null}
            </View>
            <View className="mt-[12rpx] flex items-center gap-[10rpx]">
              <Icon name="mdi-calendar-clock" size="xs" color="mutedForeground" />
              <Text className="text-[24rpx] text-muted-foreground">
                {currentClass?.schedule || '暂无排课信息'}
              </Text>
            </View>
          </View>

          <View className="mt-[14rpx] flex items-center gap-[12rpx] rounded-[20rpx] border border-[#e1f5e8] bg-[#fbfffc] px-[20rpx] py-[18rpx]">
            <View className="flex h-[56rpx] w-[56rpx] items-center justify-center rounded-full bg-[#edfdf3]">
              <Icon name="mdi-swap-horizontal" size="xs" color="#16a34a" />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="block text-[22rpx] text-muted-foreground">目标班级</Text>
              <Text className="mt-[4rpx] block truncate text-[28rpx] font-semibold text-[#16a34a]">
                {selectedTargetClass?.name || '请选择目标班级'}
              </Text>
            </View>
          </View>
        </WorkflowHeaderCard>

        <View className="mt-[24rpx] rounded-[28rpx] bg-white px-[24rpx] py-[22rpx] shadow-card">
          <View className="flex items-center justify-between">
            <View>
              <Text className="text-[30rpx] font-semibold text-foreground">可调入班级</Text>
              <Text className="mt-[6rpx] block text-[24rpx] text-muted-foreground">
                {availableClasses.length
                  ? `共 ${availableClasses.length} 个班级可选`
                  : '暂无可调入班级'}
              </Text>
            </View>
            {selectedTargetClass ? (
              <View className="rounded-full bg-[#edfdf3] px-[18rpx] py-[10rpx]">
                <Text className="text-[24rpx] font-medium text-[#16a34a]">已选 1 个</Text>
              </View>
            ) : null}
          </View>

          {!currentClass ? (
            <View className="mt-[20rpx] rounded-[24rpx] bg-[#f8fafc] px-[24rpx] py-[48rpx]">
              <Empty
                icon="mdi-account-search"
                description="未找到该学员当前所在班级，暂时无法调班"
              />
            </View>
          ) : availableClasses.length === 0 ? (
            <View className="mt-[20rpx] rounded-[24rpx] bg-[#f8fafc] px-[24rpx] py-[48rpx]">
              <Empty icon="mdi-account-group-outline" description="暂无可调入的进行中班级" />
            </View>
          ) : (
            <ScrollView scrollY className="mt-[18rpx] max-h-[720rpx]">
              <View className="flex flex-col gap-[16rpx] pb-[8rpx]">
                {availableClasses.map((item) => {
                  const isSelected = item.id === targetClassId;

                  return (
                    <View
                      key={item.id}
                      className={`rounded-[26rpx] border px-[24rpx] py-[24rpx] ${
                        isSelected
                          ? 'border-[#16a34a] bg-[#f4fffa]'
                          : 'border-[#eef2f6] bg-[#fbfcfd]'
                      }`}
                      onClick={() => setTargetClassId(item.id)}
                    >
                      <View className="flex items-center justify-between gap-[16rpx]">
                        <View className="min-w-0 flex-1">
                          <Text className="block truncate text-[30rpx] font-semibold text-foreground">
                            {item.name}
                          </Text>
                          <Text className="mt-[8rpx] block text-[24rpx] text-muted-foreground">
                            {item.schedule || '暂无排课信息'}
                          </Text>
                        </View>
                        <View className="flex items-center gap-[12rpx]">
                          <View className="rounded-full bg-white px-[14rpx] py-[8rpx]">
                            <Text className="text-[22rpx] text-muted-foreground">
                              {item.student_count}人
                            </Text>
                          </View>
                          <Icon
                            name={
                              isSelected ? 'mdi-check-circle' : 'mdi-checkbox-blank-circle-outline'
                            }
                            size="sm"
                            color={isSelected ? '#16a34a' : '#c7ced9'}
                          />
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          )}
        </View>
      </View>

      <View className="fixed bottom-0 left-0 right-0 bg-white px-[24rpx] pt-[20rpx] pb-safe-bar shadow-soft">
        <View
          className={`flex h-[96rpx] items-center justify-center rounded-[48rpx] ${
            canSubmit
              ? 'bg-[linear-gradient(135deg,#17b26a_0%,#36c28d_100%)] press-scale'
              : 'bg-[#d1fadf]'
          }`}
          onClick={canSubmit ? handleSubmit : undefined}
        >
          <Text className="text-[30rpx] font-semibold text-white">
            {submitting ? '调班中...' : '确认调班'}
          </Text>
        </View>
      </View>
    </PageContainer>
  );
};

export default withRouteGuard(StudentTransferPage);
