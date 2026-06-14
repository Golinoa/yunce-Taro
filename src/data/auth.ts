/**
 * Mock 认证接口
 * 模拟后端 /auth/login、/auth/register、/auth/session 等接口
 * 后续对接真实 API 时替换此文件即可
 */
import type { UserRole, Profile, AuthSession } from '@/types/profile';

// ============================================
// Mock 用户数据库
// ============================================
interface MockUser {
  id: string;
  username: string;
  password: string;
  name: string;
  role: UserRole;
  inviteCode?: string;
}

const MOCK_USERS: MockUser[] = [
  {
    id: 'teacher-001',
    username: 'teacher1',
    password: '123456',
    name: '张老师',
    role: 'teacher',
    inviteCode: 'TC001',
  },
  { id: 'parent-001', username: 'parent1', password: '123456', name: '李家长', role: 'parent' },
];

// 邀请码 → 学生ID 映射
const INVITE_CODE_MAP: Record<string, { studentId: string; studentName: string }> = {
  ST001: { studentId: 'student-001', studentName: '王小明' },
  ST002: { studentId: 'student-002', studentName: '赵小红' },
};

// Token 存储 key
const AUTH_TOKEN_KEY = 'yunce-edu-auth-token';
const USER_PROFILE_KEY = 'yunce-edu-user-profile';

// ============================================
// 工具函数
// ============================================
function generateId(): string {
  return `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function generateToken(): string {
  return `mock-token-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function delay(ms: number = 500): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================
// Mock API
// ============================================

/** 用户名密码登录 — 用户名自动拼接 @miaoda.com */
export async function mockLogin(
  username: string,
  password: string,
): Promise<{
  session: AuthSession | null;
  profile: Profile | null;
  error: { message: string } | null;
}> {
  await delay(800);
  const email = `${username}@miaoda.com`;
  const user = MOCK_USERS.find((u) => u.username === username && u.password === password);

  if (!user) {
    return { session: null, profile: null, error: { message: '用户名或密码错误' } };
  }

  const session: AuthSession = {
    access_token: generateToken(),
    refresh_token: generateToken(),
    expires_at: Date.now() / 1000 + 3600,
    user: { id: user.id, email },
  };

  const profile: Profile = {
    id: user.id,
    name: user.name,
    role: user.role,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // 持久化到 storage
  try {
    wx.setStorageSync(AUTH_TOKEN_KEY, JSON.stringify(session));
    wx.setStorageSync(USER_PROFILE_KEY, JSON.stringify(profile));
  } catch {
    /* ignore */
  }

  return { session, profile, error: null };
}

/** 用户注册 */
export async function mockRegister(
  username: string,
  password: string,
  role: UserRole,
  name: string,
  inviteCode?: string,
): Promise<{
  session: AuthSession | null;
  profile: Profile | null;
  error: { message: string } | null;
}> {
  await delay(800);

  // 检查用户名是否已存在
  if (MOCK_USERS.some((u) => u.username === username)) {
    return { session: null, profile: null, error: { message: '用户名已存在' } };
  }

  // 家长角色需要验证邀请码
  if (role === 'parent' && inviteCode) {
    if (!INVITE_CODE_MAP[inviteCode.toUpperCase()]) {
      return { session: null, profile: null, error: { message: '邀请码无效' } };
    }
  }

  const userId = generateId();
  const email = `${username}@miaoda.com`;

  const newUser: MockUser = {
    id: userId,
    username,
    password,
    name,
    role,
    inviteCode: role === 'teacher' ? `TC${MOCK_USERS.length + 1}`.padStart(6, '0') : undefined,
  };
  MOCK_USERS.push(newUser);

  const session: AuthSession = {
    access_token: generateToken(),
    refresh_token: generateToken(),
    expires_at: Date.now() / 1000 + 3600,
    user: { id: userId, email },
  };

  const profile: Profile = {
    id: userId,
    name,
    role,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  try {
    wx.setStorageSync(AUTH_TOKEN_KEY, JSON.stringify(session));
    wx.setStorageSync(USER_PROFILE_KEY, JSON.stringify(profile));
  } catch {
    /* ignore */
  }

  return { session, profile, error: null };
}

/** 验证邀请码 */
export async function mockValidateInviteCode(code: string): Promise<{
  valid: boolean;
  studentId?: string;
  studentName?: string;
}> {
  await delay(300);
  const info = INVITE_CODE_MAP[code.toUpperCase()];
  return info
    ? { valid: true, studentId: info.studentId, studentName: info.studentName }
    : { valid: false };
}

/** 获取当前会话（从 storage 恢复） */
export async function mockGetSession(): Promise<{
  session: AuthSession | null;
  profile: Profile | null;
}> {
  try {
    const tokenStr = wx.getStorageSync(AUTH_TOKEN_KEY);
    const profileStr = wx.getStorageSync(USER_PROFILE_KEY);
    if (!tokenStr) return { session: null, profile: null };

    const session: AuthSession = JSON.parse(tokenStr);
    const profile: Profile | null = profileStr ? JSON.parse(profileStr) : null;

    // 检查 token 是否过期
    if (session.expires_at * 1000 < Date.now()) {
      wx.removeStorageSync(AUTH_TOKEN_KEY);
      wx.removeStorageSync(USER_PROFILE_KEY);
      return { session: null, profile: null };
    }

    return { session, profile };
  } catch {
    return { session: null, profile: null };
  }
}

/** 退出登录 */
export async function mockLogout(): Promise<void> {
  try {
    wx.removeStorageSync(AUTH_TOKEN_KEY);
    wx.removeStorageSync(USER_PROFILE_KEY);
    wx.removeStorageSync('userRole');
  } catch {
    /* ignore */
  }
}
