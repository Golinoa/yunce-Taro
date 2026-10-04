import { View, Text } from '@tarojs/components';
import cn from 'classnames';
import React from 'react';

/**
 * 课表卡片右上角「停课」角标（放假停课 / 主动停课共用一套实现，只有文案不同）
 *
 * ## 为什么抽出来
 *
 * 两处停课在卡片上的表现完全同构，只是"谁让这节课停的"不同：
 * - `holiday` = 机构放假，系统按日期推导 ⇒ 显示「放假停课」；
 * - `manual`  = 老师在点名页手动停的 ⇒ 显示「停课」。
 *
 * 早先只有放假有角标，老师手动停的课落到「取消」角标（红底）—— 其实没有独立的
 * "取消课次"入口，那张卡片就是手动停课，文案不准确，故统一收敛到这里。
 *
 * ## 用法
 *
 * ```tsx
 * <SuspendBadge kind={item.holidaySuspended ? 'holiday' : 'manual'} />
 * ```
 */
export type SuspendBadgeKind = 'holiday' | 'manual';

export const SUSPEND_BADGE_TEXT: Record<SuspendBadgeKind, string> = {
  holiday: '放假停课',
  manual: '停课',
};

export interface SuspendBadgeProps {
  kind: SuspendBadgeKind;
  /** 额外类名（卡片里靠它定位到右上角） */
  className?: string;
}

const SuspendBadge: React.FC<SuspendBadgeProps> = ({ kind, className }) => (
  <View className={cn('overflow-hidden', className)}>
    <View className="rounded-bl-[16rpx] bg-warning px-[20rpx] py-[10rpx] shadow-card">
      <Text className="text-[20rpx] font-semibold tracking-[2rpx] text-warning-foreground">
        {SUSPEND_BADGE_TEXT[kind]}
      </Text>
    </View>
  </View>
);

export default SuspendBadge;
