/**
 * 主题切换 Store — Zustand
 *
 * 管理全局主题状态，支持 blue（默认）/ coral（课表页提取）/ orange（我的页提取）切换。
 * 切换时会同步更新：
 *  1. 当前 page 根的 CSS 变量（确保 UnoCSS 主题色类生效）
 *  2. TabBar 颜色（原生 tabBar 通过 setTabBarStyle 动态改色）
 *  3. 当前页导航栏颜色（setNavigationBarColor）
 * 主题类名通过 app.tsx 应用到 page 容器，CSS 变量自动生效。
 */
import Taro from '@tarojs/taro';
import { create } from 'zustand';
import { applyTheme, getThemePalette, type ThemeKey } from '@/theme';
import { syncTabBarToTheme } from '@/utils/navigation-bar';

/** 主题本地存储键 */
const THEME_STORAGE_KEY = 'yunce:active-theme';

interface ThemeState {
  /** 当前主题 */
  activeTheme: ThemeKey;
  /** 切换主题并持久化 */
  setTheme: (theme: ThemeKey) => void;
  /** 从本地存储初始化主题 */
  initTheme: () => void;
}

/** 获取持久化主题（默认蓝色主题） */
function getStoredTheme(): ThemeKey {
  try {
    const stored = Taro.getStorageSync(THEME_STORAGE_KEY) as ThemeKey | undefined;
    if (stored && ['blue', 'coral', 'orange'].includes(stored)) {
      return stored;
    }
  } catch {
    // 忽略存储读取异常，使用默认值
  }
  return 'blue';
}

export const useThemeStore = create<ThemeState>((set) => ({
  activeTheme: 'blue',

  setTheme: (theme) => {
    try {
      Taro.setStorageSync(THEME_STORAGE_KEY, theme);
    } catch {
      // 忽略存储写入异常
    }
    set({ activeTheme: theme });

    // 同步应用主题：注入 CSS 变量到 page 根 + 同步 TabBar + 同步导航栏
    // 注意：applyTheme 会读取当前 page 实例，调用前需要 set() 已完成
    try {
      const palette = getThemePalette(theme);
      void applyTheme(palette);
      syncTabBarToTheme(theme);
    } catch (err) {
      console.warn('[theme] 应用主题失败', err);
    }
  },

  initTheme: () => {
    const theme = getStoredTheme();
    set({ activeTheme: theme });

    // 启动时也应用一次（解决首屏 iftab 切换导致的主题不一致）
    try {
      const palette = getThemePalette(theme);
      void applyTheme(palette);
      syncTabBarToTheme(theme);
    } catch {
      // 首屏 page 实例可能尚未创建，忽略
    }
  },
}));
