/**
 * 学员详情一级 Tab 栏
 *
 * 使用场景：student-detail Swiper 上方胶囊 Tab。
 * 功能说明：按当前 swiper index 高亮，点击切换。
 */
import { View, Text } from '@tarojs/components';
import cn from 'classnames';
import React from 'react';
import {
  STUDENT_DETAIL_TABS,
  STUDENT_DETAIL_TAB_INDEX_MAP,
  type TabKey,
} from './student-detail-constants';

export interface StudentDetailTabBarProps {
  studentSwiperCurrent: number;
  onTabChange: (tab: TabKey) => void;
}

const StudentDetailTabBar: React.FC<StudentDetailTabBarProps> = ({
  studentSwiperCurrent,
  onTabChange,
}) => {
  return (
    <View className="px-[32rpx] -mt-[40rpx] relative z-2">
      <View className="flex bg-card rounded-[32rpx] p-[8rpx] shadow-soft">
        {STUDENT_DETAIL_TABS.map((tab) => {
          const isActive = studentSwiperCurrent === STUDENT_DETAIL_TAB_INDEX_MAP[tab.key];
          return (
            <View
              key={tab.key}
              className={cn(
                'flex-1 py-[20rpx] text-center rounded-[24rpx] transition-all',
                isActive
                  ? 'bg-primary-bg text-primary font-semibold'
                  : 'text-muted-foreground font-medium',
              )}
              onClick={() => onTabChange(tab.key)}
            >
              <Text className={cn('text-[24rpx]', { 'text-primary': isActive })}>{tab.label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

export default StudentDetailTabBar;
