/**
 * Mock 专用：快速切换测试账号（仅 VITE_USE_MOCK=true 时挂载）
 * 勿引用 mock-database 大文件，避免生产树摇压力。
 *
 * 展示统一为「姓名(角色)」：万老师(管理员)、李老师(校长)、张老师(教师)
 */
export interface MockSwitchAccount {
  username: string;
  password: string;
  /** 对应 USERS.id */
  userId: string;
  /** 展示名（不含角色括号） */
  name: string;
  /** 角色短标签：管理员 / 校长 / 教师 / 家长 */
  roleLabel: string;
}

/** 统一展示：万老师(管理员) */
export function formatMockSwitchLabel(name: string, roleLabel: string): string {
  return `${name}(${roleLabel})`;
}

/** 与种子账号一致，密码均为 123456；教职工按角色区分体验 */
export const MOCK_SWITCH_ACCOUNTS: MockSwitchAccount[] = [
  {
    username: 'principal1',
    password: '123456',
    userId: 'user-principal-001',
    name: '万老师',
    roleLabel: '管理员',
  },
  {
    username: 'teacher2',
    password: '123456',
    userId: 'user-teacher-002',
    name: '李老师',
    roleLabel: '校长',
  },
  {
    username: 'teacher1',
    password: '123456',
    userId: 'user-teacher-001',
    name: '张老师',
    roleLabel: '教师',
  },
  {
    username: 'teacher3',
    password: '123456',
    userId: 'user-teacher-003',
    name: '王老师',
    roleLabel: '教师',
  },
  {
    username: 'teacher4',
    password: '123456',
    userId: 'user-teacher-004',
    name: '赵老师',
    roleLabel: '教师',
  },
  {
    username: 'parent1',
    password: '123456',
    userId: 'user-parent-001',
    name: '张老师',
    roleLabel: '家长',
  },
  {
    username: 'parent2',
    password: '123456',
    userId: 'user-parent-002',
    name: '赵小红妈妈',
    roleLabel: '家长',
  },
  {
    username: 'parent3',
    password: '123456',
    userId: 'user-parent-003',
    name: '李子轩爸爸',
    roleLabel: '家长',
  },
];
