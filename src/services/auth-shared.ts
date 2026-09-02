/**
 * Auth 共享常量与工具（端点、storage、能力开关、错误文案）
 */
import Taro from '@tarojs/taro';
import { isDevApiEnv } from '@/utils/build-env';

export interface TestAccount {
  username: string;
  label: string;
}

export const AUTH_TOKEN_KEY = 'yunce-edu-auth-token';
export const USER_PROFILE_KEY = 'yunce-edu-user-profile';
export const REGISTER_DRAFT_STORAGE_KEY = 'yunce-edu-register-draft-local';

export const AUTH_ENDPOINTS = {
  login: '/auth/login',
  me: '/auth/me',
  logout: '/auth/logout',
  phoneLogin: '/auth/phone-login',
  smsCode: '/auth/sms-code',
  emailCode: '/auth/email-code',
  checkEmail: '/auth/check-email',
  emailLogin: '/auth/email-login',
  resetPasswordEmail: '/auth/reset-password-email',
  register: '/auth/register',
  refresh: '/auth/refresh',
  profile: '/profile',
  switchRole: '/auth/switch-role',
  wechatLogin: '/auth/wechat-login',
  wechatBind: '/auth/wechat-bind',
  passwordLogin: '/auth/password-login',
} as const;

export const authCapabilities = {
  /** 测环境包：可用种子账号邮箱密码登录 */
  supportsAccountPasswordLogin: isDevApiEnv(),
  /** 邮箱验证码登录 */
  supportsEmailCodeLogin: true,
  supportsPhoneLogin: isDevApiEnv(),
  supportsWechatLogin: true,
  usesMockRegister: false,
} as const;

export const clearStoredAuth = (): void => {
  try {
    Taro.removeStorageSync(AUTH_TOKEN_KEY);
    Taro.removeStorageSync(USER_PROFILE_KEY);
    Taro.removeStorageSync('userRole');
  } catch {
    // ignore storage cleanup errors
  }
};

export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}
