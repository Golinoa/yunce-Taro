import { View, Text } from '@tarojs/components';
import cn from 'classnames';
import React, { useEffect, useState } from 'react';
import BottomSheet from '@/components/BottomSheet';
import FormInput from '@/components/FormInput';
import type { DeductionType } from '@/types/teacher';

/**
 * DeductionSheet - 自定义调整项弹窗
 *
 * 使用场景：薪资核对页面添加奖励/扣款调整项
 * 功能：选择奖励/扣款 + 填写项目名称和金额，支持新增和编辑
 * 金额规则：保留小数点后 2 位，多余位数直接舍去（不进位）
 */

interface DeductionSheetProps {
  visible: boolean;
  teacherName: string;
  /** 编辑时的初始数据 */
  initialData?: { reason: string; amount: number; type: DeductionType };
  /** 新增时的默认类型 */
  defaultType?: DeductionType;
  onClose: () => void;
  onSubmit: (data: { reason: string; amount: number; type: DeductionType }) => void;
}

const TYPE_OPTIONS: { label: string; value: DeductionType; color: string }[] = [
  { label: '扣款', value: 'deduct', color: 'destructive' },
  { label: '奖励', value: 'bonus', color: 'success' },
];

/** 截断到两位小数（直接舍去，不进位） */
function truncateToTwoDecimals(value: string): string {
  const trimmed = value.replace(/[^\d.]/g, '');
  const parts = trimmed.split('.');
  if (parts.length > 2) {
    parts.length = 2;
  }
  if (parts[1]) {
    parts[1] = parts[1].slice(0, 2);
  }
  return parts.join('.');
}

const DeductionSheet: React.FC<DeductionSheetProps> = ({
  visible,
  teacherName,
  initialData,
  defaultType = 'deduct',
  onClose,
  onSubmit,
}) => {
  const isEdit = Boolean(initialData);
  const [type, setType] = useState<DeductionType>(defaultType);
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState('');
  const [reasonError, setReasonError] = useState('');
  const [amountError, setAmountError] = useState('');

  useEffect(() => {
    if (visible) {
      setType(initialData?.type || defaultType);
      setReason(initialData?.reason || '');
      setAmount(initialData ? truncateToTwoDecimals(String(initialData.amount)) : '');
      setReasonError('');
      setAmountError('');
    }
  }, [visible, initialData, defaultType]);

  const handleAmountInput = (value: string) => {
    setAmount(truncateToTwoDecimals(value));
    setAmountError('');
  };

  const handleSubmit = () => {
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setReasonError('请输入项目名称');
      return;
    }
    if (!amount || amount === '.' || Number(amount) <= 0) {
      setAmountError('金额必须为正数');
      return;
    }
    const numAmount = Math.trunc(Number(amount) * 100) / 100;
    onSubmit({
      reason: trimmedReason,
      amount: numAmount,
      type,
    });
  };

  const handleClose = () => {
    setType(defaultType);
    setReason('');
    setAmount('');
    setReasonError('');
    setAmountError('');
    onClose();
  };

  const activeOption = TYPE_OPTIONS.find((opt) => opt.value === type);

  return (
    <BottomSheet
      visible={visible}
      title={isEdit ? '编辑调整项' : '添加调整项'}
      onClose={handleClose}
    >
      <View className="px-[32rpx] pb-[48rpx]">
        {/* 教师信息 */}
        <View className="mb-[32rpx] p-[24rpx] rounded-[16rpx] bg-muted">
          <Text className="text-[26rpx] text-muted-foreground">
            当前教师：<Text className="font-semibold text-foreground">{teacherName}</Text>
          </Text>
        </View>

        {/* 类型选择 */}
        <View className="mb-[32rpx]">
          <Text className="text-[28rpx] font-semibold text-foreground mb-[16rpx] block">
            调整类型
          </Text>
          <View className="flex gap-[24rpx]">
            {TYPE_OPTIONS.map((opt) => (
              <View
                key={opt.value}
                className={cn(
                  'flex-1 py-[24rpx] rounded-[16rpx] border-[2rpx] border-solid text-center text-[28rpx] font-medium',
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

        {/* 项目名称 */}
        <View className="mb-[24rpx]">
          <FormInput
            label="项目名称"
            required
            placeholder="请输入项目名称，如：迟到扣款、全勤奖"
            value={reason}
            onInput={(e) => {
              setReason(e.detail.value);
              setReasonError('');
            }}
          />
          {reasonError ? (
            <Text className="text-[24rpx] text-destructive mt-[8rpx] ml-[4rpx]">{reasonError}</Text>
          ) : null}
        </View>

        {/* 金额 */}
        <View className="mb-[48rpx]">
          <FormInput
            label="金额"
            required
            prefix="¥"
            placeholder="请输入金额"
            type="digit"
            value={amount}
            onInput={(e) => handleAmountInput(e.detail.value)}
          />
          {amountError ? (
            <Text className="text-[24rpx] text-destructive mt-[8rpx] ml-[4rpx]">{amountError}</Text>
          ) : null}
        </View>

        {/* 提交按钮 */}
        <View
          className={cn(
            'w-full py-[28rpx] rounded-[28rpx] text-center text-[30rpx] font-semibold',
            reason.trim() && amount && amount !== '.' && Number(amount) > 0
              ? activeOption?.value === 'deduct'
                ? 'bg-destructive text-white'
                : 'bg-gradient-primary text-white'
              : 'bg-muted text-muted-foreground',
          )}
          onClick={
            reason.trim() && amount && amount !== '.' && Number(amount) > 0
              ? handleSubmit
              : undefined
          }
        >
          {isEdit ? '保存' : '确认添加'}
          {type === 'deduct' ? '扣款' : '奖励'}
        </View>
      </View>
    </BottomSheet>
  );
};

export default DeductionSheet;
