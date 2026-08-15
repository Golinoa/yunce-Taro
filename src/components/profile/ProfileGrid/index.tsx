/**
 * ProfileGrid - 个人中心图标网格卡片
 *
 * 设计风格：
 * - 图标统一使用主题色，随主题切换实时变化
 * - 每个图标置于主题色浅色圆形背景中，提升识别度与层次感
 * - 图标尺寸适中，视觉不轻飘、不厚重
 */
import { View, Text } from '@tarojs/components';
import cn from 'classnames';
import React from 'react';
import Icon from '@/components/Icon';
import type { IconName } from '@/components/Icon';

export interface GridItem {
  /** 图标名称 */
  icon: IconName;
  /** 入口文案 */
  label: string;
  /** 点击跳转 */
  onClick?: () => void;
}

export interface ProfileGridProps {
  /** 卡片标题 */
  title: string;
  /** 入口列表 */
  items: GridItem[];
  /** 额外类名 */
  className?: string;
}

const ProfileGrid: React.FC<ProfileGridProps> = ({ title, items, className }) => {
  return (
    <View
      className={cn(
        'mx-[32rpx] px-[24rpx] pt-[28rpx] pb-[24rpx] rounded-[24rpx] bg-card shadow-soft',
        className,
      )}
    >
      <Text className="text-[32rpx] font-bold text-foreground block mb-[28rpx]">{title}</Text>
      <View className="grid grid-cols-4 gap-y-[28rpx]">
        {items.map((item) => (
          <View
            key={item.label}
            className="flex flex-col items-center gap-[14rpx] active:opacity-70"
            onClick={item.onClick}
          >
            <Icon name={item.icon} size="xl" color="primary" />
            <Text className="text-[24rpx] text-foreground-secondary font-medium whitespace-nowrap">
              {item.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

export default ProfileGrid;
