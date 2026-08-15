/**
 * 排课/预约 Tab 切换器
 *
 * 用于课表页与试听预约页之间的快速切换。
 * - 在课表页表现为深色胶囊（适配珊瑚色头部）
 * - 在预约页表现为浅色胶囊（适配白色内容区）
 */
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React from 'react';

export type ScheduleBookingTab = 'schedule' | 'booking';

interface ScheduleBookingSwitchProps {
  /** 当前激活项 */
  active: ScheduleBookingTab;
  /** 视觉变体：dark 用于课表页珊瑚色头部，light 用于预约页白色头部 */
  variant?: 'dark' | 'light';
  /**
   * 切换回调。传入时由父组件控制跳转/视图切换；
   * 未传入时默认走页面路由（课表页 switchTab / 预约页 navigateTo）。
   */
  onChange?: (tab: ScheduleBookingTab) => void;
}

const TAB_OPTIONS: { key: ScheduleBookingTab; label: string }[] = [
  { key: 'schedule', label: '排课' },
  { key: 'booking', label: '约课' },
];

const ScheduleBookingSwitch: React.FC<ScheduleBookingSwitchProps> = ({
  active,
  variant = 'dark',
  onChange,
}) => {
  const handleTabChange = (tab: ScheduleBookingTab) => {
    if (tab === active) return;
    if (onChange) {
      onChange(tab);
      return;
    }
    if (tab === 'schedule') {
      // 课表页是 tabBar 页面，必须使用 switchTab
      Taro.switchTab({ url: '/pages/schedule/index' });
    } else {
      Taro.navigateTo({ url: '/package-lead/pages/trial-booking/index' });
    }
  };

  const isDark = variant === 'dark';

  return (
    <View
      className={cn(
        'flex items-center rounded-full p-[4rpx]',
        isDark
          ? 'border border-primary-foreground/40 bg-primary-foreground/15'
          : 'border border-border bg-card',
      )}
    >
      {TAB_OPTIONS.map((tab) => {
        const isActive = active === tab.key;
        return (
          <View
            key={tab.key}
            className={cn(
              'px-[20rpx] py-[8rpx] rounded-full active:opacity-80',
              isActive ? (isDark ? 'bg-primary-foreground' : 'bg-primary') : 'bg-transparent',
            )}
            onClick={() => handleTabChange(tab.key)}
          >
            <Text
              className={cn(
                'text-[26rpx] font-medium',
                isActive
                  ? isDark
                    ? 'text-schedule-header'
                    : 'text-primary-foreground'
                  : isDark
                    ? 'text-primary-foreground'
                    : 'text-foreground-secondary',
              )}
            >
              {tab.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
};

export default ScheduleBookingSwitch;
