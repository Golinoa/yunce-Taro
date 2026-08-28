/**
 * 校区员工邀请链接工具（CampusInvite.inviteCode�?
 * 与家长绑定码、员工拉新码（Teacher.inviteCode）区分�?
 */
import Taro from '@tarojs/taro';

export const PENDING_CAMPUS_INVITE_CODE_KEY = 'yunce:pending-campus-invite-code';

export function storePendingCampusInviteCode(code: string): void {
  const trimmed = (code || '').trim().toUpperCase();
  if (!trimmed) return;
  try {
    Taro.setStorageSync(PENDING_CAMPUS_INVITE_CODE_KEY, trimmed);
  } catch {
    /* ignore */
  }
}

export function getPendingCampusInviteCode(): string {
  try {
    return String(Taro.getStorageSync(PENDING_CAMPUS_INVITE_CODE_KEY) || '');
  } catch {
    return '';
  }
}

export function hasPendingCampusInviteCode(): boolean {
  return Boolean(getPendingCampusInviteCode());
}

export function consumePendingCampusInviteCode(): string {
  const code = getPendingCampusInviteCode();
  if (code) {
    try {
      Taro.removeStorageSync(PENDING_CAMPUS_INVITE_CODE_KEY);
    } catch {
      /* ignore */
    }
  }
  return code;
}

export function buildCampusInvitePath(inviteCode: string): string {
  const code = (inviteCode || '').trim().toUpperCase();
  return `/package-auth/pages/campus-invite-landing/index?code=${encodeURIComponent(code)}`;
}

export async function copyCampusInviteLink(inviteCode: string): Promise<void> {
  if (!(inviteCode || '').trim()) {
    Taro.showToast({ title: '邀请码异常', icon: 'none' });
    return;
  }

  const path = buildCampusInvitePath(inviteCode);
  const link = `package-auth/pages/index/index?redirect=${encodeURIComponent(path)}`;

  await Taro.setClipboardData({ data: link });
  Taro.showToast({
    title: '员工邀请链接已复制',
    icon: 'none',
    duration: 2500,
  });
}
