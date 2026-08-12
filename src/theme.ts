/**
 * 松果排课 - 设计 Token 单一数据源
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
// 配色方案对齐设计稿 scheme-bc-fusion-v2.html（蓝色主题 + 花瓣五色）
// ============================================
export const colors = {
  // 主题色（对齐设计稿 #3B6EF5 采集工具蓝）
  primary: '224 90% 60%', // #3B6EF5
  primaryForeground: '0 0% 100%', // #FFFFFF
  primaryGlow: '222 87% 69%', // #6B95F5
  primaryDark: '221 83% 53%', // #2563EB

  // 次要色
  secondary: '224 90% 95%', // #D8E5F8
  secondaryForeground: '224 50% 25%', // #1E2D5C

  // 强调色（对齐设计稿 #8B5CF6 花瓣素材紫）
  accent: '258 90% 66%', // #8B5CF6
  accentForeground: '0 0% 100%', // #FFFFFF
  accentGlow: '258 90% 76%', // #A78BFA

  // 背景
  background: '210 20% 97%', // #f8f9fa
  foreground: '0 0% 10%', // #1a1a1a

  // 卡片
  card: '0 0% 100%', // #FFFFFF
  cardForeground: '0 0% 10%', // #1a1a1a

  // 柔和
  muted: '210 20% 96%', // #f0f2f5
  mutedForeground: '0 0% 54%', // #8a8a8a

  // 文本三级色（对齐设计稿 text-primary/secondary/tertiary）
  foregroundSecondary: '0 0% 33%', // #555555

  // 危险（对齐设计稿 #ef4444）
  destructive: '0 84% 60%', // #ef4444
  destructiveForeground: '0 0% 100%',

  // 边框（对齐设计稿 #eef0f2 border-light）
  border: '210 20% 94%', // #eef0f2
  borderLight: '210 20% 94%', // #eef0f2
  input: '210 20% 94%', // #eef0f2
  ring: '224 90% 60%', // #3B6EF5

  // 状态色（对齐设计稿）
  success: '160 84% 39%', // #10b981
  warning: '38 92% 50%', // #f59e0b
  error: '0 84% 60%', // #ef4444
  info: '199 89% 48%', // #0EA5E9

  // 薄荷绿（用于课程/消课详情头部卡片等轻量成功场景）
  mint: '160 100% 97%', // #f4fffa
  mintForeground: '160 84% 39%', // #10b981
  mintBorder: '160 60% 90%', // #dff3e8

  // 身份角色色（对齐注册流程设计稿）
  rolePrincipal: '38 92% 50%', // #F59E0B 校长
  rolePrincipalGlow: '45 91% 59%', // #FBBF24
  rolePrincipalDark: '32 94% 44%', // #D97706
  roleTeacher: '224 90% 60%', // #3B6EF5 教师
  roleTeacherGlow: '222 87% 69%', // #6B95F5
  roleTeacherDark: '221 83% 53%', // #2563EB
  roleParent: '258 90% 66%', // #8B5CF6 家长
  roleParentGlow: '258 90% 76%', // #A78BFA
  roleParentDark: '262 83% 58%', // #7C3AED

  // 花瓣五色（对齐设计稿 petal 配色，用于 KPI 卡片渐变）
  petalBlue: '224 90% 60%', // #3B6EF5
  petalPurple: '258 90% 66%', // #8B5CF6
  petalOrange: '38 92% 50%', // #F59E0B
  petalRed: '0 84% 60%', // #EF4444
  petalCyan: '189 94% 43%', // #06B6D4

  // 图表色板（对齐花瓣五色）
  chart1: '224 90% 60%', // #3B6EF5 蓝
  chart2: '258 90% 66%', // #8B5CF6 紫
  chart3: '189 94% 43%', // #06B6D4 青
  chart4: '38 92% 50%', // #F59E0B 橙
  chart5: '0 84% 60%', // #EF4444 红
} as const;

// ============================================
// HEX 颜色快捷引用（仅用于无法使用 CSS 变量的场景，如 ECharts 配置）
// ============================================
export const hexColors = {
  primary: '#3B6EF5',
  primaryLight: '#6B95F5',
  primaryDark: '#2563EB',
  accent: '#8B5CF6',
  accentLight: '#A78BFA',
  background: '#f8f9fa',
  foreground: '#1a1a1a',
  foregroundSecondary: '#555555',
  card: '#FFFFFF',
  muted: '#f0f2f5',
  mutedForeground: '#8a8a8a',
  destructive: '#ef4444',
  border: '#eef0f2',
  borderLight: '#eef0f2',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#0EA5E9',
  mint: '#f4fffa',
  mintForeground: '#10b981',
  mintBorder: '#dff3e8',
  // 身份角色色
  rolePrincipal: '#F59E0B',
  rolePrincipalGlow: '#FBBF24',
  rolePrincipalDark: '#D97706',
  roleTeacher: '#3B6EF5',
  roleTeacherGlow: '#6B95F5',
  roleTeacherDark: '#2563EB',
  roleParent: '#8B5CF6',
  roleParentGlow: '#A78BFA',
  roleParentDark: '#7C3AED',
  // 花瓣五色
  petalBlue: '#3B6EF5',
  petalPurple: '#8B5CF6',
  petalOrange: '#F59E0B',
  petalRed: '#EF4444',
  petalCyan: '#06B6D4',
  // 图表色板
  chart1: '#3B6EF5',
  chart2: '#8B5CF6',
  chart3: '#06B6D4',
  chart4: '#F59E0B',
  chart5: '#EF4444',
} as const;

// ============================================
// 多主题色板系统
// ============================================
// 从课表页/我的页提取的重要颜色，扩展为完整主题，支持后续切换。
// 蓝色主题为默认主题，保留不变；新增珊瑚主题（课表页）和橙色主题（我的页）。

/** 主题标识 */
export type ThemeKey = 'blue' | 'coral' | 'orange';

/** 可用主题列表 */
export const THEME_KEYS: ThemeKey[] = ['blue', 'coral', 'orange'];

/** 主题元数据 */
export const THEME_META: Record<ThemeKey, { label: string; description: string; source: string }> =
  {
    blue: { label: '采集蓝', description: '默认蓝色主题', source: 'scheme-bc-fusion-v2' },
    coral: { label: '珊瑚粉', description: '课表页提取主题', source: 'schedule-page' },
    orange: { label: '活力橙', description: '我的页提取主题', source: 'profile-page' },
  };

/** 完整主题色板（每个主题拥有与 colors 相同的 Token 结构，值为 HSL 字符串） */
export type ThemePalette = Record<keyof typeof colors, string>;

/** 蓝色主题 — 当前默认主题 */
export const blueTheme: ThemePalette = { ...colors };

/** 珊瑚主题 — 提取自课表页 #f97768、#47c1b6 等关键色 */
export const coralTheme: ThemePalette = {
  ...colors,
  primary: '6 92% 69%', // #f97768
  primaryForeground: '0 0% 100%',
  primaryGlow: '6 90% 77%', // #fb9b8f
  primaryDark: '5 80% 60%', // #e85a4a
  secondary: '6 100% 95%', // #ffe8e5
  secondaryForeground: '5 50% 37%', // #8b3a30
  accent: '174 50% 52%', // #47c1b6
  accentForeground: '0 0% 100%',
  accentGlow: '174 50% 67%', // #7dd9d0
  background: '0 0% 96%', // #f5f5f5
  foreground: '0 0% 10%',
  card: '0 0% 100%',
  cardForeground: '0 0% 10%',
  muted: '0 0% 94%', // #f0f0f0
  mutedForeground: '0 0% 54%',
  border: '0 0% 93%', // #ededed
  borderLight: '0 0% 93%',
  input: '0 0% 93%',
  ring: '6 92% 69%',
  roleTeacher: '6 92% 69%',
  roleTeacherGlow: '6 90% 77%',
  roleTeacherDark: '5 80% 60%',
  roleParent: '174 50% 52%',
  roleParentGlow: '174 50% 67%',
  roleParentDark: '174 45% 45%',
  petalBlue: '6 92% 69%',
  petalPurple: '174 50% 52%',
  chart1: '6 92% 69%',
  chart2: '174 50% 52%',
  chart3: '189 94% 43%',
  chart4: '38 92% 50%',
  chart5: '0 84% 60%',
};

/** 橙色主题 — 提取自我的页 #FF8A2A、#FCA45C 等高亮橙 */
export const orangeTheme: ThemePalette = {
  ...colors,
  primary: '27 100% 58%', // #FF8A2A
  primaryForeground: '0 0% 100%',
  primaryGlow: '27 96% 67%', // #FCA45C
  primaryDark: '25 80% 50%', // #e66d1a
  secondary: '27 100% 95%', // #fff0e5
  secondaryForeground: '25 77% 28%', // #7a3d10
  accent: '189 94% 43%', // #06B6D4
  accentForeground: '0 0% 100%',
  accentGlow: '187 92% 59%', // #38D5F0
  background: '30 30% 97%', // #faf8f5
  foreground: '0 0% 10%',
  card: '0 0% 100%',
  cardForeground: '0 0% 10%',
  muted: '30 20% 96%', // #f5f3f0
  mutedForeground: '0 0% 54%',
  border: '30 20% 93%', // #f0ede9
  borderLight: '30 20% 93%',
  input: '30 20% 93%',
  ring: '27 100% 58%',
  roleTeacher: '27 100% 58%',
  roleTeacherGlow: '27 96% 67%',
  roleTeacherDark: '25 80% 50%',
  roleParent: '189 94% 43%',
  roleParentGlow: '187 92% 59%',
  roleParentDark: '191 91% 36%',
  petalBlue: '27 100% 58%',
  petalPurple: '189 94% 43%',
  chart1: '27 100% 58%',
  chart2: '189 94% 43%',
  chart3: '189 94% 43%',
  chart4: '38 92% 50%',
  chart5: '0 84% 60%',
};

/** 主题色板映射表 */
export const themePalettes: Record<ThemeKey, ThemePalette> = {
  blue: blueTheme,
  coral: coralTheme,
  orange: orangeTheme,
};

/** HEX 色板类型（允许每主题覆盖为任意色值） */
export type HexColorPalette = Record<keyof typeof hexColors, string>;

/** 按主题组织的 HEX 快捷引用 */
export const hexThemeColors: Record<ThemeKey, HexColorPalette> = {
  blue: { ...hexColors },
  coral: {
    ...hexColors,
    primary: '#f97768',
    primaryLight: '#fb9b8f',
    primaryDark: '#e85a4a',
    accent: '#47c1b6',
    accentLight: '#7dd9d0',
    background: '#f5f5f5',
    muted: '#f0f0f0',
    border: '#ededed',
    roleTeacher: '#f97768',
    roleTeacherGlow: '#fb9b8f',
    roleTeacherDark: '#e85a4a',
    roleParent: '#47c1b6',
    roleParentGlow: '#7dd9d0',
    roleParentDark: '#35a89e',
    petalBlue: '#f97768',
    petalPurple: '#47c1b6',
    chart1: '#f97768',
    chart2: '#47c1b6',
  },
  orange: {
    ...hexColors,
    primary: '#FF8A2A',
    primaryLight: '#FCA45C',
    primaryDark: '#e66d1a',
    accent: '#06B6D4',
    accentLight: '#38D5F0',
    background: '#faf8f5',
    muted: '#f5f3f0',
    border: '#f0ede9',
    roleTeacher: '#FF8A2A',
    roleTeacherGlow: '#FCA45C',
    roleTeacherDark: '#e66d1a',
    roleParent: '#06B6D4',
    roleParentGlow: '#38D5F0',
    roleParentDark: '#0891B2',
    petalBlue: '#FF8A2A',
    petalPurple: '#06B6D4',
    chart1: '#FF8A2A',
    chart2: '#06B6D4',
  },
};

/** 获取指定主题的色板 */
export function getThemePalette(key: ThemeKey): ThemePalette {
  return themePalettes[key] ?? blueTheme;
}

/** 获取指定主题的 HEX 快捷引用 */
export function getThemeHexColors(key: ThemeKey): HexColorPalette {
  return hexThemeColors[key] ?? hexColors;
}

/** 将主题色板转为 CSS 变量声明 */
export function generateThemeCSSVars(palette: ThemePalette): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [key, value] of Object.entries(palette)) {
    const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
    vars[`--${cssKey}`] = value;
  }
  return vars;
}

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
// 阴影 Token（对齐设计稿蓝色主题阴影）
// ============================================
export const shadows = {
  elegant: '0 20rpx 60rpx -20rpx rgba(59, 110, 245, 0.3)',
  soft: '0 8rpx 40rpx -8rpx rgba(59, 110, 245, 0.08)',
  card: '0 2rpx 12rpx rgba(59, 110, 245, 0.06)',
  cardHover: '0 4rpx 20rpx rgba(59, 110, 245, 0.1)',
  float: '0 4rpx 16rpx rgba(59, 110, 245, 0.08)',
  popup: '0 8rpx 32rpx rgba(0, 0, 0, 0.15)',
  rollcall: '0 4rpx 16rpx rgba(37, 99, 235, 0.3)',
} as const;

// ============================================
// 渐变 Token（对齐设计稿蓝色主题）
// ============================================
export const gradients = {
  primary:
    'linear-gradient(135deg, hsl(var(--primary-glow)) 0%, hsl(var(--primary)) 50%, hsl(var(--primary-dark)) 100%)',
  accent: 'linear-gradient(135deg, hsl(var(--accent)), hsl(var(--accent-glow)))',
  subtle: 'linear-gradient(180deg, hsl(var(--primary)/0.06), hsl(var(--background)))',
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
