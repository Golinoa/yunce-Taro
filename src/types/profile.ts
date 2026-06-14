/**
 * 用户角色枚举
 */
export type UserRole = 'teacher' | 'parent';

/**
 * 用户资料 (profiles 表)
 */
export interface Profile {
  id: string;
  name: string;
  phone?: string;
  role: UserRole;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

/**
 * 认证会话信息
 */
export interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: {
    id: string;
    email?: string;
    phone?: string;
  };
}
