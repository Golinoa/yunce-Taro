import { View, Input } from '@tarojs/components';
import cn from 'classnames';
import React, { useCallback } from 'react';
import ChipPicker from '../ChipPicker';

/**
 * InstallmentPanel - 分期付款面板组件
 *
 * 对齐设计稿分期详情：
 * - 三列摘要：总金额(primary-bg)、首笔金额(success-bg)、待付金额(warning-bg)
 * - 期数选择：ChipPicker
 * - 还款计划卡片：序号标签 + 金额/日期输入
 */

export interface ScheduleItem {
  period: number;
  amount: string;
  date: string;
  reminder: boolean;
}

export interface InstallmentPanelProps {
  totalAmount: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  periodCount: number;
  onPeriodChange: (count: number) => void;
  schedule: ScheduleItem[];
  onScheduleChange: (schedule: ScheduleItem[]) => void;
  className?: string;
}

const PERIOD_OPTIONS = [
  { label: '2期', value: '2' },
  { label: '3期', value: '3' },
  { label: '6期', value: '6' },
  { label: '12期', value: '12' },
];

const InstallmentPanel: React.FC<InstallmentPanelProps> = ({
  totalAmount,
  enabled,
  onToggle: _onToggle,
  periodCount,
  onPeriodChange,
  schedule,
  onScheduleChange,
  className,
}) => {
  const total = parseFloat(totalAmount) || 0;
  const firstAmount = schedule.length > 0 ? parseFloat(schedule[0].amount) || 0 : 0;
  const allocatedAmount = schedule.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
  const remainAmount = total - allocatedAmount;

  const initSchedule = useCallback(
    (count: number) => {
      const perPeriod = total > 0 ? Math.floor((total / count) * 100) / 100 : 0;
      const lastAmount = total > 0 ? Math.round((total - perPeriod * (count - 1)) * 100) / 100 : 0;
      const items: ScheduleItem[] = [];
      for (let i = 0; i < count; i++) {
        items.push({
          period: i + 1,
          amount: i === count - 1 ? String(lastAmount) : String(perPeriod),
          date: '',
          reminder: false,
        });
      }
      onScheduleChange(items);
    },
    [total, onScheduleChange],
  );

  const handlePeriodChange = useCallback(
    (val: string | string[]) => {
      const count = parseInt(val as string, 10);
      onPeriodChange(count);
      initSchedule(count);
    },
    [onPeriodChange, initSchedule],
  );

  const handleScheduleUpdate = useCallback(
    (index: number, field: keyof ScheduleItem, val: string | boolean) => {
      const next = [...schedule];
      next[index] = { ...next[index], [field]: val };

      // 手动修改金额后，自动均分剩余金额到后续期数
      if (field === 'amount' && val !== '') {
        const changedAmount = parseFloat(String(val)) || 0;
        // 计算已分配金额（含当前修改的期）
        const allocatedBefore = next
          .slice(0, index + 1)
          .reduce(
            (sum, s, i) => sum + (i === index ? changedAmount : parseFloat(s.amount) || 0),
            0,
          );
        const remaining = total - allocatedBefore;
        const remainingPeriods = next.length - index - 1;

        if (remainingPeriods > 0) {
          const perPeriod =
            remaining > 0 ? Math.floor((remaining / remainingPeriods) * 100) / 100 : 0;
          const lastAdjust =
            remaining > 0 ? Math.round((remaining - perPeriod * remainingPeriods) * 100) / 100 : 0;
          for (let i = index + 1; i < next.length; i++) {
            next[i] = {
              ...next[i],
              amount: i === next.length - 1 ? String(perPeriod + lastAdjust) : String(perPeriod),
            };
          }
        }
      }

      onScheduleChange(next);
    },
    [schedule, onScheduleChange, total],
  );

  if (!enabled) return null;

  return (
    <View className={cn('pt-[28rpx]', className)}>
      {/* 分期摘要（对齐设计稿 .installment-summary 三列） */}
      <View className="flex flex-row gap-[16rpx] mb-[28rpx]">
        <View className="inst-summary-item bg-primary-bg">
          <View className="text-xs text-primary font-medium mb-[4rpx]">总金额</View>
          <View className="text-base font-bold text-primary">¥{total.toFixed(2)}</View>
        </View>
        <View className="inst-summary-item bg-success-bg">
          <View className="text-xs text-success font-medium mb-[4rpx]">首笔金额</View>
          <View className="text-base font-bold text-success">¥{firstAmount.toFixed(2)}</View>
        </View>
        <View className="inst-summary-item bg-warning-bg">
          <View className="text-xs text-amber font-medium mb-[4rpx]">待付金额</View>
          <View
            className={cn(
              'text-base font-bold',
              remainAmount < 0 ? 'text-destructive' : 'text-amber',
            )}
          >
            ¥{remainAmount.toFixed(2)}
          </View>
        </View>
      </View>

      {/* 期数选择 */}
      <View className="mb-[28rpx]">
        <View className="text-sm text-muted-foreground font-medium mb-[12rpx]">分期期数</View>
        <ChipPicker
          options={PERIOD_OPTIONS}
          value={String(periodCount)}
          onChange={handlePeriodChange}
        />
      </View>

      {/* 还款计划 */}
      <View>
        <View className="text-sm font-semibold text-foreground mb-[16rpx]">还款计划</View>
        <View className="flex flex-col gap-[20rpx]">
          {schedule.map((item, index) => (
            <View
              key={item.period}
              className="bg-background rounded-[20rpx] p-[24rpx] border-[2rpx] border-solid border-border"
            >
              <View className="flex flex-row items-center gap-[12rpx] mb-[16rpx]">
                <View
                  className={cn(
                    'w-[40rpx] h-[40rpx] rounded-md flex items-center justify-center text-xs font-bold text-white',
                    index === 0 ? 'bg-accent' : 'bg-primary',
                  )}
                >
                  {item.period}
                </View>
                <View className="text-sm font-semibold text-foreground">第{item.period}期</View>
              </View>
              <View className="flex flex-row items-center gap-[16rpx]">
                <View className="text-xs text-muted-foreground/60 w-[104rpx] flex-shrink-0">
                  金额
                </View>
                <View className="flex-1 bg-white rounded-md border-[2rpx] border-solid border-border px-[18rpx] py-[14rpx]">
                  <Input
                    className="w-full text-sm font-semibold text-foreground h-[40rpx] leading-[40rpx]"
                    type="digit"
                    placeholder="0.00"
                    value={item.amount}
                    onInput={(e) => {
                      const v = e.detail.value || '';
                      // 禁止负数输入
                      const num = parseFloat(v);
                      if (v && (isNaN(num) || num < 0)) return;
                      handleScheduleUpdate(index, 'amount', v);
                    }}
                  />
                </View>
              </View>
              <View className="flex flex-row items-center gap-[16rpx] mt-[16rpx]">
                <View className="text-xs text-muted-foreground/60 w-[104rpx] flex-shrink-0">
                  日期
                </View>
                <View className="flex-1 bg-white rounded-md border-[2rpx] border-solid border-border px-[18rpx] py-[14rpx]">
                  <Input
                    className="w-full text-sm text-foreground h-[40rpx] leading-[40rpx]"
                    type="text"
                    placeholder="选择日期"
                    value={item.date}
                    onInput={(e) => handleScheduleUpdate(index, 'date', e.detail.value || '')}
                  />
                </View>
              </View>
            </View>
          ))}
        </View>
        {/* 剩余金额提示 */}
        {remainAmount !== 0 && (
          <View
            className={cn(
              'text-xs mt-[16rpx] text-right',
              remainAmount < 0 ? 'text-destructive' : 'text-primary',
            )}
          >
            {remainAmount > 0
              ? `还有 ¥${remainAmount.toFixed(2)} 未分配`
              : `超出 ¥${Math.abs(remainAmount).toFixed(2)}`}
          </View>
        )}
      </View>
    </View>
  );
};

export default InstallmentPanel;
