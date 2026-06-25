/**
 * RegisterStepper 注册步骤指示器
 * 用于注册流程顶部，展示当前进行到第几步
 */
import { View, Text } from '@tarojs/components';
import cn from 'classnames';
import React from 'react';
import Icon from '@/components/Icon';

export interface RegisterStepperProps {
  /** 当前步骤：1 | 2 | 3 */
  current: number;
  className?: string;
}

const STEPS = [{ label: '创建账号' }, { label: '选择身份' }, { label: '完善信息' }];

const RegisterStepper: React.FC<RegisterStepperProps> = ({ current, className }) => {
  return (
    <View className={cn('flex items-center justify-between', className)}>
      {STEPS.map((step, index) => {
        const stepNumber = index + 1;
        const isDone = current > stepNumber;
        const isActive = current === stepNumber;
        const isPending = current < stepNumber;

        return (
          <React.Fragment key={step.label}>
            <View className="flex flex-col items-center">
              <View
                className={cn(
                  'w-[48rpx] h-[48rpx] rounded-full flex items-center justify-center text-[24rpx] font-semibold border-2',
                  isDone && 'bg-primary border-primary',
                  isActive && 'bg-white border-primary text-primary',
                  isPending && 'bg-white border-border text-muted-foreground',
                )}
              >
                {isDone ? (
                  <Icon name="check" size={24} className="text-white" />
                ) : (
                  <Text className={cn(isActive ? 'text-primary' : 'text-muted-foreground')}>
                    {stepNumber}
                  </Text>
                )}
              </View>
              <Text
                className={cn(
                  'text-[22rpx] mt-[10rpx]',
                  isDone || isActive ? 'text-foreground font-medium' : 'text-muted-foreground',
                )}
              >
                {step.label}
              </Text>
            </View>

            {index < STEPS.length - 1 && (
              <View
                className={cn(
                  'flex-1 h-[4rpx] mx-[16rpx] mb-[32rpx] rounded-full',
                  current > stepNumber ? 'bg-primary' : 'bg-border',
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
};

export default RegisterStepper;
