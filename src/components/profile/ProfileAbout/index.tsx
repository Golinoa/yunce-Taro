/**
 * ProfileAbout - 个人中心底部品牌关于入口
 *
 * 展示品牌 Logo 与「关于 XX」入口，点击跳转关于页（未实现时占位提示）。
 */
import { View, Text, Image } from '@tarojs/components';
import cn from 'classnames';
import React from 'react';
import Icon from '@/components/Icon';
import { BRAND_LOGO, BRAND_NAME_ZH } from '@/constants/brand';

export interface ProfileAboutProps {
  /** 点击跳转关于页 */
  onClick?: () => void;
  /** 版本号 */
  version?: string;
  /** 额外类名 */
  className?: string;
}

const DEFAULT_VERSION = '2.6.7';

const ProfileAbout: React.FC<ProfileAboutProps> = ({
  onClick,
  version = DEFAULT_VERSION,
  className,
}) => {
  return (
    <View
      className={cn(
        'flex flex-col items-center justify-center gap-[8rpx] py-[32rpx] active:opacity-70',
        className,
      )}
      onClick={onClick}
    >
      <View className="flex items-center gap-[12rpx]">
        <Image src={BRAND_LOGO} mode="aspectFit" className="w-[48rpx] h-[48rpx]" />
        <Text className="text-[28rpx] font-medium text-profile-orange-soft">
          关于{BRAND_NAME_ZH}
        </Text>
        <Icon name="mdi-chevron-right" size="xs" color="#ffa06c" />
      </View>
      <Text className="text-[22rpx] text-muted-foreground">正式版 版本号 {version}</Text>
    </View>
  );
};

export default ProfileAbout;
