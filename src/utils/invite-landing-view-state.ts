/** L2 invite-register / L3 campus-invite-landing 落地页分态（纯函数，便于验收测试） */

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
