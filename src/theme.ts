/**
 * 云策教务 - 设计 Token 单一数据源
 *
 * 所有设计值（颜色、间距、圆角、字号、阴影等）的唯一来源。
 * - CSS 变量声明 → app.scss 中手动同步（Taro 小程序不支持运行时动态注入 CSS 变量）
 * - JS/TS 运行时引用 → import { colors, spacing, ... } from '@/theme'
 * - UnoCSS 引用 → 通过 CSS 变量 hsl(var(--primary)) 方式引用
 *
 * 修改原则：改这里 → 同步 app.scss → 全局生效
 */

// ============================================
// 颜色 Token（HSL 值，用于 CSS 变量和运行时拼接）
// ============================================
export const colors = {
  // 主题色
  primary: '168 55% 58%', // #5EC8A8
  primaryForeground: '0 0% 100%', // #FFFFFF
  primaryGlow: '168 55% 75%', // #9EDDC7
  primaryDark: '168 45% 45%', // #3DA88A

  // 次要色
  secondary: '168 35% 92%', // #E3F2EF
  secondaryForeground: '160 15% 25%', // #374842

  // 强调色
  accent: '340 60% 78%', // #E89BB8
  accentForeground: '0 0% 100%', // #FFFFFF
  accentGlow: '340 60% 88%', // #F2C5D6

  // 背景
  background: '160 30% 97%', // #FAFDFB
  foreground: '160 15% 25%', // #374842

  // 卡片
  card: '0 0% 100%', // #FFFFFF
  cardForeground: '160 15% 25%', // #374842

  // 柔和
  muted: '168 25% 94%', // #EDF5F2
  mutedForeground: '160 10% 50%', // #738C82

  // 危险
  destructive: '0 70% 65%', // #D94040
  destructiveForeground: '0 0% 100%',

  // 边框
  border: '168 25% 88%', // #D5E8E0
  input: '168 25% 88%', // #D5E8E0
  ring: '168 55% 58%', // #5EC8A8

  // 状态色
  success: '140 55% 50%', // #3ABF6E
  warning: '43 74% 66%', // #E8C468
  error: '0 70% 65%', // #D94040
  info: '200 55% 65%', // #6BB5D4

  // 图表色板
  chart1: '168 55% 58%', // #5EC8A8
  chart2: '340 60% 78%', // #E89BB8
  chart3: '200 55% 65%', // #6BB5D4
  chart4: '43 74% 66%', // #E8C468
  chart5: '27 87% 67%', // #E8864A
} as const;

// ============================================
// HEX 颜色快捷引用（仅用于无法使用 CSS 变量的场景，如 ECharts 配置）
// ============================================
export const hexColors = {
  primary: '#5EC8A8',
  primaryLight: '#9EDDC7',
  primaryDark: '#3DA88A',
  accent: '#E89BB8',
  accentLight: '#F2C5D6',
  background: '#FAFDFB',
  foreground: '#374842',
  card: '#FFFFFF',
  muted: '#EDF5F2',
  mutedForeground: '#738C82',
  destructive: '#D94040',
  border: '#D5E8E0',
  success: '#3ABF6E',
  warning: '#E8C468',
  error: '#D94040',
  info: '#6BB5D4',
} as const;

// ============================================
// 间距 Token（rpx）
// ============================================
export const spacing = {
  xs: 8,
  sm: 16,
  md: 24,
  lg: 32,
  xl: 48,
  pagePadding: 32,
} as const;

// ============================================
// 圆角 Token（rpx）— 基础 + 组件级语义
// ============================================
export const radius = {
  // 基础
  base: 30,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  button: 48,
  round: 999,
  // 组件级语义（统一全局组件圆角）
  card: 32, // 卡片圆角
  input: 24, // 输入框圆角
  sheet: 40, // 底部弹窗顶部圆角
  tag: 20, // 标签圆角
  avatar: 999, // 头像圆角（圆形）
  headerBottom: 60, // 渐变头部底部圆角
} as const;

// ============================================
// 字号 Token（rpx）
// ============================================
export const fontSize = {
  xs: 22,
  sm: 24,
  md: 28,
  lg: 32,
  xl: 36,
  '2xl': 40,
  '3xl': 44,
  '4xl': 52,
  '5xl': 64,
} as const;

// ============================================
// 字重 Token
// ============================================
export const fontWeight = {
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

// ============================================
// 阴影 Token
// ============================================
export const shadows = {
  elegant: '0 20rpx 60rpx -20rpx hsl(168 55% 58% / 0.3)',
  soft: '0 8rpx 40rpx -8rpx rgba(54, 73, 67, 0.1)',
  card: '0 2rpx 12rpx rgba(0, 0, 0, 0.08)',
  cardHover: '0 4rpx 20rpx rgba(0, 0, 0, 0.12)',
  float: '0 4rpx 16rpx rgba(0, 0, 0, 0.1)',
  popup: '0 8rpx 32rpx rgba(0, 0, 0, 0.15)',
} as const;

// ============================================
// 渐变 Token
// ============================================
export const gradients = {
  primary: 'linear-gradient(135deg, hsl(168 55% 58%), hsl(168 55% 75%))',
  accent: 'linear-gradient(135deg, hsl(340 60% 78%), hsl(340 60% 88%))',
  subtle: 'linear-gradient(180deg, #f5faf8, #e3f2ef)',
} as const;

// ============================================
// 排课颜色主题
// ============================================
export const scheduleColors = {
  primary: { bg: 'rgba(94, 200, 168, 0.25)', text: 'rgba(94, 200, 168, 0.75)' },
  info: { bg: 'rgba(107, 181, 212, 0.25)', text: 'rgba(107, 181, 212, 0.75)' },
  accent: { bg: 'rgba(232, 155, 184, 0.25)', text: 'rgba(232, 155, 184, 0.75)' },
  lavender: { bg: 'rgba(160, 140, 210, 0.25)', text: 'rgba(160, 140, 210, 0.75)' },
} as const;

// ============================================
// 班级颜色主题（图标渐变）
// ============================================
export const classColors = {
  primary: { gradient: 'linear-gradient(135deg, #5EC8A8, #7dd8bc)', label: '薄荷绿' },
  accent: { gradient: 'linear-gradient(135deg, #e88aaa, #f0b3c7)', label: '粉紫' },
  amber: { gradient: 'linear-gradient(135deg, #d4a24e, #e8c47a)', label: '琥珀' },
  info: { gradient: 'linear-gradient(135deg, #6ba3d6, #93c5e8)', label: '天蓝' },
  purple: { gradient: 'linear-gradient(135deg, #9b7ed8, #bda4e8)', label: '紫罗兰' },
} as const;

// ============================================
// 动画 Token
// ============================================
export const animation = {
  durationFast: 150, // ms
  durationBase: 250,
  durationSlow: 350,
  easingDefault: 'ease',
} as const;

// ============================================
// 工具函数
// ============================================

/** 将 HSL Token 值转为 hsl() CSS 字符串 */
export function hsl(hslValue: string): string {
  return `hsl(${hslValue})`;
}

/** 将 HSL Token 值转为带透明度的 hsla() CSS 字符串 */
export function hsla(hslValue: string, alpha: number): string {
  return `hsl(${hslValue} / ${alpha})`;
}

/**
 * 生成 CSS 变量声明字符串（用于主题切换时动态设置）
 * 在小程序中通过 Taro.setPageStyle 或 page.style 设置
 */
export function generateCSSVars(overrides?: Partial<typeof colors>): Record<string, string> {
  const merged = { ...colors, ...overrides };
  const vars: Record<string, string> = {};

  for (const [key, value] of Object.entries(merged)) {
    // camelCase → kebab-case: primaryGlow → primary-glow
    const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
    vars[`--${cssKey}`] = value;
  }

  return vars;
}

/**
 * 应用主题到页面（小程序运行时主题切换）
 * 使用 Taro 的 setPageStyle API
 */
export async function applyTheme(overrides?: Partial<typeof colors>) {
  const { default: Taro } = await import('@tarojs/taro');
  const vars = generateCSSVars(overrides);
  // Taro 4.x 支持 setPageStyle
  try {
    await (Taro as any).setPageStyle?.({ style: vars });
  } catch {
    // 降级：直接设置 page 元素 style（兼容旧版本）
    const page = (
      typeof document !== 'undefined' ? document.querySelector('page') : null
    ) as PageElement | null;
    if (page) {
      Object.assign(page.style, vars);
    }
  }
}
