/**
 * 身份选择漏斗路径白名单（打开 store-entry 不清除 pending）
 */

/** 与 auth-onboarding 共用的 storage key（本文件不依赖 route-guard，避免循环） */
export const IDENTITY_SELECT_PENDING_KEY = 'yunce:identity-select-pending';

export const IDENTITY_ONBOARDING_PATH_MARKERS = [
  'package-auth/pages/identity-select',
  'package-auth/pages/profile-setup',
  'package-settings/pages/store-entry',
  'package-auth/pages/login',
  'package-auth/pages/register',
  'package-settings/pages/agreement',
  'package-settings/pages/about',
  'package-settings/pages/feedback',
  'package-student/pages/parent-bind',
  'package-lead/pages/invite-landing',
  'package-auth/pages/campus-invite-landing',
] as const;

/** 当前路径是否在身份选择漏斗白名单内（含 forgot* under login） */
export function isIdentityOnboardingAllowlistedPath(path: string): boolean {
  const norm = String(path || '')
    .replace(/^\//, '')
    .toLowerCase();
  if (!norm) return false;
  return IDENTITY_ONBOARDING_PATH_MARKERS.some((marker) => norm.includes(marker.toLowerCase()));
}
