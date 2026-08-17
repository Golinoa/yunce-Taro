import { View, Text, Image } from '@tarojs/components';
import cn from 'classnames';
import React from 'react';
import { BRAND_LOGO } from '@/constants/brand';

/**
 * Avatar - 全局统一头像组件
 *
 * 支持：
 * - 图片头像（avatarUrl 优先）
 * - 姓氏+颜色头像（基于名字 hash 稳定取色）
 * - 4 种尺寸：sm / md / lg / xl
 */

const AVATAR_COLORS = [
  '#5EC8A8',
  '#E89BB8',
  '#6BA3D6',
  '#D4A24E',
  '#9B7ED8',
  '#F0A0A0',
  '#7BC8E8',
  '#B8D45E',
];

/** 根据名字 hash 稳定取色 */
function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export interface AvatarProps {
  /** 显示名称（取首字，同时用于颜色 hash） */
  name: string;
  /** 头像图片 URL（优先于文字头像） */
  avatarUrl?: string;
  /** 尺寸 */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** 额外类名 */
  className?: string;
  /** 点击事件 */
  onClick?: () => void;
}

const SIZE_MAP = {
  sm: { container: 'w-12 h-12', text: 'text-xs' }, // 48rpx
  md: { container: 'w-[68rpx] h-[68rpx]', text: 'text-[26rpx]' }, // 68rpx
  lg: { container: 'w-20 h-20', text: 'text-lg' }, // 80rpx
  xl: { container: 'w-40 h-40', text: 'text-[60rpx]' }, // 160rpx
} as const;

const Avatar: React.FC<AvatarProps> = ({ name, avatarUrl, size = 'md', className, onClick }) => {
  const { container, text } = SIZE_MAP[size];
  const src = avatarUrl || BRAND_LOGO;

  // 图片头像（无自定义头像时使用品牌默认头像）
  if (src) {
    return (
      <Image
        src={src}
        mode="aspectFill"
        className={cn('rounded-full flex-shrink-0', container, className)}
        onClick={onClick}
      />
    );
  }

  // 文字头像兜底
  return (
    <View
      className={cn(
        'rounded-full flex items-center justify-center font-semibold text-white flex-shrink-0',
        container,
        className,
      )}
      style={{ background: getAvatarColor(name) }}
      onClick={onClick}
    >
      <Text className={cn('text-white font-semibold', text)}>{name[0]}</Text>
    </View>
  );
};

export default Avatar;
export { AVATAR_COLORS, getAvatarColor };
