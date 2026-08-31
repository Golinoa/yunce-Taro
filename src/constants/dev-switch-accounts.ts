/**
 * 测环境 / Mock 共用：快速切换测试账号
 * 密码均为 123456；真实联调走邮箱密码登录（/auth/password-login）
 */
export interface DevSwitchAccount {
  /** 短用户名（兼容 mock 切换器） */
  username: string;
  /** 种子邮箱（password-login） */
  email: string;
  password: string;
  /** 对应 User.id */
  userId: string;
  name: string;
  roleLabel: string;
}

/** @deprecated 使用 DevSwitchAccount */
export type MockSwitchAccount = DevSwitchAccount;

export function formatMockSwitchLabel(name: string, roleLabel: string): string {
  return `${name}(${roleLabel})`;
}

export const DEV_SWITCH_ACCOUNTS: DevSwitchAccount[] = [
  {
    username: 'principal1',
    email: 'principal1@yunce.com',
    password: '123456',
    userId: 'user-principal-001',
    name: '万老师',
    roleLabel: '管理员',
  },
  {
    username: 'teacher2',
    email: 'teacher2@yunce.com',
    password: '123456',
    userId: 'user-teacher-002',
    name: '李老师',
    roleLabel: '校长',
  },
  {
    username: 'teacher1',
    email: 'teacher1@yunce.com',
    password: '123456',
    userId: 'user-teacher-001',
    name: '张老师',
    roleLabel: '教师',
  },
  {
    username: 'teacher3',
    email: 'teacher3@yunce.com',
    password: '123456',
    userId: 'user-teacher-003',
    name: '王老师',
    roleLabel: '教师',
  },
  {
    username: 'teacher4',
    email: 'teacher4@yunce.com',
    password: '123456',
    userId: 'user-teacher-004',
    name: '赵老师',
    roleLabel: '教师',
  },
  {
    username: 'parent1',
    email: 'parent1@yunce.com',
    password: '123456',
    userId: 'user-parent-001',
    name: '张老师',
    roleLabel: '家长',
  },
  {
    username: 'parent2',
    email: 'parent2@yunce.com',
    password: '123456',
    userId: 'user-parent-002',
    name: '赵小红妈妈',
    roleLabel: '家长',
  },
  {
    username: 'parent3',
    email: 'parent3@yunce.com',
    password: '123456',
    userId: 'user-parent-003',
    name: '李子轩爸爸',
    roleLabel: '家长',
  },
];

/** @deprecated 使用 DEV_SWITCH_ACCOUNTS */
export const MOCK_SWITCH_ACCOUNTS = DEV_SWITCH_ACCOUNTS;

/** 短用户名或邮箱 → 登录邮箱 */
export function resolveDevLoginEmail(usernameOrEmail: string): string | null {
  const raw = usernameOrEmail.trim().toLowerCase();
  if (!raw) return null;
  if (raw.includes('@')) return raw;
  const hit = DEV_SWITCH_ACCOUNTS.find((a) => a.username.toLowerCase() === raw);
  return hit?.email ?? null;
}
