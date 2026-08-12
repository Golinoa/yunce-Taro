/**
 * 主题切换 Store — Zustand
 *
 * 管理全局主题状态，支持 blue（默认）/ coral（课表页提取）/ orange（我的页提取）切换。
 * 主题类名通过 app.tsx 应用到 page 容器，CSS 变量自动生效。
 */
import Taro from '@tarojs/taro';
import { create } from 'zustand';
import type { ThemeKey } from '@/theme';

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
  },

  initTheme: () => {
    set({ activeTheme: getStoredTheme() });
  },
}));
