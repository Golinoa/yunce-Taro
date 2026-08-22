import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import ActionButton from '@/components/ActionButton';
import Avatar from '@/components/Avatar';
import Loading from '@/components/Loading';
import PageContainer from '@/components/PageContainer';
import Stepper from '@/components/Stepper';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import {
  classService,
  packageService,
  lessonRecordService,
  studentService,
  notificationService,
} from '@/services';
import { auditLogService } from '@/services/audit-log';
import { lessonDebtService } from '@/services/lesson-debt';
import { countTriggeredAlerts } from '@/services/operation-alert';
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
  /** 班级科目（P1：签到消课按科目检索课包） */
  const [classSubjectId, setClassSubjectId] = useState<string | undefined>(undefined);
  const [students, setStudents] = useState<Student[]>([]);
  const [leaveIds, setLeaveIds] = useState<string[]>([]);
  const [hoursUsed, setHoursUsed] = useState(1);
  const { loading, setLoading } = useDelayedLoading();
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    try {
      const cls = await classService.getById(classId);
      if (cls) {
        setClassName(cls.name);
        setClassSubjectId(cls.subject_id);
      }
      const stuList = await classService.getStudents(classId);
      setStudents(stuList);
    } catch (err) {
      logError('load checkin data', err);
    } finally {
      setLoading(false);
    }
  }, [classId, setLoading]);

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

  // 批量消课（P1：课包按科目检索，科目课包不足时让老师选 欠课上课/划扣其他课包/取消）
  const handleBatchCheckin = useCallback(async () => {
    if (presentStudents.length === 0) {
      Taro.showToast({ title: '至少需要一名学生参与消课', icon: 'none' });
      return;
    }
    setSubmitting(true);
    const successList: string[] = [];
    const failList: { name: string; reason: string }[] = [];
    /** 扣课时后剩余：用于预警"触发即提醒一次"判定 */
    const alertItems: { studentId: string; remainingHours: number }[] = [];

    try {
      for (const stu of presentStudents) {
        try {
          const packages = await packageService.getActiveByStudent(stu.id);

          // 1) 优先按班级科目检索课包
          const subjectPackages = classSubjectId
            ? packages.filter((p) => p.subject_id === classSubjectId)
            : packages;
          let pkg =
            subjectPackages.find((p) => (p.remaining_hours || 0) >= hoursUsed) ||
            packages.find((p) => (p.remaining_hours || 0) >= hoursUsed);

          // 2) 科目课包不足 → 弹窗让老师处理
          if (!pkg) {
            const handle: 'debt' | 'transfer' | 'skip' = await new Promise((resolve) => {
              Taro.showActionSheet({
                itemList: ['欠课上课', '划扣其他课包', '取消'],
                success: (res) => {
                  if (res.tapIndex === 0) resolve('debt');
                  else if (res.tapIndex === 1) resolve('transfer');
                  else resolve('skip');
                },
                fail: () => resolve('skip'),
              });
            });

            if (handle === 'debt') {
              // 欠课上课：课时照记，不扣课包（package_id 传空不触发扣减），欠课记入台账
              const createdRecord = await lessonRecordService.create({
                teacher_id: currentUserId,
                student_id: stu.id,
                package_id: '',
                lesson_date: new Date().toISOString().split('T')[0],
                hours_used: hoursUsed,
                content: `${className} 欠课上课`,
              });
              await lessonDebtService.addDebt({
                studentId: stu.id,
                subjectId: classSubjectId,
                hours: hoursUsed,
                sourceRecordId: createdRecord.id,
              });
              successList.push(`${stu.name}(欠课)`);
              continue;
            }

            if (handle === 'transfer') {
              // 划扣其他课包：列出可划扣课包（剩余>0）让老师选
              const candidates = packages.filter((p) => (p.remaining_hours || 0) > 0);
              if (candidates.length === 0) {
                failList.push({ name: stu.name, reason: '无课包可划扣' });
                continue;
              }
              const chosenIdx: number = await new Promise((resolve) => {
                Taro.showActionSheet({
                  itemList: candidates.map((p) => `${p.name}（剩 ${p.remaining_hours} 课时）`),
                  success: (res) => resolve(res.tapIndex),
                  fail: () => resolve(-1),
                });
              });
              if (chosenIdx < 0 || chosenIdx >= candidates.length) {
                failList.push({ name: stu.name, reason: '未选择划扣课包' });
                continue;
              }
              pkg = candidates[chosenIdx];
            } else {
              failList.push({ name: stu.name, reason: '课时不足未处理' });
              continue;
            }
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
          // 预警触发判定（扣课时后剩余降到阈值 → 提醒一次，重复进入不计数）
          alertItems.push({
            studentId: stu.id,
            remainingHours:
              createdRecord.remaining_hours ?? Math.max((pkg.remaining_hours ?? 0) - hoursUsed, 0),
          });
        } catch (err) {
          logError('batchCheckin single student', err);
          failList.push({ name: stu.name, reason: '消课失败' });
        }
      }

      // 汇总结果提示
      // 预警：扣课时后剩余降到阈值 → 立即提醒一次（去重，不重复推送）
      const triggeredAlertCount = successList.length > 0 ? countTriggeredAlerts(alertItems) : 0;
      const alertSuffix = triggeredAlertCount > 0 ? `，${triggeredAlertCount}名课时不足已提醒` : '';

      if (failList.length === 0) {
        Taro.showToast({
          title: `已完成 ${successList.length} 名学生消课${alertSuffix}`,
          icon: 'success',
        });
      } else if (successList.length === 0) {
        Taro.showToast({ title: '全部消课失败', icon: 'none' });
      } else {
        Taro.showToast({
          title: `${successList.length}人成功，${failList.length}人失败${alertSuffix}`,
          icon: 'none',
          duration: 3000,
        });
      }

      // 审计日志（用户口径 2026-08-22）：点名签到属重要日志，批量汇总记一条；学员消课明细在消课记录中可查
      if (successList.length > 0) {
        try {
          await auditLogService.record({
            action: 'lesson.checkin',
            operatorId: currentUserId || profile?.id || '',
            operatorName: profile?.name || '未知',
            operatorRole: profile?.currentContext?.role || 'unknown',
            targetType: 'class_checkin',
            detail: `点名签到：班级「${className}」签到 ${successList.length} 名学员（${hoursUsed} 课时/人）`,
            meta: { className, studentCount: successList.length, hoursPerStudent: hoursUsed },
          });
        } catch (e) {
          logError('audit lesson.checkin', e);
        }
      }

      invalidateStudents(currentUserId);
      setTimeout(() => Taro.navigateBack(), 1500);
    } catch (err) {
      logError('batchCheckin', err);
      Taro.showToast({ title: '操作失败', icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  }, [
    presentStudents,
    className,
    classSubjectId,
    currentUserId,
    hoursUsed,
    invalidateStudents,
    profile,
  ]);

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
