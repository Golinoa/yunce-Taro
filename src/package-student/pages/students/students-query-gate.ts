import type { UserRole } from '@/types/profile';

export interface StudentQueryGateInput {
  profileId?: string | null;
  sessionUserId?: string | null;
  role?: UserRole | null;
}

/**
 * 学员列表的请求身份。
 * 冷启动时 session 通常先于 /auth/me profile 恢复，必须允许 session user
 * 作为短暂的请求身份，否则 query 会被 enabled=false 阻断。
 */
export function resolveStudentQueryGate(input: StudentQueryGateInput): {
  actorId: string | undefined;
  enabled: boolean;
} {
  const actorId = input.profileId || input.sessionUserId || undefined;
  return { actorId, enabled: Boolean(actorId) };
}
