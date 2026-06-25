/**
 * 通用图标组件
 * 基于 MDI SVG 路径 + CSS mask-image 渲染
 * 颜色映射对齐设计稿 scheme-bc-fusion-v2.html（蓝色主题）
 */
import { View } from '@tarojs/components';
import React from 'react';
import { hexColors } from '@/theme';
import { MDI_ICONS } from './icons';

export type IconName = keyof typeof MDI_ICONS;
export type IconSize = 'xxs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | 'xxxl' | number;
export type IconColor =
  | 'primary'
  | 'primaryLight'
  | 'primaryDark'
  | 'accent'
  | 'accentLight'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'white'
  | 'foreground'
  | 'foregroundSecondary'
  | 'muted'
  | 'mutedForeground'
  | 'destructive'
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
  xxs: 20,
  xs: 24,
  sm: 32,
  md: 40,
  lg: 48,
  xl: 56,
  xxl: 72,
  xxxl: 80,
};

// 颜色映射：以 theme.ts 的 hexColors 为单一数据源
const COLOR_MAP: Record<string, string> = {
  primary: hexColors.primary, // #3B6EF5
  primaryLight: hexColors.primaryLight, // #6B95F5
  primaryDark: hexColors.primaryDark, // #2563EB
  accent: hexColors.accent, // #8B5CF6
  accentLight: hexColors.accentLight, // #A78BFA
  purple: hexColors.accent, // #8B5CF6（语义同 accent）
  success: hexColors.success, // #10b981
  warning: hexColors.warning, // #f59e0b
  amber: hexColors.warning, // 兼容旧用法
  error: hexColors.error, // #ef4444
  info: hexColors.info, // #0EA5E9
  white: '#FFFFFF',
  foreground: hexColors.foreground, // #1a1a1a
  foregroundSecondary: hexColors.foregroundSecondary, // #555555
  muted: hexColors.mutedForeground, // #8a8a8a（语义同 mutedForeground）
  mutedForeground: hexColors.mutedForeground, // #8a8a8a
  destructive: hexColors.destructive, // #ef4444
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

  // 首先尝试直接查找
  let svgPath = MDI_ICONS[name];

  // 如果找不到，尝试添加 mdi- 前缀
  if (!svgPath && !name.startsWith('mdi-')) {
    const prefixedName = `mdi-${name}` as IconName;
    svgPath = MDI_ICONS[prefixedName];
  }

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
