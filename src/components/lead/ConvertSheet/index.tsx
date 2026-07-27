import { View, Text } from '@tarojs/components';
import cn from 'classnames';
import React, { useState, useCallback } from 'react';
import BottomSheet from '@/components/BottomSheet';
import FormInput from '@/components/FormInput';
import Icon from '@/components/Icon';
import type { ConversionType } from '@/types/lead';

/**
 * ConvertSheet - 转正式学员弹窗
 *
 * 流程：选择课包充值 → 推荐选班（非必选）→ 确认转化。
 * 充值课包为必选，选班为非必选步骤。
 */

export interface ConvertSheetProps {
  visible: boolean;
  /** 线索 ID */
  leadId: string;
  /** 孩子姓名 */
  childName: string;
  /** 可选课包列表 */
  coursePackages: { id: string; name: string; price: number; lessonCount: number }[];
  /** 可选班级列表 */
  classes: { id: string; name: string; subjectName: string; schedule: string }[];
  /** 试听过的班级 ID 列表（优先推荐） */
  trialClassIds?: string[];
  /** 提交回调 */
  onSubmit: (params: {
    leadId: string;
    conversionType: ConversionType;
    packageId: string;
    classId?: string;
    note?: string;
  }) => void;
  onClose: () => void;
  className?: string;
}

/** 转化步骤 */
type Step = 'package' | 'class' | 'confirm';

const ConvertSheet: React.FC<ConvertSheetProps> = ({
  visible,
  leadId,
  childName,
  coursePackages,
  classes,
  trialClassIds = [],
  onSubmit,
  onClose,
  className,
}) => {
  const [step, setStep] = useState<Step>('package');
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [note, setNote] = useState('');

  const handleNextFromClass = useCallback(() => {
    setStep('confirm');
  }, []);

  const handleSkipClass = useCallback(() => {
    setStep('confirm');
  }, []);

  const handlePrevStep = useCallback(() => {
    if (step === 'confirm') setStep('class');
    if (step === 'class') setStep('package');
  }, [step]);

  const handleConfirm = useCallback(() => {
    if (!selectedPackageId) return;
    onSubmit({
      leadId,
      conversionType: 'new_student',
      packageId: selectedPackageId,
      classId: selectedClassId || undefined,
      note: note.trim() || undefined,
    });
    // 重置
    setStep('package');
    setSelectedPackageId('');
    setSelectedClassId('');
    setNote('');
  }, [leadId, selectedPackageId, selectedClassId, note, onSubmit]);

  const handleClose = useCallback(() => {
    setStep('package');
    setSelectedPackageId('');
    setSelectedClassId('');
    setNote('');
    onClose();
  }, [onClose]);

  const stepTitle =
    step === 'package' ? '选择课包（必选）' : step === 'class' ? '推荐选班（选填）' : '确认转化';

  return (
    <BottomSheet visible={visible} title={stepTitle} onClose={handleClose}>
      <View className={cn('px-[40rpx] pb-[60rpx] pt-[12rpx]', className)}>
        {/* 步骤一：选择课包 */}
        {step === 'package' && (
          <>
            <Text className="text-[26rpx] text-muted-foreground mb-3">
              为 {childName} 选择课包充值
            </Text>
            <View className="flex flex-col gap-3 mb-6">
              {coursePackages.map((pkg) => (
                <View
                  key={pkg.id}
                  className={cn(
                    'p-4 rounded-[20rpx] border-2',
                    selectedPackageId === pkg.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-white',
                  )}
                  onClick={() => setSelectedPackageId(pkg.id)}
                >
                  <View className="flex justify-between items-center">
                    <Text className="text-[28rpx] font-medium text-foreground">{pkg.name}</Text>
                    <Text className="text-[28rpx] font-bold text-primary">¥{pkg.price}</Text>
                  </View>
                  <Text className="text-[24rpx] text-muted-foreground mt-1">
                    {pkg.lessonCount} 节课
                  </Text>
                </View>
              ))}
              {coursePackages.length === 0 && (
                <View className="py-8 center">
                  <Text className="text-[26rpx] text-muted-foreground">暂无可选课包</Text>
                </View>
              )}
            </View>
            <View
              className={cn(
                'py-[24rpx] rounded-full center',
                selectedPackageId ? 'bg-gradient-primary' : 'bg-muted',
              )}
              onClick={selectedPackageId ? () => setStep('class') : undefined}
            >
              <Text
                className={cn(
                  'text-[28rpx] font-medium',
                  selectedPackageId ? 'text-white' : 'text-muted-foreground',
                )}
              >
                下一步
              </Text>
            </View>
          </>
        )}

        {/* 步骤二：推荐选班 */}
        {step === 'class' && (
          <>
            <View className="flex justify-between items-center mb-3">
              <Text className="text-[26rpx] text-muted-foreground">推荐班级（可跳过）</Text>
              <View onClick={handleSkipClass}>
                <Text className="text-[26rpx] text-primary">跳过</Text>
              </View>
            </View>
            <View className="flex flex-col gap-3 mb-6">
              {/* 按试听班级优先排序 */}
              {[...classes]
                .sort((a, b) => {
                  const aTrial = trialClassIds.includes(a.id) ? 0 : 1;
                  const bTrial = trialClassIds.includes(b.id) ? 0 : 1;
                  return aTrial - bTrial;
                })
                .map((cls) => {
                  const isTrial = trialClassIds.includes(cls.id);
                  return (
                    <View
                      key={cls.id}
                      className={cn(
                        'p-4 rounded-[20rpx] border-2',
                        selectedClassId === cls.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border bg-white',
                      )}
                      onClick={() => setSelectedClassId(cls.id)}
                    >
                      <View className="flex justify-between items-center">
                        <View className="flex items-center gap-2">
                          <Text className="text-[28rpx] font-medium text-foreground">
                            {cls.name}
                          </Text>
                          {isTrial && (
                            <View className="rounded-[8rpx] bg-primary/10 px-[12rpx] py-[4rpx]">
                              <Text className="text-center text-[20rpx] font-medium text-primary">
                                试听过
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text className="text-[24rpx] text-primary">{cls.subjectName}</Text>
                      </View>
                      <Text className="text-[24rpx] text-muted-foreground mt-1">
                        {cls.schedule}
                      </Text>
                    </View>
                  );
                })}
              {classes.length === 0 && (
                <View className="py-8 center">
                  <Text className="text-[26rpx] text-muted-foreground">暂无可选班级</Text>
                </View>
              )}
            </View>
            <View className="flex gap-3">
              <View
                className="flex-1 py-[24rpx] rounded-full center border-2 border-primary"
                onClick={handlePrevStep}
              >
                <Text className="text-[28rpx] text-primary font-medium">上一步</Text>
              </View>
              <View
                className="flex-1 py-[24rpx] rounded-full center bg-gradient-primary"
                onClick={handleNextFromClass}
              >
                <Text className="text-[28rpx] text-white font-medium">下一步</Text>
              </View>
            </View>
          </>
        )}

        {/* 步骤三：确认 */}
        {step === 'confirm' && (
          <>
            <View className="bg-muted rounded-[16rpx] p-4 mb-6">
              <View className="flex items-center gap-2 mb-2">
                <Icon name="mdi-account-plus" size={20} className="text-primary" />
                <Text className="text-[28rpx] font-medium text-foreground">
                  {childName} → 正式学员
                </Text>
              </View>
              {selectedPackageId && (
                <Text className="text-[24rpx] text-foreground-secondary">
                  课包：{coursePackages.find((p) => p.id === selectedPackageId)?.name}
                </Text>
              )}
              {selectedClassId && (
                <Text className="text-[24rpx] text-foreground-secondary">
                  班级：{classes.find((c) => c.id === selectedClassId)?.name}
                </Text>
              )}
            </View>

            <FormInput
              label="备注"
              placeholder="可选，填写转化相关说明"
              value={note}
              onInput={(e) => setNote(e.detail.value)}
              multiline
              maxlength={200}
            />

            <View className="flex gap-3 mt-6">
              <View
                className="flex-1 py-[24rpx] rounded-full center border-2 border-primary"
                onClick={handlePrevStep}
              >
                <Text className="text-[28rpx] text-primary font-medium">上一步</Text>
              </View>
              <View
                className="flex-1 py-[24rpx] rounded-full center bg-gradient-primary"
                onClick={handleConfirm}
              >
                <Text className="text-[28rpx] text-white font-medium">确认转化</Text>
              </View>
            </View>
          </>
        )}
      </View>
    </BottomSheet>
  );
};

export default ConvertSheet;
