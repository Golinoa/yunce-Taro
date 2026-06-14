/**
 * 通用图标组件
 * 基于 MDI SVG 路径 + CSS mask-image 渲染
 */
import { View } from '@tarojs/components';
import React from 'react';
import { MDI_ICONS } from './icons';

export type IconName = keyof typeof MDI_ICONS;
export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | number;
export type IconColor =
  | 'primary'
  | 'accent'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'white'
  | 'muted'
  | 'inherit'
  | string;

interface IconProps {
  name: IconName;
  size?: IconSize;
  color?: IconColor;
  className?: string;
  onClick?: () => void;
}

const SIZE_MAP: Record<Exclude<IconSize, number>, number> = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 48,
  xl: 56,
  xxl: 72,
};

const COLOR_MAP: Record<string, string> = {
  primary: '#5EC8A8',
  accent: '#E89BB8',
  success: '#3ABF6E',
  warning: '#E8C468',
  error: '#D94040',
  info: '#6BB5D4',
  white: '#FFFFFF',
  muted: '#738C82',
};

const Icon: React.FC<IconProps> = ({
  name,
  size = 'md',
  color = 'inherit',
  className,
  onClick,
}) => {
  const sizeRpx = typeof size === 'number' ? size : SIZE_MAP[size];
  const fillColor =
    color !== 'inherit' && !COLOR_MAP[color]
      ? color
      : color !== 'inherit'
        ? COLOR_MAP[color]
        : undefined;
  const svgPath = MDI_ICONS[name];
  if (!svgPath) {
    console.warn(`[Icon] unknown icon name: ${name}`);
    return null;
  }
  const svgUrl = `data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Cpath d='${svgPath}'/%3E%3C/svg%3E`;

  return (
    <View
      className={`inline-block flex-shrink-0 leading-none align-middle ${onClick ? 'active:opacity-70 cursor-pointer' : ''} ${className || ''}`}
      style={{
        width: `${sizeRpx}rpx`,
        height: `${sizeRpx}rpx`,
        backgroundColor: fillColor || 'currentColor',
        WebkitMaskImage: `url("${svgUrl}")`,
        maskImage: `url("${svgUrl}")`,
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskSize: '100% 100%',
        maskSize: '100% 100%',
      }}
      onClick={onClick}
    />
  );
};

export default Icon;
