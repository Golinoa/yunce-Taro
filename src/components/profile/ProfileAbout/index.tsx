/**
 * ProfileAbout - 个人中心底部品牌关于入口
 *
 * 展示品牌 Logo 与「关于 XX」入口，点击跳转关于页。
 * 预期效果：Logo（圆形白底）+ 主题色文字横向居中排列。
 */
import { View, Text, Image } from '@tarojs/components';
import cn from 'classnames';
import React from 'react';
import { BRAND_LOGO, BRAND_NAME_ZH } from '@/constants/brand';

export interface ProfileAboutProps {
  /** 点击跳转关于页 */
  onClick?: () => void;
  /** 额外类名 */
  className?: string;
}

const ProfileAbout: React.FC<ProfileAboutProps> = ({ onClick, className }) => {
  return (
    <View
      className={cn(
        'mt-[24rpx] mb-[32rpx] mx-[32rpx] bg-card rounded-[28rpx] shadow-card px-[28rpx] py-[24rpx] flex items-center justify-center gap-[16rpx] active:opacity-70 press-scale',
        className,
      )}
      onClick={onClick}
    >
      <View className="w-[56rpx] h-[56rpx] rounded-full bg-white center shadow-soft flex-shrink-0">
        <Image src={BRAND_LOGO} mode="aspectFit" className="w-[44rpx] h-[44rpx] rounded-full" />
      </View>
      <Text className="text-[30rpx] font-bold text-primary">关于{BRAND_NAME_ZH}</Text>
    </View>
  );
};

export default ProfileAbout;
