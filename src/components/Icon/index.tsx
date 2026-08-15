/**
 * 通用图标组件
 * 基于 MDI SVG 路径 + CSS mask-image 渲染
 * 颜色映射对齐设计稿 scheme-bc-fusion-v2.html（蓝色主题）
 */
import { View } from '@tarojs/components';
import React, { useMemo } from 'react';
import { useThemeStore } from '@/stores/theme';
import { getThemeHexColors } from '@/theme';
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
  style?: React.CSSProperties;
  /** 是否使用描边线条风格（1px 细线，适合 outline 图标） */
  stroke?: boolean;
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

// 基础颜色映射（保留兜底，主题未覆盖时使用）
const BASE_COLOR_MAP: Record<string, string> = {
  white: '#FFFFFF',
  inherit: '',
};

/** 根据当前主题生成命名颜色映射 */
function useThemeColorMap(): Record<string, string> {
  const { activeTheme } = useThemeStore();
  return useMemo(() => {
    const hex = getThemeHexColors(activeTheme);
    return {
      ...BASE_COLOR_MAP,
      primary: hex.primary,
      primaryLight: hex.primaryLight,
      'primary-light': hex.primaryLight,
      primaryDark: hex.primaryDark,
      'primary-dark': hex.primaryDark,
      accent: hex.accent,
      accentLight: hex.accentLight,
      'accent-light': hex.accentLight,
      purple: hex.accent,
      success: hex.success,
      warning: hex.warning,
      amber: hex.warning,
      error: hex.error,
      info: hex.info,
      foreground: hex.foreground,
      foregroundSecondary: hex.foregroundSecondary,
      'foreground-secondary': hex.foregroundSecondary,
      muted: hex.mutedForeground,
      mutedForeground: hex.mutedForeground,
      'muted-foreground': hex.mutedForeground,
      destructive: hex.destructive,
    };
  }, [activeTheme]);
}

const Icon: React.FC<IconProps> = ({
  name,
  size = 'md',
  color = 'inherit',
  className,
  style,
  stroke = false,
  onClick,
}) => {
  const sizeRpx = typeof size === 'number' ? size : SIZE_MAP[size];
  const colorMap = useThemeColorMap();
  const fillColor =
    color !== 'inherit' && !colorMap[color]
      ? color
      : color !== 'inherit'
        ? colorMap[color]
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
  // 描边模式：1px 细线，fill 为 none，通过 stroke 渲染
  const svgUrl = stroke
    ? `data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' fill='none' stroke='currentColor' stroke-width='1' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='${svgPath}'/%3E%3C/svg%3E`
    : `data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Cpath d='${svgPath}'/%3E%3C/svg%3E`;

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
        ...style,
      }}
      onClick={onClick}
    />
  );
};

export default Icon;
