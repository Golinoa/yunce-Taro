/**
 * Auth 登录 / 发码 / 绑定 / 找回 / 重置
 */
import {
  EMAIL_NOT_REGISTERED,
  EMAIL_PATTERN,
  EMAIL_SEND_FAILED,
  PASSWORD_RESET_SUCCESS,
} from '@/constants/email-auth';
import { maskEmailAddress, resolveLoginEmailInput } from '@/services/auth-email';
import { mapBackendAuthPayload, type BackendAuthPayload } from '@/services/auth-profile-map';
import { AUTH_ENDPOINTS, getErrorMessage } from '@/services/auth-shared';
import type { AuthSession, Profile } from '@/types/profile';
import { post } from '@/utils/request';

export { PASSWORD_RESET_SUCCESS };

export type EmailOtpSendResult = {
  error: { message: string } | null;
  maskedEmail?: string;
};

/** 校验邮箱已注册（不发码），与找回密码发码前校验口径一致 */
export async function checkEmailRegistered(
  email: string,
): Promise<{ error: { message: string } | null }> {
  const trimmed = email.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(trimmed)) {
    return { error: { message: '请输入正确的邮箱地址' } };
  }
  try {
    await post(AUTH_ENDPOINTS.checkEmail, { email: trimmed }, { skipAuth: true });
    return { error: null };
  } catch (error) {
    return { error: { message: getErrorMessage(error, EMAIL_NOT_REGISTERED) } };
  }
}

export async function sendPasswordResetCode(email: string): Promise<EmailOtpSendResult> {
  const trimmed = email.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(trimmed)) {
    return { error: { message: '请输入正确的邮箱地址' } };
  }
  try {
    await post(AUTH_ENDPOINTS.emailCode, { email: trimmed, purpose: 'RESET' }, { skipAuth: true });
    return { error: null, maskedEmail: maskEmailAddress(trimmed) };
  } catch (error) {
    return { error: { message: getErrorMessage(error, EMAIL_SEND_FAILED) } };
  }
}

export async function sendRegisterEmailCode(email: string): Promise<EmailOtpSendResult> {
  const trimmed = email.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(trimmed)) {
    return { error: { message: '请输入正确的邮箱地址' } };
  }
  try {
    await post(
      AUTH_ENDPOINTS.emailCode,
      { email: trimmed, purpose: 'REGISTER' },
      { skipAuth: true, timeout: 20000 },
    );
    return { error: null, maskedEmail: maskEmailAddress(trimmed) };
  } catch (error) {
    return { error: { message: getErrorMessage(error, EMAIL_SEND_FAILED) } };
  }
}

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

export interface LoginResult {
  session: AuthSession | null;
  profile: Profile | null;
  isNewUser?: boolean;
  shareAttached?: boolean;
  error: { message: string } | null;
}

export interface WechatLoginOptions {
  inviteCode?: string;
  role?: 'PARENT' | 'PRINCIPAL' | 'TEACHER';
}

export async function login(username: string, password: string): Promise<LoginResult> {
  const email = resolveLoginEmailInput(username);
  if (!email) {
    return {
      session: null,
      profile: null,
      error: { message: '请输入正确的邮箱地址' },
    };
  }
  try {
    const data = await post<BackendAuthPayload>(
      AUTH_ENDPOINTS.passwordLogin,
      { email, password },
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
      error: { message: getErrorMessage(error, '账号密码登录失败') },
    };
  }
}

export async function wechatLogin(
  code: string,
  options?: WechatLoginOptions,
): Promise<LoginResult> {
  try {
    const body: { code: string; inviteCode?: string; role?: string } = { code };
    const inviteCode = (options?.inviteCode || '').trim();
    if (inviteCode) {
      body.inviteCode = inviteCode;
      body.role = options?.role ?? 'PARENT';
    }

    const data = await post<BackendAuthPayload>(AUTH_ENDPOINTS.wechatLogin, body, {
      skipAuth: true,
    });
    const mapped = mapBackendAuthPayload(data);
    return {
      session: mapped.session,
      profile: mapped.profile,
      isNewUser: data.isNewUser,
      shareAttached: data.shareAttached,
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
  try {
    await post(AUTH_ENDPOINTS.smsCode, { phone }, { skipAuth: true });
    return { error: null };
  } catch (error) {
    return { error: { message: getErrorMessage(error, '验证码发送失败') } };
  }
}

export async function phoneLogin(phone: string, code: string): Promise<LoginResult> {
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
    // 发码接口单独放宽 timeout 作兜底；全局 TIMEOUT 仍为 10s。后端已异步 SES，正常应远低于此。
    await post(
      AUTH_ENDPOINTS.emailCode,
      { email: trimmed, purpose: 'LOGIN' },
      { skipAuth: true, timeout: 20000 },
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

/** 注册页发码（purpose=REGISTER；未注册邮箱） */
export async function prepareEmailRegister(email: string): Promise<EmailLoginPrepareResult> {
  const trimmed = email.trim();
  if (!EMAIL_PATTERN.test(trimmed)) {
    return {
      status: 'email_not_found',
      error: { message: '请输入正确的邮箱地址' },
    };
  }

  try {
    await post(
      AUTH_ENDPOINTS.emailCode,
      { email: trimmed, purpose: 'REGISTER' },
      { skipAuth: true, timeout: 20000 },
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

export async function prepareAccountRecovery(
  _email: string,
): Promise<AccountRecoveryPrepareResult> {
  return {
    status: 'email_not_found',
    error: { message: '账号找回服务暂未接通，请稍后再试' },
  };
}

export async function recoverAccountByEmailCode(
  _email: string,
  _code: string,
): Promise<AccountRecoveryResult> {
  return {
    account: null,
    error: { message: '账号找回服务暂未接通，请稍后再试' },
  };
}

export async function preparePasswordReset(account: string): Promise<PasswordResetPrepareResult> {
  const trimmed = account.trim();
  // 生产端按邮箱发码（purpose=RESET）；账号体系未接通时要求直接填邮箱
  if (!EMAIL_PATTERN.test(trimmed)) {
    return {
      status: 'account_not_found',
      error: { message: '请输入绑定邮箱以重置密码' },
    };
  }

  try {
    await post(AUTH_ENDPOINTS.emailCode, { email: trimmed, purpose: 'RESET' }, { skipAuth: true });
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
