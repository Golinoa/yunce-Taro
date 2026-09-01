/**
 * 登录后引导：完善资料 / 选择身份（门店入驻|绑定机构）/ 机构入驻 / 家长绑定 / 分享归属
 */
import Taro from '@tarojs/taro';
import type { Profile } from '@/types/profile';
import {
  IDENTITY_ONBOARDING_PATH_MARKERS,
  IDENTITY_SELECT_PENDING_KEY,
  isIdentityOnboardingAllowlistedPath,
} from '@/utils/identity-path-allowlist';
import { consumePendingInviteCode, markShareAttached, consumeShareAttached } from '@/utils/invite-parent-link';
import { markLoginOptInPending } from '@/utils/notify-master-settings';
import { navigateAfterLogin } from '@/utils/route-guard';
import { isUuidOrganizationId } from '@/utils/tenant-id';

export const LAST_LOGIN_IS_NEW_USER_KEY = 'yunce:last-login-is-new-user';
export const ONBOARDING_SKIPPED_KEY = 'yunce:onboarding-skipped';
export { IDENTITY_SELECT_PENDING_KEY };

export { IDENTITY_ONBOARDING_PATH_MARKERS, isIdentityOnboardingAllowlistedPath };

/** 有 pending 且不在白名单 → 应强制回 identity-select */
export function shouldRedirectToIdentitySelect(path: string): boolean {
  return hasIdentitySelectionPending() && !isIdentityOnboardingAllowlistedPath(path);
}

export function markLastLoginAsNewUser(): void {
  try {
    Taro.setStorageSync(LAST_LOGIN_IS_NEW_USER_KEY, '1');
    // 订阅 opt-in 延后到有机构上下文后再标记（见 markSubscribeOptInAfterTenantReady）
  } catch {
    /* 静默 */
  }
}

/** 用户完成入驻/绑机构后，进站再弹一次微信订阅授权 */
export function markSubscribeOptInAfterTenantReady(): void {
  markLoginOptInPending();
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
    // 以真实 UUID organizationId 为准，禁止用机构名 / 演示名判断
    return !isUuidOrganizationId(profile.currentContext?.organizationId);
  }

  return false;
}

/** 新用户漏斗进行中（完善资料 / 选身份 / 未绑机构）— 此阶段不应调订阅 bootstrap */
export function isOnboardingFunnelActive(profile: Profile | null, options?: { isNewUser?: boolean }): boolean {
  if (!profile) return false;
  if (needsProfileSetup(profile, options?.isNewUser)) return true;
  if (hasIdentitySelectionPending()) return true;
  return needsOnboarding(profile);
}

/** 已有真实机构上下文时才应请求 subscribe-message/bootstrap */
export function isSubscribeContextReady(profile: Profile | null): boolean {
  if (!profile?.id) return false;
  if (needsProfileSetup(profile)) return false;
  return isUuidOrganizationId(profile.currentContext?.organizationId);
}

/** 登录成功后的统一跳转
 *
 * 分流：已有真实机构上下文 → 业务首页；
 * 未绑定机构 → 选择身份（门店入驻 / 绑定机构）；
 * 分享招生归属成功 → 直接进首页（跳过选身份）。
 * 完善资料优先于身份选择。
 */
function redirectWithFailFallback(url: string): void {
  Taro.redirectTo({
    url,
    fail: () => {
      Taro.showToast({ title: '页面打开失败，请重试', icon: 'none' });
      Taro.reLaunch({
        url: '/package-auth/pages/login/index',
        fail: () => {
          Taro.showToast({ title: '请重新打开小程序', icon: 'none' });
        },
      });
    },
  });
}

export function navigateAfterAuth(
  profile: Profile | null,
  options?: { isNewUser?: boolean; shareAttached?: boolean },
): void {
  if (!profile) {
    return;
  }

  if (options?.shareAttached) {
    markShareAttached();
  }

  if (needsProfileSetup(profile, options?.isNewUser)) {
    // Keep identity-select pending across profile-setup (production funnel)
    markIdentitySelectionPending();
    redirectWithFailFallback('/package-auth/pages/profile-setup/index');
    return;
  }

  // 员工招生归属成功：跳过 identity-select（即使家长尚未绑定孩子）
  if (consumeShareAttached()) {
    consumePendingInviteCode();
    consumeIdentitySelectionPending();
    navigateAfterLogin(profile);
    return;
  }

  // 已有真实机构 / 已完成家长绑定：清残留 pending，进业务首页
  // （修复：误标 isNewUser 或上次卡在「选择身份」的老种子账号被错误拦下）
  if (!needsOnboarding(profile)) {
    clearIdentitySelectionPending();
    if (isSubscribeContextReady(profile)) {
      markSubscribeOptInAfterTenantReady();
    }
    navigateAfterLogin(profile);
    return;
  }

  // 未绑定机构：选择身份（门店入驻 | 绑定机构）
  markIdentitySelectionPending();
  redirectWithFailFallback('/package-auth/pages/identity-select/index');
}

/** After profile-setup: continue production funnel via pending identity flag */
export function navigateAfterProfileSetup(profile: Profile | null): void {
  navigateAfterAuth(profile, { isNewUser: false });
}
