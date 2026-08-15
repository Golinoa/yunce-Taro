/**
 * ProfileGrid - 个人中心图标网格卡片
 *
 * 按卡片聚合同类功能入口，支持两种展示风格：
 * - default: 4 列彩色图标背景（金刚区风格）
 * - simple: 简洁图标 + 文字，无背景色块，对齐参考设计稿「我的约课/我的服务」
 */
import { View, Text } from '@tarojs/components';
import cn from 'classnames';
import React from 'react';
import Icon from '@/components/Icon';
import type { IconName } from '@/components/Icon';

export type GridIconColor = 'primary' | 'accent' | 'warning' | 'info' | 'success' | 'destructive';
export type GridVariant = 'default' | 'simple';

export interface GridItem {
  /** 图标名称 */
  icon: IconName;
  /** 入口文案 */
  label: string;
  /** 图标主题色（default 模式下控制背景与图标色） */
  color?: GridIconColor;
  /** 点击跳转 */
  onClick?: () => void;
}

export interface ProfileGridProps {
  /** 卡片标题 */
  title: string;
  /** 入口列表 */
  items: GridItem[];
  /** 展示风格 */
  variant?: GridVariant;
  /** 额外类名 */
  className?: string;
}

const COLOR_STYLES: Record<GridIconColor, { bg: string; icon: string }> = {
  primary: { bg: 'bg-primary-10', icon: 'text-primary' },
  accent: { bg: 'bg-purple-10', icon: 'text-accent' },
  warning: { bg: 'bg-amber-10', icon: 'text-warning' },
  info: { bg: 'bg-info-bg', icon: 'text-info' },
  success: { bg: 'bg-success-bg', icon: 'text-success' },
  destructive: { bg: 'bg-destructive-10', icon: 'text-destructive' },
};

const ProfileGrid: React.FC<ProfileGridProps> = ({
  title,
  items,
  variant = 'default',
  className,
}) => {
  const isSimple = variant === 'simple';

  return (
    <View
      className={cn(
        'mx-[32rpx] px-[24rpx] pt-[28rpx] pb-[20rpx] rounded-[24rpx] bg-card shadow-soft',
        className,
      )}
    >
      <Text className="text-[32rpx] font-bold text-foreground block mb-[28rpx]">{title}</Text>
      <View className={cn('grid gap-y-[24rpx]', isSimple ? 'grid-cols-4' : 'grid-cols-4')}>
        {items.map((item) => {
          const color = item.color || 'primary';
          const styles = COLOR_STYLES[color];

          if (isSimple) {
            return (
              <View
                key={item.label}
                className="flex flex-col items-center gap-[12rpx] active:opacity-70"
                onClick={item.onClick}
              >
                <Icon name={item.icon} size="xl" color="primaryLight" />
                <Text className="text-[24rpx] text-foreground-secondary font-medium whitespace-nowrap">
                  {item.label}
                </Text>
              </View>
            );
          }

          return (
            <View
              key={item.label}
              className="flex flex-col items-center gap-[12rpx] active:opacity-70"
              onClick={item.onClick}
            >
              <View
                className={cn(
                  'w-[88rpx] h-[88rpx] rounded-[28rpx] flex items-center justify-center',
                  styles.bg,
                )}
              >
                <Icon name={item.icon} size="xl" color={styles.icon} />
              </View>
              <Text className="text-[24rpx] text-foreground-secondary font-medium whitespace-nowrap">
                {item.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

export default ProfileGrid;
