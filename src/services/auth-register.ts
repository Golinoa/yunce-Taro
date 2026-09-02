/**
 * Auth 注册分步 / 邀请码 / 兼容 signUp
 */
import Taro from '@tarojs/taro';
import { EMAIL_PATTERN } from '@/constants/email-auth';
import type {
  ParentRoleInfo,
  PrincipalRoleInfo,
  RegisterDraft,
  TeacherRoleInfo,
  UserRole,
} from '@/types/profile';
import { get, post } from '@/utils/request';
import type { LoginResult } from '@/services/auth-login';
import {
  AUTH_ENDPOINTS,
  REGISTER_DRAFT_STORAGE_KEY,
  getErrorMessage,
} from '@/services/auth-shared';
import {
  mapBackendAuthPayload,
  mapUserRoleToBackend,
  type BackendAuthPayload,
} from '@/services/auth-profile-map';

export type { RegisterDraft };

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

export interface RegisterStep1Result {
  tempToken: string | null;
  error: { message: string } | null;
}

export async function registerStep1(
  _username: string,
  _password: string,
  _inviteCode?: string,
): Promise<RegisterStep1Result> {
  return { tempToken: null, error: { message: '请使用邮箱注册' } };
}

/** 邮箱注册 Step1：校验邮箱格式并写入本地草稿（角色在后续步骤选择） */
export async function registerStep1ByEmail(
  email: string,
  _password = '',
): Promise<RegisterStep1Result> {
  const normalized = email.trim();
  if (!EMAIL_PATTERN.test(normalized)) {
    return { tempToken: null, error: { message: '请输入正确的邮箱地址' } };
  }

  return {
    tempToken: `email-register:${normalized}`,
    error: null,
  };
}

export async function registerStep1ByPhone(
  phone: string,
  _password: string,
): Promise<RegisterStep1Result> {
  const normalized = phone.trim();
  if (!/^1[3-9]\d{9}$/.test(normalized)) {
    return { tempToken: null, error: { message: '请输入正确的手机号' } };
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
    const principalInfo = draft.role === 'principal' ? (roleInfo as PrincipalRoleInfo) : undefined;
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

/** 邮箱 + 验证码 + 密码注册（写入 passwordHash） */
export async function registerWithEmailPassword(input: {
  email: string;
  code: string;
  password: string;
  role?: 'PARENT' | 'PRINCIPAL';
}): Promise<LoginResult> {
  try {
    const data = await post<BackendAuthPayload>(
      AUTH_ENDPOINTS.register,
      {
        email: input.email.trim(),
        code: input.code.trim(),
        password: input.password,
        role: input.role ?? 'PRINCIPAL',
      },
      { skipAuth: true },
    );
    const mapped = mapBackendAuthPayload(data);
    return {
      session: mapped.session,
      profile: mapped.profile,
      isNewUser: true,
      error: null,
    };
  } catch (error) {
    return {
      session: null,
      profile: null,
      error: { message: getErrorMessage(error, '注册失败') },
    };
  }
}

export async function verifyCampusCode(_code: string) {
  return { valid: false };
}

export async function verifyStudentCode(_code: string) {
  return { valid: false };
}

export async function validateInviteCode(code: string) {
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
