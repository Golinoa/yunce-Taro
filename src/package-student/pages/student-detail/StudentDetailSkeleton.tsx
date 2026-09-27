/**
 * 学员详情页骨架屏（冷进入且无缓存时使用）
 *
 * 为什么用它替代全屏 loading：整页转圈会让用户觉得"卡住了"；骨架屏先给出页面结构
 * （头部 + 标签栏 + 内容块占位），数据回来后原地填充，等待感明显更轻。
 *
 * 几何与真实组件对齐（避免数据到达时跳版）：
 * - 头部：`StudentDetailHeader` 同款渐变容器 / 内边距，占位返回按钮 64rpx、头像 160rpx；
 * - 标签栏：`StudentDetailTabBar` 同款 `px-[32rpx] -mt-[40rpx]` + 卡片内 4 个等宽占位；
 * - 内容：与资料面板同节奏的三段卡片占位。
 */
import { View } from '@tarojs/components';
import cn from 'classnames';
import React from 'react';

const SkeletonBlock: React.FC<{ className?: string }> = ({ className }) => (
  <View className={cn('rounded-[12rpx] bg-muted animate-pulse', className)} />
);

export interface StudentDetailSkeletonProps {
  statusBarHeight: number;
  activeTheme: string;
}

const StudentDetailSkeleton: React.FC<StudentDetailSkeletonProps> = ({
  statusBarHeight,
  activeTheme,
}) => {
  return (
    <View className={cn(`theme-${activeTheme}`, 'min-h-screen bg-background')}>
      {/* 头部占位：渐变导航区 */}
      <View
        className="bg-gradient-diffuse-custom-nav px-[40rpx] relative overflow-hidden pb-[72rpx]"
        style={{ paddingTop: `${statusBarHeight + 8}px` }}
      >
        <SkeletonBlock className="w-[64rpx] h-[64rpx] rounded-full bg-card/80" />
        <View className="flex items-center gap-[24rpx] mt-[24rpx]">
          <SkeletonBlock className="w-[160rpx] h-[160rpx] rounded-full" />
          <View className="flex-1 min-w-0">
            <SkeletonBlock className="w-[240rpx] h-[40rpx]" />
            <SkeletonBlock className="w-[320rpx] h-[28rpx] mt-[16rpx]" />
          </View>
        </View>
      </View>

      {/* 标签栏占位 */}
      <View className="px-[32rpx] -mt-[40rpx] relative z-2">
        <View className="flex bg-card rounded-[32rpx] p-[8rpx] shadow-soft">
          <SkeletonBlock className="flex-1 h-[72rpx] rounded-[24rpx]" />
          <SkeletonBlock className="flex-1 h-[72rpx] rounded-[24rpx] ml-[8rpx]" />
          <SkeletonBlock className="flex-1 h-[72rpx] rounded-[24rpx] ml-[8rpx]" />
          <SkeletonBlock className="flex-1 h-[72rpx] rounded-[24rpx] ml-[8rpx]" />
        </View>
      </View>

      {/* 内容占位：与资料面板卡片节奏一致 */}
      <View className="px-[32rpx] mt-[24rpx] flex flex-col gap-[24rpx]">
        <SkeletonBlock className="h-[180rpx]" />
        <SkeletonBlock className="h-[120rpx]" />
        <SkeletonBlock className="h-[120rpx]" />
        <SkeletonBlock className="h-[200rpx]" />
      </View>
    </View>
  );
};

export default StudentDetailSkeleton;
