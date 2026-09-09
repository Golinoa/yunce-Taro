import { beforeEach, describe, expect, it, vi } from 'vitest';

const request = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock('@/utils/request', () => ({
  get: request.get,
  post: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
}));

describe('teacherService 薪资月份查询', () => {
  beforeEach(() => vi.resetAllMocks());

  it('将目标月份贯穿到教师列表请求', async () => {
    request.get.mockResolvedValue({
      list: [{ id: 't1', name: '教师一', payHistory: [] }],
      pagination: { page: 1, pageSize: 50, total: 1, totalPages: 1 },
    });

    const { teacherService } = await import('@/services/teacher');
    await teacherService.getList(undefined, '2026-08');

    expect(request.get).toHaveBeenCalledWith('/teachers', {
      page: 1,
      pageSize: 50,
      status: undefined,
      month: '2026-08',
    });
  });
});
