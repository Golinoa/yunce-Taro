/**
 * 认证 Service 层
 * 所有认证相关请求统一通过此处，真实 API 联调时只改此处即可
 */
import Taro from '@tarojs/taro';
import {
  mockCheckLoginAccount,
  mockPrepareEmailLogin,
  mockLoginByEmailCode,
  mockPrepareAccountRecovery,
  mockRecoverAccountByEmailCode,
  mockPreparePasswordReset,
  mockResetPasswordByEmailCode,
  mockLogin,
  mockWechatLogin,
  mockPhoneLogin,
  mockRegisterStep1,
  mockRegisterStep2,
  mockRegisterStep3,
  mockVerifyCampusCode,
  mockVerifyStudentCode,
  mockValidateInviteCode,
  mockGetSession,
  mockSwitchIdentity,
  mockAddIdentity,
  mockRestoreRegisterDrafts,
  mockLogout,
} from '@/data/auth';
import { TEST_ACCOUNTS, TEST_PASSWORD } from '@/data/mock-database';
import type { TestAccount } from '@/data/mock-database';
import type {
  AuthSession,
  Profile,
  UserRole,
  ParentRoleInfo,
  PrincipalRoleInfo,
  RegisterDraft,
  TeacherRoleInfo,
} from '@/types/profile';
import { get, post } from '@/utils/request';

type BackendRole = 'ADMIN' | 'ASSISTANT' | 'PARENT' | 'PRINCIPAL' | 'TEACHER';

const USE_MOCK =
  typeof process !== 'undefined' && typeof process.env !== 'undefined'
    ? process.env.VITE_USE_MOCK !== 'false'
    : true;

const AUTH_TOKEN_KEY = 'yunce-edu-auth-token';
const USER_PROFILE_KEY = 'yunce-edu-user-profile';

const AUTH_ENDPOINTS = {
  login: '/auth/login',
  me: '/auth/me',
  logout: '/auth/logout',
  phoneLogin: '/auth/phone-login',
  profile: '/profile',
  switchRole: '/auth/switch-role',
  wechatLogin: '/auth/wechat-login',
} as const;

interface BackendUserInfo {
  id: string;
  profileId: string;
  nickname: null | string;
  role: BackendRole;
  avatar: null | string;
  phone: null | string;
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

interface BackendAuthPayload {
  expiresIn: number;
  refreshToken: string;
  token: string;
  user: BackendUserInfo;
}

interface BackendProfileDetailPayload {
  avatar: null | string;
  createdAt: string;
  email: null | string;
  id: string;
  nickname: null | string;
  phone: null | string;
  profileId: string;
  role: BackendRole;
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

interface AuthPayload {
  session: AuthSession | null;
  profile: Profile | null;
}

export const authCapabilities = {
  supportsAccountPasswordLogin: USE_MOCK,
  supportsEmailCodeLogin: USE_MOCK,
  supportsPhoneLogin: USE_MOCK,
  supportsWechatLogin: true,
} as const;

const clearStoredAuth = (): void => {
  try {
    Taro.removeStorageSync(AUTH_TOKEN_KEY);
    Taro.removeStorageSync(USER_PROFILE_KEY);
    Taro.removeStorageSync('userRole');
  } catch {
    // ignore storage cleanup errors
  }
};

const mapBackendRole = (role: BackendRole): UserRole => {
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

const buildOrganizationName = (user: BackendUserInfo, role: UserRole): string => {
  if (role === 'teacher') {
    return user.teacher?.institution ?? '好用消课';
  }

  if (role === 'principal') {
    return user.principal?.institution ?? '好用消课';
  }

  return user.parent?.student?.name ? `${user.parent.student.name}家长` : '好用消课';
};

const mapBackendProfile = (user: BackendUserInfo): Profile => {
  const role = mapBackendRole(user.role);
  const organizationName = buildOrganizationName(user, role);
  const identityId = user.id;
  const organizationId = organizationName || user.profileId;
  const now = new Date().toISOString();

  return {
    id: user.profileId,
    name: user.nickname?.trim() || user.phone || '未命名用户',
    nickname: user.nickname?.trim() || undefined,
    phone: user.phone ?? undefined,
    avatar_url: user.avatar ?? undefined,
    identities: [
      {
        id: identityId,
        role,
        organizationId,
        organizationName,
        isDefault: true,
      },
    ],
    currentContext: {
      identityId,
      role,
      organizationId,
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

const mergeBackendProfileDetail = (
  baseProfile: Profile,
  detail: BackendProfileDetailPayload,
): Profile => {
  const organizationName = buildOrganizationNameFromProfileDetail(
    detail,
    baseProfile.identities[0]?.organizationName || baseProfile.currentContext.organizationId,
  );
  const organizationId = organizationName || baseProfile.currentContext.organizationId;

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
          }
        : identity,
    ),
    currentContext: {
      ...baseProfile.currentContext,
      organizationId,
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

const mapBackendSession = (payload: BackendAuthPayload): AuthSession => ({
  access_token: payload.token,
  refresh_token: payload.refreshToken,
  expires_at: Math.floor(Date.now() / 1000) + payload.expiresIn,
  user: {
    id: payload.user.profileId,
    phone: payload.user.phone ?? undefined,
  },
});

const mapBackendAuthPayload = (payload: BackendAuthPayload): AuthPayload => ({
  session: mapBackendSession(payload),
  profile: mapBackendProfile(payload.user),
});

const readStoredSession = (): AuthSession | null => {
  try {
    const raw = Taro.getStorageSync(AUTH_TOKEN_KEY);
    if (!raw) {
      return null;
    }

    const session = JSON.parse(raw) as AuthSession;
    if (!session?.access_token || !session?.expires_at || session.expires_at * 1000 <= Date.now()) {
      clearStoredAuth();
      return null;
    }

    return session;
  } catch {
    clearStoredAuth();
    return null;
  }
};

export interface LoginAccountCheckResult {
  exists: boolean;
  account: string;
  maskedEmail?: string;
  hasBoundEmail: boolean;
  error: { message: string } | null;
}

export interface EmailLoginPrepareResult {
  status: 'ready' | 'account_not_found' | 'email_not_found' | 'email_not_bound';
  email?: string;
  maskedEmail?: string;
  error: { message: string } | null;
}

export interface AccountRecoveryPrepareResult {
  status: 'ready' | 'email_not_found';
  email?: string;
  maskedEmail?: string;
  error: { message: string } | null;
}

export interface AccountRecoveryResult {
  account: string | null;
  maskedEmail?: string;
  error: { message: string } | null;
}

export interface PasswordResetPrepareResult {
  status: 'ready' | 'account_not_found' | 'email_not_bound';
  account?: string;
  email?: string;
  maskedEmail?: string;
  error: { message: string } | null;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

// ============================================
// 登录相关
// ============================================

export interface LoginResult {
  session: AuthSession | null;
  profile: Profile | null;
  error: { message: string } | null;
}

export async function login(username: string, password: string): Promise<LoginResult> {
  if (USE_MOCK) return mockLogin(username, password);
  return {
    session: null,
    profile: null,
    error: { message: '当前真实后端联调口径暂不支持账号密码登录，请优先使用微信登录或手机号登录' },
  };
}

export async function wechatLogin(code: string): Promise<LoginResult> {
  if (USE_MOCK) return mockWechatLogin(code);
  try {
    const data = await post<BackendAuthPayload>(AUTH_ENDPOINTS.wechatLogin, { code });
    const mapped = mapBackendAuthPayload(data);
    return { session: mapped.session, profile: mapped.profile, error: null };
  } catch (error) {
    return {
      session: null,
      profile: null,
      error: { message: getErrorMessage(error, '微信登录失败') },
    };
  }
}

export async function phoneLogin(phone: string, code: string): Promise<LoginResult> {
  if (USE_MOCK) return mockPhoneLogin(phone, code);
  try {
    const data = await post<BackendAuthPayload>(AUTH_ENDPOINTS.phoneLogin, { phone, code });
    const mapped = mapBackendAuthPayload(data);
    return { session: mapped.session, profile: mapped.profile, error: null };
  } catch (error) {
    return {
      session: null,
      profile: null,
      error: { message: getErrorMessage(error, '手机号登录失败') },
    };
  }
}

export async function checkLoginAccount(account: string): Promise<LoginAccountCheckResult> {
  if (USE_MOCK) return mockCheckLoginAccount(account);
  return {
    exists: false,
    account: account.trim(),
    hasBoundEmail: false,
    error: { message: '账户校验服务暂未接通，请稍后再试' },
  };
}

export async function prepareEmailLogin(
  identifier: string,
  mode: 'account' | 'email',
): Promise<EmailLoginPrepareResult> {
  if (USE_MOCK) return mockPrepareEmailLogin(identifier, mode);
  return {
    status: mode === 'email' ? 'email_not_found' : 'account_not_found',
    error: { message: '邮箱验证码服务暂未接通，请稍后再试' },
  };
}

export async function loginByEmailCode(email: string, code: string): Promise<LoginResult> {
  if (USE_MOCK) return mockLoginByEmailCode(email, code);
  return {
    session: null,
    profile: null,
    error: { message: '邮箱验证码登录服务暂未接通，请稍后再试' },
  };
}

export async function prepareAccountRecovery(email: string): Promise<AccountRecoveryPrepareResult> {
  if (USE_MOCK) return mockPrepareAccountRecovery(email);
  return {
    status: 'email_not_found',
    error: { message: '账号找回服务暂未接通，请稍后再试' },
  };
}

export async function recoverAccountByEmailCode(
  email: string,
  code: string,
): Promise<AccountRecoveryResult> {
  if (USE_MOCK) return mockRecoverAccountByEmailCode(email, code);
  return {
    account: null,
    error: { message: '账号找回服务暂未接通，请稍后再试' },
  };
}

export async function preparePasswordReset(account: string): Promise<PasswordResetPrepareResult> {
  if (USE_MOCK) return mockPreparePasswordReset(account);
  return {
    status: 'account_not_found',
    error: { message: '密码重置服务暂未接通，请稍后再试' },
  };
}

export async function resetPasswordByEmailCode(
  account: string,
  code: string,
  newPassword: string,
): Promise<{ error: { message: string } | null }> {
  if (USE_MOCK) return mockResetPasswordByEmailCode(account, code, newPassword);
  return {
    error: { message: '密码重置服务暂未接通，请稍后再试' },
  };
}

// ============================================
// 注册相关（基于草稿 token 的分步注册）
// ============================================

export interface RegisterStep1Result {
  tempToken: string | null;
  error: { message: string } | null;
}

export async function registerStep1(
  username: string,
  password: string,
  inviteCode?: string,
): Promise<RegisterStep1Result> {
  if (USE_MOCK) return mockRegisterStep1(username, password, inviteCode);
  return { tempToken: null, error: { message: '注册服务暂未接通，请稍后再试' } };
}

export async function registerStep2(
  tempToken: string,
  role: UserRole,
): Promise<RegisterStep1Result> {
  if (USE_MOCK) return mockRegisterStep2(tempToken, role);
  return { tempToken: null, error: { message: '注册服务暂未接通，请稍后再试' } };
}

export async function registerStep3(
  tempToken: string,
  roleInfo: PrincipalRoleInfo | TeacherRoleInfo | ParentRoleInfo,
): Promise<LoginResult> {
  if (USE_MOCK) return mockRegisterStep3(tempToken, roleInfo);
  return { session: null, profile: null, error: { message: '注册服务暂未接通，请稍后再试' } };
}

// ============================================
// 验证码/邀请码验证
// ============================================

export async function verifyCampusCode(code: string) {
  if (USE_MOCK) return mockVerifyCampusCode(code);
  return { valid: false };
}

export async function verifyStudentCode(code: string) {
  if (USE_MOCK) return mockVerifyStudentCode(code);
  return { valid: false };
}

export async function validateInviteCode(code: string) {
  if (USE_MOCK) return mockValidateInviteCode(code);
  try {
    const data = await get<{ valid: boolean; student?: { id: string; name: string } }>(
      `/auth/invite-code/${encodeURIComponent(code)}/validate`,
    );
    return {
      valid: data.valid,
      inviterName: data.student?.name,
      studentId: data.student?.id,
      studentName: data.student?.name,
    };
  } catch {
    return { valid: false };
  }
}

// ============================================
// 会话与身份
// ============================================

export async function getSession(): Promise<{
  session: AuthSession | null;
  profile: Profile | null;
}> {
  if (USE_MOCK) return mockGetSession();
  try {
    const storedSession = readStoredSession();
    if (!storedSession) {
      return { session: null, profile: null };
    }

    const user = await get<BackendUserInfo>(AUTH_ENDPOINTS.me);
    const baseProfile = mapBackendProfile(user);
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

export async function switchIdentity(identityId: string): Promise<{
  profile: Profile | null;
  error: { message: string } | null;
}> {
  if (USE_MOCK) return mockSwitchIdentity(identityId);
  return { profile: null, error: { message: '真实后端联调阶段暂未开放多身份切换' } };
}

export async function addIdentity(
  role: UserRole,
  roleInfo: PrincipalRoleInfo | TeacherRoleInfo | ParentRoleInfo,
): Promise<{ profile: Profile | null; error: { message: string } | null }> {
  if (USE_MOCK) return mockAddIdentity(role, roleInfo);
  return { profile: null, error: { message: '真实后端联调阶段暂未开放新增身份' } };
}

export function restoreRegisterDrafts(): void {
  if (USE_MOCK) mockRestoreRegisterDrafts();
}

export async function logout(): Promise<void> {
  if (USE_MOCK) return mockLogout();
  const storedSession = readStoredSession();
  try {
    await post(
      AUTH_ENDPOINTS.logout,
      storedSession?.refresh_token ? { refreshToken: storedSession.refresh_token } : {},
    );
  } finally {
    clearStoredAuth();
  }
}

// 兼容旧 signUp 调用，内部走分步注册
export async function signUp(
  username: string,
  password: string,
  role: UserRole,
): Promise<LoginResult> {
  const step1 = await registerStep1(username, password);
  if (step1.error || !step1.tempToken) {
    return { session: null, profile: null, error: step1.error || { message: '注册失败' } };
  }
  const step2 = await registerStep2(step1.tempToken, role);
  if (step2.error || !step2.tempToken) {
    return { session: null, profile: null, error: step2.error || { message: '注册失败' } };
  }
  // 默认空信息完成注册（旧调用兼容）
  return registerStep3(step2.tempToken, {} as PrincipalRoleInfo);
}

// 导出注册草稿类型与工具，供组件直接使用
export type { RegisterDraft };

// 导出测试账号信息（Mock 模式下登录页提示用，联调时置空即可）
export const testAccounts: TestAccount[] = USE_MOCK ? TEST_ACCOUNTS : [];
export const testPassword = USE_MOCK ? TEST_PASSWORD : '';
