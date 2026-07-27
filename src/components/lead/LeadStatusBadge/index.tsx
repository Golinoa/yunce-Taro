import { View, Text } from '@tarojs/components';
import cn from 'classnames';
import React from 'react';
import type { LeadStatus } from '@/types/lead';

/**
 * LeadStatusBadge - 线索状态标签
 *
 * 业务上线索只展示三种状态：待跟进 / 已预约 / 已流失。
 * 原始状态在此组件内统一映射为这三种展示状态。
 */

export interface LeadStatusBadgeProps {
  status: LeadStatus;
  /** 尺寸：sm（卡片内）/ md（详情页） */
  size?: 'sm' | 'md';
  className?: string;
}

/** 展示状态类型 */
type DisplayStatus = 'following' | 'booked' | 'lost';

const DISPLAY_META: Record<DisplayStatus, { label: string; className: string }> = {
  following: {
    label: '待跟进',
    className: 'bg-[#fff7ed] text-[#f59e0b] border border-[#fbbf24]',
  },
  booked: {
    label: '已预约',
    className: 'bg-[#eff6ff] text-[#3b82f6] border border-[#60a5fa]',
  },
  lost: {
    label: '已流失',
    className: 'bg-[#f3f4f6] text-[#6b7280] border border-[#9ca3af]',
  },
};

function mapStatus(status: LeadStatus): DisplayStatus {
  if (['new', 'pending', 'following', 'not_arrived'].includes(status)) return 'following';
  if (['booked', 'arrived'].includes(status)) return 'booked';
  return 'lost';
}

const SIZE_CLASS_MAP = {
  sm: 'px-[12rpx] py-[4rpx] text-[20rpx] rounded-[8rpx]',
  md: 'px-[16rpx] py-[6rpx] text-[24rpx] rounded-[12rpx]',
} as const;

const LeadStatusBadge: React.FC<LeadStatusBadgeProps> = ({ status, size = 'sm', className }) => {
  const displayStatus = mapStatus(status);
  const meta = DISPLAY_META[displayStatus];

  return (
    <View className={cn(meta.className, SIZE_CLASS_MAP[size], className)}>
      <Text className="font-bold">{meta.label}</Text>
    </View>
  );
};

export default LeadStatusBadge;
