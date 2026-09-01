/**
 * L4 门店互邀链接工具（Organization.orgReferralCode，O 前缀永久码）
 */
import Taro from '@tarojs/taro';

export const PENDING_STORE_REFERRAL_CODE_KEY = 'yunce:pending-store-referral-code';

export function normalizeOrgReferralCode(raw: string): string {
  return String(raw || '')
    .trim()
    .toUpperCase();
}

export function storePendingStoreReferralCode(code: string): void {
  const trimmed = normalizeOrgReferralCode(code);
  if (!trimmed) return;
  try {
    Taro.setStorageSync(PENDING_STORE_REFERRAL_CODE_KEY, trimmed);
  } catch {
    /* ignore */
  }
}

export function getPendingStoreReferralCode(): string {
  try {
    return String(Taro.getStorageSync(PENDING_STORE_REFERRAL_CODE_KEY) || '');
  } catch {
    return '';
  }
}

export function consumePendingStoreReferralCode(): string {
  const code = getPendingStoreReferralCode();
  if (code) {
    try {
      Taro.removeStorageSync(PENDING_STORE_REFERRAL_CODE_KEY);
    } catch {
      /* ignore */
    }
  }
  return code;
}

export function buildStoreReferralLandingPath(inviteCode: string): string {
  const code = normalizeOrgReferralCode(inviteCode);
  return `/package-settings/pages/store-referral-landing/index?code=${encodeURIComponent(code)}`;
}

/** 微信分享 path（根路径前不加 /） */
export function buildStoreReferralSharePath(inviteCode: string): string {
  const code = normalizeOrgReferralCode(inviteCode);
  return `package-settings/pages/store-referral-landing/index?code=${encodeURIComponent(code)}`;
}

export async function copyStoreReferralLink(inviteCode: string): Promise<void> {
  if (!normalizeOrgReferralCode(inviteCode)) {
    Taro.showToast({ title: '邀请码异常', icon: 'none' });
    return;
  }
  const path = buildStoreReferralLandingPath(inviteCode);
  await Taro.setClipboardData({ data: path });
  Taro.showToast({
    title: '门店互邀链接已复制',
    icon: 'none',
    duration: 2500,
  });
}
