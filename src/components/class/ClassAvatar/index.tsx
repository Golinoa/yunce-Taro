import { Image, View } from '@tarojs/components';
import cn from 'classnames';
import React from 'react';
import { BRAND_LOGO } from '@/constants/brand';

/**
 * ClassAvatar - 班级统一圆形头像组件
 *
 * 所有班级头像默认使用品牌 Logo（sgpk.png），统一为圆形，
 * 提供 sm / md / lg 三种规范尺寸，确保班级卡片、详情页、
 * 课表卡片、预约记录等场景视觉一致。
 *
 * 使用场景：班级列表、班级详情头部、课表卡片、试听预约记录卡片等。
 */

export interface ClassAvatarProps {
  /** 尺寸规格 */
  size?: 'sm' | 'md' | 'lg';
  /** 自定义头像地址（默认使用品牌 Logo） */
  src?: string;
  /** 额外类名 */
  className?: string;
}

const SIZE_MAP = {
  sm: 'w-[100rpx] h-[100rpx]',
  md: 'w-[100rpx] h-[100rpx]',
  lg: 'w-[100rpx] h-[100rpx]',
} as const;

const ClassAvatar: React.FC<ClassAvatarProps> = ({ size = 'md', src, className }) => {
  const preferred = src?.trim() ? src.trim() : BRAND_LOGO;
  const [imageSrc, setImageSrc] = React.useState(preferred);

  React.useEffect(() => {
    setImageSrc(src?.trim() ? src.trim() : BRAND_LOGO);
  }, [src]);

  return (
    <View
      className={cn(
        'flex-shrink-0 overflow-hidden rounded-full border-[6rpx] border-white bg-white shadow-[0_10rpx_30rpx_rgba(0,0,0,0.22)]',
        SIZE_MAP[size],
        className,
      )}
    >
      {/* aspectFit 保持比例完整显示 Logo，避免文字被圆形裁剪 */}
      <Image
        src={imageSrc}
        mode="aspectFit"
        className="h-full w-full"
        lazyLoad
        onError={() => {
          if (imageSrc !== BRAND_LOGO) setImageSrc(BRAND_LOGO);
        }}
      />
    </View>
  );
};

export default ClassAvatar;
