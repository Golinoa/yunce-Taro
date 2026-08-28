/**
 * TabBar 同步 �?普通员工弱化「数据」Tab（完整权限由 route-guard 拦截�?
 */
import Taro from '@tarojs/taro';
import type { Profile, UserRole } from '@/types/profile';
import { isTabBarPage } from '@/utils/navigation';

export const STATISTICS_TAB_INDEX = 2;

const FINANCE_TAB = {
  text: '数据',
  iconPath: 'assets/icons/checkin_unselected.png',
  selectedIconPath: 'assets/icons/checkin_selected.png',
};

const HIDDEN_TAB = {
  text: ' ',
  iconPath: 'assets/icons/checkin_unselected.png',
  selectedIconPath: 'assets/icons/checkin_unselected.png',
};

function isFinanceTabRole(role?: UserRole | null): boolean {
  return role === 'admin' || role === 'principal';
}

function getCurrentPagePath(): string {
  const pages = Taro.getCurrentPages();
  const route = pages[pages.length - 1]?.route;
  return route ? `/${route}` : '';
}

/** 同步原生 TabBar：非管理员弱化数�?Tab 展示（仅 Tab 页可�?setTabBarItem�?*/
export function syncTabBarByProfile(profile?: Profile | null): void {
  const currentPath = getCurrentPagePath();
  if (!currentPath || !isTabBarPage(currentPath)) {
    return;
  }

  const showFinance = isFinanceTabRole(profile?.currentContext?.role);
  const item = showFinance ? FINANCE_TAB : HIDDEN_TAB;
  void Taro.setTabBarItem({ index: STATISTICS_TAB_INDEX, ...item }).catch(() => {
    /* �?Tab 页或 Tab 未就绪时忽略 */
  });
}

/** @deprecated 兼容旧调�?*/
export const syncCustomTabBar = syncTabBarByProfile;
