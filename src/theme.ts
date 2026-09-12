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

// Taro 运行时引用（仅 applyTheme 函数使用，避免 tree-shaking）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WechatMinigameGlobal = { wx?: any; getCurrentPages?: () => any[] };
declare const globalThis: WechatMinigameGlobal;
// 配色方案对齐设计稿 scheme-bc-fusion-v2.html（蓝色主题 + 花瓣五色）
// ============================================
export const colors = {
  // 主题色（对齐设计稿 #3B6EF5 采集工具蓝）
  primary: '224 90% 60%', // #3B6EF5
  primaryForeground: '0 0% 100%', // #FFFFFF
  primaryGlow: '222 87% 69%', // #6B95F5
  primaryDark: '221 83% 53%', // #2563EB
  primarySoft: '220 100% 93%', // #DCE8FF 淡主题色（primary 20%），用于导航栏/头部渐变背景

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

  /**
   * 待办四象限专用色（参考 Eisenhower 看板）
   * - q1 重要且紧急 · 红
   * - q2 重要不紧急 · 金 #DAA520 / 浅底 #FFF9E6
   * - q3 紧急不重要 · 蓝（info）
   * - q4 不紧急不重要 · 绿 #00B36B / 浅底 #E6F9F0
   */
  todoQ1Bg: '0 86% 97%', // #FEF2F2
  todoQ2: '43 74% 49%', // #DAA520
  todoQ2Bg: '48 100% 95%', // #FFF9E6
  todoQ3: '199 89% 48%', // #0EA5E9 与 info 一致
  todoQ3Bg: '199 95% 96%', // #E8F6FC
  todoQ4: '156 100% 35%', // #00B36B
  todoQ4Bg: '152 56% 94%', // #E6F9F0

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
  primarySoftBg: '#DCE8FF', // 淡主题色背景，用于导航栏/头部弥散
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
  successLight: '#34d399',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#0EA5E9',
  /** 待办四象限：q1 红 / q2 金 / q3 蓝 / q4 绿 */
  todoQ1Bg: '#FEF2F2',
  todoQ2: '#DAA520',
  todoQ2Bg: '#FFF9E6',
  todoQ3: '#0EA5E9',
  todoQ3Bg: '#E8F6FC',
  todoQ4: '#00B36B',
  todoQ4Bg: '#E6F9F0',
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
// 扩展调色板（覆盖组件中高频硬编码颜色，接入主题系统）
// ============================================
export const extendedColors = {
  pageBg: '220 20% 97%',
  pageBgSecondary: '30 20% 95%',
  pageBgTertiary: '210 25% 98%',
  foregroundTertiary: '215 16% 57%',
  foregroundQuaternary: '218 14% 41%',
  divider: '0 0% 91%',
  dividerLight: '0 0% 88%',
  dividerStrong: '0 0% 75%',
  successBg: '152 100% 97%',
  successBgSoft: '152 82% 95%',
  successBorder: '160 60% 90%',
  warningBg: '25 100% 97%',
  warningBgSoft: '15 100% 97%',
  warningBorder: '15 60% 86%',
  errorBg: '0 100% 97%',
  errorBorder: '0 60% 88%',
  infoBg: '200 50% 96%',
  leadPrimary: '20 100% 65%',
  leadPrimaryGlow: '12 95% 67%',
  leadPrimaryDark: '16 85% 58%',
  avatarMint: '160 55% 58%',
  avatarMintDark: '162 49% 48%',
  avatarMintLight: '159 64% 64%',
  avatarPink: '340 60% 75%',
  avatarPinkDark: '335 53% 67%',
  avatarPinkLight: '340 75% 87%',
  avatarBlue: '205 55% 60%',
  avatarBlueDark: '209 47% 51%',
  avatarBlueLight: '204 75% 73%',
  avatarBlueDeep: '207 47% 52%',
  avatarAmber: '40 60% 57%',
  avatarAmberDark: '37 56% 45%',
  avatarPurple: '260 50% 67%',
  avatarPurpleDark: '254 43% 59%',
  avatarCoral: '0 65% 78%',
  avatarCoralDeep: '14 64% 65%',
  avatarCoralDeepDark: '15 60% 53%',
  avatarOrange: '21 71% 60%',
  avatarOrangeDark: '20 64% 50%',
  avatarOrangeLight: '26 84% 80%',
  avatarCyan: '195 70% 70%',
  avatarLime: '75 55% 60%',
  avatarRose: '340 80% 64%',
  avatarIndigo: '235 70% 64%',
  mintBackground: '152 60% 98%',
  mintBorderStrong: '152 41% 85%',
  mintError: '0 75% 65%',
  scheduleBlueBg: '218 100% 96%',
  scheduleBlueText: '210 75% 55%',
  scheduleGreenBg: '147 67% 94%',
  scheduleGreenText: '148 56% 45%',
  scheduleOrangeBg: '25 100% 95%',
  scheduleOrangeText: '28 71% 55%',
  scheduleGrayBg: '0 0% 95%',
  scheduleGrayText: '0 0% 56%',
  scheduleBlueLight: '218 100% 96%',
  scheduleBlueBorder: '218 100% 92%',
  scheduleBlueBgg: '218 40% 98%',
  statGreen: '130 41% 58%',
  statAmber: '36 71% 60%',
  statBlue: '218 100% 71%',
  statPurple: '268 100% 78%',
  cardGradientBlueStart: '218 50% 99%',
  cardGradientBlueEnd: '218 50% 96%',
  cardGradientRedStart: '0 100% 99%',
  cardGradientRedEnd: '0 100% 97%',
  cardRedBorder: '0 86% 91%',
  badgeOrangeBg: '33 100% 97%',
  badgeOrangeText: '38 92% 50%',
  badgeOrangeBorder: '38 95% 60%',
  badgeBlueBg: '214 100% 97%',
  badgeBlueText: '217 91% 60%',
  badgeBlueBorder: '213 94% 68%',
  badgeGrayBg: '220 14% 96%',
  badgeGrayBorder: '218 11% 65%',
  gray50: '0 0% 98%',
  gray100: '210 20% 96%',
  gray200: '220 13% 91%',
  gray300: '216 12% 84%',
  gray400: '218 11% 65%',
  gray500: '220 9% 46%',
  gray600: '215 14% 34%',
  gray700: '217 19% 27%',
  gray800: '215 28% 17%',
  gray900: '221 39% 11%',
  gray950: '224 71% 4%',
} as const;

// ============================================
// 扩展 HEX 快捷引用
// ============================================
export const extendedHexColors = {
  pageBg: '#f6f7fb',
  pageBgSecondary: '#f3f2ed',
  pageBgTertiary: '#f8fafc',
  foregroundTertiary: '#8b95a7',
  foregroundQuaternary: '#5b6475',
  divider: '#e8e8e8',
  dividerLight: '#e0e0e0',
  dividerStrong: '#c0c0c0',
  successBg: '#f4fffa',
  successBgSoft: '#edfdf3',
  successBorder: '#dff3e8',
  mintNavBackground: '#FAFDFB',
  warningBg: '#fff7f5',
  warningBgSoft: '#fff4f2',
  warningBorder: '#f5c6bf',
  errorBg: '#fff0f0',
  errorBorder: '#f5d0d0',
  infoBg: '#f4f7fb',
  leadPrimary: '#ff8a4c',
  leadPrimaryGlow: '#f97361',
  leadPrimaryDark: '#e67a3e',
  avatarMint: '#5EC8A8',
  avatarMintDark: '#4AB893',
  avatarMintLight: '#7dd8bc',
  avatarPink: '#E89BB8',
  avatarPinkDark: '#D97CA2',
  avatarPinkLight: '#f0b3c7',
  avatarBlue: '#6BA3D6',
  avatarBlueDark: '#4B85BB',
  avatarBlueLight: '#93c5e8',
  avatarBlueDeep: '#4D86BD',
  avatarAmber: '#D4A24E',
  avatarAmberDark: '#B9852F',
  avatarPurple: '#9B7ED8',
  avatarPurpleDark: '#7E63C9',
  avatarCoral: '#F0A0A0',
  avatarCoralDeep: '#F08A5D',
  avatarCoralDeepDark: '#D96A38',
  avatarOrange: '#E8864A',
  avatarOrangeDark: '#D66D2B',
  avatarOrangeLight: '#f5c6a0',
  avatarCyan: '#7BC8E8',
  avatarLime: '#B8D45E',
  avatarRose: '#f43f5e',
  avatarIndigo: '#6366f1',
  mintBackground: '#f5faf8',
  mintBorderStrong: '#D5E8E0',
  mintError: '#E46767',
  scheduleBlueBg: '#eaf6ff',
  scheduleBlueText: '#3a8ee6',
  scheduleGreenBg: '#ebf9f1',
  scheduleGreenText: '#33b07a',
  scheduleOrangeBg: '#fff3e8',
  scheduleOrangeText: '#df8b3b',
  scheduleGrayBg: '#f1f1f1',
  scheduleGrayText: '#8f8f8f',
  scheduleBlueLight: '#eaf1ff',
  scheduleBlueBorder: '#e8ecf3',
  scheduleBlueBgg: '#f9fafb',
  statGreen: '#65c08b',
  statAmber: '#e0a54e',
  statBlue: '#6aa8ff',
  statPurple: '#c28cff',
  cardGradientBlueStart: '#f8fbff',
  cardGradientBlueEnd: '#eef5ff',
  cardGradientRedStart: '#fff8f8',
  cardGradientRedEnd: '#fff1f1',
  cardRedBorder: '#fde2e2',
  badgeOrangeBg: '#fff7ed',
  badgeOrangeText: '#f59e0b',
  badgeOrangeBorder: '#fbbf24',
  badgeBlueBg: '#eff6ff',
  badgeBlueText: '#3b82f6',
  badgeBlueBorder: '#60a5fa',
  badgeGrayBg: '#f3f4f6',
  badgeGrayBorder: '#9ca3af',
  gray50: '#fafafa',
  gray100: '#f0f2f5',
  gray200: '#e5e7eb',
  gray300: '#d1d5db',
  gray400: '#9ca3af',
  gray500: '#6b7280',
  gray600: '#4b5563',
  gray700: '#374151',
  gray800: '#1f2937',
  gray900: '#111827',
  gray950: '#030712',
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
export type HexColorPalette = Record<
  keyof typeof hexColors | keyof typeof extendedHexColors,
  string
>;

/** 按主题组织的 HEX 快捷引用 */
export const hexThemeColors: Record<ThemeKey, HexColorPalette> = {
  blue: { ...hexColors, ...extendedHexColors },
  coral: {
    ...hexColors,
    ...extendedHexColors,
    primary: '#f97768',
    primaryLight: '#fb9b8f',
    primaryDark: '#e85a4a',
    primarySoftBg: '#FEE4E0', // 淡珊瑚色背景（primary 20%）
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
    ...extendedHexColors,
    primary: '#FF8A2A',
    primaryLight: '#FCA45C',
    primaryDark: '#e66d1a',
    primarySoftBg: '#FFE4CC', // 淡橙色背景（primary 20%）
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
  red: { gradient: 'linear-gradient(135deg, #E57373, #f2a0a0)', label: '绯红' },
  teal: { gradient: 'linear-gradient(135deg, #4FC3B7, #8adfd6)', label: '青碧' },
} as const;

/**
 * 班级颜色统一色板（ClassColor key → hex）：
 * 课程管理 / 班级详情头部 / 今日课表 / 新增课程预设色 共用此表，保证颜色一致（用户口径 2026-08-23）
 */
export const classColorHex: Record<string, string> = {
  primary: '#5EC8A8',
  red: '#E57373',
  amber: '#D4A24E',
  purple: '#9B7ED8',
  info: '#6BA3D6',
  teal: '#4FC3B7',
};

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
 * 应用主题到所有已渲染页面（小程序运行时主题切换）
 *
 * 实现思路：
 *  1. 通过 `Taro.getCurrentPages()` 拿到所有已加载的页面实例
 *  2. 给每个页面根 view 注入 style 字符串（包含 CSS 变量声明）
 *  3. CSS 变量会自动向下级联，所有 UnoCSS 主题色类（如 `bg-primary`）都会跟随更新
 *
 * 实现细节：
 *  - 小程序 page 根元素是 `<page>` 元素，Taro 在编译后会把页面根组件挂到 page 容器内
 *  - 通过 `wx.createSelectorQuery().selectPage()` 拿到 page 根节点，调用 setStyle
 *  - 为了兼容不同端：依次降级到 page.$scope.setData({ style }) / page.setData({ style })
 *
 * @param palette 完整的 HSL 色板（通常来自 getThemePalette(themeKey)）
 */
export function applyTheme(palette: ThemePalette): void {
  // 小程序环境检查：通过 globalThis.wx 判断
  if (typeof globalThis === 'undefined' || !(globalThis as WechatMinigameGlobal).wx) {
    // 非小程序环境（H5/React Native），静默退出
    return;
  }

  const vars = generateThemeCSSVars(palette);
  // 将 CSS 变量序列化为 inline style 字符串
  const styleStr = Object.entries(vars)
    .map(([k, v]) => `${k}: ${v}`)
    .join('; ');

  // 方案 A：通过 wx.createSelectorQuery 拿到 page 节点直接设置 style（推荐）
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wx = (typeof globalThis !== 'undefined' ? (globalThis as any).wx : undefined) as
      | {
          createSelectorQuery?: () => {
            selectPage?: () => unknown;
            exec?: (cb: (res: unknown) => void) => void;
          };
        }
      | undefined;
    if (wx?.createSelectorQuery) {
      const query = wx.createSelectorQuery();
      if (query.selectPage) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (query as any)
          .selectPage()
          .node()
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 小程序 selectPage 回调类型不可用
          .exec((res: any) => {
            const node = res?.[0]?.node;
            if (node?.style) {
              // 给 page 根节点的所有 CSS 变量赋值
              for (const [k, v] of Object.entries(vars)) {
                try {
                  node.style.setProperty(k, String(v));
                } catch {
                  // 忽略单变量设置失败
                }
              }
            }
          });
        return; // 方案 A 成功就直接返回
      }
    }
  } catch (err) {
    console.warn('[theme] applyTheme: wx.selectPage 失败，降级到 setData', err);
  }

  // 方案 B：setData 写 style 字段（需要 page WXML 模板绑定 style="{{style}}"，通常不生效）
  try {
    const pages = globalThis.getCurrentPages?.() ?? [];
    for (const page of pages) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p = page as any;
      if (typeof p.setData === 'function') {
        p.setData({ style: styleStr });
      } else if (p.$scope && typeof p.$scope.setData === 'function') {
        p.$scope.setData({ style: styleStr });
      }
    }
  } catch (err) {
    // page 实例未就绪（首屏渲染前），静默忽略
    console.warn('[theme] applyTheme: 无法访问 page 实例', err);
  }
}

/**
 * @deprecated 该函数旧版本签名，仅保留类型导出兼容。请使用 `applyTheme(palette)` 新版本。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const _legacyApplyTheme: any = undefined;
