import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from '@/utils/request';
import { studentService } from './student';

vi.mock('@/utils/request', () => ({
  del: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}));

describe('studentService 分页列表', () => {
  beforeEach(() => vi.clearAllMocks());

  it('教师列表只请求指定页，并保留搜索和校区条件', async () => {
    vi.mocked(get).mockResolvedValue({
      list: [
        {
          id: 'student-1',
          name: '王克明',
          nickname: '老王',
          createdAt: '2026-09-22T00:00:00.000Z',
          gender: 'MALE',
        },
      ],
      pagination: { page: 2, pageSize: 50, total: 101, totalPages: 3 },
    });

    const result = await studentService.getPageByTeacher('teacher-1', 2, 50, 'campus-1', '王克明');

    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith(
      '/students?page=2&pageSize=50&campusId=campus-1&keyword=%E7%8E%8B%E5%85%8B%E6%98%8E',
    );
    expect(result.pagination.totalPages).toBe(3);
    expect(result.list[0]).toMatchObject({ id: 'student-1', name: '王克明', nickname: '老王' });
  });

  it('家长列表不会自动拉取后续页', async () => {
    vi.mocked(get).mockResolvedValue({
      list: [],
      pagination: { page: 1, pageSize: 50, total: 1000, totalPages: 20 },
    });

    const result = await studentService.getPageByParent('parent-1', 1);

    expect(get).toHaveBeenCalledTimes(1);
    expect(result.pagination.total).toBe(1000);
  });
});
