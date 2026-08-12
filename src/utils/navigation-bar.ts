/**
 * 导航栏颜色工具
 * 用于将页面导航栏接入主题系统，支持主题切换时动态更新。
 *
 * 核心原则：所有导航栏颜色必须跟随当前主题变化，
 * 使用 hexThemeColors[activeTheme] 获取主题感知的 HEX 颜色，
 * 而非静态的 hexColors（永远为蓝色主题）。
 */
import Taro, { useDidShow } from '@tarojs/taro';
import { useEffect } from 'react';
import { useThemeStore } from '@/stores/theme';
import { hexThemeColors, type ThemeKey } from '@/theme';

interface NavigationBarOptions {
  /** 导航栏背景色（Hex） */
  backgroundColor?: string;
  /** 标题颜色，仅支持 '#ffffff' 或 '#000000' */
  frontColor?: '#ffffff' | '#000000';
}

/**
 * 获取当前主题的 HEX 颜色快捷引用
 */
function getThemeHex(theme: ThemeKey) {
  return hexThemeColors[theme];
}

/**
 * 设置当前页面导航栏颜色
 * @param options 导航栏颜色选项
 */
export function setNavigationBarColor(options: NavigationBarOptions): void {
  const { backgroundColor, frontColor = '#000000' } = options;
  if (!backgroundColor) return;

  Taro.setNavigationBarColor({
    frontColor,
    backgroundColor,
    animation: {
      duration: 0,
      timingFunc: 'linear',
    },
  });
}

/**
 * Hook：根据当前主题动态设置导航栏颜色
 *
 * 同时监听 activeTheme 变化和 useDidShow，
 * 确保切换主题后即时更新，以及返回页面时重新应用。
 *
 * @param getOptions 返回导航栏颜色选项的函数，接收当前主题的 HEX 颜色引用
 */
export function useThemedNavigationBar(
  getOptions: (themeHex: ReturnType<typeof getThemeHex>) => NavigationBarOptions,
): void {
  const { activeTheme } = useThemeStore();

  const apply = () => {
    const themeHex = getThemeHex(activeTheme);
    const options = getOptions(themeHex);
    setNavigationBarColor(options);
  };

  // 主题切换时立即更新
  useEffect(() => {
    apply();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTheme]);

  // 页面重新可见时也更新（解决返回页面后导航栏重置的问题）
  useDidShow(() => {
    apply();
  });
}

/**
 * 主题色导航栏预设
 * 用于需要跟随主题色变化的页面导航栏（首页、课表等 Tab 页）
 */
export function usePrimaryNavigationBar(): void {
  useThemedNavigationBar((themeHex) => ({
    backgroundColor: themeHex.primary,
    frontColor: '#ffffff',
  }));
}

/**
 * 卡片白底导航栏预设
 * 用于白色卡片背景、黑色标题的页面导航栏
 */
export function useCardNavigationBar(): void {
  useThemedNavigationBar((themeHex) => ({
    backgroundColor: themeHex.card,
    frontColor: '#000000',
  }));
}

/**
 * 薄荷绿背景导航栏预设
 * 用于课程/消课等轻量成功场景的页面导航栏
 */
export function useMintNavigationBar(): void {
  useThemedNavigationBar((themeHex) => ({
    backgroundColor: themeHex.mintNavBackground,
    frontColor: '#000000',
  }));
}

/**
 * 页面背景色导航栏预设
 * 用于与页面背景融为一体的导航栏
 */
export function usePageBgNavigationBar(): void {
  useThemedNavigationBar((themeHex) => ({
    backgroundColor: themeHex.pageBg,
    frontColor: '#000000',
  }));
}

// ============================================
// TabBar 主题同步
// ============================================

/**
 * 同步 TabBar 颜色到当前主题
 * 小程序 tabBar 配置是静态的，需要通过 setTabBarStyle 动态更新
 */
export function syncTabBarToTheme(theme: ThemeKey): void {
  const themeHex = getThemeHex(theme);
  try {
    Taro.setTabBarStyle({
      color: themeHex.mutedForeground,
      selectedColor: themeHex.primary,
      backgroundColor: themeHex.card,
      borderStyle: 'white',
    });
  } catch {
    // tabBar 可能未初始化，忽略错误
  }
}

/**
 * Hook：监听主题变化并同步 TabBar 颜色
 * 在 App 组件或 Tab 页面中调用
 */
export function useThemedTabBar(): void {
  const { activeTheme } = useThemeStore();

  useEffect(() => {
    syncTabBarToTheme(activeTheme);
  }, [activeTheme]);

  // 页面可见时也同步（确保返回 Tab 页后 tabBar 颜色正确）
  useDidShow(() => {
    syncTabBarToTheme(activeTheme);
  });
}
