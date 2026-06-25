/**
 * Mock 认证接口
 * 使用统一数据源 src/data/mock-database.ts
 * 联调时替换为真实 API 调用即可
 */
import Taro from '@tarojs/taro';
import type { AuthSession, CurrentContext, Identity, ParentRoleInfo, PrincipalRoleInfo, Profile, RegisterDraft, TeacherRoleInfo, UserRole } from '@/types/profile';
import { ACCOUNT_RULE_TEXT, isAccountFormatValid } from '@/utils/account';
import {
  USERS,
  IDENTITIES,
  ORGANIZATIONS,
  CAMPUSES,
  type User,
  type Identity as DbIdentity,
} from './mock-database';

// ============================================
// 存储 Key
// ============================================
const AUTH_TOKEN_KEY = 'yunce-edu-auth-token';
const USER_PROFILE_KEY = 'yunce-edu-user-profile';
const REGISTER_DRAFT_KEY = 'yunce-edu-register-draft';
const EMAIL_LOGIN_CODE = '123456';
const emailLoginCodeMap: Record<string, string> = {};
const accountRecoveryCodeMap: Record<string, string> = {};
const passwordResetCodeMap: Record<string, string> = {};

// ============================================
// 工具函数
// ============================================
function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function generateToken(): string {
  return `mock-token-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function delay(ms = 100): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeValue(value: string): string {
  return value.trim().toLowerCase();
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function maskEmail(email: string): string {
  const [localPart, domain = ''] = email.split('@');
  const safeLocalPart = localPart || '';
  if (safeLocalPart.length <= 2) {
    return `${safeLocalPart[0] || '*'}***@${domain}`;
  }
  return `${safeLocalPart.slice(0, 2)}***${safeLocalPart.slice(-1)}@${domain}`;
}

function findUserByAccount(account: string): User | null {
  const normalizedAccount = normalizeValue(account);
  return (
    USERS.find((user) => {
      return (
        normalizeValue(user.username) === normalizedAccount ||
        normalizeValue(user.email || '') === normalizedAccount
      );
    }) || null
  );
}

function findUserByEmail(email: string): User | null {
  const normalizedEmail = normalizeValue(email);
  return (
    USERS.find((user) => user.email && normalizeValue(user.email) === normalizedEmail) || null
  );
}

function saveSession(session: AuthSession, profile: Profile): void {
  try {
    Taro.setStorageSync(AUTH_TOKEN_KEY, JSON.stringify(session));
    Taro.setStorageSync(USER_PROFILE_KEY, JSON.stringify(profile));
  } catch {
    /* ignore */
  }
}

function getStoredSession(): { session: AuthSession | null; profile: Profile | null } {
  try {
    const tokenStr = Taro.getStorageSync(AUTH_TOKEN_KEY);
    const profileStr = Taro.getStorageSync(USER_PROFILE_KEY);
    if (!tokenStr) return { session: null, profile: null };

    const session: AuthSession = JSON.parse(tokenStr);
    const profile: Profile | null = profileStr ? JSON.parse(profileStr) : null;

    if (session.expires_at * 1000 < Date.now()) {
      Taro.removeStorageSync(AUTH_TOKEN_KEY);
      Taro.removeStorageSync(USER_PROFILE_KEY);
      return { session: null, profile: null };
    }

    return { session, profile };
  } catch {
    return { session: null, profile: null };
  }
}

function getCurrentUser(): User | null {
  const { profile } = getStoredSession();
  if (!profile) return null;
  return USERS.find((u) => u.id === profile.id) || null;
}

function buildIdentities(userId: string): Identity[] {
  return IDENTITIES.filter((i) => i.userId === userId).map((i: DbIdentity) => {
    const org = ORGANIZATIONS.find((o) => o.id === i.organizationId);
    const campuses = CAMPUSES.filter((c) => i.campusIds.includes(c.id));
    return {
      id: i.id,
      role: i.role,
      organizationId: i.organizationId,
      organizationName: org?.name || '未知机构',
      campusIds: campuses.map((c) => c.id),
      isDefault: i.isDefault,
    };
  });
}

function buildCurrentContext(identities: Identity[]): CurrentContext {
  const defaultIdentity = identities.find((i) => i.isDefault) || identities[0];
  return {
    identityId: defaultIdentity.id,
    role: defaultIdentity.role,
    organizationId: defaultIdentity.organizationId,
    campusId: defaultIdentity.campusIds?.[0],
  };
}

function buildProfile(user: User): Profile {
  const identities = buildIdentities(user.id);
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    avatar_url: user.avatar,
    identities,
    currentContext: buildCurrentContext(identities),
    created_at: user.createdAt,
    updated_at: new Date().toISOString(),
  };
}

function buildAuthResult(user: User): {
  session: AuthSession;
  profile: Profile;
  error: null;
} {
  const session: AuthSession = {
    access_token: generateToken(),
    refresh_token: generateToken(),
    expires_at: Date.now() / 1000 + 3600,
    user: {
      id: user.id,
      email: user.email || (user.username ? `${user.username}@yunce.com` : undefined),
      phone: user.phone,
    },
  };
  const profile = buildProfile(user);
  saveSession(session, profile);
  return { session, profile, error: null };
}

// 注册草稿（内存 + storage 双保险）
const registerDrafts: Record<string, RegisterDraft> = {};

// ============================================
// Mock API
// ============================================

/** 用户名密码登录 */
export async function mockLogin(
  username: string,
  password: string,
): Promise<{
  session: AuthSession | null;
  profile: Profile | null;
  error: { message: string } | null;
}> {
  await delay(600);
  const normalizedAccount = normalizeValue(username);
  const user =
    USERS.find((u) => {
      return (
        (normalizeValue(u.username) === normalizedAccount ||
          normalizeValue(u.email || '') === normalizedAccount) &&
        u.password === password
      );
    }) || null;
  if (!user) {
    return { session: null, profile: null, error: { message: '用户名或密码错误' } };
  }
  return buildAuthResult(user);
}

export async function mockCheckLoginAccount(account: string): Promise<{
  exists: boolean;
  account: string;
  maskedEmail?: string;
  hasBoundEmail: boolean;
  error: { message: string } | null;
}> {
  await delay(250);
  const trimmedAccount = account.trim();
  if (!trimmedAccount) {
    return {
      exists: false,
      account: '',
      hasBoundEmail: false,
      error: { message: '请输入账户' },
    };
  }

  const user = findUserByAccount(trimmedAccount);
  if (!user) {
    return {
      exists: false,
      account: trimmedAccount,
      hasBoundEmail: false,
      error: { message: '账户不存在' },
    };
  }

  return {
    exists: true,
    account: user.email && normalizeValue(user.email) === normalizeValue(trimmedAccount)
      ? user.email
      : user.username,
    maskedEmail: user.email ? maskEmail(user.email) : undefined,
    hasBoundEmail: Boolean(user.email),
    error: null,
  };
}

export async function mockPrepareEmailLogin(
  identifier: string,
  mode: 'account' | 'email',
): Promise<{
  status: 'ready' | 'account_not_found' | 'email_not_found' | 'email_not_bound';
  email?: string;
  maskedEmail?: string;
  error: { message: string } | null;
}> {
  await delay(350);
  const trimmedIdentifier = identifier.trim();
  if (!trimmedIdentifier) {
    return {
      status: mode === 'email' ? 'email_not_found' : 'account_not_found',
      error: { message: mode === 'email' ? '请输入邮箱' : '请输入账户' },
    };
  }

  if (mode === 'email') {
    if (!isEmail(trimmedIdentifier)) {
      return {
        status: 'email_not_found',
        error: { message: '请输入正确的邮箱地址' },
      };
    }
    const emailUser = findUserByEmail(trimmedIdentifier);
    if (!emailUser || !emailUser.email) {
      return {
        status: 'email_not_found',
        error: { message: '邮箱不存在' },
      };
    }
    emailLoginCodeMap[normalizeValue(emailUser.email)] = EMAIL_LOGIN_CODE;
    return {
      status: 'ready',
      email: emailUser.email,
      maskedEmail: maskEmail(emailUser.email),
      error: null,
    };
  }

  const accountUser = findUserByAccount(trimmedIdentifier);
  if (!accountUser) {
    return {
      status: 'account_not_found',
      error: { message: '账户不存在' },
    };
  }
  if (!accountUser.email) {
    return {
      status: 'email_not_bound',
      error: { message: '该账户未绑定邮箱' },
    };
  }
  emailLoginCodeMap[normalizeValue(accountUser.email)] = EMAIL_LOGIN_CODE;
  return {
    status: 'ready',
    email: accountUser.email,
    maskedEmail: maskEmail(accountUser.email),
    error: null,
  };
}

export async function mockLoginByEmailCode(
  email: string,
  code: string,
): Promise<{
  session: AuthSession | null;
  profile: Profile | null;
  error: { message: string } | null;
}> {
  await delay(600);
  const normalizedEmail = normalizeValue(email);
  const user = findUserByEmail(normalizedEmail);
  if (!user || !user.email) {
    return { session: null, profile: null, error: { message: '邮箱不存在' } };
  }
  const savedCode = emailLoginCodeMap[normalizedEmail] || EMAIL_LOGIN_CODE;
  if (code.trim() !== savedCode) {
    return { session: null, profile: null, error: { message: '验证码错误' } };
  }
  return buildAuthResult(user);
}

export async function mockPrepareAccountRecovery(email: string): Promise<{
  status: 'ready' | 'email_not_found';
  email?: string;
  maskedEmail?: string;
  error: { message: string } | null;
}> {
  await delay(350);
  const trimmedEmail = email.trim();
  if (!trimmedEmail || !isEmail(trimmedEmail)) {
    return {
      status: 'email_not_found',
      error: { message: '请输入正确的绑定邮箱' },
    };
  }

  const user = findUserByEmail(trimmedEmail);
  if (!user || !user.email) {
    return {
      status: 'email_not_found',
      error: { message: '未找到绑定该邮箱的账号' },
    };
  }

  accountRecoveryCodeMap[normalizeValue(user.email)] = EMAIL_LOGIN_CODE;
  return {
    status: 'ready',
    email: user.email,
    maskedEmail: maskEmail(user.email),
    error: null,
  };
}

export async function mockRecoverAccountByEmailCode(
  email: string,
  code: string,
): Promise<{
  account: string | null;
  maskedEmail?: string;
  error: { message: string } | null;
}> {
  await delay(400);
  const normalizedEmail = normalizeValue(email);
  const user = findUserByEmail(normalizedEmail);
  if (!user || !user.email) {
    return { account: null, error: { message: '未找到绑定该邮箱的账号' } };
  }

  const savedCode = accountRecoveryCodeMap[normalizedEmail] || EMAIL_LOGIN_CODE;
  if (code.trim() !== savedCode) {
    return { account: null, maskedEmail: maskEmail(user.email), error: { message: '验证码错误' } };
  }

  return {
    account: user.username,
    maskedEmail: maskEmail(user.email),
    error: null,
  };
}

export async function mockPreparePasswordReset(account: string): Promise<{
  status: 'ready' | 'account_not_found' | 'email_not_bound';
  account?: string;
  email?: string;
  maskedEmail?: string;
  error: { message: string } | null;
}> {
  await delay(350);
  const trimmedAccount = account.trim();
  if (!trimmedAccount) {
    return {
      status: 'account_not_found',
      error: { message: '请输入账号' },
    };
  }

  const user = findUserByAccount(trimmedAccount);
  if (!user) {
    return {
      status: 'account_not_found',
      error: { message: '账号不存在' },
    };
  }
  if (!user.email) {
    return {
      status: 'email_not_bound',
      error: { message: '该账号未绑定邮箱，暂时无法自助重置密码' },
    };
  }

  passwordResetCodeMap[normalizeValue(user.email)] = EMAIL_LOGIN_CODE;
  return {
    status: 'ready',
    account: user.username,
    email: user.email,
    maskedEmail: maskEmail(user.email),
    error: null,
  };
}

export async function mockResetPasswordByEmailCode(
  account: string,
  code: string,
  newPassword: string,
): Promise<{ error: { message: string } | null }> {
  await delay(450);
  const trimmedAccount = account.trim();
  const user = findUserByAccount(trimmedAccount);
  if (!user) {
    return { error: { message: '账号不存在' } };
  }
  if (!user.email) {
    return { error: { message: '该账号未绑定邮箱，暂时无法自助重置密码' } };
  }
  if (!newPassword.trim()) {
    return { error: { message: '请输入新密码' } };
  }
  if (newPassword.trim().length < 6) {
    return { error: { message: '密码至少6位' } };
  }

  const normalizedEmail = normalizeValue(user.email);
  const savedCode = passwordResetCodeMap[normalizedEmail] || EMAIL_LOGIN_CODE;
  if (code.trim() !== savedCode) {
    return { error: { message: '验证码错误' } };
  }

  user.password = newPassword.trim();
  return { error: null };
}

/** 微信一键登录 */
export async function mockWechatLogin(code: string): Promise<{
  session: AuthSession | null;
  profile: Profile | null;
  error: { message: string } | null;
}> {
  await delay(600);
  if (!code) {
    return { session: null, profile: null, error: { message: '微信授权失败' } };
  }
  // 模拟：使用 teacher1 账号
  const user = USERS.find((u) => u.username === 'teacher1') || USERS[0];
  return buildAuthResult(user);
}

/** 手机号验证码登录 */
export async function mockPhoneLogin(
  phone: string,
  code: string,
): Promise<{
  session: AuthSession | null;
  profile: Profile | null;
  error: { message: string } | null;
}> {
  await delay(600);
  if (!/^1\d{10}$/.test(phone)) {
    return { session: null, profile: null, error: { message: '请输入正确的手机号' } };
  }
  if (code !== '123456') {
    return { session: null, profile: null, error: { message: '验证码错误' } };
  }
  const user = USERS.find((u) => u.phone === phone) || USERS[0];
  return buildAuthResult(user);
}

/** 注册 Step1：创建账号 */
export async function mockRegisterStep1(
  username: string,
  password: string,
  inviteCode?: string,
): Promise<{ tempToken: string | null; error: { message: string } | null }> {
  await delay(400);
  if (!username.trim() || !password.trim()) {
    return { tempToken: null, error: { message: '请填写用户名和密码' } };
  }
  if (!isAccountFormatValid(username.trim())) {
    return { tempToken: null, error: { message: `账号仅支持${ACCOUNT_RULE_TEXT}` } };
  }
  if (password.length < 6) {
    return { tempToken: null, error: { message: '密码至少6位' } };
  }
  if (USERS.some((u) => u.username === username)) {
    return { tempToken: null, error: { message: '用户名已存在' } };
  }

  const tempToken = generateToken();
  const draft: RegisterDraft = {
    tempToken,
    username: username.trim(),
    password,
    inviteCode: inviteCode?.trim().toUpperCase(),
  };
  registerDrafts[tempToken] = draft;
  try {
    Taro.setStorageSync(REGISTER_DRAFT_KEY, JSON.stringify(registerDrafts));
  } catch {
    /* ignore */
  }
  return { tempToken, error: null };
}

/** 注册 Step2：选择身份 */
export async function mockRegisterStep2(
  tempToken: string,
  role: UserRole,
): Promise<{ tempToken: string | null; error: { message: string } | null }> {
  await delay(300);
  const draft = registerDrafts[tempToken];
  if (!draft) {
    return { tempToken: null, error: { message: '注册已过期，请重新填写' } };
  }
  draft.role = role;
  try {
    Taro.setStorageSync(REGISTER_DRAFT_KEY, JSON.stringify(registerDrafts));
  } catch {
    /* ignore */
  }
  return { tempToken, error: null };
}

/** 注册 Step3：补全角色信息并完成注册 */
export async function mockRegisterStep3(
  tempToken: string,
  roleInfo: PrincipalRoleInfo | TeacherRoleInfo | ParentRoleInfo,
): Promise<{
  session: AuthSession | null;
  profile: Profile | null;
  error: { message: string } | null;
}> {
  await delay(600);
  const draft = registerDrafts[tempToken];
  if (!draft || !draft.role) {
    return { session: null, profile: null, error: { message: '注册信息不完整，请重新填写' } };
  }

  // 创建用户
  const userId = generateId('user');
  const newUser: User = {
    id: userId,
    username: draft.username,
    password: draft.password,
    name: '',
    phone: '',
    createdAt: new Date().toISOString(),
  };

  if (draft.role === 'principal') {
    const info = roleInfo as PrincipalRoleInfo;
    newUser.name = info.contactPhone ? `校长${info.contactPhone.slice(-4)}` : '校长';
  } else if (draft.role === 'teacher') {
    newUser.name = '新教师';
  } else if (draft.role === 'parent') {
    newUser.name = '新家长';
  }

  // 注意：这里不修改全局数据，只用于本次注册会话
  // 联调时由后端处理
  delete registerDrafts[tempToken];
  try {
    Taro.setStorageSync(REGISTER_DRAFT_KEY, JSON.stringify(registerDrafts));
  } catch {
    /* ignore */
  }

  // 构建一个临时用户用于登录
  const tempUser: User = { ...newUser, id: userId, name: newUser.name || '新用户' };
  return buildAuthResult(tempUser);
}

/** 验证校区码 */
export async function mockVerifyCampusCode(code: string): Promise<{
  valid: boolean;
  campusId?: string;
  campusName?: string;
  organizationName?: string;
}> {
  await delay(300);
  const campus = CAMPUSES.find((c) => c.code === code.toUpperCase());
  if (!campus) return { valid: false };
  const org = ORGANIZATIONS.find((o) => o.id === campus.organizationId);
  return {
    valid: true,
    campusId: campus.id,
    campusName: campus.name,
    organizationName: org?.name,
  };
}

/** 验证学生邀请码 */
export async function mockVerifyStudentCode(code: string): Promise<{
  valid: boolean;
  studentId?: string;
  studentName?: string;
  organizationName?: string;
}> {
  await delay(300);
  // 从 mock-database 导入 STUDENTS
  const { STUDENTS } = await import('./mock-database');
  const student = STUDENTS.find((s) => s.id === code.toUpperCase() || s.id.includes(code));
  if (!student) return { valid: false };
  const org = ORGANIZATIONS.find((o) => o.id === 'org-yunce');
  return {
    valid: true,
    studentId: student.id,
    studentName: student.name,
    organizationName: org?.name,
  };
}

/** 验证拉新邀请码 */
export async function mockValidateInviteCode(
  code: string,
): Promise<{ valid: boolean; inviterName?: string }> {
  await delay(300);
  const user = USERS.find((u) => u.username === code.toUpperCase() || u.id.includes(code));
  return user ? { valid: true, inviterName: user.name } : { valid: false };
}

/** 获取当前会话 */
export async function mockGetSession(): Promise<{
  session: AuthSession | null;
  profile: Profile | null;
}> {
  await delay(200);
  return getStoredSession();
}

/** 切换当前身份 */
export async function mockSwitchIdentity(
  identityId: string,
): Promise<{ profile: Profile | null; error: { message: string } | null }> {
  await delay(300);
  const { profile } = getStoredSession();
  if (!profile) {
    return { profile: null, error: { message: '未登录' } };
  }
  const identity = profile.identities.find((i) => i.id === identityId);
  if (!identity) {
    return { profile: null, error: { message: '身份不存在' } };
  }
  const newProfile: Profile = {
    ...profile,
    currentContext: {
      identityId: identity.id,
      role: identity.role,
      organizationId: identity.organizationId,
      campusId: identity.campusIds?.[0],
    },
  };
  const { session } = getStoredSession();
  if (session) {
    saveSession(session, newProfile);
  }
  return { profile: newProfile, error: null };
}

/** 添加新身份 */
export async function mockAddIdentity(
  _role: UserRole,
  _roleInfo: PrincipalRoleInfo | TeacherRoleInfo | ParentRoleInfo,
): Promise<{ profile: Profile | null; error: { message: string } | null }> {
  await delay(600);
  const currentUser = getCurrentUser();
  if (!currentUser) {
    return { profile: null, error: { message: '未登录' } };
  }

  const { profile } = getStoredSession();
  if (!profile) {
    return { profile: null, error: { message: '未登录' } };
  }

  return { profile, error: { message: 'Mock 模式不支持添加新身份' } };
}

/** 恢复未完成的注册草稿 */
export async function mockRestoreRegisterDrafts(): Promise<{
  drafts: RegisterDraft[];
}> {
  await delay(200);
  try {
    const stored = Taro.getStorageSync(REGISTER_DRAFT_KEY);
    if (!stored) return { drafts: [] };
    const parsed = JSON.parse(stored);
    return { drafts: Object.values(parsed) as RegisterDraft[] };
  } catch {
    return { drafts: [] };
  }
}

/** 登出 */
export async function mockLogout(): Promise<void> {
  await delay(100);
  try {
    Taro.removeStorageSync(AUTH_TOKEN_KEY);
    Taro.removeStorageSync(USER_PROFILE_KEY);
    Taro.removeStorageSync('userRole');
    Taro.removeStorageSync(REGISTER_DRAFT_KEY);
    Taro.removeStorageSync('yunce-edu-register-draft-local');
    Taro.removeStorageSync('loginRedirectPath');
  } catch {
    /* ignore */
  }
}

/** 验证测试账号 */
export function isTestAccount(username: string, password: string): boolean {
  return USERS.some((u) => u.username === username && u.password === password);
}
