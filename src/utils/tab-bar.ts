/**
 * 自定义 TabBar 同步 — 按角色真正隐藏「数据」Tab（非仅改文案）
 */
import Taro from '@tarojs/taro';
import type { Profile, UserRole } from '@/types/profile';
import { isTabBarPage } from '@/utils/navigation';

export const STATISTICS_TAB_INDEX = 2;

export function isFinanceTabRole(role?: UserRole | null): boolean {
  return role === 'admin' || role === 'principal';
}

/** 自定义 TabBar 实例方法（由 src/custom-tab-bar 实现） */
export interface CustomTabBarBridge {
  setSelectedByPath?: (pagePath: string) => void;
  refreshByRole?: (role?: UserRole | null) => void;
  setColors?: (colors: {
    color: string;
    selectedColor: string;
    backgroundColor: string;
  }) => void;
}

function getCurrentPagePath(): string {
  const pages = Taro.getCurrentPages();
  const route = pages[pages.length - 1]?.route;
  return route ? `/${route}` : '';
}

function getActiveCustomTabBar(): CustomTabBarBridge | null {
  try {
    const page = Taro.getCurrentInstance()?.page;
    if (!page) return null;
    return (Taro.getTabBar(page) as CustomTabBarBridge | null) || null;
  } catch {
    return null;
  }
}

/** 同步自定义 TabBar：仅 admin/principal 渲染「数据」；并刷新当前选中项 */
export function syncTabBarByProfile(profile?: Profile | null): void {
  const currentPath = getCurrentPagePath();
  if (!currentPath || !isTabBarPage(currentPath)) {
    return;
  }

  const tabBar = getActiveCustomTabBar();
  if (!tabBar) return;

  tabBar.refreshByRole?.(profile?.currentContext?.role ?? null);
  tabBar.setSelectedByPath?.(currentPath);
}

/** 主题色同步到自定义 TabBar */
export function syncCustomTabBarColors(colors: {
  color: string;
  selectedColor: string;
  backgroundColor: string;
}): void {
  const tabBar = getActiveCustomTabBar();
  tabBar?.setColors?.(colors);
}

/** @deprecated 兼容旧调用 */
export const syncCustomTabBar = syncTabBarByProfile;
