/**
 * 学员详情退费 BottomSheet
 *
 * 使用场景：课程消耗 Tab「申请退费」打开后，选择可退课包并提交。
 * 功能说明：封装退费表单 UI；提交逻辑由父级回调提供。
 */
import { View, Text, Textarea } from '@tarojs/components';
import cn from 'classnames';
import React from 'react';
import BottomSheet from '@/components/BottomSheet';
import FormInput from '@/components/FormInput';
import Icon from '@/components/Icon';
import StudentAvatar from '@/components/student/StudentAvatar';
import type { CoursePackage } from '@/types/course-package';
import type { Student } from '@/types/student';
import {
  getPackageGiftHours,
  getPackagePurchasedHours,
  getPackageRefundableAmount,
} from './student-detail-package';

export interface RefundSheetProps {
  visible: boolean;
  student: Student;
  remainingHours: number;
  refundablePackages: CoursePackage[];
  selectedRefundPackageId: string;
  selectedRefundPackage: CoursePackage | null;
  refundedAmountByPackage: Record<string, number>;
  refundAmount: string;
  refundReason: string;
  refundSubmitting: boolean;
  onClose: () => void;
  onSelectPackage: (pkg: CoursePackage) => void;
  onRefundAmountChange: (value: string) => void;
  onRefundReasonChange: (value: string) => void;
  onConfirm: () => void;
}

const RefundSheet: React.FC<RefundSheetProps> = ({
  visible,
  student,
  remainingHours,
  refundablePackages,
  selectedRefundPackageId,
  selectedRefundPackage,
  refundedAmountByPackage,
  refundAmount,
  refundReason,
  refundSubmitting,
  onClose,
  onSelectPackage,
  onRefundAmountChange,
  onRefundReasonChange,
  onConfirm,
}) => {
  const canSubmit = refundablePackages.length > 0 && !refundSubmitting;

  return (
    <BottomSheet visible={visible} title="申请退费" onClose={onClose}>
      <View className="px-[32rpx] py-[32rpx]">
        <View className="flex items-center gap-[20rpx] mb-[32rpx] py-[24rpx] px-[28rpx] bg-muted rounded-[20rpx]">
          <StudentAvatar name={student.name} size="sm" />
          <View>
            <Text className="text-[28rpx] font-medium text-foreground block">{student.name}</Text>
            <Text className="text-[24rpx] text-muted-foreground">剩余课时 {remainingHours}</Text>
          </View>
        </View>

        <View className="mb-[28rpx]">
          <Text className="text-[28rpx] text-foreground font-medium mb-[16rpx] block">
            选择退费课包 <Text className="text-destructive">*</Text>
          </Text>
          <View className="flex flex-col gap-[16rpx]">
            {refundablePackages.map((pkg) => {
              const isSelected = pkg.id === selectedRefundPackageId;
              const giftHours = getPackageGiftHours(pkg);
              const purchasedHours = getPackagePurchasedHours(pkg);
              const refundedAmount = refundedAmountByPackage[pkg.id] || 0;
              const maxRefundAmount = getPackageRefundableAmount(pkg, refundedAmount);

              return (
                <View
                  key={pkg.id}
                  className={cn(
                    'rounded-[24rpx] border px-[24rpx] py-[22rpx]',
                    isSelected ? 'border-primary bg-primary/5' : 'border-border bg-card',
                  )}
                  onClick={() => onSelectPackage(pkg)}
                >
                  <View className="flex items-start justify-between gap-[16rpx]">
                    <View className="min-w-0 flex-1">
                      <Text className="block text-[28rpx] font-semibold text-foreground">
                        {pkg.name}
                      </Text>
                      <Text className="mt-[6rpx] block text-[24rpx] text-muted-foreground">
                        充值 {purchasedHours} 课时
                        {giftHours > 0 ? ` · 赠送 ${giftHours} 课时` : ''}
                      </Text>
                      <Text className="mt-[6rpx] block text-[24rpx] text-muted-foreground">
                        最多可退 ¥{maxRefundAmount.toFixed(2)}
                      </Text>
                      {refundedAmount > 0 && (
                        <Text className="mt-[6rpx] block text-[24rpx] text-warning">
                          已退 ¥{refundedAmount.toFixed(2)}
                        </Text>
                      )}
                    </View>
                    <Icon
                      name={isSelected ? 'mdi-check-circle' : 'mdi-checkbox-blank-circle-outline'}
                      size="sm"
                      color={isSelected ? 'success' : 'hsl(var(--muted-foreground))'}
                    />
                  </View>
                </View>
              );
            })}
            {refundablePackages.length === 0 && (
              <View className="rounded-[20rpx] bg-muted px-[24rpx] py-[24rpx]">
                <Text className="text-[24rpx] text-muted-foreground">
                  当前没有可退费课包。退费仅按剩余充值课时计算，赠送课时不参与退费。
                </Text>
              </View>
            )}
          </View>
        </View>

        <FormInput
          label="退费金额"
          required
          placeholder={
            selectedRefundPackage ? '系统已预填可退金额，可按需修改' : '请先选择退费课包'
          }
          type="digit"
          value={refundAmount}
          onInput={(e) => onRefundAmountChange(e.detail.value)}
          disabled={!selectedRefundPackage}
        />
        {selectedRefundPackage && (
          <View className="mb-[24rpx] mt-[-12rpx]">
            <Text className="text-[24rpx] text-muted-foreground">
              已预填建议金额，可自行修改；赠送课时不参与退费。
            </Text>
          </View>
        )}

        <View className="mb-[32rpx]">
          <Text className="text-[28rpx] text-foreground font-medium mb-[16rpx] block">
            退费原因 <Text className="text-destructive">*</Text>
          </Text>
          <Textarea
            className="w-full bg-muted rounded-[20rpx] px-[24rpx] py-[24rpx] text-[28rpx] text-foreground min-h-[160rpx]"
            placeholder="请输入退费原因"
            placeholderClass="input-placeholder"
            value={refundReason}
            onInput={(e) => onRefundReasonChange(e.detail.value)}
            maxlength={200}
            cursorSpacing={160}
            autoHeight
            disableDefaultPadding
          />
        </View>

        <View
          className={cn(
            'rounded-[48rpx] py-[28rpx] flex items-center justify-center press-scale',
            canSubmit ? 'bg-destructive' : 'bg-border',
          )}
          onClick={canSubmit ? onConfirm : undefined}
        >
          <Text className="text-[30rpx] text-primary-foreground font-semibold">
            {refundSubmitting ? '提交中...' : '确认退费'}
          </Text>
        </View>
      </View>
    </BottomSheet>
  );
};

export default RefundSheet;
