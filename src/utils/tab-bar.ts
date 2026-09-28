/**
 * 自定义 TabBar 同步 — 按角色真正隐藏「数据」Tab（非仅改文案）
 */
import Taro from '@tarojs/taro';
import type { Profile, UserRole } from '@/types/profile';
import { isTabBarPage } from '@/utils/navigation';

/** 与 app.config tabBar.custom 保持一致；为 true 时不可调用 setTabBarStyle */
export const HAS_CUSTOM_TAB_BAR = true;

export const STATISTICS_TAB_INDEX = 2;

export function isFinanceTabRole(role?: UserRole | null): boolean {
  return role === 'admin' || role === 'principal';
}

/** 自定义 TabBar 实例方法（由 src/custom-tab-bar 实现） */
export interface CustomTabBarBridge {
  setSelectedByPath?: (pagePath: string) => void;
  refreshByRole?: (role?: UserRole | null) => void;
  setColors?: (colors: { color: string; selectedColor: string; backgroundColor: string }) => void;
  /** 全屏弹层打开期间让 tabBar 自身不渲染（由 src/custom-tab-bar 实现） */
  setHidden?: (hidden: boolean) => void;
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

/**
 * 全屏弹层占位申请的计数。
 *
 * 多层弹层可能叠加（如「批量处理」→「选择班级」→ 确认框），必须等最后一层释放
 * 才恢复 tabBar，否则先关闭的那层会把 tabBar 提前放出来，压住仍打开的上层弹层。
 */
let tabBarHiddenRefCount = 0;

/**
 * 申请「让自定义 TabBar 让位」，返回释放函数（幂等，可安全重复调用）。
 *
 * 为什么不让弹层靠 z-index 硬盖：
 * - 本项目 tabBar 是自定义模式（`app.config.ts` 的 `tabBar.custom = true`）。
 *   它能否被页面内容覆盖，在不同基础库/机型上表现不一致，截图实测（2026-09-28）
 *   仍会被 tabBar 压住底部内容；
 * - `Taro.hideTabBar()` 对自定义 tabBar 不生效（同次实测确认）。
 *
 * 可靠做法是让 tabBar 组件自身不渲染 —— 即微信官方文档给出的自定义 tabBar
 * 控制方式：`Taro.getTabBar(page)` 取到组件实例后改其自身状态。
 * 非 tabBar 页面取不到实例，`setHidden` 可选链自然跳过，无需特判。
 */
export function acquireTabBarHidden(): () => void {
  tabBarHiddenRefCount += 1;
  if (tabBarHiddenRefCount === 1) {
    getActiveCustomTabBar()?.setHidden?.(true);
  }

  let released = false;
  return () => {
    if (released) return;
    released = true;
    tabBarHiddenRefCount = Math.max(0, tabBarHiddenRefCount - 1);
    if (tabBarHiddenRefCount === 0) {
      getActiveCustomTabBar()?.setHidden?.(false);
    }
  };
}
