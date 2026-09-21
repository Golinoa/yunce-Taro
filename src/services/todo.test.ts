import { beforeEach, describe, expect, it, vi } from 'vitest';
import { todoService } from '@/services/todo';

const getMock = vi.fn();

vi.mock('@/utils/request', () => ({
  get: (...args: unknown[]) => getMock(...args),
  post: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
}));

describe('todoService 列表契约', () => {
  beforeEach(() => {
    getMock.mockReset();
    getMock.mockResolvedValue({ items: [], quadrantOverrides: {} });
  });

  it('完整待办按 YYYY-MM 发送 month，复用与首页相同的 /todos 出口', async () => {
    await todoService.getList({
      view: 'all',
      month: '2026-09',
      campusId: 'campus-1',
      teacherId: 'teacher-1',
      userId: 'user-1',
      userName: '教师',
    });

    expect(getMock).toHaveBeenCalledWith('/todos?view=all&campusId=campus-1&month=2026-09');
  });
});
