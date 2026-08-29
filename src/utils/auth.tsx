/**
 * 认证状态管理 Hook + AuthProvider
 * 使用 React Context 在全局共享认证状态
 * 支持多身份切换、分步注册草稿
 */
import Taro from '@tarojs/taro';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { markLastLoginAsNewUser } from '@/utils/auth-onboarding';
import {
  addIdentity as addIdentityService,
  getProfileExtra,
  getSession,
  loginByEmailCode,
  login,
  logout,
  phoneLogin,
  registerStep1,
  registerStep1ByPhone,
  registerStep1ByEmail,
  registerStep2,
  registerStep3,
  restoreRegisterDrafts,
  switchIdentity as switchIdentityService,
  updateProfile as updateProfileService,
  validateInviteCode as validateInviteCodeService,
  wechatLogin,
  bindWechatCredentials,
} from '@/services/auth';
import type {
  AuthSession,
  Identity,
  ParentRoleInfo,
  PrincipalRoleInfo,
  Profile,
  RegisterDraft,
  TeacherRoleInfo,
  UserRole,
} from '@/types/profile';
import { syncTabBarByProfile } from '@/utils/tab-bar';

// ============================================
// 类型定义
// ============================================
export interface AuthState {
  /** 当前登录用户资料 */
  profile: Profile | null;
  /** 当前会话 */
  session: AuthSession | null;
  /** 是否正在初始化/加载 */
  loading: boolean;
  /** 所有身份列表 */
  identities: Identity[];
  /** 当前身份 */
  currentIdentity: Identity | null;
  /** 当前角色 */
  currentRole: UserRole | null;
  /** 注册草稿（跨步骤共享） */
  registerDraft: RegisterDraft | null;

  /** 用户名密码登录 */
  signInWithUsername: (
    username: string,
    password: string,
  ) => Promise<{ error: { message: string } | null }>;
  /** 微信一键登录 */
  signInWithWechat: (
    code: string,
  ) => Promise<{ error: { message: string } | null; isNewUser?: boolean }>;
  /** 微信登录后绑定手机号+密码（无短信） */
  bindWechatPhone: (
    phone: string,
    password: string,
  ) => Promise<{ error: { message: string } | null }>;
  /** 手机号验证码登录 */
  signInWithPhone: (phone: string, code: string) => Promise<{ error: { message: string } | null }>;
  /** 邮箱验证码登录 */
  signInWithEmailCode: (
    email: string,
    code: string,
  ) => Promise<{ error: { message: string } | null; isNewUser?: boolean }>;

  /** 注册 Step1：创建账号（邮箱） */
  signUpStep1: (payload: {
    username?: string;
    password?: string;
    phone?: string;
    email?: string;
    inviteCode?: string;
  }) => Promise<{ error: { message: string } | null }>;
  /** 注册 Step2：选择身份 */
  signUpStep2: (role: UserRole) => Promise<{ error: { message: string } | null }>;
  /** 注册 Step3：补全角色信息并完成注册 */
  signUpStep3: (
    roleInfo: PrincipalRoleInfo | TeacherRoleInfo | ParentRoleInfo,
  ) => Promise<{ error: { message: string } | null }>;

  /** 更新注册草稿（用于 Step2/Step3 页面本地修改） */
  updateRegisterDraft: (patch: Partial<RegisterDraft>) => void;
  /** 清空注册草稿 */
  clearRegisterDraft: () => void;

  /** 切换当前身份 */
  switchIdentity: (identityId: string) => Promise<{ error: { message: string } | null }>;
  /** 添加新身份 */
  addIdentity: (
    role: UserRole,
    roleInfo: PrincipalRoleInfo | TeacherRoleInfo | ParentRoleInfo,
  ) => Promise<{ error: { message: string } | null }>;

  /** 验证邀请码 */
  validateInviteCode: (code: string) => Promise<{ valid: boolean; inviterName?: string }>;

  /** 更新当前用户基础资料（昵称/头像/手机/邮箱/性别/生日/证件/地区/地址） */
  updateProfile: (
    patch: Partial<{
      name: string;
      nickname: string;
      avatar_url: string;
      phone: string;
      email: string;
      gender: 'male' | 'female' | 'other';
      birthday: string;
      id_card: string;
      region: string;
      address: string;
    }>,
  ) => Promise<{ error: { message: string } | null }>;
  /** 获取用户扩展资料（性别/生日/证件/地区/地址） */
  getProfileExtra: () => Promise<{
    gender?: 'male' | 'female' | 'other';
    birthday?: string;
    id_card?: string;
    region?: string;
    address?: string;
  }>;

  /** 刷新用户资料 */
  refreshProfile: () => Promise<void>;
  /** 退出登录 */
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/**
 * 判断角色是否为管理员
 * 过渡期 principal 同享管理员权限，正式期改为仅 admin
 */
export const isAdmin = (role: UserRole | null | undefined): boolean =>
  role === 'admin' || role === 'principal';

/**
 * 判断角色是否为校长及以上（admin + principal）
 * 用于数据范围控制（如校区级数据）
 */
export const isPrincipalOrAbove = (role: UserRole | null | undefined): boolean =>
  role === 'admin' || role === 'principal';

/**
 * 判断角色是否为机构端（admin + principal + teacher + assistant）
 * 校长拥有教师全部权限，教师是校长的子集
 */
export const isStaffRole = (role: UserRole | null | undefined): boolean => {
  return role === 'admin' || role === 'principal' || role === 'teacher' || role === 'assistant';
};

/**
 * 判断角色是否为教学角色（teacher + assistant，不含管理岗）
 */
export const isTeachingRole = (role: UserRole | null | undefined): boolean =>
  role === 'teacher' || role === 'assistant';

/**
 * 判断角色是否为老师（不含助教）
 */
export const isTeacherRole = (role: UserRole | null | undefined): boolean => role === 'teacher';

/**
 * 判断角色是否为助教
 */
export const isAssistantRole = (role: UserRole | null | undefined): boolean => role === 'assistant';

/**
 * 判断角色是否为学生家长
 */
export const isParentRole = (role: UserRole | null | undefined): boolean => role === 'parent';

// storage key
const REGISTER_DRAFT_STORAGE_KEY = 'yunce-edu-register-draft-local';
const AUTH_TOKEN_KEY = 'yunce-edu-auth-token';
const USER_PROFILE_KEY = 'yunce-edu-user-profile';

/** 店铺管理 onboarding 引导是否已隐藏（true/false） */
export const STORE_ONBOARDING_HIDDEN_KEY = 'store_onboarding_hidden';

/** 店铺管理 onboarding 各步骤是否已访问过（JSON: { campus: true, venue: false, ... }） */
export const STORE_ONBOARDING_VISITED_KEY = 'store_onboarding_visited';

const clearPersistedAuth = (): void => {
  try {
    Taro.removeStorageSync(USER_PROFILE_KEY);
    Taro.removeStorageSync(AUTH_TOKEN_KEY);
    Taro.removeStorageSync('userRole');
  } catch {
    /* ignore */
  }
};

// ============================================
// AuthProvider
// ============================================
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [registerDraft, setRegisterDraft] = useState<RegisterDraft | null>(null);

  const identities = useMemo(() => profile?.identities || [], [profile]);
  const currentIdentity = useMemo(() => {
    if (!profile?.currentContext) return null;
    return (
      profile.identities.find((i) => i.id === profile.currentContext.identityId) ||
      profile.identities[0] ||
      null
    );
  }, [profile]);
  const currentRole = useMemo(() => currentIdentity?.role || null, [currentIdentity]);

  // 持久化 profile/session 到本地
  const persistAuth = useCallback((p: Profile | null, s: AuthSession | null) => {
    try {
      if (p && s) {
        Taro.setStorageSync(USER_PROFILE_KEY, JSON.stringify(p));
        Taro.setStorageSync(AUTH_TOKEN_KEY, JSON.stringify(s));
      } else {
        clearPersistedAuth();
      }
    } catch {
      /* ignore */
    }
  }, []);

  // 同步写入当前角色（兼容旧代码读取 userRole）
  const syncUserRole = useCallback((role: UserRole | null) => {
    if (role) {
      Taro.setStorageSync('userRole', role);
    } else {
      Taro.removeStorageSync('userRole');
    }
  }, []);

  // 初始化：从 storage 恢复会话与注册草稿
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        restoreRegisterDrafts();
        const { session: s, profile: p } = await getSession();
        if (cancelled) return;

        setSession(s);
        setProfile(p);
        syncUserRole(p?.currentContext?.role || null);

        const draftStr = Taro.getStorageSync(REGISTER_DRAFT_STORAGE_KEY);
        if (draftStr) {
          try {
            const draft: RegisterDraft = JSON.parse(draftStr);
            setRegisterDraft(draft);
          } catch {
            Taro.removeStorageSync(REGISTER_DRAFT_STORAGE_KEY);
          }
        }
      } catch {
        setSession(null);
        setProfile(null);
        setRegisterDraft(null);
        clearPersistedAuth();
        syncUserRole(null);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [syncUserRole]);

  // Tab「数据」仅管理员/校长可见：登录、切身份后同步
  useEffect(() => {
    if (loading) return;
    syncTabBarByProfile(profile);
  }, [loading, profile]);

  // 注册草稿持久化
  useEffect(() => {
    try {
      if (registerDraft) {
        Taro.setStorageSync(REGISTER_DRAFT_STORAGE_KEY, JSON.stringify(registerDraft));
      } else {
        Taro.removeStorageSync(REGISTER_DRAFT_STORAGE_KEY);
      }
    } catch {
      /* ignore */
    }
  }, [registerDraft]);

  // 登录：用户名密码
  const signInWithUsername = useCallback(
    async (username: string, password: string) => {
      const result = await login(username, password);
      if (result.error) return { error: result.error };
      setSession(result.session);
      setProfile(result.profile);
      persistAuth(result.profile, result.session);
      syncUserRole(result.profile?.currentContext?.role || null);
      return { error: null };
    },
    [persistAuth, syncUserRole],
  );

  // 登录：微信
  const signInWithWechat = useCallback(
    async (code: string) => {
      const result = await wechatLogin(code);
      if (result.error) return { error: result.error };
      if (result.isNewUser) {
        markLastLoginAsNewUser();
      }
      setSession(result.session);
      setProfile(result.profile);
      persistAuth(result.profile, result.session);
      syncUserRole(result.profile?.currentContext?.role || null);
      return { error: null, isNewUser: result.isNewUser };
    },
    [persistAuth, syncUserRole],
  );

  // 微信登录后绑定手机号+密码
  const bindWechatPhone = useCallback(
    async (phone: string, password: string) => {
      const result = await bindWechatCredentials({ phone, password });
      if (result.error) return { error: result.error };
      setSession(result.session);
      setProfile(result.profile);
      persistAuth(result.profile, result.session);
      syncUserRole(result.profile?.currentContext?.role || null);
      return { error: null };
    },
    [persistAuth, syncUserRole],
  );

  // 登录：手机
  const signInWithPhone = useCallback(
    async (phone: string, code: string) => {
      const result = await phoneLogin(phone, code);
      if (result.error) return { error: result.error };
      setSession(result.session);
      setProfile(result.profile);
      persistAuth(result.profile, result.session);
      syncUserRole(result.profile?.currentContext?.role || null);
      return { error: null };
    },
    [persistAuth, syncUserRole],
  );

  // 登录：邮箱验证码
  const signInWithEmailCode = useCallback(
    async (email: string, code: string) => {
      const result = await loginByEmailCode(email, code);
      if (result.error) return { error: result.error };
      if (result.isNewUser) {
        markLastLoginAsNewUser();
      }
      setSession(result.session);
      setProfile(result.profile);
      persistAuth(result.profile, result.session);
      syncUserRole(result.profile?.currentContext?.role || null);
      return { error: null, isNewUser: result.isNewUser };
    },
    [persistAuth, syncUserRole],
  );

  // 注册 Step1
  const signUpStep1 = useCallback(
    async (payload: {
      username?: string;
      password?: string;
      phone?: string;
      email?: string;
      inviteCode?: string;
    }) => {
      const useEmailRegister = Boolean(payload.email) && !payload.username;
      const usePhoneRegister = Boolean(payload.phone) && !payload.username && !payload.email;
      const result = useEmailRegister
        ? await registerStep1ByEmail(payload.email!, payload.password || '')
        : usePhoneRegister
          ? await registerStep1ByPhone(payload.phone!, payload.password || '')
          : await registerStep1(payload.username || '', payload.password || '', payload.inviteCode);

      if (result.error || !result.tempToken) {
        return { error: result.error || { message: '注册失败' } };
      }

      const draft: RegisterDraft = useEmailRegister
        ? {
            tempToken: result.tempToken,
            email: payload.email!.trim(),
            username: payload.email!.trim(),
            password: payload.password || '',
            inviteCode: payload.inviteCode,
          }
        : usePhoneRegister
          ? {
              tempToken: result.tempToken,
              phone: payload.phone!.trim(),
              username: '',
              password: '',
              inviteCode: payload.inviteCode,
            }
          : {
              tempToken: result.tempToken,
              username: payload.username!.trim(),
              password: payload.password!,
              inviteCode: payload.inviteCode,
            };
      setRegisterDraft(draft);
      return { error: null };
    },
    [],
  );

  // 注册 Step2
  const signUpStep2 = useCallback(
    async (role: UserRole) => {
      if (!registerDraft?.tempToken) return { error: { message: '注册已过期，请重新填写' } };
      const result = await registerStep2(registerDraft.tempToken, role);
      if (result.error) return { error: result.error };
      setRegisterDraft((prev) => (prev ? { ...prev, role } : null));
      return { error: null };
    },
    [registerDraft?.tempToken],
  );

  // 注册 Step3
  const signUpStep3 = useCallback(
    async (roleInfo: PrincipalRoleInfo | TeacherRoleInfo | ParentRoleInfo) => {
      if (!registerDraft?.tempToken) return { error: { message: '注册已过期，请重新填写' } };
      const result = await registerStep3(registerDraft.tempToken, roleInfo);
      if (result.error) return { error: result.error };
      setSession(result.session);
      setProfile(result.profile);
      setRegisterDraft(null);
      persistAuth(result.profile, result.session);
      syncUserRole(result.profile?.currentContext?.role || null);
      return { error: null };
    },
    [registerDraft?.tempToken, persistAuth, syncUserRole],
  );

  const updateRegisterDraft = useCallback((patch: Partial<RegisterDraft>) => {
    setRegisterDraft((prev) => (prev ? { ...prev, ...patch } : null));
  }, []);

  const clearRegisterDraft = useCallback(() => {
    setRegisterDraft(null);
  }, []);

  // 切换身份
  const switchIdentity = useCallback(
    async (identityId: string) => {
      const result = await switchIdentityService(identityId);
      if (result.error) return { error: result.error };
      if (result.profile) {
        setProfile(result.profile);
        persistAuth(result.profile, session);
        syncUserRole(result.profile.currentContext.role);
      }
      return { error: null };
    },
    [session, persistAuth, syncUserRole],
  );

  // 添加身份
  const addIdentity = useCallback(
    async (role: UserRole, roleInfo: PrincipalRoleInfo | TeacherRoleInfo | ParentRoleInfo) => {
      const result = await addIdentityService(role, roleInfo);
      if (result.error) return { error: result.error };
      if (result.profile) {
        setProfile(result.profile);
        persistAuth(result.profile, session);
        syncUserRole(result.profile.currentContext.role);
      }
      return { error: null };
    },
    [session, persistAuth, syncUserRole],
  );

  // 验证邀请码
  const validateInviteCode = useCallback(async (code: string) => {
    return validateInviteCodeService(code);
  }, []);

  // 更新基础资料
  const updateProfile = useCallback<AuthState['updateProfile']>(
    async (patch) => {
      const result = await updateProfileService(patch);
      if (result.error || !result.profile) return { error: result.error };
      setProfile(result.profile);
      persistAuth(result.profile, session);
      return { error: null };
    },
    [session, persistAuth],
  );

  // 读取扩展资料
  const getProfileExtraFn = useCallback(async () => {
    if (!profile?.id) return {};
    return getProfileExtra(profile.id);
  }, [profile?.id]);

  // 刷新资料
  const refreshProfile = useCallback(async () => {
    try {
      const { session: s, profile: p } = await getSession();
      setSession(s);
      setProfile(p);
      persistAuth(p, s);
      syncUserRole(p?.currentContext?.role || null);
    } catch {
      setSession(null);
      setProfile(null);
      persistAuth(null, null);
      syncUserRole(null);
    }
  }, [persistAuth, syncUserRole]);

  // 退出登录
  const signOut = useCallback(async () => {
    try {
      await logout();
    } finally {
      setProfile(null);
      setSession(null);
      setRegisterDraft(null);
      persistAuth(null, null);
      syncUserRole(null);
      try {
        Taro.removeStorageSync(REGISTER_DRAFT_STORAGE_KEY);
        Taro.removeStorageSync('loginRedirectPath');
      } catch {
        /* ignore */
      }
    }
  }, [persistAuth, syncUserRole]);

  const value: AuthState = useMemo(
    () => ({
      profile,
      session,
      loading,
      identities,
      currentIdentity,
      currentRole,
      registerDraft,
      signInWithUsername,
      signInWithWechat,
      bindWechatPhone,
      signInWithPhone,
      signInWithEmailCode,
      signUpStep1,
      signUpStep2,
      signUpStep3,
      updateRegisterDraft,
      clearRegisterDraft,
      switchIdentity,
      addIdentity,
      validateInviteCode,
      refreshProfile,
      updateProfile,
      getProfileExtra: getProfileExtraFn,
      signOut,
    }),
    [
      profile,
      session,
      loading,
      identities,
      currentIdentity,
      currentRole,
      registerDraft,
      signInWithUsername,
      signInWithWechat,
      bindWechatPhone,
      signInWithPhone,
      signInWithEmailCode,
      signUpStep1,
      signUpStep2,
      signUpStep3,
      updateRegisterDraft,
      clearRegisterDraft,
      switchIdentity,
      addIdentity,
      validateInviteCode,
      refreshProfile,
      updateProfile,
      getProfileExtraFn,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// ============================================
// useAuth Hook
// ============================================
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
