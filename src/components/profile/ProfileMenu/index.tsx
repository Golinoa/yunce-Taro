/**
 * ProfileMenu - 个人中心列表菜单卡片
 *
 * 以列表形式聚合设置、协议、帮助等低频入口，
 * 每项左侧图标 + 中间文案 + 右侧附加信息/箭头。
 */
import { View, Text } from '@tarojs/components';
import cn from 'classnames';
import React from 'react';
import Icon from '@/components/Icon';
import type { IconName } from '@/components/Icon';

export type MenuIconColor = 'primary' | 'accent' | 'warning' | 'info' | 'success' | 'destructive';

export interface MenuItem {
  /** 图标名称 */
  icon: IconName;
  /** 菜单文案 */
  label: string;
  /** 右侧附加文本，如"2 条未读" */
  extra?: string;
  /** 图标主题色 */
  color?: MenuIconColor;
  /** 点击跳转 */
  onClick?: () => void;
}

export interface ProfileMenuProps {
  /** 卡片标题 */
  title: string;
  /** 菜单列表 */
  items: MenuItem[];
  /** 额外类名 */
  className?: string;
}

const ICON_BG_STYLES: Record<MenuIconColor, string> = {
  primary: 'bg-primary-10',
  accent: 'bg-purple-10',
  warning: 'bg-amber-10',
  info: 'bg-info-bg',
  success: 'bg-success-bg',
  destructive: 'bg-destructive-10',
};

const ICON_COLOR_STYLES: Record<MenuIconColor, string> = {
  primary: 'text-primary',
  accent: 'text-accent',
  warning: 'text-warning',
  info: 'text-info',
  success: 'text-success',
  destructive: 'text-destructive',
};

const ProfileMenu: React.FC<ProfileMenuProps> = ({ title, items, className }) => {
  return (
    <View
      className={cn(
        'mx-[32rpx] mb-[24rpx] px-[24rpx] pt-[28rpx] pb-[12rpx] rounded-[32rpx] bg-card shadow-soft',
        className,
      )}
    >
      <Text className="text-[32rpx] font-bold text-foreground block mb-[8rpx]">{title}</Text>
      <View>
        {items.map((item, idx) => {
          const color = item.color || 'primary';
          return (
            <View
              key={item.label}
              className={cn(
                'flex items-center py-[24rpx] active:bg-muted -mx-[24rpx] px-[24rpx]',
                idx > 0 && 'border-t border-border',
              )}
              onClick={item.onClick}
            >
              <View
                className={cn(
                  'w-[56rpx] h-[56rpx] rounded-[16rpx] flex items-center justify-center mr-[20rpx]',
                  ICON_BG_STYLES[color],
                )}
              >
                <Icon name={item.icon} size="xs" color={ICON_COLOR_STYLES[color]} />
              </View>
              <Text className="flex-1 text-[28rpx] text-foreground font-medium">{item.label}</Text>
              {item.extra && (
                <Text className="text-[24rpx] text-muted-foreground mr-[12rpx]">{item.extra}</Text>
              )}
              <Icon name="mdi-chevron-right" size="xs" color="mutedForeground" />
            </View>
          );
        })}
      </View>
    </View>
  );
};

export default ProfileMenu;
