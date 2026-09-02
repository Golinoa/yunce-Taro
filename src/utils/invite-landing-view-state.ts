/**
 * 邀约落地页分态（纯函数）
 * - L1：试听课 invite-landing 主屏
 * - L2：invite-register（家长分享临时码）
 * - L3：campus-invite-landing（机构拉员工）
 */

export type ParentShareLandingView = 'expired' | 'used_invalid' | 'success_for_viewer' | 'pending';

export function resolveParentShareLandingView(
  context: { inviteStatus: string; usedByUserId?: string | null },
  currentUserId: string | null,
): ParentShareLandingView {
  if (context.inviteStatus === 'expired') return 'expired';
  if (context.inviteStatus === 'used') {
    if (currentUserId && context.usedByUserId === currentUserId) return 'success_for_viewer';
    return 'used_invalid';
  }
  return 'pending';
}

export type CampusInviteLandingView = 'expired' | 'used_invalid' | 'success_for_viewer' | 'pending';

export function resolveCampusInviteLandingView(
  preview: { status: string; expireAt: string; usedByUserId?: string | null },
  currentUserId: string | null,
  now = Date.now(),
): CampusInviteLandingView {
  const isExpired = preview.status === 'EXPIRED' || new Date(preview.expireAt).getTime() <= now;
  if (isExpired) return 'expired';
  if (preview.status === 'USED') {
    if (currentUserId && preview.usedByUserId === currentUserId) return 'success_for_viewer';
    return 'used_invalid';
  }
  return 'pending';
}

/** L1 试听邀约主屏 */
export type TrialInviteLandingScreen = 'boot' | 'staff_blocked' | 'login_gate' | 'success' | 'main';

export function resolveTrialInviteLandingScreen(input: {
  bootstrapped: boolean;
  authLoading: boolean;
  staffBlocked: boolean;
  needLoginGate: boolean;
  success: boolean;
}): TrialInviteLandingScreen {
  if (!input.bootstrapped || input.authLoading) return 'boot';
  if (input.staffBlocked) return 'staff_blocked';
  if (input.needLoginGate) return 'login_gate';
  if (input.success) return 'success';
  return 'main';
}

/** 是否需要全屏登录门（须先微信登录再看内容） */
export function resolveTrialInviteNeedLoginGate(input: {
  bootstrapped: boolean;
  guestMode: boolean;
  hasSession: boolean;
  staffBlocked: boolean;
  success: boolean;
}): boolean {
  return (
    input.bootstrapped &&
    !input.guestMode &&
    !input.hasSession &&
    !input.staffBlocked &&
    !input.success
  );
}
