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

  /**
   * 回归：`pagination` 缺失时不能让整个列表崩掉。
   *
   * 缺该字段时 `getNextPageParam` 直读 `.page` 会在渲染期抛 TypeError，
   * useInfiniteQuery 随即把**已成功的响应**判成 isError，
   * 页面显示「学员加载失败」而后端日志是 200。
   */
  it('响应缺 pagination 时补保守值，不把 undefined 透传给页面', async () => {
    vi.mocked(get).mockResolvedValue({
      list: [
        {
          id: 'student-1',
          name: '王克明',
          createdAt: '2026-09-22T00:00:00.000Z',
        },
      ],
    } as never);

    const result = await studentService.getPageByTeacher('teacher-1', 1, 50, 'campus-1');

    expect(result.pagination).toEqual({
      page: 1,
      pageSize: 50,
      total: 1,
      totalPages: 1,
    });
    // totalPages=1 ⇒ 页面判定「没有下一页」，不会继续上拉
    expect(result.pagination.page < result.pagination.totalPages).toBe(false);
  });

  it('响应缺 pagination 且列表为空时同样返回可用的分页对象', async () => {
    vi.mocked(get).mockResolvedValue({ list: [] } as never);

    const result = await studentService.getPageByParent('parent-1', 1, 50);

    expect(result.list).toEqual([]);
    expect(result.pagination).toEqual({
      page: 1,
      pageSize: 50,
      total: 0,
      totalPages: 1,
    });
  });
});
