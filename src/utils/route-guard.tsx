/**
 * 路由守卫高阶组件
 * 对应原代码中的 withRouteGuard
 * 未登录时自动跳转登录页，登录后回跳目标路径
 */
import Taro, { useDidShow } from '@tarojs/taro';
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/utils/auth';

// 无需登录即可访问的页面
const PUBLIC_PAGES = [
  '/pages/login/index',
  '/pages/register/index',
  '/pages/agreement/index',
  '/pages/parent-bind/index',
];
const LOGIN_PAGE = '/pages/login/index';
const REDIRECT_KEY = 'loginRedirectPath';

/** 判断路径是否为 TabBar 页 */
function isTabBarPage(path: string): boolean {
  const tabBarPages = ['/pages/home/index', '/pages/statistics/index', '/pages/profile/index'];
  return tabBarPages.some((p) => path.includes(p));
}

/** 跳转到登录页并记录来源路径 */
let isRedirecting = false;
function redirectToLogin(fromPath: string) {
  if (isRedirecting) return;
  isRedirecting = true;
  Taro.setStorageSync(REDIRECT_KEY, fromPath);
  // 与原代码对齐：TabBar 页面用 navigateTo，非 TabBar 页面用 redirectTo
  if (isTabBarPage(fromPath)) {
    Taro.navigateTo({ url: LOGIN_PAGE });
  } else {
    Taro.redirectTo({ url: LOGIN_PAGE });
  }
  setTimeout(() => {
    isRedirecting = false;
  }, 100);
}

/** 登录后跳转回原页面 */
export function navigateAfterLogin() {
  const redirectPath = Taro.getStorageSync(REDIRECT_KEY) || '';
  Taro.removeStorageSync(REDIRECT_KEY);

  if (redirectPath) {
    const path = redirectPath.startsWith('/') ? redirectPath : `/${redirectPath}`;
    if (isTabBarPage(path)) {
      Taro.switchTab({ url: path });
    } else {
      Taro.redirectTo({ url: path });
    }
  } else {
    Taro.switchTab({ url: '/pages/home/index' });
  }
}

// ============================================
// 内部守卫组件
// ============================================
const RouteGuardInner: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, loading, refreshProfile } = useAuth();
  const [authorized, setAuthorized] = useState(false);

  const checkAuth = useCallback(() => {
    if (loading) {
      setAuthorized(false);
      return;
    }

    const currentInstance = Taro.getCurrentInstance();
    const currentPath = currentInstance?.router?.path || '';
    const isPublicPage = PUBLIC_PAGES.some((p) => currentPath.includes(p));

    // 已登录 或 在公开页面 → 放行
    if (profile || isPublicPage) {
      setAuthorized(true);
      return;
    }

    // 未登录且不在登录页 → 跳转登录
    if (!currentPath.includes(LOGIN_PAGE)) {
      redirectToLogin(currentPath);
    }
    setAuthorized(false);
  }, [profile, loading]);

  // 页面显示时刷新会话（检测 token 过期）
  useDidShow(() => {
    refreshProfile()
      .then(() => {
        checkAuth();
      })
      .catch(() => {
        checkAuth();
      });
  });
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (!authorized) return null;
  return <>{children}</>;
};

// ============================================
// withRouteGuard HOC
// ============================================
export function withRouteGuard<P extends object>(Component: React.FC<P>): React.FC<P> {
  const GuardedComponent = (props: P) => (
    <RouteGuardInner>
      <Component {...props} />
    </RouteGuardInner>
  );

  const displayName = Component.displayName || Component.name || 'Component';
  GuardedComponent.displayName = `withRouteGuard(${displayName})`;

  return GuardedComponent;
}
