/**
 * ProfileFollowCard - 个人中心公众号关注卡片
 *
 * 深色卡片，引导用户关注公众号以开启消息推送。
 * 用于「我的」页面信息订阅入口。
 */
import { View, Text } from '@tarojs/components';
import cn from 'classnames';
import React from 'react';
import Icon from '@/components/Icon';
import { BRAND_NAME_ZH } from '@/constants/brand';

export interface ProfileFollowCardProps {
  /** 点击卡片 */
  onClick?: () => void;
  /** 额外类名 */
  className?: string;
}

const ProfileFollowCard: React.FC<ProfileFollowCardProps> = ({ onClick, className }) => {
  return (
    <View
      className={cn(
        'mx-[32rpx] px-[28rpx] h-[120rpx] rounded-[24rpx] bg-profile-follow shadow-soft flex items-center justify-between active:opacity-90',
        className,
      )}
      onClick={onClick}
    >
      <Text className="text-[28rpx] font-medium leading-none text-white">
        关注「{BRAND_NAME_ZH}」公众号
      </Text>
      <View className="flex items-center gap-[4rpx] flex-shrink-0 ml-[16rpx]">
        <Text className="text-[24rpx] leading-none text-white/50">开启会员约课消息推送</Text>
        <Icon name="mdi-chevron-right" size="xs" color="rgba(255,255,255,0.5)" />
      </View>
    </View>
  );
};

export default ProfileFollowCard;
