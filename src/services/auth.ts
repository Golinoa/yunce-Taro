/**
 * 认证 Service 层
 * 所有认证相关请求统一通过此处，真实 API 联调时只改此处即可
 */
import Taro from '@tarojs/taro';
import type {
  AuthSession,
  Profile,
  UserRole,
  ParentRoleInfo,
  PrincipalRoleInfo,
  RegisterDraft,
  TeacherRoleInfo,
} from '@/types/profile';
import { isUseMock } from '@/utils/build-env';
import { loadAuthMock } from '@/utils/mock-loaders';
import { get, post, put } from '@/utils/request';

export interface TestAccount {
  username: string;
  label: string;
}

type BackendRole = 'ADMIN' | 'ASSISTANT' | 'PARENT' | 'PRINCIPAL' | 'TEACHER';

const AUTH_TOKEN_KEY = 'yunce-edu-auth-token';
const USER_PROFILE_KEY = 'yunce-edu-user-profile';

const AUTH_ENDPOINTS = {
  login: '/auth/login',
  me: '/auth/me',
  logout: '/auth/logout',
  phoneLogin: '/auth/phone-login',
  smsCode: '/auth/sms-code',
  emailCode: '/auth/email-code',
  emailLogin: '/auth/email-login',
  resetPasswordEmail: '/auth/reset-password-email',
  register: '/auth/register',
  refresh: '/auth/refresh',
  profile: '/profile',
  switchRole: '/auth/switch-role',
  wechatLogin: '/auth/wechat-login',
  wechatBind: '/auth/wechat-bind',
} as const;

const REGISTER_DRAFT_STORAGE_KEY = 'yunce-edu-register-draft-local';

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
  isNewUser?: boolean;
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
  supportsAccountPasswordLogin: isUseMock(),
  /** mock 与生产后端均已提供邮箱验证码登录 */
  supportsEmailCodeLogin: true,
  supportsPhoneLogin: isUseMock(),
  supportsWechatLogin: true,
  usesMockRegister: isUseMock(),
} as const;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function maskEmailAddress(email: string): string {
  const [localPart = '', domain = ''] = email.split('@');
  if (!localPart || !domain) return email;
  if (localPart.length <= 2) return `${localPart[0] || '*'}***@${domain}`;
  return `${localPart.slice(0, 2)}***@${domain}`;
}

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

const mapUserRoleToBackend = (role: UserRole): BackendRole => {
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

function readClientRegisterDraft(): RegisterDraft | null {
  try {
    const raw = Taro.getStorageSync(REGISTER_DRAFT_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as RegisterDraft;
  } catch {
    return null;
  }
}

const buildOrganizationName = (user: BackendUserInfo, role: UserRole): string => {
  if (role === 'teacher') {
    return user.teacher?.institution ?? '松果排课';
  }

  if (role === 'principal') {
    return user.principal?.institution ?? '松果排课';
  }

  return user.parent?.student?.name ? `${user.parent.student.name}家长` : '松果排课';
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
  isNewUser?: boolean;
  error: { message: string } | null;
}

export async function login(username: string, password: string): Promise<LoginResult> {
  if (isUseMock()) { const { mockLogin } = await loadAuthMock(); return mockLogin(username, password); }
  return {
    session: null,
    profile: null,
    error: { message: '当前真实后端联调口径暂不支持账号密码登录，请优先使用微信登录或手机号登录' },
  };
}

export async function wechatLogin(code: string): Promise<LoginResult> {
  if (isUseMock()) { const { mockWechatLogin } = await loadAuthMock(); return mockWechatLogin(code); }
  try {
    const data = await post<BackendAuthPayload>(
      AUTH_ENDPOINTS.wechatLogin,
      { code },
      { skipAuth: true },
    );
    const mapped = mapBackendAuthPayload(data);
    return {
      session: mapped.session,
      profile: mapped.profile,
      isNewUser: data.isNewUser,
      error: null,
    };
  } catch (error) {
    return {
      session: null,
      profile: null,
      error: { message: getErrorMessage(error, '微信登录失败') },
    };
  }
}

/**
 * 发送绑定邮箱验证码（purpose=BIND）
 */
export async function sendBindEmailCode(email: string): Promise<{
  error: { message: string } | null;
  maskedEmail?: string;
}> {
  const trimmed = email.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(trimmed)) {
    return { error: { message: '请输入正确的邮箱' } };
  }
  if (isUseMock()) {
    const { mockSendBindEmailCode } = await loadAuthMock();
    return mockSendBindEmailCode(trimmed);
  }
  try {
    await post(AUTH_ENDPOINTS.emailCode, { email: trimmed, purpose: 'BIND' });
    return { error: null, maskedEmail: maskEmailAddress(trimmed) };
  } catch (error) {
    return { error: { message: getErrorMessage(error, '验证码发送失败') } };
  }
}

/**
 * 已登录绑定邮箱：验证码 + 密码。
 * 对接后端 POST /auth/wechat-bind { email, code, password }
 */
export async function bindAccountEmail(payload: {
  email: string;
  code: string;
  password: string;
}): Promise<LoginResult> {
  if (isUseMock()) {
    const { mockBindAccountEmail } = await loadAuthMock();
    return mockBindAccountEmail(payload.email, payload.password, payload.code);
  }
  try {
    const data = await post<BackendAuthPayload>(AUTH_ENDPOINTS.wechatBind, {
      email: payload.email.trim().toLowerCase(),
      code: payload.code.trim(),
      password: payload.password,
    });
    const mapped = mapBackendAuthPayload(data);
    return { session: mapped.session, profile: mapped.profile, error: null };
  } catch (error) {
    return {
      session: null,
      profile: null,
      error: { message: getErrorMessage(error, '绑定失败，请稍后重试') },
    };
  }
}

/**
 * 微信登录后绑定手机号 + 设置密码（无短信）。
 * 需已登录；成功后返回新 token / profile（可能发生账号合并）。
 */
export async function bindWechatCredentials(payload: {
  phone: string;
  password: string;
}): Promise<LoginResult> {
  if (isUseMock()) {
    const { mockBindWechatCredentials } = await loadAuthMock();
    return mockBindWechatCredentials(payload.phone, payload.password);
  }
  try {
    const data = await post<BackendAuthPayload>(AUTH_ENDPOINTS.wechatBind, {
      phone: payload.phone.trim(),
      password: payload.password,
    });
    const mapped = mapBackendAuthPayload(data);
    return { session: mapped.session, profile: mapped.profile, error: null };
  } catch (error) {
    return {
      session: null,
      profile: null,
      error: { message: getErrorMessage(error, '绑定失败，请稍后重试') },
    };
  }
}

export async function sendSmsCode(phone: string): Promise<{ error: { message: string } | null }> {
  if (isUseMock()) {
    return { error: null };
  }
  try {
    await post(AUTH_ENDPOINTS.smsCode, { phone }, { skipAuth: true });
    return { error: null };
  } catch (error) {
    return { error: { message: getErrorMessage(error, '验证码发送失败') } };
  }
}

export async function phoneLogin(phone: string, code: string): Promise<LoginResult> {
  if (isUseMock()) { const { mockPhoneLogin } = await loadAuthMock(); return mockPhoneLogin(phone, code); }
  try {
    const data = await post<BackendAuthPayload>(
      AUTH_ENDPOINTS.phoneLogin,
      { phone, code },
      { skipAuth: true },
    );
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
  if (isUseMock()) { const { mockCheckLoginAccount } = await loadAuthMock(); return mockCheckLoginAccount(account); }
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
  if (isUseMock()) {
    const { mockPrepareEmailLogin } = await loadAuthMock();
    return mockPrepareEmailLogin(identifier, mode);
  }

  const trimmed = identifier.trim();
  if (mode !== 'email') {
    return {
      status: 'account_not_found',
      error: { message: '请使用邮箱验证码登录' },
    };
  }
  if (!EMAIL_PATTERN.test(trimmed)) {
    return {
      status: 'email_not_found',
      error: { message: '请输入正确的邮箱地址' },
    };
  }

  try {
    await post(
      AUTH_ENDPOINTS.emailCode,
      { email: trimmed, purpose: 'LOGIN' },
      { skipAuth: true },
    );
    return {
      status: 'ready',
      email: trimmed,
      maskedEmail: maskEmailAddress(trimmed),
      error: null,
    };
  } catch (error) {
    return {
      status: 'email_not_found',
      error: { message: getErrorMessage(error, '验证码发送失败') },
    };
  }
}

export async function loginByEmailCode(email: string, code: string): Promise<LoginResult> {
  if (isUseMock()) {
    const { mockLoginByEmailCode } = await loadAuthMock();
    return mockLoginByEmailCode(email, code);
  }

  try {
    const data = await post<BackendAuthPayload>(
      AUTH_ENDPOINTS.emailLogin,
      { email: email.trim(), code: code.trim() },
      { skipAuth: true },
    );
    const mapped = mapBackendAuthPayload(data);
    return {
      session: mapped.session,
      profile: mapped.profile,
      isNewUser: data.isNewUser,
      error: null,
    };
  } catch (error) {
    return {
      session: null,
      profile: null,
      error: { message: getErrorMessage(error, '邮箱验证码登录失败') },
    };
  }
}

export async function prepareAccountRecovery(email: string): Promise<AccountRecoveryPrepareResult> {
  if (isUseMock()) {
    const { mockPrepareAccountRecovery } = await loadAuthMock();
    return mockPrepareAccountRecovery(email);
  }
  return {
    status: 'email_not_found',
    error: { message: '账号找回服务暂未接通，请稍后再试' },
  };
}

export async function recoverAccountByEmailCode(
  email: string,
  code: string,
): Promise<AccountRecoveryResult> {
  if (isUseMock()) {
    const { mockRecoverAccountByEmailCode } = await loadAuthMock();
    return mockRecoverAccountByEmailCode(email, code);
  }
  return {
    account: null,
    error: { message: '账号找回服务暂未接通，请稍后再试' },
  };
}

export async function preparePasswordReset(account: string): Promise<PasswordResetPrepareResult> {
  if (isUseMock()) {
    const { mockPreparePasswordReset } = await loadAuthMock();
    return mockPreparePasswordReset(account);
  }

  const trimmed = account.trim();
  // 生产端按邮箱发码（purpose=RESET）；账号体系未接通时要求直接填邮箱
  if (!EMAIL_PATTERN.test(trimmed)) {
    return {
      status: 'account_not_found',
      error: { message: '请输入绑定邮箱以重置密码' },
    };
  }

  try {
    await post(
      AUTH_ENDPOINTS.emailCode,
      { email: trimmed, purpose: 'RESET' },
      { skipAuth: true },
    );
    return {
      status: 'ready',
      account: trimmed,
      email: trimmed,
      maskedEmail: maskEmailAddress(trimmed),
      error: null,
    };
  } catch (error) {
    return {
      status: 'account_not_found',
      error: { message: getErrorMessage(error, '验证码发送失败') },
    };
  }
}

export async function resetPasswordByEmailCode(
  account: string,
  code: string,
  newPassword: string,
): Promise<{ error: { message: string } | null }> {
  if (isUseMock()) {
    const { mockResetPasswordByEmailCode } = await loadAuthMock();
    return mockResetPasswordByEmailCode(account, code, newPassword);
  }

  const email = account.trim();
  if (!EMAIL_PATTERN.test(email)) {
    return { error: { message: '请输入正确的邮箱地址' } };
  }

  try {
    await post(
      AUTH_ENDPOINTS.resetPasswordEmail,
      { email, code: code.trim(), newPassword },
      { skipAuth: true },
    );
    return { error: null };
  } catch (error) {
    return { error: { message: getErrorMessage(error, '密码重置失败') } };
  }
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
  if (isUseMock()) { const { mockRegisterStep1 } = await loadAuthMock(); return mockRegisterStep1(username, password, inviteCode); }
  return { tempToken: null, error: { message: '请使用邮箱注册' } };
}

/** 邮箱注册 Step1：校验邮箱格式并写入本地草稿（角色在后续步骤选择） */
export async function registerStep1ByEmail(
  email: string,
  password = '',
): Promise<RegisterStep1Result> {
  const normalized = email.trim();
  if (!EMAIL_PATTERN.test(normalized)) {
    return { tempToken: null, error: { message: '请输入正确的邮箱地址' } };
  }

  if (isUseMock()) {
    const { mockRegisterStep1 } = await loadAuthMock();
    return mockRegisterStep1(normalized, password.trim() || 'email-register', undefined);
  }

  return {
    tempToken: `email-register:${normalized}`,
    error: null,
  };
}

export async function registerStep1ByPhone(
  phone: string,
  password: string,
): Promise<RegisterStep1Result> {
  const normalized = phone.trim();
  if (!/^1[3-9]\d{9}$/.test(normalized)) {
    return { tempToken: null, error: { message: '请输入正确的手机号' } };
  }

  if (isUseMock()) {
    const { mockRegisterStep1 } = await loadAuthMock();
    return mockRegisterStep1(normalized, password.trim() || 'phone-register', undefined);
  }

  return {
    tempToken: null,
    error: { message: '请使用邮箱注册' },
  };
}

export async function registerStep2(
  tempToken: string,
  role: UserRole,
): Promise<RegisterStep1Result> {
  if (isUseMock()) { const { mockRegisterStep2 } = await loadAuthMock(); return mockRegisterStep2(tempToken, role); }
  if (!tempToken) {
    return { tempToken: null, error: { message: '注册已过期，请重新填写' } };
  }
  if (!['teacher', 'principal', 'parent'].includes(role)) {
    return { tempToken: null, error: { message: '当前仅支持注册为教师、校长或家长' } };
  }
  return { tempToken, error: null };
}

export async function registerStep3(
  tempToken: string,
  roleInfo: PrincipalRoleInfo | TeacherRoleInfo | ParentRoleInfo,
): Promise<LoginResult> {
  if (isUseMock()) { const { mockRegisterStep3 } = await loadAuthMock(); return mockRegisterStep3(tempToken, roleInfo); }

  const draft = readClientRegisterDraft();
  const email =
    draft?.email?.trim() ||
    (draft?.tempToken?.startsWith('email-register:')
      ? draft.tempToken.slice('email-register:'.length)
      : '') ||
    (EMAIL_PATTERN.test(draft?.username || '') ? draft!.username.trim() : '');

  if (!email || !draft?.role || draft.tempToken !== tempToken) {
    return { session: null, profile: null, error: { message: '注册信息不完整，请重新填写' } };
  }

  if (!['parent', 'principal'].includes(draft.role)) {
    return {
      session: null,
      profile: null,
      error: { message: '当前仅支持注册为校长或家长，教师请通过机构邀请加入' },
    };
  }

  try {
    const backendRole = mapUserRoleToBackend(draft.role);
    const principalInfo =
      draft.role === 'principal' ? (roleInfo as PrincipalRoleInfo) : undefined;
    const body: Record<string, unknown> = {
      email,
      role: backendRole,
    };

    if (principalInfo?.organizationName) {
      body.nickname = principalInfo.organizationName;
      body.institution = principalInfo.organizationName;
    }

    const data = await post<BackendAuthPayload>(AUTH_ENDPOINTS.register, body, { skipAuth: true });
    const mapped = mapBackendAuthPayload(data);
    return { session: mapped.session, profile: mapped.profile, isNewUser: true, error: null };
  } catch (error) {
    return {
      session: null,
      profile: null,
      error: { message: getErrorMessage(error, '注册失败') },
    };
  }
}

// ============================================
// 验证码/邀请码验证
// ============================================

export async function verifyCampusCode(code: string) {
  if (isUseMock()) { const { mockVerifyCampusCode } = await loadAuthMock(); return mockVerifyCampusCode(code); }
  return { valid: false };
}

export async function verifyStudentCode(code: string) {
  if (isUseMock()) { const { mockVerifyStudentCode } = await loadAuthMock(); return mockVerifyStudentCode(code); }
  return { valid: false };
}

export async function validateInviteCode(code: string) {
  if (isUseMock()) { const { mockValidateInviteCode } = await loadAuthMock(); return mockValidateInviteCode(code); }
  try {
    const data = await get<{ valid: boolean; student?: { id: string; name: string } }>(
      `/auth/invite-code/${encodeURIComponent(code)}/validate`,
      undefined,
      { skipAuth: true },
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
  if (isUseMock()) { const { mockGetSession } = await loadAuthMock(); return mockGetSession(); }
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
  if (isUseMock()) { const { mockSwitchIdentity } = await loadAuthMock(); return mockSwitchIdentity(identityId); }
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
  if (isUseMock()) { const { mockUpdateProfile } = await loadAuthMock(); return mockUpdateProfile(patch); }
  try {
    const updated = await put<BackendUserInfo>(
      AUTH_ENDPOINTS.profile,
      patch as Record<string, unknown>,
    );
    const mapped = mapBackendProfile(updated);
    return { profile: mapped, error: null };
  } catch (err) {
    return {
      profile: null,
      error: { message: err instanceof Error ? err.message : '更新资料失败' },
    };
  }
}

/** 获取用户扩展资料（性别/生日等） */
export async function getProfileExtra(userId: string): Promise<{
  gender?: 'male' | 'female' | 'other';
  birthday?: string;
  id_card?: string;
  region?: string;
  address?: string;
}> {
  if (isUseMock()) { const { mockGetProfileExtra } = await loadAuthMock(); return mockGetProfileExtra(userId); }
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
  role: UserRole,
  roleInfo: PrincipalRoleInfo | TeacherRoleInfo | ParentRoleInfo,
): Promise<{ profile: Profile | null; error: { message: string } | null }> {
  if (isUseMock()) { const { mockAddIdentity } = await loadAuthMock(); return mockAddIdentity(role, roleInfo); }
  return { profile: null, error: { message: '真实后端联调阶段暂未开放新增身份' } };
}

export function restoreRegisterDrafts(): void {
  if (isUseMock()) { void loadAuthMock().then(({ mockRestoreRegisterDrafts }) => mockRestoreRegisterDrafts()); }
}

export async function logout(): Promise<void> {
  if (isUseMock()) { const { mockLogout } = await loadAuthMock(); return mockLogout(); }
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
export const testAccounts: TestAccount[] = [];
export const testPassword = '';

export async function getTestAccounts(): Promise<TestAccount[]> {
  if (!isUseMock()) return [];
  const { TEST_ACCOUNTS } = await import('@/data/mock-database');
  return TEST_ACCOUNTS;
}

export async function getTestPassword(): Promise<string> {
  if (!isUseMock()) return '';
  const { TEST_PASSWORD } = await import('@/data/mock-database');
  return TEST_PASSWORD;
}
