/**
 * Service 层 — 认证相关 API
 */
import {
  mockLogin,
  mockRegister,
  mockValidateInviteCode,
  mockGetSession,
  mockLogout,
} from '@/data/auth';
import type { UserRole, Profile, AuthSession } from '@/types/profile';

export const authService = {
  /** 用户名密码登录 */
  login: (username: string, password: string) => mockLogin(username, password),

  /** 用户注册 */
  register: (
    username: string,
    password: string,
    role: UserRole,
    name: string,
    inviteCode?: string,
  ) => mockRegister(username, password, role, name, inviteCode),

  /** 验证邀请码 */
  validateInviteCode: (code: string) => mockValidateInviteCode(code),

  /** 获取当前会话 */
  getSession: () => mockGetSession(),

  /** 退出登录 */
  logout: () => mockLogout(),
};
