import { View, Text, Input } from '@tarojs/components';
import cn from 'classnames';
import React, { useState, useEffect } from 'react';
import BottomSheet from '@/components/BottomSheet';
import type { SalarySettings } from '@/types/teacher';

/**
 * PaymentSettingsSheet - 发放设置弹窗
 *
 * 使用场景：教师列表薪资设置Tab中配置发放参数
 * 功能：设置发薪日（1-28号）+ 薪资报表推送天数 + 推送提醒开关
 * 相关组件：SalaryModelSheet（工资模型）
 */

interface PaymentSettingsSheetProps {
  visible: boolean;
  settings: SalarySettings;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (updates: Partial<SalarySettings>) => void;
}

/** 发薪日快捷选项 */
const PAY_DAY_OPTIONS = [5, 10, 15, 20, 25];

/** 提前推送天数选项 */
const PUSH_DAYS_OPTIONS = [1, 2, 3, 5, 7];

const PaymentSettingsSheet: React.FC<PaymentSettingsSheetProps> = ({
  visible,
  settings,
  submitting = false,
  onClose,
  onSubmit,
}) => {
  const [payDay, setPayDay] = useState(settings.payDay);
  const [payDayInput, setPayDayInput] = useState(String(settings.payDay));
  const [pushDaysBefore, setPushDaysBefore] = useState(settings.pushDaysBefore);
  const [pushEnabled, setPushEnabled] = useState(settings.pushEnabled);

  // 同步外部 settings 变化
  useEffect(() => {
    if (visible) {
      setPayDay(settings.payDay);
      setPayDayInput(String(settings.payDay));
      setPushDaysBefore(settings.pushDaysBefore);
      setPushEnabled(settings.pushEnabled);
    }
  }, [visible, settings]);

  const handlePayDayInput = (val: string) => {
    setPayDayInput(val);
    const num = parseInt(val, 10);
    if (num >= 1 && num <= 28) {
      setPayDay(num);
    }
  };

  const handleQuickPayDay = (day: number) => {
    setPayDay(day);
    setPayDayInput(String(day));
  };

  const handleSubmit = () => {
    if (submitting) return;
    onSubmit({
      payDay,
      pushDaysBefore,
      pushEnabled,
    });
  };

  return (
    <BottomSheet
      visible={visible}
      title="发放设置"
      onClose={submitting ? () => {} : onClose}
    >
      <View className="px-4 pb-6">
        {/* 发薪日 */}
        <View className="mb-5">
          <Text className="text-sm font-semibold text-foreground mb-2 block">发薪日</Text>
          <Text className="text-xs text-muted-foreground mb-3 block">
            每月固定日期发放工资（1-28号）
          </Text>
          {/* 输入框 */}
          <View className="flex items-center gap-2 mb-3">
            <Text className="text-sm text-muted-foreground">每月</Text>
            <View className="flex items-center py-[14rpx] px-[20rpx] rounded-xl bg-f5faf8-border-d5e8e0">
              <Input
                className="w-[80rpx] text-sm text-center text-foreground"
                type="number"
                value={payDayInput}
                onInput={(e) => handlePayDayInput(e.detail.value)}
                maxlength={2}
              />
            </View>
            <Text className="text-sm text-muted-foreground">号</Text>
          </View>
          {/* 快捷标签 */}
          <View className="flex flex-wrap gap-2">
            {PAY_DAY_OPTIONS.map((day) => (
              <View
                key={day}
                className={cn(
                  'py-[14rpx] px-[28rpx] rounded-2xl border-[2rpx] border-solid text-sm font-medium',
                  payDay === day
                    ? 'border-primary bg-primary-bg text-primary font-semibold'
                    : 'border-border bg-background text-muted-foreground',
                )}
                onClick={submitting ? undefined : () => handleQuickPayDay(day)}
              >
                {day}号
              </View>
            ))}
          </View>
        </View>

        {/* 薪资报表推送 */}
        <View className="mb-5">
          <Text className="text-sm font-semibold text-foreground mb-2 block">薪资报表推送</Text>
          <Text className="text-xs text-muted-foreground mb-3 block">
            发薪前几天推送薪资报表提醒
          </Text>
          <View className="flex flex-wrap gap-2">
            {PUSH_DAYS_OPTIONS.map((days) => (
              <View
                key={days}
                className={cn(
                  'py-[14rpx] px-[28rpx] rounded-2xl border-[2rpx] border-solid text-sm font-medium',
                  pushDaysBefore === days
                    ? 'border-primary bg-primary-bg text-primary font-semibold'
                    : 'border-border bg-background text-muted-foreground',
                )}
                onClick={submitting ? undefined : () => setPushDaysBefore(days)}
              >
                提前{days}天
              </View>
            ))}
          </View>
        </View>

        {/* 推送提醒开关 */}
        <View className="mb-6">
          <Text className="text-sm font-semibold text-foreground mb-3 block">其他设置</Text>
          <View className="bg-card rounded-2xl overflow-hidden">
            <View className="flex items-center justify-between px-4 py-[22rpx]">
              <View className="flex-1">
                <Text className="text-sm font-medium text-foreground block">推送提醒</Text>
                <Text className="text-xs text-muted-foreground mt-1 block">
                  发薪前推送薪资报表给教师
                </Text>
              </View>
              <View
                className={cn(
                  'w-[44px] h-[26px] rounded-[13px] relative flex-shrink-0 transition-colors',
                  pushEnabled ? 'bg-primary' : 'bg-border',
                )}
                onClick={submitting ? undefined : () => setPushEnabled(!pushEnabled)}
              >
                <View
                  className={cn(
                    'absolute top-[3px] w-[20px] h-[20px] rounded-full bg-white shadow-sm transition-transform',
                    pushEnabled ? 'left-[21px]' : 'left-[3px]',
                  )}
                />
              </View>
            </View>
          </View>
        </View>

        {/* 提交按钮 */}
        <View
          className={`w-full py-[28rpx] rounded-2xl text-center text-base font-semibold ${submitting ? 'bg-muted text-muted-foreground' : 'bg-gradient-primary text-white'}`}
          onClick={submitting ? undefined : handleSubmit}
        >
          {submitting ? '保存中...' : '保存设置'}
        </View>
      </View>
    </BottomSheet>
  );
};

export default PaymentSettingsSheet;
