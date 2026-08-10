/**
 * 路由守卫高阶组件
 * 对应原代码中的 withRouteGuard
 * 未登录时自动跳转登录页，登录后回跳目标路径
 */
import Taro, { useDidShow } from '@tarojs/taro';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Loading from '@/components/Loading';
import type { Profile } from '@/types/profile';
import { useAuth } from '@/utils/auth';
import { reportLocalDebug } from '@/utils/local-debug';
import { isTabBarPage, safeReLaunch } from '@/utils/navigation';

// 无需登录即可访问的页面
const PUBLIC_PAGES = [
  '/pages/login/index',
  '/pages/login/forgot-account/index',
  '/pages/login/forgot-password/index',
  '/pages/login/contact-support/index',
  '/pages/register/index',
  '/pages/register/role-select',
  '/pages/register/role-info',
  '/pages/agreement/index',
  '/package-settings/pages/feedback/index',
  '/package-student/pages/parent-bind/index',
];
const LOGIN_PAGE = '/pages/login/index';
const REDIRECT_KEY = 'loginRedirectPath';
const AUTH_TOKEN_KEY = 'yunce-edu-auth-token';
function hasValidStoredSession(): boolean {
  try {
    const raw = Taro.getStorageSync(AUTH_TOKEN_KEY);
    if (!raw) {
      return false;
    }

    const session = JSON.parse(raw) as { expires_at?: number };
    const expiresAt = Number(session?.expires_at ?? 0);
    return Number.isFinite(expiresAt) && expiresAt * 1000 > Date.now();
  } catch {
    return false;
  }
}

/** 跳转到登录页并记录来源路径 */
let isRedirecting = false;
function redirectToLogin(fromPath: string) {
  if (isRedirecting) return;
  isRedirecting = true;
  Taro.setStorageSync(REDIRECT_KEY, fromPath);
  // TabBar 页面不能用 navigateTo 压一个登录页，否则左滑返回会回到受保护页，
  // 又被守卫重新打回登录页，形成“首页 <-> 登录页”来回跳。
  if (isTabBarPage(fromPath)) {
    void safeReLaunch(LOGIN_PAGE);
  } else {
    void Taro.redirectTo({ url: LOGIN_PAGE });
  }
  setTimeout(() => {
    isRedirecting = false;
  }, 100);
}

/** 登录后跳转逻辑
 * 优先级：
 * 1. 若有 redirectPath，优先回原页面
 * 2. 若用户无身份，进入注册流程
 * 3. 若用户单身份，进入首页
 * 4. 若用户多身份，进入角色切换页
 */
export function navigateAfterLogin(profile?: Profile | null) {
  const redirectPath = Taro.getStorageSync(REDIRECT_KEY) || '';
  Taro.removeStorageSync(REDIRECT_KEY);

  if (redirectPath) {
    const path = redirectPath.startsWith('/') ? redirectPath : `/${redirectPath}`;
    if (isTabBarPage(path)) {
      Taro.switchTab({ url: path });
    } else {
      Taro.redirectTo({ url: path });
    }
    return;
  }

  const identities = profile?.identities || [];
  if (identities.length === 0) {
    Taro.redirectTo({ url: '/pages/register/index' });
    return;
  }
  if (identities.length === 1) {
    Taro.switchTab({ url: '/pages/home/index' });
    return;
  }
  Taro.redirectTo({ url: '/pages/role-switch/index' });
}

// ============================================
// 内部守卫组件
// ============================================
const RouteGuardInner: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, loading, refreshProfile } = useAuth();
  const [authorized, setAuthorized] = useState(false);
  const hasRefreshed = useRef(false);
  const guardStartAtRef = useRef(Date.now());

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
      // #region debug-point H3:route-guard-pass
      reportLocalDebug({
        hypothesisId: 'H3',
        location: 'src/utils/route-guard.tsx:checkAuth',
        msg: '[DEBUG] route guard pass',
        data: {
          currentPath,
          loading,
          hasProfile: Boolean(profile),
          isPublicPage,
          elapsedMs: Date.now() - guardStartAtRef.current,
        },
      });
      // #endregion
      setAuthorized(true);
      return;
    }

    // 未登录且不在登录页 → 跳转登录
    if (!currentPath.includes(LOGIN_PAGE)) {
      redirectToLogin(currentPath);
    }
    setAuthorized(false);
  }, [profile, loading]);

  // 首次加载时 refreshProfile + checkAuth
  useEffect(() => {
    guardStartAtRef.current = Date.now();
    if (!hasRefreshed.current) {
      hasRefreshed.current = true;
      // #region debug-point H3:route-guard-refresh
      reportLocalDebug({
        hypothesisId: 'H3',
        location: 'src/utils/route-guard.tsx:useEffect',
        msg: '[DEBUG] route guard refresh start',
        data: { hasProfile: Boolean(profile) },
      });
      // #endregion
      refreshProfile()
        .then(() => checkAuth())
        .catch(() => checkAuth());
    } else {
      checkAuth();
    }
  }, [checkAuth, refreshProfile, profile]);

  // 后续 useDidShow 仅做本地 token 检查，不再 refreshProfile
  useDidShow(() => {
    if (hasRefreshed.current) {
      const hasValidSession = hasValidStoredSession();
      if (!hasValidSession && !profile) {
        const currentInstance = Taro.getCurrentInstance();
        const currentPath = currentInstance?.router?.path || '';
        const isPublicPage = PUBLIC_PAGES.some((p) => currentPath.includes(p));
        if (!isPublicPage && !currentPath.includes(LOGIN_PAGE)) {
          redirectToLogin(currentPath);
        }
      } else {
        setAuthorized(true);
      }
    }
  });

  if (!authorized) {
    return (
      <Loading
        fullScreen
        size="large"
        title={loading ? '正在校验登录状态' : '正在准备页面'}
        text={loading ? '请稍候，正在恢复你的访问上下文' : '页面即将打开，请稍候'}
      />
    );
  }
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
