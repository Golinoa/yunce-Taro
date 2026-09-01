import { Image, View } from '@tarojs/components';
import cn from 'classnames';
import React, { useEffect, useState } from 'react';
import { BRAND_LOGO } from '@/constants/brand';
import { resolveAvatarSrc } from '@/utils/avatar-src';

interface StudentAvatarProps {
  name?: string;
  src?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  /** @deprecated 已统一品牌图，不再渲染姓氏文字 */
  textClassName?: string;
}

const SIZE_CLASS_MAP: Record<NonNullable<StudentAvatarProps['size']>, string> = {
  sm: 'w-[64rpx] h-[64rpx]',
  md: 'w-[96rpx] h-[96rpx]',
  lg: 'w-[128rpx] h-[128rpx]',
  xl: 'w-[160rpx] h-[160rpx]',
};

/**
 * 学员头像：未上传 / 加载失败 → sgpk 品牌 Logo（禁止「?」色块）
 */
const StudentAvatar: React.FC<StudentAvatarProps> = ({
  name: _name,
  src,
  size = 'md',
  className,
}) => {
  const preferred = resolveAvatarSrc(src);
  const [avatarSrc, setAvatarSrc] = useState(preferred);

  useEffect(() => {
    setAvatarSrc(resolveAvatarSrc(src));
  }, [src]);

  return (
    <View
      className={cn(
        'rounded-full center flex-shrink-0 overflow-hidden bg-white',
        SIZE_CLASS_MAP[size],
        className,
      )}
    >
      <Image
        src={avatarSrc}
        className="h-full w-full"
        mode="aspectFill"
        lazyLoad
        onError={() => {
          if (avatarSrc !== BRAND_LOGO) {
            setAvatarSrc(BRAND_LOGO);
          }
        }}
      />
    </View>
  );
};

export default StudentAvatar;
