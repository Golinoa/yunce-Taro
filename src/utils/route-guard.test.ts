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

  it('无 redirect：无身份 → 注册；单身份 → 首页；多身份 → 角色切换', () => {
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
    navigateAfterLogin(profileWithRoles(['teacher', 'parent']));
    expect(redirectTo).toHaveBeenCalledWith({ url: '/package-auth/pages/role-switch/index' });
  });
});
