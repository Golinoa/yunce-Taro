import { beforeEach, describe, expect, it, vi } from 'vitest';

const request = vi.hoisted(() => ({ post: vi.fn() }));

vi.mock('@/utils/request', () => ({
  get: vi.fn(),
  post: request.post,
  put: vi.fn(),
  del: vi.fn(),
}));

describe('teacherSalaryRuleService.copyToTeachers', () => {
  beforeEach(() => vi.resetAllMocks());

  it('sends source and target IDs and preserves partial result details', async () => {
    request.post.mockResolvedValue({
      sourceTeacherId: 'source',
      success: false,
      copiedIds: ['target-a'],
      failedIds: ['target-b'],
      failures: [{ id: 'target-b', reason: '教师不属于当前机构' }],
      message: '已复制 1 位，1 位失败',
    });

    const { teacherSalaryRuleService } = await import('@/services/teacher');
    await expect(
      teacherSalaryRuleService.copyToTeachers('source', ['target-a', 'target-b']),
    ).resolves.toMatchObject({
      success: false,
      copiedIds: ['target-a'],
      failedIds: ['target-b'],
    });
    expect(request.post).toHaveBeenCalledWith('/teachers/source/salary-rule/copy', {
      targetTeacherIds: ['target-a', 'target-b'],
    });
  });
});
