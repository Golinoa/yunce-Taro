import { beforeEach, describe, expect, it } from 'vitest';
import {
  mockDismissPending,
  mockEnqueuePending,
  mockGetBootstrap,
  mockReportAuth,
  mockResetState,
} from './subscribe-message';
import { MOCK_TMPL_IDS } from '@/constants/subscribe-presets';

const USER = 'test-user-subscribe';

describe('subscribe-message mock data', () => {
  beforeEach(() => {
    mockResetState();
  });

  it('bootstrap 返回默认 quotas', async () => {
    const data = await mockGetBootstrap(USER);
    expect(data.templates).toHaveLength(Object.keys(MOCK_TMPL_IDS).length);
    expect(data.quotas.every((q) => q.remain === 3)).toBe(true);
  });

  it('auth-report accept 增加 remain', async () => {
    const before = await mockGetBootstrap(USER);
    const todoBefore = before.quotas.find((q) => q.group === 'todo_remind')!.remain;

    const result = await mockReportAuth(USER, {
      scene: 'student_create_success',
      items: [{ tmplId: MOCK_TMPL_IDS.todo_remind, group: 'todo_remind', status: 'accept' }],
      clientRequestId: 'req-1',
    });

    const todoAfter = result.quotas.find((q) => q.group === 'todo_remind')!.remain;
    expect(todoAfter).toBe(todoBefore + 1);
  });

  it('reject 不增加 remain', async () => {
    const before = await mockGetBootstrap(USER);
    const todoBefore = before.quotas.find((q) => q.group === 'todo_remind')!.remain;

    await mockReportAuth(USER, {
      scene: 'student_create_success',
      items: [{ tmplId: MOCK_TMPL_IDS.todo_remind, group: 'todo_remind', status: 'reject' }],
      clientRequestId: 'req-2',
    });

    const after = await mockGetBootstrap(USER);
    expect(after.quotas.find((q) => q.group === 'todo_remind')!.remain).toBe(todoBefore);
  });

  it('pending dismiss 后不再返回', async () => {
    await mockEnqueuePending(USER, {
      id: 'p-1',
      presetId: 'student_join_class_teacher',
      eventCode: 'class_assign',
      payload: { studentName: '小明', className: '钢琴班' },
      templateGroups: ['class_remind'],
      scene: 'class_assign_teacher',
      priority: 10,
    });

    let data = await mockGetBootstrap(USER);
    expect(data.pendingPrompts).toHaveLength(1);

    await mockDismissPending(USER, 'p-1');
    data = await mockGetBootstrap(USER);
    expect(data.pendingPrompts).toHaveLength(0);
  });
});
