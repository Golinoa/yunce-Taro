/**
 * 试听预约页骨架屏
 *
 * 用于预约内容加载时占位，减少白屏等待感。
 */
import { View } from '@tarojs/components';
import cn from 'classnames';
import React from 'react';

const SkeletonBlock: React.FC<{ className?: string }> = ({ className }) => (
  <View className={cn('rounded-[12rpx] bg-muted animate-pulse', className)} />
);

const TrialBookingSkeleton: React.FC = () => {
  return (
    <View className="px-page-padding py-4">
      {/* 线索选择区占位 */}
      <SkeletonBlock className="h-[96rpx] mb-4" />

      {/* 日期选择占位 */}
      <SkeletonBlock className="h-[112rpx] mb-4" />

      {/* 卡片占位 */}
      <View className="flex flex-col gap-[16rpx]">
        <SkeletonBlock className="h-[220rpx]" />
        <SkeletonBlock className="h-[220rpx]" />
        <SkeletonBlock className="h-[180rpx]" />
      </View>

      {/* 备注占位 */}
      <SkeletonBlock className="h-[160rpx] mt-4" />
    </View>
  );
};

export default TrialBookingSkeleton;
