import { View, Text } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import cn from 'classnames';
import dayjs from 'dayjs';
import React, { useMemo, useState, useCallback } from 'react';
import Avatar from '@/components/Avatar';
import DeductionSheet from '@/components/teacher/DeductionSheet';
import PayConfirmSheet from '@/components/teacher/PayConfirmSheet';
import { SalaryStatusTag } from '@/components/teacher/TeacherCard';
import { useTeacherStore, calcTotal } from '@/stores/teacher';
import type { SalaryStatus, DeductionType } from '@/types/teacher';

/** 状态流转步骤 */
const STATUS_STEPS: { key: SalaryStatus; label: string; icon: string }[] = [
  { key: 'pending', label: '待确认', icon: '⏳' },
  { key: 'confirmed', label: '已确认', icon: '✓' },
  { key: 'paid', label: '已发放', icon: '¥' },
];

const SalaryDetailPage: React.FC = () => {
  const { id } = useRouter().params;
  const { teachers, confirmSalary, setPendingPayAction } = useTeacherStore();

  const teacher = useMemo(() => teachers.find((t) => t.id === id), [teachers, id]);

  const [paySheetVisible, setPaySheetVisible] = useState(false);
  const [deductionSheetVisible, setDeductionSheetVisible] = useState(false);

  const total = useMemo(() => (teacher ? calcTotal(teacher) : 0), [teacher]);
  const lessonFee = useMemo(() => (teacher ? teacher.hours * teacher.rate : 0), [teacher]);

  const handleAction = useCallback(() => {
    if (!teacher) return;
    if (teacher.salaryStatus === 'pending') {
      confirmSalary(teacher.id);
      Taro.showToast({ title: '工资已确认', icon: 'success' });
    } else if (teacher.salaryStatus === 'confirmed') {
      setPendingPayAction({ type: 'single', ids: [teacher.id] });
      setPaySheetVisible(true);
    }
  }, [teacher, confirmSalary, setPendingPayAction]);

  const handlePayConfirm = useCallback((remark: string) => {
    useTeacherStore.getState().executePay(remark);
    setPaySheetVisible(false);
    Taro.showToast({ title: '发放成功', icon: 'success' });
  }, []);

  const handleDeductionSubmit = useCallback(
    (data: { reason: string; amount: number; type: DeductionType }) => {
      if (!teacher) return;
      useTeacherStore.getState().addDeduction(teacher.id, {
        id: `d${Date.now()}`,
        reason: data.reason,
        amount: data.amount,
        type: data.type,
      });
      setDeductionSheetVisible(false);
      Taro.showToast({ title: data.type === 'deduct' ? '扣款成功' : '补发成功', icon: 'success' });
    },
    [teacher],
  );

  if (!teacher) {
    return (
      <View className="min-h-screen bg-background pb-safe-bar">
        <View className="flex items-center justify-center py-[160rpx]">
          <Text className="text-[28rpx] text-muted-foreground">教师不存在</Text>
        </View>
      </View>
    );
  }

  // 当前状态索引
  const currentStepIdx = STATUS_STEPS.findIndex((s) => s.key === teacher.salaryStatus);

  return (
    <View className="min-h-screen bg-background pb-safe-bar">
      {/* 教师信息头 */}
      <View className="flex items-center gap-[24rpx] pt-[96rpx] px-[32rpx] pb-[32rpx] bg-card relative">
        <View
          className="absolute top-[96rpx] left-[32rpx] w-[72rpx] h-[72rpx] rounded-full bg-muted flex items-center justify-center"
          onClick={() => Taro.navigateBack()}
        >
          <Text className="text-foreground text-[44rpx] font-light">‹</Text>
        </View>
        <Avatar name={teacher.name} size="lg" />
        <View className="flex-1 min-w-0 ml-[88rpx]">
          <Text className="text-[36rpx] font-bold text-foreground block">{teacher.name}</Text>
          <Text className="text-[26rpx] text-muted-foreground mt-[8rpx] block">
            {teacher.subject} · {teacher.hours}课时
          </Text>
        </View>
        <SalaryStatusTag status={teacher.salaryStatus} />
      </View>

      {/* 状态流转 */}
      <View className="flex items-center justify-center py-[40rpx] px-[48rpx] mx-[32rpx] mt-[24rpx] bg-card rounded-[28rpx] shadow-card">
        {STATUS_STEPS.map((step, idx) => {
          const isCompleted = idx <= currentStepIdx;
          const isCurrent = idx === currentStepIdx;
          return (
            <View key={step.key} className="flex flex-col items-center gap-[12rpx] relative flex-1">
              <View
                className={cn(
                  'w-[64rpx] h-[64rpx] rounded-full flex items-center justify-center transition-all',
                  isCompleted ? 'bg-primary' : 'bg-muted',
                  isCurrent && 'shadow-flow-dot',
                )}
              >
                <Text
                  className={cn(
                    'text-[28rpx]',
                    isCompleted ? 'text-white' : 'text-muted-foreground',
                  )}
                >
                  {isCompleted ? step.icon : idx + 1}
                </Text>
              </View>
              <Text
                className={cn(
                  'text-[22rpx]',
                  isCompleted ? 'text-primary font-semibold' : 'text-muted-foreground',
                )}
              >
                {step.label}
              </Text>
              {idx < STATUS_STEPS.length - 1 && (
                <View
                  className={cn(
                    'absolute top-[32rpx] left-[calc(50%+40rpx)] right-[calc(-50%+40rpx)] h-[4rpx] z-0',
                    idx < currentStepIdx ? 'bg-primary' : 'bg-border',
                  )}
                />
              )}
            </View>
          );
        })}
      </View>

      {/* 金额总览 */}
      <View className="bg-class-amber rounded-[32rpx] py-[40rpx] px-[32rpx] mx-[32rpx] mb-[24rpx] text-center text-white relative overflow-hidden">
        <View className="absolute -top-[40rpx] -right-[40rpx] w-[160rpx] h-[160rpx] rounded-full bg-white/10" />
        <Text className="text-[26rpx] opacity-90 block">{dayjs().month() + 1}月应发总额</Text>
        <Text className="text-[64rpx] font-extrabold mt-[8rpx] block">
          ¥{total.toLocaleString()}
        </Text>
        <View className="flex justify-center gap-[32rpx] mt-[16rpx]">
          <Text className="text-[22rpx] opacity-80">课时费 ¥{lessonFee}</Text>
          {teacher.base > 0 && (
            <Text className="text-[22rpx] opacity-80">底薪 ¥{teacher.base}</Text>
          )}
          {(teacher.attend > 0 || teacher.perf > 0) && (
            <Text className="text-[22rpx] opacity-80">奖金 ¥{teacher.attend + teacher.perf}</Text>
          )}
        </View>
      </View>

      {/* 薪资构成明细 */}
      <View className="bg-card rounded-[28rpx] p-[32rpx] mx-[32rpx] mb-[24rpx] shadow-card">
        <Text className="text-[28rpx] font-semibold text-foreground mb-[24rpx] block">
          薪资构成
        </Text>
        {teacher.base > 0 && (
          <View className="flex justify-between items-center py-[16rpx]">
            <Text className="text-[26rpx] text-muted-foreground">底薪</Text>
            <Text className="text-[26rpx] font-semibold text-foreground">¥{teacher.base}</Text>
          </View>
        )}
        <View className="flex justify-between items-center py-[16rpx]">
          <Text className="text-[26rpx] text-muted-foreground">
            课时费 ({teacher.hours}课时 × ¥{teacher.rate})
          </Text>
          <Text className="text-[26rpx] font-semibold text-foreground">¥{lessonFee}</Text>
        </View>
        {teacher.attend > 0 && (
          <View className="flex justify-between items-center py-[16rpx]">
            <Text className="text-[26rpx] text-muted-foreground">全勤奖</Text>
            <Text className="text-[26rpx] font-semibold text-foreground">¥{teacher.attend}</Text>
          </View>
        )}
        {teacher.perf > 0 && (
          <View className="flex justify-between items-center py-[16rpx]">
            <Text className="text-[26rpx] text-muted-foreground">绩效奖金</Text>
            <Text className="text-[26rpx] font-semibold text-foreground">¥{teacher.perf}</Text>
          </View>
        )}

        {/* 按班级计费 */}
        {teacher.classRateOverrides && teacher.classRateOverrides.length > 0 && (
          <>
            <View className="h-[2rpx] bg-border my-[24rpx]" />
            <Text className="text-[28rpx] font-semibold text-foreground mb-[24rpx] block">
              课时明细
            </Text>
            {teacher.classRateOverrides.map((ov) => (
              <View className="flex justify-between items-center py-[16rpx]" key={ov.className}>
                <Text className="text-[26rpx] text-muted-foreground">{ov.className}</Text>
                <Text className="text-[26rpx] font-semibold text-foreground">¥{ov.rate}/课时</Text>
              </View>
            ))}
          </>
        )}

        {/* 扣款/补发 */}
        {teacher.deductions.length > 0 && (
          <>
            <View className="h-[2rpx] bg-border my-[24rpx]" />
            <View className="flex items-center justify-between mb-[24rpx]">
              <Text className="text-[28rpx] font-semibold text-foreground">扣款/补发</Text>
              <Text
                className="text-[26rpx] font-medium text-primary"
                onClick={() => setDeductionSheetVisible(true)}
              >
                + 添加
              </Text>
            </View>
            {teacher.deductions.map((d) => (
              <View className="flex justify-between items-center py-[16rpx]" key={d.id}>
                <View className="flex items-center gap-[16rpx]">
                  <View
                    className={cn(
                      'w-[12rpx] h-[12rpx] rounded-full flex-shrink-0',
                      d.type === 'deduct' ? 'bg-destructive' : 'bg-success',
                    )}
                  />
                  <Text className="text-[26rpx] text-muted-foreground">{d.reason}</Text>
                </View>
                <Text
                  className={cn(
                    'text-[26rpx] font-semibold',
                    d.type === 'deduct' ? 'text-destructive' : 'text-success',
                  )}
                >
                  {d.type === 'deduct' ? '-' : '+'}¥{d.amount}
                </Text>
              </View>
            ))}
          </>
        )}

        {teacher.payRemark && (
          <>
            <View className="h-[2rpx] bg-border my-[24rpx]" />
            <View className="py-[20rpx] px-[24rpx] bg-muted rounded-xl">
              <Text className="text-[24rpx] font-medium text-muted-foreground block mb-[8rpx]">
                备注
              </Text>
              <Text className="text-[26rpx] text-foreground">{teacher.payRemark}</Text>
            </View>
          </>
        )}
      </View>

      {/* 底部操作按钮 */}
      {teacher.salaryStatus !== 'paid' && (
        <View className="fixed bottom-0 left-0 right-0 px-[32rpx] py-[24rpx] pb-safe-bar bg-card border-t border-border z-10">
          <View
            className={cn(
              teacher.salaryStatus === 'confirmed' ? 'action-btn-primary' : 'action-btn-secondary',
            )}
            onClick={handleAction}
          >
            {teacher.salaryStatus === 'pending' ? '确认工资' : '确认发放'}
          </View>
        </View>
      )}

      {/* 发放确认弹窗 */}
      <PayConfirmSheet
        visible={paySheetVisible}
        action={{ type: 'single', ids: [teacher.id] }}
        teacherName={teacher.name}
        amount={total}
        onConfirm={handlePayConfirm}
        onClose={() => {
          setPaySheetVisible(false);
          setPendingPayAction(null);
        }}
      />

      {/* 扣款/补发弹窗 */}
      <DeductionSheet
        visible={deductionSheetVisible}
        teacherName={teacher.name}
        onClose={() => setDeductionSheetVisible(false)}
        onSubmit={handleDeductionSubmit}
      />
    </View>
  );
};

export default SalaryDetailPage;
