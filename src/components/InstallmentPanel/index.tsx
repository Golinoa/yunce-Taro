import { View, Input, Text } from '@tarojs/components';
import dayjs from 'dayjs';
import cn from 'classnames';
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import DatePickerSheet from '@/components/DatePickerSheet';
import ChipPicker from '../ChipPicker';
import {
  buildInstallmentSchedule,
  getPeriodOptions,
  type ScheduleItem,
} from './installment-utils';

export type { ScheduleItem } from './installment-utils';
export { buildInstallmentSchedule, getPeriodOptions } from './installment-utils';

/**
 * InstallmentPanel - 分期付款面板
 * 期数变更时按「今天 + (期号-1) 个月」自动填到期日；日期可点开底部选择器修改。
 *
 * 注意：期数选项用 getter，useState 禁止数组解构——避免 Taro weapp 打包白屏。
 */

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

function useStatePair<T>(initial: T | (() => T)): [T, Dispatch<SetStateAction<T>>] {
  const pair = useState(initial);
  return [pair[0], pair[1]];
}

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
  const seededRef = useRef(false);
  const periodOptions = getPeriodOptions();

  const initSchedule = useCallback(
    (count: number) => {
      onScheduleChange(buildInstallmentSchedule(total, count));
    },
    [total, onScheduleChange],
  );

  useEffect(() => {
    if (!enabled) {
      seededRef.current = false;
      return;
    }
    if (schedule.length === 0 && !seededRef.current) {
      seededRef.current = true;
      initSchedule(periodCount || 2);
    }
  }, [enabled, schedule.length, periodCount, initSchedule]);

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

      if (field === 'amount' && val !== '') {
        const changedAmount = parseFloat(String(val)) || 0;
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

  const datePickerIndexPair = useStatePair<number | null>(null);
  const datePickerIndex = datePickerIndexPair[0];
  const setDatePickerIndex = datePickerIndexPair[1];

  if (!enabled) return null;

  return (
    <View className={cn('pt-[28rpx]', className)}>
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

      <View className="mb-[28rpx]">
        <View className="text-sm text-muted-foreground font-medium mb-[12rpx]">分期期数</View>
        <ChipPicker
          options={periodOptions}
          value={String(periodCount)}
          onChange={handlePeriodChange}
        />
      </View>

      <View>
        <View className="text-sm font-semibold text-foreground mb-[8rpx]">还款计划</View>
        <View className="text-xs text-muted-foreground mb-[16rpx]">
          默认按今天起每期顺延一个月，可点日期单独修改
        </View>
        <View className="flex flex-col gap-[20rpx]">
          {schedule.map((item, index) => (
            <View
              key={item.period}
              className="bg-muted/40 rounded-2xl p-[24rpx] border-[2rpx] border-solid border-border"
            >
              <View className="flex flex-row items-center gap-[16rpx] mb-[16rpx]">
                <View
                  className={cn(
                    'w-[48rpx] h-[48rpx] rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
                    index === 0
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted-foreground/20 text-muted-foreground',
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
                <View
                  className="flex-1 bg-white rounded-md border-[2rpx] border-solid border-border px-[18rpx] py-[14rpx]"
                  onClick={() => setDatePickerIndex(index)}
                >
                  <Text
                    className={cn(
                      'text-sm h-[40rpx] leading-[40rpx]',
                      item.date ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {item.date || '选择日期'}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>
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

      <DatePickerSheet
        visible={datePickerIndex !== null}
        title="选择日期"
        value={
          datePickerIndex !== null
            ? schedule[datePickerIndex]?.date || dayjs().format('YYYY-MM-DD')
            : dayjs().format('YYYY-MM-DD')
        }
        onClose={() => setDatePickerIndex(null)}
        onConfirm={(date) => {
          if (datePickerIndex === null) return;
          handleScheduleUpdate(datePickerIndex, 'date', date);
          setDatePickerIndex(null);
        }}
      />
    </View>
  );
};

export default InstallmentPanel;
