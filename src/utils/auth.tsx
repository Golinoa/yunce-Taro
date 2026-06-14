/**
 * 认证状态管理 Hook + AuthProvider
 * 对应原代码中的 useAuth / AuthProvider
 * 使用 React Context 在全局共享认证状态
 */
import Taro from '@tarojs/taro';
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { authService } from '@/services/auth';
import type { UserRole, Profile, AuthSession } from '@/types/profile';

// ============================================
// 类型定义
// ============================================
interface AuthState {
  /** 当前登录用户资料 */
  profile: Profile | null;
  /** 当前会话 */
  session: AuthSession | null;
  /** 是否正在加载 */
  loading: boolean;
  /** 用户名密码登录 */
  signInWithUsername: (
    username: string,
    password: string,
  ) => Promise<{ error: { message: string } | null }>;
  /** 用户注册 */
  signUpWithUsername: (
    username: string,
    password: string,
    role: UserRole,
    name: string,
    inviteCode?: string,
  ) => Promise<{ error: { message: string } | null }>;
  /** 验证邀请码 */
  validateInviteCode: (
    code: string,
  ) => Promise<{ valid: boolean; studentId?: string; studentName?: string }>;
  /** 退出登录 */
  signOut: () => Promise<void>;
  /** 刷新用户资料 */
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

// ============================================
// AuthProvider
// ============================================
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  // 初始化：从 storage 恢复会话
  useEffect(() => {
    let cancelled = false;
    authService.getSession().then(({ session: s, profile: p }) => {
      if (!cancelled) {
        setSession(s);
        setProfile(p);
        // 与原代码对齐：根据 profile.role 写入 userRole
        if (p?.role) {
          Taro.setStorageSync('userRole', p.role);
        } else {
          Taro.removeStorageSync('userRole');
        }
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // 用户名密码登录
  const signInWithUsername = useCallback(async (username: string, password: string) => {
    const result = await authService.login(username, password);
    if (result.error) return { error: result.error };
    setSession(result.session);
    setProfile(result.profile);
    // 与原代码对齐：登录成功后写入 userRole
    if (result.profile?.role) {
      Taro.setStorageSync('userRole', result.profile.role);
    }
    return { error: null };
  }, []);

  // 注册
  const signUpWithUsername = useCallback(
    async (
      username: string,
      password: string,
      role: UserRole,
      name: string,
      inviteCode?: string,
    ) => {
      const result = await authService.register(username, password, role, name, inviteCode);
      if (result.error) return { error: result.error };
      setSession(result.session);
      setProfile(result.profile);
      // 与原代码对齐：注册成功后写入 userRole
      if (result.profile?.role) {
        Taro.setStorageSync('userRole', result.profile.role);
      }
      return { error: null };
    },
    [],
  );

  // 验证邀请码
  const validateInviteCode = useCallback(async (code: string) => {
    return await authService.validateInviteCode(code);
  }, []);

  // 退出
  const signOut = useCallback(async () => {
    await authService.logout();
    setProfile(null);
    setSession(null);
    Taro.removeStorageSync('userRole');
  }, []);

  // 刷新资料（同时检测 token 过期）
  const refreshProfile = useCallback(async () => {
    const { session: s, profile: p } = await authService.getSession();
    setSession(s);
    setProfile(p);
    // token 过期时清除 userRole
    if (!p?.role) {
      Taro.removeStorageSync('userRole');
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        profile,
        session,
        loading,
        signInWithUsername,
        signUpWithUsername,
        validateInviteCode,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// ============================================
// useAuth Hook
// ============================================
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
