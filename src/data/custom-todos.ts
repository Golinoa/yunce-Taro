/**
 * 自定义待办 Mock 种子数据
 *
 * 使用场景：Mock 模式下自动注入演示待办（含逾期样例），供「我的待办」与首页四象限查看。
 * 日期按当前时间动态计算，保证随时打开都能看到逾期效果。
 */
import dayjs from 'dayjs';
import { isUseMock } from '@/utils/build-env';
import type { CustomTodoRecord } from '@/utils/custom-todos';
import {
  CUSTOM_TODO_ID_PREFIX,
  mergeCustomTodoSeeds,
  refreshMockCustomTodoSeedFields,
} from '@/utils/custom-todos';
import { TODO_CATEGORY_INBOX_ID } from '@/utils/todo-categories';

/** Mock 登录页三个测试账号均注入演示数据 */
export const MOCK_CUSTOM_TODO_SEED_USER_IDS = [
  'user-principal-001',
  'user-teacher-001',
  'user-parent-001',
];

const MOCK_SEED_IDS = {
  overdue1: `${CUSTOM_TODO_ID_PREFIX}mock-overdue-1`,
  overdue3: `${CUSTOM_TODO_ID_PREFIX}mock-overdue-3`,
  today: `${CUSTOM_TODO_ID_PREFIX}mock-today`,
  future: `${CUSTOM_TODO_ID_PREFIX}mock-future`,
  noRemind: `${CUSTOM_TODO_ID_PREFIX}mock-no-remind`,
} as const;

/** 按用户生成 Mock 待办（提醒日期相对今天动态计算） */
export function buildMockCustomTodoSeeds(userId: string): CustomTodoRecord[] {
  const today = dayjs().startOf('day');

  return [
    {
      id: MOCK_SEED_IDS.overdue1,
      userId,
      title: '点击任务可以编辑详情',
      remindDate: today.subtract(1, 'day').format('YYYY-MM-DD'),
      remindTime: '23:59',
      remindEnabled: true,
      quadrant: 'q1',
      categoryId: TODO_CATEGORY_INBOX_ID,
      createdAt: today.subtract(6, 'day').toISOString(),
    },
    {
      id: MOCK_SEED_IDS.overdue3,
      userId,
      title: '跟进试听家长回访',
      remindDate: today.subtract(3, 'day').format('YYYY-MM-DD'),
      remindTime: '18:00',
      remindEnabled: true,
      quadrant: 'q2',
      categoryId: TODO_CATEGORY_INBOX_ID,
      createdAt: today.subtract(8, 'day').toISOString(),
    },
    {
      id: MOCK_SEED_IDS.today,
      userId,
      title: '今日 15:00 备课检查',
      remindDate: today.format('YYYY-MM-DD'),
      remindTime: '15:00',
      remindEnabled: true,
      quadrant: 'q3',
      categoryId: TODO_CATEGORY_INBOX_ID,
      createdAt: today.subtract(1, 'day').toISOString(),
    },
    {
      id: MOCK_SEED_IDS.future,
      userId,
      title: '下周一提交月度报表',
      remindDate: today.add(5, 'day').format('YYYY-MM-DD'),
      remindTime: '09:00',
      remindEnabled: true,
      quadrant: 'q4',
      categoryId: TODO_CATEGORY_INBOX_ID,
      createdAt: today.toISOString(),
    },
    {
      id: MOCK_SEED_IDS.noRemind,
      userId,
      title: '无提醒的随手记',
      remindEnabled: false,
      quadrant: 'q4',
      categoryId: TODO_CATEGORY_INBOX_ID,
      createdAt: today.toISOString(),
    },
  ];
}

/** 为指定用户合并/刷新 Mock 种子 */
export function ensureMockCustomTodoSeedsForUser(userId: string): void {
  if (!userId) return;
  const seeds = buildMockCustomTodoSeeds(userId);
  mergeCustomTodoSeeds(userId, seeds);
  refreshMockCustomTodoSeedFields(userId, seeds);
}

/** 模块加载时预置三个测试账号的演示数据 */
export function mockInitCustomTodoSeeds(): void {
  if (!isUseMock()) return;

  MOCK_CUSTOM_TODO_SEED_USER_IDS.forEach((userId) => {
    ensureMockCustomTodoSeedsForUser(userId);
  });
}

mockInitCustomTodoSeeds();
