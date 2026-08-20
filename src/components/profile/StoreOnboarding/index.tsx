/**
 * StoreOnboarding - 店铺管理配置引导卡片
 *
 * 用于教师角色个人中心「店铺管理」区域：
 * - 7 项基础配置（门店/场地/员工/课程/科目/卡种/薪资）未全部完成时展示引导态
 * - 显示进度条、「配置进度 X/6」、步骤角标
 * - 未完成步骤逐个雷达扩散光圈闪烁，引导用户按顺序配置
 * - 全部完成后由页面切换回普通 8 宫格（ProfileGrid）
 * - 图标统一使用主题色 + 浅色圆形背景，随主题切换变化
 */
import { View, Text } from '@tarojs/components';
import cn from 'classnames';
import React, { useCallback, useMemo } from 'react';
import Icon from '@/components/Icon';
import type { StoreOnboardingStep } from '@/types/onboarding';
import type { StoreOnboardingProps } from './types';

// 引导态中不参与步骤统计的固定入口
const EXTRA_ITEMS: Array<{ label: string; icon: 'mdi-email-outline' }> = [
  { label: '学员信箱', icon: 'mdi-email-outline' },
];

// 进度条宽度映射（6 等分，避免内联 style）
const PROGRESS_WIDTH_CLASSES = ['w-0', 'w-1/6', 'w-2/6', 'w-3/6', 'w-4/6', 'w-5/6', 'w-full'];

const StoreOnboarding: React.FC<StoreOnboardingProps> = ({
  data,
  loading,
  onStepClick,
  onExtraClick,
  className,
}) => {
  const progressClass = useMemo(
    () => PROGRESS_WIDTH_CLASSES[Math.min(data.completed, data.total)] || 'w-0',
    [data.completed, data.total],
  );

  // ============================================
  // 引导闪烁：始终只高亮「第一个未完成步骤」
  // 用户配置完成后自动推进到下一个未完成步骤
  // ============================================
  const firstPendingIndex = useMemo(() => data.steps.findIndex((s) => !s.completed), [data.steps]);

  const handleStepClick = useCallback(
    (step: StoreOnboardingStep) => () => {
      onStepClick(step);
    },
    [onStepClick],
  );

  return (
    <View
      className={cn(
        'mx-[32rpx] px-[24rpx] pt-[28rpx] pb-[24rpx] rounded-[24rpx] bg-card shadow-soft',
        className,
      )}
    >
      {/* 标题 + 进度文案 */}
      <View className="flex items-center justify-between mb-[16rpx]">
        <Text className="text-[34rpx] font-bold text-foreground">店铺管理</Text>
        <Text className="text-[26rpx] font-medium text-profile-orange">
          配置进度 {data.completed}/{data.total}
        </Text>
      </View>

      {/* 进度条 */}
      <View className="h-[12rpx] rounded-full bg-primary-15 overflow-hidden mb-[32rpx]">
        <View
          className={cn(
            'h-full rounded-full bg-primary transition-all duration-300',
            progressClass,
          )}
        />
      </View>

      {/* 入口网格 */}
      <View className={cn('grid grid-cols-4 gap-y-[28rpx]', loading && 'state-loading')}>
        {/* 6 个配置步骤 */}
        {data.steps.map((step, index) => {
          const isPulsing = index === firstPendingIndex;
          return (
            <View
              key={step.key}
              className="flex flex-col items-center gap-[14rpx] active:opacity-70"
              onClick={handleStepClick(step)}
            >
              <View className="relative">
                {/* 图标统一使用主题色 */}
                <Icon name={step.icon} size={56} color="primary" />
                {step.completed ? (
                  /* 完成标记 */
                  <View className="absolute -top-[8rpx] -right-[8rpx] w-[28rpx] h-[28rpx] rounded-full bg-success center shadow">
                    <Icon name="mdi-check" size={16} color="hsl(var(--primary-foreground))" />
                  </View>
                ) : (
                  /* 待配置序号：悬浮在右上角，带轻微阴影 */
                  <View className="absolute -top-[8rpx] -right-[8rpx] w-[32rpx] h-[32rpx]">
                    {/* 扩散环：垫在角标下面，初始被角标完全遮住 */}
                    {isPulsing && (
                      <View className="absolute inset-0 rounded-full bg-profile-orange-solid animate-radar-ring" />
                    )}
                    {/* 角标本体 */}
                    <View
                      className={cn(
                        'absolute inset-0 rounded-full bg-profile-orange-solid border-[3rpx] border-card flex items-center justify-center shadow',
                        isPulsing && 'animate-badge-scale',
                      )}
                    >
                      <Text className="text-[20rpx] font-bold text-primary-foreground leading-none">
                        {index + 1}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
              <Text className="text-[24rpx] text-foreground-secondary font-medium whitespace-nowrap">
                {step.label}
              </Text>
            </View>
          );
        })}

        {/* 固定附加入口 */}
        {EXTRA_ITEMS.map((item) => (
          <View
            key={item.label}
            className="flex flex-col items-center gap-[14rpx] active:opacity-70"
            onClick={() => onExtraClick?.()}
          >
            <Icon name={item.icon} size={56} color="primary" />
            <Text className="text-[24rpx] text-foreground-secondary font-medium whitespace-nowrap">
              {item.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

export default StoreOnboarding;
