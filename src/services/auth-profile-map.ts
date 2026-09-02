/**
 * Auth 后端 UserInfo / Profile 映射
 */
import type { AuthSession, Profile, UserRole } from '@/types/profile';
import { decodeAccessTokenClaims, isUuidOrganizationId, pickRealTenantId } from '@/utils/tenant-id';

export type BackendRole = 'ADMIN' | 'ASSISTANT' | 'PARENT' | 'PRINCIPAL' | 'TEACHER';

export interface BackendUserInfo {
  id: string;
  profileId: string;
  nickname: null | string;
  role: BackendRole;
  avatar: null | string;
  phone: null | string;
  email?: null | string;
  /** 主租户机构 UUID（有 ACTIVE 租户时由 BE 返回） */
  organizationId?: null | string;
  /** 主租户校区 UUID */
  campusId?: null | string;
  /** 机构展示名（仅 UI） */
  organizationName?: null | string;
  teacher?: {
    id: string;
    institution: null | string;
    inviteCode: string;
  };
  parent?: {
    id: string;
    bindStatus: string;
    relation: null | string;
    student: null | {
      id: string;
      name: string;
    };
  };
  principal?: {
    id: string;
    institution: null | string;
  };
}

export interface BackendAuthPayload {
  expiresIn: number;
  isNewUser?: boolean;
  refreshToken: string;
  shareAttached?: boolean;
  token: string;
  user: BackendUserInfo;
}

export interface BackendProfileDetailPayload {
  avatar: null | string;
  createdAt: string;
  email: null | string;
  id: string;
  nickname: null | string;
  phone: null | string;
  profileId: string;
  role: BackendRole;
  /** 主租户机构 UUID（有则优先于 base） */
  organizationId?: null | string;
  campusId?: null | string;
  organizationName?: null | string;
  teacher?: {
    id: string;
    inviteCode: string;
    institution: null | string;
    studentCount: number;
    classCount: number;
  };
  parent?: {
    id: string;
    studentId: null | string;
    studentName: null | string;
    relation: null | string;
    bindStatus: string;
  };
}

export interface AuthPayload {
  session: AuthSession | null;
  profile: Profile | null;
}

export const mapBackendRole = (role: BackendRole): UserRole => {
  switch (role) {
    case 'ADMIN':
      return 'admin';
    case 'ASSISTANT':
      return 'assistant';
    case 'PARENT':
      return 'parent';
    case 'TEACHER':
      return 'teacher';
    case 'PRINCIPAL':
    default:
      return 'principal';
  }
};

export const mapUserRoleToBackend = (role: UserRole): BackendRole => {
  switch (role) {
    case 'teacher':
      return 'TEACHER';
    case 'parent':
      return 'PARENT';
    case 'principal':
      return 'PRINCIPAL';
    default:
      throw new Error('当前仅支持注册为教师、校长或家长');
  }
};

const buildOrganizationName = (user: BackendUserInfo, role: UserRole): string => {
  if (user.organizationName?.trim()) {
    return user.organizationName.trim();
  }
  if (role === 'teacher') {
    return user.teacher?.institution?.trim() || '';
  }

  if (role === 'principal') {
    return user.principal?.institution?.trim() || '';
  }

  return user.parent?.student?.name ? `${user.parent.student.name}家长` : '';
};

/**
 * 将后端 UserInfo 映射为前端 Profile。
 * organizationId 只能来自接口真实 UUID 或 access_token claims，禁止用名称/profileId 冒充。
 */
export const mapBackendProfile = (user: BackendUserInfo, accessToken?: string | null): Profile => {
  const role = mapBackendRole(user.role);
  const organizationName = buildOrganizationName(user, role);
  const identityId = user.id;
  const jwtClaims = decodeAccessTokenClaims(accessToken);
  const forbidden = [
    user.profileId,
    user.id,
    user.nickname,
    organizationName,
    user.principal?.institution,
    user.teacher?.institution,
    user.organizationName,
  ];
  const organizationId = pickRealTenantId(
    [user.organizationId, jwtClaims.organizationId],
    forbidden,
  );
  const campusId = pickRealTenantId([user.campusId, jwtClaims.campusId], forbidden) || undefined;
  const now = new Date().toISOString();

  return {
    id: user.profileId,
    name: user.nickname?.trim() || user.phone || '未命名用户',
    nickname: user.nickname?.trim() || undefined,
    phone: user.phone ?? undefined,
    email: user.email ?? undefined,
    avatar_url: user.avatar ?? undefined,
    identities: [
      {
        id: identityId,
        role,
        organizationId,
        organizationName,
        isDefault: true,
        ...(campusId ? { campusIds: [campusId] } : {}),
      },
    ],
    currentContext: {
      identityId,
      role,
      organizationId,
      ...(campusId ? { campusId } : {}),
    },
    created_at: now,
    updated_at: now,
  };
};

const buildOrganizationNameFromProfileDetail = (
  profile: BackendProfileDetailPayload,
  fallback: string,
): string => {
  const role = mapBackendRole(profile.role);
  if (role === 'teacher') {
    return profile.teacher?.institution ?? fallback;
  }

  if (role === 'parent') {
    return profile.parent?.studentName ? `${profile.parent.studentName}家长` : fallback;
  }

  return fallback;
};

export const mergeBackendProfileDetail = (
  baseProfile: Profile,
  detail: BackendProfileDetailPayload,
): Profile => {
  // 展示名可更新；organizationId 优先 detail 真实 UUID，否则仅保留 base 中已是 UUID 的值
  const organizationName =
    detail.organizationName?.trim() ||
    buildOrganizationNameFromProfileDetail(
      detail,
      baseProfile.identities[0]?.organizationName || '',
    );
  const forbidden = [
    detail.profileId,
    detail.id,
    detail.nickname,
    organizationName,
    detail.teacher?.institution,
  ];
  const fromDetail = pickRealTenantId([detail.organizationId], forbidden);
  const previous = baseProfile.currentContext.organizationId || '';
  const organizationId = fromDetail || (isUuidOrganizationId(previous) ? previous : '');
  const campusId =
    pickRealTenantId([detail.campusId], forbidden) ||
    (isUuidOrganizationId(baseProfile.currentContext.campusId)
      ? baseProfile.currentContext.campusId
      : undefined);

  return {
    ...baseProfile,
    name: detail.nickname?.trim() || baseProfile.name,
    nickname: detail.nickname?.trim() || baseProfile.nickname,
    phone: detail.phone ?? baseProfile.phone,
    email: detail.email ?? baseProfile.email,
    avatar_url: detail.avatar ?? baseProfile.avatar_url,
    identities: baseProfile.identities.map((identity, index) =>
      index === 0
        ? {
            ...identity,
            organizationId,
            organizationName,
            ...(campusId ? { campusIds: [campusId] } : {}),
          }
        : identity,
    ),
    currentContext: {
      ...baseProfile.currentContext,
      organizationId,
      ...(campusId ? { campusId } : {}),
    },
    created_at: detail.createdAt || baseProfile.created_at,
    updated_at: new Date().toISOString(),
    teacher_profile: detail.teacher
      ? {
          id: detail.teacher.id,
          invite_code: detail.teacher.inviteCode,
          institution: detail.teacher.institution ?? undefined,
          student_count: detail.teacher.studentCount,
          class_count: detail.teacher.classCount,
        }
      : baseProfile.teacher_profile,
    parent_profile: detail.parent
      ? {
          id: detail.parent.id,
          student_id: detail.parent.studentId ?? undefined,
          student_name: detail.parent.studentName,
          relation: detail.parent.relation,
          bind_status: detail.parent.bindStatus,
        }
      : baseProfile.parent_profile,
  };
};

export const mapBackendSession = (payload: BackendAuthPayload): AuthSession => ({
  access_token: payload.token,
  refresh_token: payload.refreshToken,
  expires_at: Math.floor(Date.now() / 1000) + payload.expiresIn,
  user: {
    id: payload.user.profileId,
    phone: payload.user.phone ?? undefined,
  },
});

export const mapBackendAuthPayload = (payload: BackendAuthPayload): AuthPayload => ({
  session: mapBackendSession(payload),
  profile: mapBackendProfile(payload.user, payload.token),
});
