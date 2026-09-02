/**
 * Auth 会话 / 身份 / Profile 更新 / 测试账号
 */
import Taro from '@tarojs/taro';
import type {
  AuthSession,
  ParentRoleInfo,
  PrincipalRoleInfo,
  Profile,
  TeacherRoleInfo,
  UserRole,
} from '@/types/profile';
import { decodeAccessTokenClaims, pickRealTenantId } from '@/utils/tenant-id';
import { get, post, put } from '@/utils/request';
import {
  AUTH_ENDPOINTS,
  AUTH_TOKEN_KEY,
  USER_PROFILE_KEY,
  clearStoredAuth,
  type TestAccount,
} from '@/services/auth-shared';
import {
  mapBackendProfile,
  mapBackendRole,
  mergeBackendProfileDetail,
  type BackendProfileDetailPayload,
  type BackendUserInfo,
} from '@/services/auth-profile-map';

const persistLocalProfile = (profile: Profile | null): void => {
  try {
    if (!profile) {
      Taro.removeStorageSync(USER_PROFILE_KEY);
      return;
    }
    Taro.setStorageSync(USER_PROFILE_KEY, JSON.stringify(profile));
  } catch {
    /* ignore */
  }
};

const readStoredSession = (): AuthSession | null => {
  try {
    const raw = Taro.getStorageSync(AUTH_TOKEN_KEY);
    if (!raw) {
      return null;
    }

    const session = JSON.parse(raw) as AuthSession;
    if (!session?.refresh_token && !session?.access_token) {
      clearStoredAuth();
      return null;
    }

    // access 过期但 refresh 仍可用时保留 session，由 request 层静默刷新
    if (session.expires_at * 1000 <= Date.now()) {
      if (session.refresh_token) {
        return session;
      }
      clearStoredAuth();
      return null;
    }

    return session;
  } catch {
    clearStoredAuth();
    return null;
  }
};

export async function getSession(): Promise<{
  session: AuthSession | null;
  profile: Profile | null;
}> {
  try {
    const storedSession = readStoredSession();
    if (!storedSession) {
      return { session: null, profile: null };
    }

    const user = await get<BackendUserInfo>(AUTH_ENDPOINTS.me);
    const baseProfile = mapBackendProfile(user, storedSession.access_token);
    const currentRole = mapBackendRole(user.role);

    if (currentRole !== 'principal') {
      try {
        const detail = await get<BackendProfileDetailPayload>(AUTH_ENDPOINTS.profile);
        return {
          session: storedSession,
          profile: mergeBackendProfileDetail(baseProfile, detail),
        };
      } catch {
        return {
          session: storedSession,
          profile: baseProfile,
        };
      }
    }

    return {
      session: storedSession,
      profile: baseProfile,
    };
  } catch {
    clearStoredAuth();
    return { session: null, profile: null };
  }
}

export async function switchIdentity(_identityId: string): Promise<{
  profile: Profile | null;
  error: { message: string } | null;
}> {
  return { profile: null, error: { message: '真实后端联调阶段暂未开放多身份切换' } };
}

/**
 * 更新当前用户的基础资料
 * - Mock：本地持久化到 profile storage
 * - 真实接口：调用 `PUT /profile`
 */
export async function updateProfile(
  patch: Partial<Pick<Profile, 'name' | 'nickname' | 'avatar_url' | 'phone' | 'email'>> & {
    gender?: 'male' | 'female' | 'other';
    birthday?: string;
    id_card?: string;
    region?: string;
    address?: string;
  },
): Promise<{ profile: Profile | null; error: { message: string } | null }> {
  try {
    // 后端契约：nickname / avatar（不是 avatar_url）；name 写入 nickname
    const body: Record<string, unknown> = {};
    const nickname = (patch.nickname ?? patch.name)?.trim();
    if (nickname) body.nickname = nickname;
    if (patch.avatar_url !== undefined) {
      const avatar = patch.avatar_url.trim();
      if (avatar) body.avatar = avatar;
    }
    if (patch.phone !== undefined) body.phone = patch.phone;
    if (patch.email !== undefined) body.email = patch.email;
    if (patch.gender !== undefined) body.gender = patch.gender;
    if (patch.birthday !== undefined) body.birthday = patch.birthday;
    if (patch.id_card !== undefined) body.id_card = patch.id_card;
    if (patch.region !== undefined) body.region = patch.region;
    if (patch.address !== undefined) body.address = patch.address;

    const updated = await put<BackendUserInfo>(AUTH_ENDPOINTS.profile, body);
    const accessToken = readStoredSession()?.access_token;
    const mapped = mapBackendProfile(updated, accessToken);
    return { profile: mapped, error: null };
  } catch (err) {
    return {
      profile: null,
      error: { message: err instanceof Error ? err.message : '更新资料失败' },
    };
  }
}

/** 获取用户扩展资料（性别/生日等） */
export async function getProfileExtra(_userId: string): Promise<{
  gender?: 'male' | 'female' | 'other';
  birthday?: string;
  id_card?: string;
  region?: string;
  address?: string;
}> {
  // 真实接口暂未独立暴露，从 profile 中按需取
  try {
    const data = await get<{
      gender?: string;
      birthday?: string;
      id_card?: string;
      region?: string;
      address?: string;
    }>(`${AUTH_ENDPOINTS.profile}/extra`);
    const mapGender = (v?: string) =>
      v === 'male' || v === 'female' || v === 'other' ? v : undefined;
    return {
      gender: mapGender(data?.gender),
      birthday: data?.birthday,
      id_card: data?.id_card,
      region: data?.region,
      address: data?.address,
    };
  } catch {
    return {};
  }
}

export async function addIdentity(
  _role: UserRole,
  _roleInfo: PrincipalRoleInfo | TeacherRoleInfo | ParentRoleInfo,
): Promise<{ profile: Profile | null; error: { message: string } | null }> {
  return { profile: null, error: { message: '真实后端联调阶段暂未开放新增身份' } };
}

export function restoreRegisterDrafts(): void {
  // no-op：真实注册草稿仅存于本地 storage，无需 mock 恢复
}

export async function logout(): Promise<void> {
  const storedSession = readStoredSession();
  try {
    await post(
      AUTH_ENDPOINTS.logout,
      storedSession?.refresh_token ? { refreshToken: storedSession.refresh_token } : {},
      { skipAuth: !storedSession?.access_token },
    );
  } finally {
    clearStoredAuth();
  }
}

/**
 * 强制用 refresh 换新会话（门店入驻批准后注入 organizationId）。
 * BE refresh 会重新 resolve ACTIVE 主租户；成功后同步本地 Profile 与 JWT 一致。
 */
export async function refreshSessionForTenant(): Promise<{
  ok: boolean;
  error?: { message: string };
  profile?: Profile | null;
}> {
  const stored = readStoredSession();
  const refreshToken = stored?.refresh_token;
  if (!refreshToken) {
    return { ok: false, error: { message: '请重新登录后再进入机构端' } };
  }
  try {
    const data = await post<{
      token: string;
      refreshToken: string;
      expiresIn: number;
    }>(AUTH_ENDPOINTS.refresh, { refreshToken }, { skipAuth: true });
    if (!data?.token || !data.refreshToken) {
      return { ok: false, error: { message: '刷新会话失败' } };
    }
    const next = {
      ...stored,
      access_token: data.token,
      refresh_token: data.refreshToken,
      expires_at: Math.floor(Date.now() / 1000) + (data.expiresIn || 7200),
    };
    Taro.setStorageSync(AUTH_TOKEN_KEY, JSON.stringify(next));

    // 用 me + 新 JWT 重映射 Profile，确保 organizationId 与 token 同为真实 UUID
    let profile: Profile | null = null;
    try {
      const user = await get<BackendUserInfo>(AUTH_ENDPOINTS.me);
      profile = mapBackendProfile(user, data.token);
      persistLocalProfile(profile);
    } catch {
      const claims = decodeAccessTokenClaims(data.token);
      const orgId = pickRealTenantId([claims.organizationId]);
      const campusId = pickRealTenantId([claims.campusId]) || undefined;
      try {
        const raw = Taro.getStorageSync(USER_PROFILE_KEY);
        if (raw && orgId) {
          const prev = JSON.parse(raw) as Profile;
          profile = {
            ...prev,
            identities: prev.identities.map((identity, index) =>
              index === 0
                ? {
                    ...identity,
                    organizationId: orgId,
                    ...(campusId ? { campusIds: [campusId] } : {}),
                  }
                : identity,
            ),
            currentContext: {
              ...prev.currentContext,
              organizationId: orgId,
              ...(campusId ? { campusId } : {}),
            },
          };
          persistLocalProfile(profile);
        }
      } catch {
        /* ignore */
      }
    }

    return { ok: true, profile };
  } catch {
    return { ok: false, error: { message: '刷新会话失败，请重新登录' } };
  }
}

// 导出测试账号信息（Mock 模式下登录页提示用，联调时置空即可）
export const testAccounts: TestAccount[] = [];
export const testPassword = '';

export async function getTestAccounts(): Promise<TestAccount[]> {
  return [];
}

export async function getTestPassword(): Promise<string> {
  return '';
}
