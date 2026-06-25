import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import ActionButton from '@/components/ActionButton';
import Avatar from '@/components/Avatar';
import Loading from '@/components/Loading';
import PageContainer from '@/components/PageContainer';
import Stepper from '@/components/Stepper';
import {
  classService,
  packageService,
  lessonRecordService,
  studentService,
  notificationService,
} from '@/services';
import { useStudentStore } from '@/stores';
import type { Student } from '@/types/student';
import { useAuth } from '@/utils/auth';
import { logError } from '@/utils/logger';
import { withRouteGuard } from '@/utils/route-guard';

const ClassCheckin: React.FC = () => {
  const { profile } = useAuth();
  const currentUserId = profile?.id || '';
  const invalidateStudents = useStudentStore((state) => state.invalidate);
  const classId = useMemo(() => {
    const instance = Taro.getCurrentInstance();
    return decodeURIComponent(instance?.router?.params?.classId || '');
  }, []);

  const [className, setClassName] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [leaveIds, setLeaveIds] = useState<string[]>([]);
  const [hoursUsed, setHoursUsed] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    try {
      const cls = await classService.getById(classId);
      if (cls) setClassName(cls.name);
      const stuList = await classService.getStudents(classId);
      setStudents(stuList);
    } catch (err) {
      logError('load checkin data', err);
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 出席学生（未请假）
  const presentStudents = useMemo(
    () => students.filter((s) => !leaveIds.includes(s.id)),
    [students, leaveIds],
  );

  // 切换请假状态
  const toggleLeave = useCallback((id: string) => {
    setLeaveIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  }, []);

  // 全选（全部出席）
  const handleSelectAll = useCallback(() => {
    setLeaveIds([]);
  }, []);

  // 全部请假
  const handleSelectNone = useCallback(() => {
    setLeaveIds(students.map((s) => s.id));
  }, [students]);

  // 批量消课
  const handleBatchCheckin = useCallback(async () => {
    if (presentStudents.length === 0) {
      Taro.showToast({ title: '至少需要一名学生参与消课', icon: 'none' });
      return;
    }
    setSubmitting(true);
    const successList: string[] = [];
    const failList: { name: string; reason: string }[] = [];

    try {
      for (const stu of presentStudents) {
        try {
          // 查找可用套餐
          const packages = await packageService.getActiveByStudent(stu.id);
          const pkg = packages.find((p) => p.remaining_hours >= hoursUsed);
          if (!pkg) {
            failList.push({ name: stu.name, reason: '课时不足' });
            continue;
          }

          const createdRecord = await lessonRecordService.create({
            teacher_id: currentUserId,
            student_id: stu.id,
            package_id: pkg.id,
            lesson_date: new Date().toISOString().split('T')[0],
            hours_used: hoursUsed,
            content: `${className} 班级签到消课`,
          });

          // 通知家长
          const parents = await studentService.getParents(stu.id);
          for (const binding of parents) {
            await notificationService.send({
              sender_id: currentUserId,
              receiver_id: binding.parent_id,
              title: `${stu.name} 课时已核销`,
              content: `本次核销 ${hoursUsed} 课时，剩余 ${createdRecord.remaining_hours ?? Math.max(pkg.remaining_hours - hoursUsed, 0)} 课时`,
              related_id: stu.id,
            });
          }
          successList.push(stu.name);
        } catch (err) {
          logError('batchCheckin single student', err);
          failList.push({ name: stu.name, reason: '消课失败' });
        }
      }

      // 汇总结果提示
      if (failList.length === 0) {
        Taro.showToast({ title: `已完成 ${successList.length} 名学生消课`, icon: 'success' });
      } else if (successList.length === 0) {
        Taro.showToast({ title: '全部消课失败', icon: 'none' });
      } else {
        Taro.showToast({
          title: `${successList.length}人成功，${failList.length}人失败`,
          icon: 'none',
          duration: 3000,
        });
      }

      invalidateStudents(currentUserId);
      setTimeout(() => Taro.navigateBack(), 1500);
    } catch (err) {
      logError('batchCheckin', err);
      Taro.showToast({ title: '操作失败', icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  }, [presentStudents, className, currentUserId, hoursUsed, invalidateStudents]);

  if (loading) {
    return (
      <PageContainer>
        <View className="flex items-center justify-center pt-50">
          <Loading text="加载中..." />
        </View>
      </PageContainer>
    );
  }

  return (
    <PageContainer safeBottom>
      <View className="min-h-screen pb-[200rpx] bg-gradient-subtle">
        {/* ====== 渐变头部 ====== */}
        <View className="bg-gradient-primary px-6 pt-6 pb-10 rounded-b-60rpx shadow-elegant relative overflow-hidden">
          <View className="flex items-center justify-between">
            <View className="flex-1">
              <Text className="text-lg font-bold text-white block">班级签到</Text>
              <Text className="text-sm text-white/70 block mt-1">{className}</Text>
            </View>
            <View className="flex gap-3">
              <View
                className="py-2 px-4 rounded-xl bg-white/20 border border-white/30"
                onClick={handleSelectAll}
              >
                <Text className="text-sm font-medium text-white">全选</Text>
              </View>
              <View
                className="py-2 px-4 rounded-xl bg-white/20 border border-white/30"
                onClick={handleSelectNone}
              >
                <Text className="text-sm font-medium text-white">全不选</Text>
              </View>
            </View>
          </View>
          {/* 课时选择 */}
          <View className="mt-4 flex items-center gap-3">
            <Text className="text-sm text-white/80">消课课时</Text>
            <Stepper value={hoursUsed} min={1} max={10} onChange={setHoursUsed} />
          </View>
        </View>

        {/* 出席统计 */}
        <View className="px-8 pt-4 pb-3">
          <Text className="text-base text-muted-foreground">
            出席 {presentStudents.length}/{students.length}
          </Text>
        </View>

        {/* ====== 2. 学生列表 ====== */}
        {students.length === 0 ? (
          <View className="py-20 px-8 text-center">
            <Text className="text-lg text-muted-foreground">暂无学生</Text>
          </View>
        ) : (
          <View className="px-8 grid grid-cols-2 gap-4">
            {students.map((stu) => {
              const isLeave = leaveIds.includes(stu.id);
              return (
                <View
                  key={stu.id}
                  className={`rounded-3xl p-6 border-2 transition flex items-center gap-4 ${isLeave ? 'border-destructive/50 bg-destructive-5' : 'border-primary/30 bg-primary-5'}`}
                  onClick={() => toggleLeave(stu.id)}
                >
                  <View className="flex-shrink-0">
                    {isLeave ? (
                      <View className="w-16 h-16 rounded-full bg-destructive-20 flex items-center justify-center">
                        <Text className="text-destructive text-base font-bold">假</Text>
                      </View>
                    ) : (
                      <Avatar name={stu.name} avatarUrl={stu.avatar_url} size="lg" />
                    )}
                  </View>
                  <View className="flex-1 min-w-0">
                    <Text className="text-base font-medium text-foreground block overflow-hidden text-ellipsis whitespace-nowrap">
                      {stu.name}
                    </Text>
                    <Text
                      className={`text-xs block mt-0_5 ${isLeave ? 'text-destructive' : 'text-primary'}`}
                    >
                      {isLeave ? '请假' : '出席'}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ====== 3. 底部固定按钮 ====== */}
        <View className="fixed bottom-0 left-0 right-0 py-6 px-8 bg-white/95 backdrop-blur-sm border-t border-input">
          <ActionButton
            text={
              submitting ? '消课中...' : `批量消课 ${presentStudents.length}人×${hoursUsed}课时`
            }
            onClick={handleBatchCheckin}
            disabled={submitting || presentStudents.length === 0}
          />
        </View>
      </View>
    </PageContainer>
  );
};

export default withRouteGuard(ClassCheckin);
