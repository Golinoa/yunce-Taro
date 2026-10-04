import Taro from '@tarojs/taro';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Profile, UserRole } from '@/types/profile';
import {
  getProfileRoles,
  LOGIN_REDIRECT_KEY,
  navigateAfterLogin,
  PAGE_ROLE_REQUIREMENTS,
  requireRole,
} from '@/utils/route-guard';

function profileWithRoles(roles: UserRole[], current?: UserRole): Profile {
  return {
    identities: roles.map((role, i) => ({
      id: `id-${i}`,
      role,
      organizationId: 'org-1',
      organizationName: '机构',
      isDefault: i === 0,
    })),
    currentContext: current
      ? {
          identityId: 'id-0',
          role: current,
          organizationId: 'org-1',
          campusId: 'c1',
        }
      : ({
          identityId: 'id-0',
          role: roles[0],
          organizationId: 'org-1',
          campusId: 'c1',
        } as Profile['currentContext']),
    id: 'p1',
    name: '测试',
    created_at: '',
    updated_at: '',
  };
}

describe('route-guard role helpers (Q3-5)', () => {
  it('getProfileRoles merges identities and currentContext', () => {
    expect(getProfileRoles(null)).toEqual([]);
    expect(getProfileRoles(profileWithRoles(['teacher'], 'admin')).sort()).toEqual(
      ['admin', 'teacher'].sort(),
    );
  });

  it('requireRole allows empty allowed; otherwise any matching role', () => {
    const profile = profileWithRoles(['teacher']);
    expect(requireRole(undefined, profile)).toBe(true);
    expect(requireRole([], profile)).toBe(true);
    expect(requireRole(['admin', 'principal'], profile)).toBe(false);
    expect(requireRole(['teacher', 'admin'], profile)).toBe(true);
  });

  it('无权限路径：家长不可进管理端薪资；教师不可进家长专属页', () => {
    const parent = profileWithRoles(['parent']);
    const teacher = profileWithRoles(['teacher']);
    const salaryReq = PAGE_ROLE_REQUIREMENTS['package-teacher/pages/salary-home/index'];
    const childrenReq = PAGE_ROLE_REQUIREMENTS['package-student/pages/children/index'];

    expect(requireRole(salaryReq, parent)).toBe(false);
    expect(requireRole(salaryReq, profileWithRoles(['principal']))).toBe(true);
    expect(requireRole(childrenReq, teacher)).toBe(false);
    expect(requireRole(childrenReq, parent)).toBe(true);
  });

  it('门店入驻页不对已登录教师做管理员角色拦截（入驻漏斗申请人未必是 principal）', () => {
    expect(PAGE_ROLE_REQUIREMENTS['package-settings/pages/store-entry/index']).toBeUndefined();
    expect(
      PAGE_ROLE_REQUIREMENTS['package-settings/pages/store-entry/pending/index'],
    ).toBeUndefined();
  });

  it('未登录语义：null profile 对任何角色要求均失败', () => {
    expect(requireRole(['admin'], null)).toBe(false);
    expect(requireRole(['parent'], undefined)).toBe(false);
    expect(requireRole([], null)).toBe(true);
  });
});

describe('navigateAfterLogin', () => {
  const switchTab = vi.fn();
  const redirectTo = vi.fn();

  beforeEach(() => {
    switchTab.mockClear();
    redirectTo.mockClear();
    (Taro as unknown as { switchTab: typeof switchTab }).switchTab = switchTab;
    (Taro as unknown as { redirectTo: typeof redirectTo }).redirectTo = redirectTo;
    Taro.removeStorageSync(LOGIN_REDIRECT_KEY);
  });

  it('有 redirectPath（非 Tab）→ redirectTo 原路径并清 key', () => {
    Taro.setStorageSync(LOGIN_REDIRECT_KEY, 'package-auth/pages/campus-invite-landing/index');
    navigateAfterLogin(profileWithRoles(['teacher']));
    expect(redirectTo).toHaveBeenCalledWith({
      url: '/package-auth/pages/campus-invite-landing/index',
    });
    expect(Taro.getStorageSync(LOGIN_REDIRECT_KEY) || '').toBe('');
  });

  it('有 redirectPath（Tab 首页）→ switchTab', () => {
    Taro.setStorageSync(LOGIN_REDIRECT_KEY, '/pages/home/index');
    navigateAfterLogin(profileWithRoles(['teacher']));
    expect(switchTab).toHaveBeenCalledWith({ url: '/pages/home/index' });
  });

  it('无 redirect：无身份 → 注册；单身份 → 首页；多身份 → 首页（不再进未实现的角色切换页）', () => {
    navigateAfterLogin({
      ...profileWithRoles(['teacher']),
      identities: [],
    });
    expect(redirectTo).toHaveBeenCalledWith({ url: '/package-auth/pages/register/index' });

    redirectTo.mockClear();
    switchTab.mockClear();
    navigateAfterLogin(profileWithRoles(['teacher']));
    expect(switchTab).toHaveBeenCalledWith({ url: '/pages/home/index' });

    switchTab.mockClear();
    redirectTo.mockClear();
    navigateAfterLogin(profileWithRoles(['teacher', 'parent']));
    // 多身份不再重定向到 package-auth/pages/role-switch：该页的 switchIdentity
    // 是空桩，会只弹「暂未开放多身份切换」。切换入口统一为首页校区卡片。
    expect(switchTab).toHaveBeenCalledWith({ url: '/pages/home/index' });
    expect(redirectTo).not.toHaveBeenCalledWith({
      url: '/package-auth/pages/role-switch/index',
    });
  });

  /**
   * 回归（2026-10-04 用户报「微信登录后直接落进入驻页、进不去主页」）：
   *
   * 入驻表单页在「未登录点提交」时会把 LOGIN_REDIRECT_KEY 写成入驻页自身
   * （`store-entry/index.tsx`，为的是登录后回来接着填）。已入驻用户一旦带上这份
   * 残留回跳，登录后就会被它直接送进入驻页、跳过首页。
   * 有机构时必须忽略该回跳。
   */
  it('已有机构 + 回跳=入驻页 → 忽略回跳，进首页（防劫持）', () => {
    Taro.setStorageSync(LOGIN_REDIRECT_KEY, '/package-settings/pages/store-entry/index');
    navigateAfterLogin(profileWithRoles(['principal']));
    expect(redirectTo).not.toHaveBeenCalled();
    expect(switchTab).toHaveBeenCalledWith({ url: '/pages/home/index' });
    // 无论是否采用，key 都必须被消费掉，避免下次登录继续劫持
    expect(Taro.getStorageSync(LOGIN_REDIRECT_KEY) || '').toBe('');
  });

  it('已有机构 + 回跳=入驻进度页 → 同样忽略', () => {
    Taro.setStorageSync(LOGIN_REDIRECT_KEY, '/package-settings/pages/store-entry/pending/index');
    navigateAfterLogin(profileWithRoles(['principal']));
    expect(redirectTo).not.toHaveBeenCalled();
    expect(switchTab).toHaveBeenCalledWith({ url: '/pages/home/index' });
  });

  it('无机构 + 回跳=入驻页 → 照旧回入驻页（原有「登录后继续填表」设计不受影响）', () => {
    const noOrg = profileWithRoles(['principal']);
    noOrg.currentContext = { ...noOrg.currentContext, organizationId: '' };
    Taro.setStorageSync(LOGIN_REDIRECT_KEY, '/package-settings/pages/store-entry/index');
    navigateAfterLogin(noOrg);
    expect(redirectTo).toHaveBeenCalledWith({
      url: '/package-settings/pages/store-entry/index',
    });
    expect(switchTab).not.toHaveBeenCalled();
  });

  it('已有机构 + 回跳=其它页 → 回跳优先级不变（只拦入驻漏斗）', () => {
    Taro.setStorageSync(LOGIN_REDIRECT_KEY, '/package-auth/pages/campus-invite-landing/index');
    navigateAfterLogin(profileWithRoles(['principal']));
    expect(redirectTo).toHaveBeenCalledWith({
      url: '/package-auth/pages/campus-invite-landing/index',
    });
    expect(switchTab).not.toHaveBeenCalled();
  });
});
