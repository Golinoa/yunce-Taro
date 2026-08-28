/**
 * 登录后引导：完善资料 / 选择身份（门店入驻|绑定机构）/ 机构入驻 / 家长绑定 / 分享归属
 */
import Taro from '@tarojs/taro';
import type { Profile } from '@/types/profile';
import { hasPendingInviteCode, consumePendingInviteCode } from '@/utils/invite-parent-link';
import { navigateAfterLogin } from '@/utils/route-guard';

export const LAST_LOGIN_IS_NEW_USER_KEY = 'yunce:last-login-is-new-user';
export const ONBOARDING_SKIPPED_KEY = 'yunce:onboarding-skipped';
/** 待完成「选择身份」标记：新用户未完成身份选择前保持，完成入驻/绑定后清除 */
export const IDENTITY_SELECT_PENDING_KEY = 'yunce:identity-select-pending';

const DEFAULT_ORG_NAMES = new Set(['松果排课', '未知机构']);

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

export function markIdentitySelectionPending(): void {
  try {
    Taro.setStorageSync(IDENTITY_SELECT_PENDING_KEY, '1');
  } catch {
    /* 静默 */
  }
}

export function hasIdentitySelectionPending(): boolean {
  try {
    return Taro.getStorageSync(IDENTITY_SELECT_PENDING_KEY) === '1';
  } catch {
    return false;
  }
}

export function consumeIdentitySelectionPending(): boolean {
  const has = hasIdentitySelectionPending();
  if (has) {
    try {
      Taro.removeStorageSync(IDENTITY_SELECT_PENDING_KEY);
    } catch {
      /* 静默 */
    }
  }
  return has;
}

export function clearIdentitySelectionPending(): void {
  try {
    Taro.removeStorageSync(IDENTITY_SELECT_PENDING_KEY);
  } catch {
    /* 静默 */
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

/** 微信登录新用户是否还需绑定手机号 */
export function needsWechatPhoneBind(profile: Profile | null, isNewUser?: boolean): boolean {
  if (!isNewUser) return false;
  if (!profile) return true;
  return !profile.phone?.trim();
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

/** 登录成功后的统一跳转
 *
 * 分流（R1）：新用户 → 选择身份页（门店入驻 / 绑定机构）；
 * 携带分享上下文（inviteCode/teacherCode 参数）→ 直接走归属流程（进首页弹关系确认），不经过身份选择；
 * 老用户保持现状。
 */
export function navigateAfterAuth(
  profile: Profile | null,
  options?: { isNewUser?: boolean },
): void {
  if (!profile) {
    return;
  }

  // 新用户（含上次登录未消费标记 + 尚未完成选择身份）
  const isNewUser = Boolean(options?.isNewUser) || hasIdentitySelectionPending();

  if (needsProfileSetup(profile, options?.isNewUser)) {
    Taro.redirectTo({ url: '/package-auth/pages/profile-setup/index' });
    return;
  }

  if (isNewUser) {
    // 携带员工邀请码分享上下文 → 归属流程已由注册/登录接口完成，直接进首页弹关系确认
    if (hasPendingInviteCode()) {
      consumePendingInviteCode();
      consumeIdentitySelectionPending();
      navigateAfterLogin(profile);
      return;
    }
    // 普通新用户 → 选择身份页
    markIdentitySelectionPending();
    Taro.redirectTo({ url: '/package-auth/pages/identity-select/index' });
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
