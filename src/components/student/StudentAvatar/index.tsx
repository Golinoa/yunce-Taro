import { Text, View } from '@tarojs/components';
import cn from 'classnames';
import React from 'react';
import { getAvatarGradientByName } from '@/utils/avatar-color';

interface StudentAvatarProps {
  name: string;
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
  size = 'md',
  className,
  textClassName,
}) => {
  const avatarName = name || '?';

  return (
    <View
      className={cn('rounded-full center flex-shrink-0', SIZE_CLASS_MAP[size], className)}
      style={{ background: getAvatarGradientByName(avatarName) }}
    >
      <Text className={cn('font-bold text-white', TEXT_CLASS_MAP[size], textClassName)}>
        {avatarName[0]}
      </Text>
    </View>
  );
};

export default StudentAvatar;
