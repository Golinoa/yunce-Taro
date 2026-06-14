import { View, Text } from '@tarojs/components';
import cn from 'classnames';
import React, { useState } from 'react';
import BottomSheet from '@/components/BottomSheet';
import FormInput from '@/components/FormInput';
import type { DeductionType } from '@/types/teacher';

/**
 * DeductionSheet - 扣款/补发弹窗
 *
 * 使用场景：教师薪资确认后，对教师进行扣款或补发操作
 * 功能：选择类型（扣款/补发）+ 填写原因和金额
 * 相关组件：ConfirmSalarySheet（确认工资）、PayConfirmSheet（确认发放）
 */

interface DeductionSheetProps {
  visible: boolean;
  teacherName: string;
  onClose: () => void;
  onSubmit: (data: { reason: string; amount: number; type: DeductionType }) => void;
}

const TYPE_OPTIONS: { label: string; value: DeductionType; color: string }[] = [
  { label: '扣款', value: 'deduct', color: 'destructive' },
  { label: '补发', value: 'bonus', color: 'success' },
];

/** 常用原因快捷选项 */
const QUICK_REASONS: { label: string; type: DeductionType }[] = [
  { label: '迟到扣款', type: 'deduct' },
  { label: '请假扣款', type: 'deduct' },
  { label: '代课补发', type: 'bonus' },
  { label: '加班补贴', type: 'bonus' },
  { label: '课时调整', type: 'bonus' },
  { label: '其他扣款', type: 'deduct' },
];

const DeductionSheet: React.FC<DeductionSheetProps> = ({
  visible,
  teacherName,
  onClose,
  onSubmit,
}) => {
  const [type, setType] = useState<DeductionType>('deduct');
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState('');

  const handleQuickReason = (label: string, quickType: DeductionType) => {
    setReason(label);
    setType(quickType);
  };

  const handleSubmit = () => {
    if (!reason.trim() || !amount || Number(amount) <= 0) return;
    onSubmit({
      reason: reason.trim(),
      amount: Number(amount),
      type,
    });
    // 重置
    setType('deduct');
    setReason('');
    setAmount('');
  };

  const handleClose = () => {
    setType('deduct');
    setReason('');
    setAmount('');
    onClose();
  };

  return (
    <BottomSheet visible={visible} title="扣款/补发" onClose={handleClose}>
      <View className="px-4 pb-6">
        {/* 教师信息 */}
        <View className="mb-4 p-3 rounded-xl bg-muted">
          <Text className="text-sm text-muted-foreground">
            当前教师：<Text className="font-semibold text-foreground">{teacherName}</Text>
          </Text>
        </View>

        {/* 类型选择 */}
        <View className="mb-4">
          <Text className="text-sm font-semibold text-foreground mb-2 block">类型</Text>
          <View className="flex gap-3">
            {TYPE_OPTIONS.map((opt) => (
              <View
                key={opt.value}
                className={cn(
                  'flex-1 py-[20rpx] rounded-2xl border-[2rpx] border-solid text-center text-sm font-medium',
                  type === opt.value
                    ? opt.value === 'deduct'
                      ? 'border-destructive bg-red-50 text-destructive font-semibold'
                      : 'border-success bg-green-50 text-success font-semibold'
                    : 'border-border bg-background text-muted-foreground',
                )}
                onClick={() => setType(opt.value)}
              >
                {opt.label}
              </View>
            ))}
          </View>
        </View>

        {/* 快捷原因 */}
        <View className="mb-4">
          <Text className="text-sm font-semibold text-foreground mb-2 block">常用原因</Text>
          <View className="flex flex-wrap gap-2">
            {QUICK_REASONS.map((qr) => (
              <View
                key={qr.label}
                className={cn(
                  'py-[8rpx] px-[24rpx] rounded-[16rpx] border-[2rpx] border-solid text-xs font-medium',
                  reason === qr.label
                    ? qr.type === 'deduct'
                      ? 'border-destructive bg-red-50 text-destructive'
                      : 'border-success bg-green-50 text-success'
                    : 'border-border bg-background text-muted-foreground',
                )}
                onClick={() => handleQuickReason(qr.label, qr.type)}
              >
                {qr.label}
              </View>
            ))}
          </View>
        </View>

        {/* 原因输入 */}
        <FormInput
          label="原因"
          required
          placeholder="请输入扣款/补发原因"
          value={reason}
          onInput={(e) => setReason(e.detail.value)}
        />

        {/* 金额输入 */}
        <FormInput
          label="金额"
          required
          prefix="¥"
          placeholder="请输入金额"
          type="digit"
          value={amount}
          onInput={(e) => setAmount(e.detail.value)}
        />

        {/* 提交按钮 */}
        <View
          className={cn(
            'w-full py-[28rpx] rounded-2xl text-center text-base font-semibold',
            reason.trim() && Number(amount) > 0
              ? type === 'deduct'
                ? 'bg-destructive text-white'
                : 'bg-gradient-primary text-white'
              : 'bg-muted text-muted-foreground',
          )}
          onClick={reason.trim() && Number(amount) > 0 ? handleSubmit : undefined}
        >
          确认{type === 'deduct' ? '扣款' : '补发'}
        </View>
      </View>
    </BottomSheet>
  );
};

export default DeductionSheet;
