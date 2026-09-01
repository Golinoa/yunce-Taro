/**
 * 邀请链接工具
 * - 家长绑定：复制小程序邀请链接（E08/E09 第三按钮）
 * - 员工招生（L2）：POST 创建 24h 临时码，落地页 invite-register?code=
 */
import Taro from '@tarojs/taro';
import { parentShareInviteService } from '@/services/parent-share-invite';
import { post } from '@/utils/request';

/** 待归属员工邀请码存储 key：分享落地页/登录页写入，注册登录完成后消费 */
export const PENDING_INVITE_CODE_KEY = 'yunce:pending-invite-code';

/** 最近一次登录 shareAttached 标记（navigateAfterAuth 消费） */
export const LAST_SHARE_ATTACHED_KEY = 'yunce:last-share-attached';

/** 规范化邀请码参数（query / scene） */
export function normalizeInviteCodeParam(raw: string): string {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/^TEACHERCODE[=:]/i, '')
    .replace(/^CODE[=:]/i, '');
}

/** 保存待归属邀请码（员工邀请码，注册/登录时作为 inviteCode 携带） */
export function storePendingInviteCode(code: string): void {
  const trimmed = (code || '').trim().toUpperCase();
  if (!trimmed) return;
  try {
    Taro.setStorageSync(PENDING_INVITE_CODE_KEY, trimmed);
  } catch {
    /* ignore */
  }
}

/** 读取待归属邀请码（不消费） */
export function getPendingInviteCode(): string {
  try {
    return String(Taro.getStorageSync(PENDING_INVITE_CODE_KEY) || '');
  } catch {
    return '';
  }
}

/** 是否存在待归属邀请码 */
export function hasPendingInviteCode(): boolean {
  return Boolean(getPendingInviteCode());
}

/** 消费待归属邀请码（读取并清除） */
export function consumePendingInviteCode(): string {
  const code = getPendingInviteCode();
  if (code) {
    try {
      Taro.removeStorageSync(PENDING_INVITE_CODE_KEY);
    } catch {
      /* ignore */
    }
  }
  return code;
}

export function markShareAttached(): void {
  try {
    Taro.setStorageSync(LAST_SHARE_ATTACHED_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function consumeShareAttached(): boolean {
  try {
    const value = Taro.getStorageSync(LAST_SHARE_ATTACHED_KEY);
    Taro.removeStorageSync(LAST_SHARE_ATTACHED_KEY);
    return value === '1' || value === true;
  } catch {
    return false;
  }
}

/** 构建员工招生落地页直链（带临时 code 参数） */
export function buildTeacherInvitePath(inviteCode: string): string {
  const code = (inviteCode || '').trim().toUpperCase();
  return `/package-auth/pages/invite-register/index?code=${encodeURIComponent(code)}`;
}

/** 创建临时邀请并复制直链（24h 有效） */
export async function copyTeacherInviteLink(options?: { extraPath?: string }): Promise<void> {
  try {
    const created = await parentShareInviteService.create();
    if (!created?.landingPath && !created?.inviteCode) {
      Taro.showToast({ title: '生成邀请链接失败', icon: 'none' });
      return;
    }

    const path =
      created.landingPath ||
      buildTeacherInvitePath(created.inviteCode) + (options?.extraPath || '');

    await Taro.setClipboardData({ data: path });
    Taro.showToast({
      title: '邀请链接已复制（24h有效，勿随意转发）',
      icon: 'none',
      duration: 2800,
    });
  } catch {
    Taro.showToast({ title: '生成邀请链接失败', icon: 'none' });
  }
}

export async function copyParentInviteLink(studentId: string): Promise<void> {
  if (!studentId) {
    Taro.showToast({ title: '学员信息异常', icon: 'none' });
    return;
  }

  try {
    const created = await post<{ token: string; expiresAt: string }>(
      `/students/${encodeURIComponent(studentId)}/parent-invite-links`,
      {},
    );
    if (!created?.token) {
      Taro.showToast({ title: '生成邀请链接失败', icon: 'none' });
      return;
    }

    const path = `/package-student/pages/parent-bind/index?studentId=${encodeURIComponent(studentId)}&token=${encodeURIComponent(created.token)}`;

    await Taro.setClipboardData({ data: path });
    Taro.showToast({
      title: '链接已复制（48h有效，勿随意转发）',
      icon: 'none',
      duration: 2800,
    });
  } catch {
    Taro.showToast({ title: '生成邀请链接失败', icon: 'none' });
  }
}
