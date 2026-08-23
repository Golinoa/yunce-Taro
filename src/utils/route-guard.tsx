/**
 * 路由守卫高阶组件
 * 对应原代码中的 withRouteGuard
 * 未登录时自动跳转登录页，登录后回跳目标路径
 */
import Taro, { useDidShow } from '@tarojs/taro';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Loading from '@/components/Loading';
import { getPermissionConfig } from '@/services/permission';
import { defaultRoleGrant, type DataModule } from '@/types/permission';
import type { Profile, UserRole } from '@/types/profile';
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

// ============================================
// C-01 角色 / 权限守卫基础设施
// ============================================

/** 管理角色：机构创建者 admin / 校长 principal，拥有校区全量数据查看权限 */
const MANAGER_ROLES: UserRole[] = ['admin', 'principal'];
/** 机构端角色：管理 + 教学（teacher/assistant 默认仅本人名下数据，由数据层按 scope 过滤） */
const STAFF_ROLES: UserRole[] = ['admin', 'principal', 'teacher', 'assistant'];

/**
 * 页面 → 允许访问的角色集合（2026-08-22 用户口径确认）。
 * 未列出的页面对所有已登录用户开放（含家长端页面）；列出的页面仅允许其中角色访问。
 * 权限体系的类型基座与规划见 types/permission.ts（ROLE_PERMISSION_MAP/DataScope/DataModule），
 * 待「权限分配 UI」落地后，页面访问将由 grantedModules 开关动态推导，本矩阵届时收敛为入口清单。
 * 数据范围过滤（teacher 看自己的学生、家长只看绑定孩子）由数据层 filterXxxByActor 承担。
 */
export const PAGE_ROLE_REQUIREMENTS: Record<string, UserRole[]> = {
  // —— 薪资管理（仅 admin/principal；teacher 仅本人薪资详情） ——
  'package-teacher/pages/salary-home/index': MANAGER_ROLES,
  'package-teacher/pages/salary-payment/index': MANAGER_ROLES,
  'package-teacher/pages/salary-adjust/index': MANAGER_ROLES,
  'package-teacher/pages/salary-settings/index': MANAGER_ROLES,
  'package-teacher/pages/salary-template/index': MANAGER_ROLES,
  'package-teacher/pages/salary-template-form/index': MANAGER_ROLES,
  'package-teacher/pages/salary-form/index': MANAGER_ROLES,
  'package-teacher/pages/salary-detail/index': STAFF_ROLES,
  // —— 教师 / 员工管理（仅 admin/principal） ——
  'package-teacher/pages/teacher-list/index': MANAGER_ROLES,
  'package-teacher/pages/teacher-form/index': MANAGER_ROLES,
  'package-teacher/pages/teacher-detail/index': MANAGER_ROLES,
  'package-teacher/pages/attendance/index': STAFF_ROLES,
  // —— 学员管理（机构端 STAFF；teacher/assistant 默认 own 范围由数据层过滤） ——
  'package-student/pages/students/index': STAFF_ROLES,
  'package-student/pages/student-detail/index': STAFF_ROLES,
  'package-student/pages/student-form/index': STAFF_ROLES,
  'package-student/pages/student-transfer/index': STAFF_ROLES,
  'package-student/pages/member-card-issue/index': STAFF_ROLES,
  'package-student/pages/member-card-edit/index': STAFF_ROLES,
  'package-student/pages/follow-record-form/index': STAFF_ROLES,
  // —— 课程 / 班级（教学角色可进；配置类仅管理角色） ——
  'package-course/pages/classes/index': STAFF_ROLES,
  'package-course/pages/class-detail/index': STAFF_ROLES,
  'package-course/pages/class-form/index': MANAGER_ROLES,
  'package-course/pages/course-management/index': MANAGER_ROLES,
  'package-course/pages/subject-management/index': MANAGER_ROLES,
  'package-course/pages/subject-form/index': MANAGER_ROLES,
  'package-course/pages/card-management/index': MANAGER_ROLES,
  'package-course/pages/card-form/index': MANAGER_ROLES,
  'package-course/pages/card-member-list/index': STAFF_ROLES,
  'package-course/pages/category-form/index': MANAGER_ROLES,
  'package-course/pages/course-form/index': MANAGER_ROLES,
  // —— 经营数据看板（仅 admin/principal；家长与教学角色不可见） ——
  'pages/statistics/index': MANAGER_ROLES,
  'pages/finance-data/index': MANAGER_ROLES,
  'pages/member-data/index': MANAGER_ROLES,
  'pages/card-data/index': MANAGER_ROLES,
  'pages/salary-data/index': MANAGER_ROLES,
  'pages/record-transaction/index': MANAGER_ROLES,
  // —— 门店入驻（仅 admin/principal） ——
  'pages/store-entry/index': MANAGER_ROLES,
};

/**
 * 页面 → 数据模块（授权开关粒度）。
 * 角色门槛通过后，再按管理员对当前角色的模块授权动态放行
 * （读 permissionService.getPermissionConfig() 的 grants，未覆盖则用 ROLE_PERMISSION_MAP 默认）。
 */
const PAGE_MODULE_MAP: Record<string, DataModule> = {
  'package-teacher/pages/salary-home/index': 'salary',
  'package-teacher/pages/salary-payment/index': 'salary',
  'package-teacher/pages/salary-adjust/index': 'salary',
  'package-teacher/pages/salary-settings/index': 'salary',
  'package-teacher/pages/salary-template/index': 'salary',
  'package-teacher/pages/salary-template-form/index': 'salary',
  'package-teacher/pages/salary-form/index': 'salary',
  'package-teacher/pages/salary-detail/index': 'salary',
  'package-teacher/pages/attendance/index': 'classes',
  'package-student/pages/students/index': 'students',
  'package-student/pages/student-detail/index': 'students',
  'package-student/pages/student-form/index': 'students',
  'package-student/pages/student-transfer/index': 'students',
  'package-student/pages/member-card-issue/index': 'students',
  'package-student/pages/member-card-edit/index': 'students',
  'package-student/pages/follow-record-form/index': 'students',
  'package-course/pages/classes/index': 'classes',
  'package-course/pages/class-detail/index': 'classes',
  'package-course/pages/class-form/index': 'classes',
  'package-course/pages/course-management/index': 'classes',
  'package-course/pages/subject-management/index': 'classes',
  'package-course/pages/subject-form/index': 'classes',
  'package-course/pages/card-management/index': 'classes',
  'package-course/pages/card-form/index': 'classes',
  'package-course/pages/card-member-list/index': 'students',
  'package-course/pages/category-form/index': 'classes',
  'package-course/pages/course-form/index': 'classes',
  'pages/statistics/index': 'finance',
  'pages/finance-data/index': 'finance',
  'pages/member-data/index': 'finance',
  'pages/card-data/index': 'finance',
  'pages/salary-data/index': 'finance',
  'pages/record-transaction/index': 'finance',
  'pages/store-entry/index': 'settings',
};

/** 模块授权校验：读持久化的 grants（系统角色覆盖），未覆盖回退角色默认 */
function hasModuleAccess(profile: Profile | null | undefined, module: DataModule): boolean {
  if (!profile) return false;
  const role = profile.currentContext?.role;
  const config = getPermissionConfig();
  const grant = config.grants[role];
  const modules =
    grant && grant.modules.length > 0 ? grant.modules : defaultRoleGrant(role).modules;
  return modules.includes(module);
}

/** 取用户全部角色（合并 identities 与 currentContext） */
export function getProfileRoles(profile?: Profile | null): UserRole[] {
  if (!profile) return [];
  const set = new Set<UserRole>();
  profile.identities?.forEach((i) => set.add(i.role));
  if (profile.currentContext?.role) set.add(profile.currentContext.role);
  return Array.from(set);
}

/** 角色校验：allowed 为空表示无需特定角色；否则用户需拥有其中任一角色 */
export function requireRole(allowed: UserRole[] | undefined, profile?: Profile | null): boolean {
  if (!allowed || allowed.length === 0) return true;
  const roles = getProfileRoles(profile);
  return roles.some((r) => allowed.includes(r));
}

/** 越权时跳回首页并提示（与登录跳转同理加单次守卫，避免抖动） */
let isRedirectingForbidden = false;
function redirectToForbidden() {
  if (isRedirectingForbidden) return;
  isRedirectingForbidden = true;
  Taro.showToast({ title: '无权限访问该页面', icon: 'none' });
  Taro.switchTab({ url: '/pages/home/index' });
  setTimeout(() => {
    isRedirectingForbidden = false;
  }, 200);
}

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
    const normPath = currentPath.replace(/^\//, '');

    // 未登录且不在公开页 → 跳转登录
    if (!profile && !isPublicPage) {
      if (!currentPath.includes(LOGIN_PAGE)) {
        redirectToLogin(currentPath);
      }
      setAuthorized(false);
      return;
    }

    // C-01 授权：已登录用户做角色校验，越权页面（如家长访问薪资页）阻断并回首页
    if (profile) {
      const required = PAGE_ROLE_REQUIREMENTS[normPath];
      if (required && !requireRole(required, profile)) {
        redirectToForbidden();
        setAuthorized(false);
        return;
      }
      // 授权开关：角色门槛通过后，再按 admin 对当前角色的模块授权动态放行
      const pageModule = PAGE_MODULE_MAP[normPath];
      if (pageModule && !hasModuleAccess(profile, pageModule)) {
        redirectToForbidden();
        setAuthorized(false);
        return;
      }
    }

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

// ============================================
// withPermission HOC（C-01 页面级权限守卫）
// ============================================

/**
 * 页面级权限守卫：按 requiredRoles 校验当前用户角色。
 * 无权限时提示并跳回首页；与 RouteGuardInner 的中央越权拦截互为补充
 * （中央守卫兜底 URL 直跳，本 HOC 可精确控制单个页面/组件）。
 */
export function withPermission<P extends object>(
  requiredRoles: UserRole[],
  Component: React.FC<P>,
): React.FC<P> {
  const GuardedComponent = (props: P) => {
    const { profile, loading } = useAuth();

    if (loading) {
      return <Loading fullScreen size="large" title="正在校验权限" />;
    }

    if (!requireRole(requiredRoles, profile)) {
      // 越权：提示并回首页（与中央守卫同口径），渲染期间保持 Loading 占位
      redirectToForbidden();
      return <Loading fullScreen title="无权限" text="正在返回首页" />;
    }

    return <Component {...props} />;
  };

  const displayName = Component.displayName || Component.name || 'Component';
  GuardedComponent.displayName = `withPermission(${displayName})`;

  return GuardedComponent;
}
