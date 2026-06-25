/**
 * ProfileStats - 个人中心数据概览卡片
 *
 * 以横向等分布局展示 3~4 项关键指标，指标之间用细线分隔。
 * 适用于教师数据概览、家长学生课时概览等场景。
 */
import { View, Text } from '@tarojs/components';
import cn from 'classnames';
import React from 'react';

export interface StatItem {
  /** 指标数值 */
  value: string | number;
  /** 指标标签 */
  label: string;
}

export interface ProfileStatsProps {
  /** 指标列表 */
  items: StatItem[];
  /** 点击整个卡片 */
  onClick?: () => void;
  /** 额外类名 */
  className?: string;
}

const ProfileStats: React.FC<ProfileStatsProps> = ({ items, onClick, className }) => {
  return (
    <View
      className={cn(
        'mx-[32rpx] mb-[24rpx] px-[24rpx] py-[32rpx] rounded-[32rpx] bg-white shadow-soft',
        onClick && 'active:bg-muted',
        className,
      )}
      onClick={onClick}
    >
      <View className="flex items-center">
        {items.map((item, idx) => (
          <React.Fragment key={item.label}>
            <View className="flex-1 text-center">
              <Text className="text-[40rpx] font-bold text-foreground block">{item.value}</Text>
              <Text className="text-[22rpx] text-muted-foreground mt-[8rpx] block">
                {item.label}
              </Text>
            </View>
            {idx < items.length - 1 && <View className="w-[2rpx] h-[48rpx] bg-border" />}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
};

export default ProfileStats;
