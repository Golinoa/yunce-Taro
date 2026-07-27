/**
 * ScheduleCardMenu - 排课卡片右上角更多菜单
 *
 * 将卡片操作按钮收起在三圆点图标中，点击后从底部弹出菜单。
 * 弹窗高度自适应菜单项数量，固定在屏幕底部。
 */
import { View, Text } from '@tarojs/components';
import cn from 'classnames';
import React, { useState } from 'react';
import BottomSheet from '@/components/BottomSheet';
import Icon from '@/components/Icon';

export interface ScheduleMenuItem {
  /** 菜单项唯一标识 */
  key: string;
  /** 显示文案 */
  label: string;
  /** 左侧图标 */
  icon: string;
  /** 文字颜色类型 */
  variant?: 'default' | 'danger' | 'warning';
  /** 点击回调 */
  onClick: () => void;
}

interface ScheduleCardMenuProps {
  items: ScheduleMenuItem[];
}

const ScheduleCardMenu: React.FC<ScheduleCardMenuProps> = ({ items }) => {
  const [visible, setVisible] = useState(false);

  const handleItemClick = (item: ScheduleMenuItem) => {
    setVisible(false);
    item.onClick();
  };

  return (
    <>
      {/* 三圆点触发按钮 */}
      <View
        className="flex h-[56rpx] w-[56rpx] items-center justify-center rounded-full border-[2rpx] border-border bg-card active:scale-90 active:bg-primary/10 active:border-primary/30 active:shadow-[0_0_16rpx_rgba(59,110,245,0.15)]"
        style={{ boxShadow: '0 2rpx 8rpx rgba(0,0,0,0.06)' }}
        onClick={(e) => {
          e.stopPropagation();
          setVisible(true);
        }}
      >
        <Icon name="mdi-dots-vertical" size={28} className="text-muted-foreground" />
      </View>

      {/* 底部菜单弹窗 — 自适应高度，固定底部 */}
      <BottomSheet
        visible={visible}
        title="更多操作"
        onClose={() => setVisible(false)}
        scrollable={false}
        height="auto"
        className="pb-safe-bar"
      >
        <View className="flex flex-col gap-[16rpx] px-[32rpx] pb-[32rpx]">
          {items.map((item) => {
            const isDanger = item.variant === 'danger';
            const isWarning = item.variant === 'warning';
            return (
              <View
                key={item.key}
                className={cn(
                  'flex items-center justify-center gap-[12rpx] rounded-[16rpx] border-[3rpx] px-[32rpx] py-[24rpx] active:scale-[0.97] transition-transform',
                  isDanger
                    ? 'border-destructive bg-destructive/5 active:bg-destructive/10 active:border-destructive active:shadow-[0_0_16rpx_rgba(239,68,68,0.15)]'
                    : isWarning
                      ? 'border-warning bg-warning/5 active:bg-warning/10 active:border-warning active:shadow-[0_0_16rpx_rgba(245,158,11,0.15)]'
                      : 'border-primary/40 bg-primary/5 active:bg-primary/10 active:border-primary active:shadow-[0_0_16rpx_rgba(59,110,245,0.15)]',
                )}
                style={{ boxShadow: '0 2rpx 8rpx rgba(0,0,0,0.04)' }}
                onClick={() => handleItemClick(item)}
              >
                <Icon
                  name={item.icon}
                  size={28}
                  className={cn(
                    isDanger ? 'text-destructive' : isWarning ? 'text-warning' : 'text-primary',
                  )}
                />
                <Text
                  className={cn(
                    'text-[28rpx] font-medium',
                    isDanger ? 'text-destructive' : isWarning ? 'text-warning' : 'text-foreground',
                  )}
                >
                  {item.label}
                </Text>
              </View>
            );
          })}
        </View>
      </BottomSheet>
    </>
  );
};

export default ScheduleCardMenu;
