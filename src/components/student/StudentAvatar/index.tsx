import { Image, Text, View } from '@tarojs/components';
import cn from 'classnames';
import React from 'react';
import { BRAND_LOGO } from '@/constants/brand';
import { getAvatarGradientByName } from '@/utils/avatar-color';

interface StudentAvatarProps {
  name?: string;
  src?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  textClassName?: string;
}

const SIZE_CLASS_MAP: Record<NonNullable<StudentAvatarProps['size']>, string> = {
  sm: 'w-[64rpx] h-[64rpx]',
  md: 'w-[96rpx] h-[96rpx]',
  lg: 'w-[128rpx] h-[128rpx]',
  xl: 'w-[160rpx] h-[160rpx]',
};

const TEXT_CLASS_MAP: Record<NonNullable<StudentAvatarProps['size']>, string> = {
  sm: 'text-[28rpx]',
  md: 'text-[36rpx]',
  lg: 'text-[52rpx]',
  xl: 'text-[60rpx]',
};

const StudentAvatar: React.FC<StudentAvatarProps> = ({
  name,
  src,
  size = 'md',
  className,
  textClassName,
}) => {
  const avatarName = name || '?';
  const avatarSrc = src || BRAND_LOGO;
  const showImage = Boolean(avatarSrc);

  return (
    <View
      className={cn(
        'rounded-full center flex-shrink-0 overflow-hidden',
        SIZE_CLASS_MAP[size],
        className,
      )}
      style={!showImage ? { background: getAvatarGradientByName(avatarName) } : undefined}
    >
      {showImage ? (
        <Image src={avatarSrc} className="h-full w-full" mode="aspectFill" lazyLoad />
      ) : (
        <Text className={cn('font-bold text-white', TEXT_CLASS_MAP[size], textClassName)}>
          {avatarName[0]}
        </Text>
      )}
    </View>
  );
};

export default StudentAvatar;
