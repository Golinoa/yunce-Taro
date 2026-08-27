/**
 * 登录后引导：完善资料 / 机构入驻 / 家长绑定
 */
import Taro from '@tarojs/taro';
import type { Profile } from '@/types/profile';
import { navigateAfterLogin } from '@/utils/route-guard';

export const LAST_LOGIN_IS_NEW_USER_KEY = 'yunce:last-login-is-new-user';
export const ONBOARDING_SKIPPED_KEY = 'yunce:onboarding-skipped';

const DEFAULT_ORG_NAMES = new Set(['好用消课', '未知机构']);

export function markLastLoginAsNewUser(): void {
  try {
    Taro.setStorageSync(LAST_LOGIN_IS_NEW_USER_KEY, '1');
  } catch {
    /* 静默 */
  }
}

export function consumeLastLoginIsNewUser(): boolean {
  try {
    const value = Taro.getStorageSync(LAST_LOGIN_IS_NEW_USER_KEY);
    Taro.removeStorageSync(LAST_LOGIN_IS_NEW_USER_KEY);
    return value === '1' || value === true;
  } catch {
    return false;
  }
}

export function markOnboardingSkipped(): void {
  try {
    Taro.setStorageSync(ONBOARDING_SKIPPED_KEY, '1');
  } catch {
    /* 静默 */
  }
}

export function hasSkippedOnboarding(): boolean {
  try {
    return Taro.getStorageSync(ONBOARDING_SKIPPED_KEY) === '1';
  } catch {
    return false;
  }
}

/** 是否需要完善头像昵称（微信一键登录新用户） */
export function needsProfileSetup(profile: Profile | null, isNewUser?: boolean): boolean {
  if (isNewUser) {
    return true;
  }
  if (!profile) {
    return false;
  }
  const displayName = profile.nickname?.trim() || profile.name?.trim();
  if (!displayName || displayName === '未命名用户') {
    return true;
  }
  return false;
}

/** 是否尚未完成业务身份（机构入驻 / 绑定孩子） */
export function needsOnboarding(profile: Profile | null): boolean {
  if (!profile || hasSkippedOnboarding()) {
    return false;
  }

  const role = profile.currentContext?.role;
  if (role === 'parent') {
    const bindStatus = profile.parent_profile?.bind_status?.toLowerCase();
    if (bindStatus === 'unbound' || bindStatus === 'pending') {
      return true;
    }
    return !profile.parent_profile?.student_id;
  }

  if (role === 'teacher') {
    return !profile.teacher_profile?.institution;
  }

  if (role === 'principal' || role === 'admin') {
    const orgName = profile.identities[0]?.organizationName?.trim();
    return !orgName || DEFAULT_ORG_NAMES.has(orgName);
  }

  return false;
}

/** 登录成功后的统一跳转 */
export function navigateAfterAuth(profile: Profile | null, options?: { isNewUser?: boolean }): void {
  if (!profile) {
    return;
  }

  if (needsProfileSetup(profile, options?.isNewUser)) {
    Taro.redirectTo({ url: '/package-auth/pages/profile-setup/index' });
    return;
  }

  if (needsOnboarding(profile)) {
    Taro.redirectTo({ url: '/package-auth/pages/onboarding/index' });
    return;
  }

  navigateAfterLogin(profile);
}

/** 完善资料后的下一步 */
export function navigateAfterProfileSetup(profile: Profile | null): void {
  navigateAfterAuth(profile, { isNewUser: false });
}
