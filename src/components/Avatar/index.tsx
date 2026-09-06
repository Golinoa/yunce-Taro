import { Image, View } from '@tarojs/components';
import cn from 'classnames';
import React, { useEffect, useState } from 'react';
import { BRAND_LOGO } from '@/constants/brand';
import { resolveAvatarSrc } from '@/utils/avatar-src';

/**
 * Avatar - 全局统一头像组件
 *
 * 未上传头像 / 图片加载失败 → 统一品牌 Logo（sgpk.png），禁止空态问号或姓氏色块冒充默认头像。
 * 圆形：外层 View overflow-hidden + Image borderRadius:50%（Image 勿再 overflow，易裁切不全）。
 */

/** 微信小程序可靠圆形：容器 overflow + 图片 borderRadius（勿给 Image 再加 overflow，易裁切不全） */
const CIRCLE_STYLE = { borderRadius: '50%' as const };

export interface AvatarProps {
  /** 显示名称（兼容旧调用；默认头像不再依赖首字） */
  name: string;
  /** 头像图片 URL（优先；空则品牌 Logo） */
  avatarUrl?: string;
  /** 尺寸 */
  size?: 'sm' | 'md' | 'mlg' | 'lg' | 'xl';
  /**
   * @deprecated 产品口径：一律品牌 Logo；保留参数避免调用方报错
   */
  fallback?: 'brand' | 'initial';
  /** 额外类名 */
  className?: string;
  /** 点击事件 */
  onClick?: () => void;
}

/** 全部用 rpx，避免 w-20/rem 在小程序里尺寸漂移 */
const SIZE_MAP = {
  sm: { container: 'w-[48rpx] h-[48rpx]' },
  md: { container: 'w-[68rpx] h-[68rpx]' },
  mlg: { container: 'w-[72rpx] h-[72rpx]' },
  lg: { container: 'w-[80rpx] h-[80rpx]' },
  xl: { container: 'w-[160rpx] h-[160rpx]' },
} as const;

const Avatar: React.FC<AvatarProps> = ({
  name: _name,
  avatarUrl,
  size = 'md',
  fallback: _fallback = 'brand',
  className,
  onClick,
}) => {
  const { container } = SIZE_MAP[size];
  const preferred = resolveAvatarSrc(avatarUrl);
  const [src, setSrc] = useState(preferred);

  useEffect(() => {
    setSrc(resolveAvatarSrc(avatarUrl));
  }, [avatarUrl]);

  return (
    <View
      className={cn('rounded-full flex-shrink-0 overflow-hidden bg-white', container, className)}
      style={CIRCLE_STYLE}
      onClick={onClick}
    >
      <Image
        src={src}
        mode="aspectFill"
        className="h-full w-full block rounded-full"
        style={CIRCLE_STYLE}
        onError={() => {
          if (src !== BRAND_LOGO) {
            setSrc(BRAND_LOGO);
          }
        }}
      />
    </View>
  );
};

export default Avatar;

/** @deprecated 色块姓氏方案已废弃；保留导出避免外部引用炸裂 */
export const AVATAR_COLORS = [
  '#5EC8A8',
  '#E89BB8',
  '#6BA3D6',
  '#D4A24E',
  '#9B7ED8',
  '#F0A0A0',
  '#7BC8E8',
  '#B8D45E',
];

/** @deprecated */
export function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
