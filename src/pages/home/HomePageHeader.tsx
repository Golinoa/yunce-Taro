/**
 * 首页顶部：封面 + 校区卡 / 未选身份占位
 */
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React from 'react';
import HomeCampusCard from '@/components/home/campus-card';
import HomeHeroBanner from '@/components/home/HomeHeroBanner';
import Icon from '@/components/Icon';
import type { CampusUIModel } from '@/types/campus';

export interface HomePageHeaderProps {
  showCampusHero: boolean;
  unreadCount: number;
  bellTopPx: number;
  campus: CampusUIModel | null;
  businessTime: string;
  isOpen: boolean;
  onSwitchCampus: () => void;
}

const HomePageHeader: React.FC<HomePageHeaderProps> = ({
  showCampusHero,
  unreadCount,
  bellTopPx,
  campus,
  businessTime,
  isOpen,
  onSwitchCampus,
}) => {
  if (showCampusHero) {
    return (
      <>
        <HomeHeroBanner
          unreadCount={unreadCount}
          bellTopPx={bellTopPx}
          onNotify={() => Taro.navigateTo({ url: '/package-settings/pages/notifications/index' })}
        />

        {/* 校区卡片 */}
        <View className="relative z-30 -mt-[90rpx] mx-[28rpx]">
          <HomeCampusCard
            campus={campus}
            businessTime={businessTime}
            isOpen={isOpen}
            onSwitch={onSwitchCampus}
            className="shadow-campus"
          />
        </View>
      </>
    );
  }

  return (
    <View className="mx-[32rpx] mt-[32rpx] p-[40rpx] rounded-[32rpx] bg-card shadow-soft flex flex-col items-center">
      <Icon name="school" size={80} className="text-primary mb-[24rpx]" />
      <Text className="text-[32rpx] font-bold text-foreground mb-[12rpx]">首页</Text>
      <Text className="text-[26rpx] text-muted-foreground text-center leading-normal">
        请先完成身份选择后继续使用
      </Text>
    </View>
  );
};

export default HomePageHeader;
