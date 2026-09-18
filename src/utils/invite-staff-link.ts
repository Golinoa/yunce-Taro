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

export async function copyCampusInviteCode(inviteCode: string): Promise<void> {
  const code = (inviteCode || '').trim().toUpperCase();
  if (!code) {
    Taro.showToast({ title: '邀请码异常', icon: 'none' });
    return;
  }

  /** 只复制纯邀请码：内部相对路径粘到微信里是纯文本，必然点不开 */
  await Taro.setClipboardData({ data: code });
  Taro.showToast({
    title: '邀请码已复制（24h有效）',
    icon: 'none',
    duration: 2500,
  });
}
