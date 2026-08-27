/**
 * 邀请链接工具
 * - 家长绑定：复制小程序邀请链接（E08/E09 第三按钮）
 * - 员工邀请（P1-1）：生成携带 teacherCode（员工邀请码）的分享链接，
 *   落地页解析 → 登录/注册带 inviteCode，注册后归属该机构/员工
 */
import Taro from '@tarojs/taro';

/** 待归属员工邀请码存储 key：分享落地页/登录页写入，注册登录完成后消费 */
export const PENDING_INVITE_CODE_KEY = 'yunce:pending-invite-code';

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

/** 是否存在待归属邀请码（navigateAfterAuth 据此判断是否跳过身份选择） */
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

/** 构建员工邀请落地页路径（带 teacherCode 参数） */
export function buildTeacherInvitePath(teacherCode: string): string {
  const code = (teacherCode || '').trim().toUpperCase();
  return `/package-lead/pages/invite-landing/index?teacherCode=${encodeURIComponent(code)}`;
}

/** 复制员工邀请链接（P1-1）：携带机构 + 员工邀请码 */
export async function copyTeacherInviteLink(
  teacherCode: string,
  options?: { extraPath?: string },
): Promise<void> {
  if (!(teacherCode || '').trim()) {
    Taro.showToast({ title: '邀请码异常', icon: 'none' });
    return;
  }

  const path = buildTeacherInvitePath(teacherCode) + (options?.extraPath || '');
  const link = `package-auth/pages/index/index?redirect=${encodeURIComponent(path)}`;

  await Taro.setClipboardData({ data: link });
  Taro.showToast({
    title: '邀请链接已复制，注册后自动归属到你',
    icon: 'none',
    duration: 2500,
  });
}

export async function copyParentInviteLink(studentId: string): Promise<void> {
  if (!studentId) {
    Taro.showToast({ title: '学员信息异常', icon: 'none' });
    return;
  }

  const token = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const path = `/package-student/pages/parent-bind/index?studentId=${encodeURIComponent(studentId)}&token=${encodeURIComponent(token)}`;
  const link = `package-auth/pages/index/index?redirect=${encodeURIComponent(path)}`;

  await Taro.setClipboardData({ data: link });
  Taro.showToast({
    title: '邀请链接已复制，请发送给家长',
    icon: 'none',
    duration: 2500,
  });
}
