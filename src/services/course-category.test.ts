import { beforeEach, describe, expect, it, vi } from 'vitest';

const request = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
  ApiError: class ApiError extends Error {
    code: number;
    constructor(code: number, message: string) {
      super(message);
      this.code = code;
      this.name = 'ApiError';
    }
  },
}));
vi.mock('@/utils/request', () => request);

describe('courseCategoryService', () => {
  beforeEach(() => vi.resetAllMocks());

  it('loads list from /course-categories', async () => {
    request.get.mockResolvedValue([
      {
        id: 'cat-1',
        name: '团课',
        sortOrder: 2,
        minOpenCount: 1,
        bookingDeadline: 'at_start',
        cancelQueueTime: 'at_start',
        nonCancelTime: 'at_start',
        autoCheckin: 'at_end',
        studentSelfCheckin: true,
        distanceLimit: false,
        checkinBeforeMinutes: 60,
        checkinAfterMinutes: 120,
        mode: 'group',
        independentDisplay: true,
        isSystem: true,
        createdAt: '2026-09-11T00:00:00.000Z',
        updatedAt: '2026-09-11T00:00:00.000Z',
      },
    ]);
    const { courseCategoryService } = await import('@/services/course-category');
    const list = await courseCategoryService.getList();
    expect(list[0]?.name).toBe('团课');
    expect(request.get).toHaveBeenCalledWith('/course-categories');
  });

  it('writes create/update/remove against /course-categories', async () => {
    request.post.mockResolvedValue({
      id: 'cat-new',
      name: '暑期班',
      sortOrder: 4,
      minOpenCount: 1,
      bookingDeadline: 'at_start',
      cancelQueueTime: 'at_start',
      nonCancelTime: 'at_start',
      autoCheckin: 'at_end',
      studentSelfCheckin: true,
      distanceLimit: false,
      checkinBeforeMinutes: 60,
      checkinAfterMinutes: 120,
      mode: 'group',
      independentDisplay: true,
      createdAt: '2026-09-11T00:00:00.000Z',
      updatedAt: '2026-09-11T00:00:00.000Z',
    });
    request.put.mockResolvedValue({
      id: 'cat-new',
      name: '秋季班',
      sortOrder: 4,
      minOpenCount: 1,
      bookingDeadline: 'at_start',
      cancelQueueTime: 'at_start',
      nonCancelTime: 'at_start',
      autoCheckin: 'at_end',
      studentSelfCheckin: true,
      distanceLimit: false,
      checkinBeforeMinutes: 60,
      checkinAfterMinutes: 120,
      mode: 'group',
      independentDisplay: true,
      createdAt: '2026-09-11T00:00:00.000Z',
      updatedAt: '2026-09-11T01:00:00.000Z',
    });
    request.del.mockResolvedValue(undefined);

    const { courseCategoryService } = await import('@/services/course-category');
    await courseCategoryService.create({
      name: '暑期班',
      sortOrder: 4,
      minOpenCount: 1,
      bookingDeadline: 'at_start',
      cancelQueueTime: 'at_start',
      nonCancelTime: 'at_start',
      autoCheckin: 'at_end',
      studentSelfCheckin: true,
      distanceLimit: false,
      checkinBeforeMinutes: 60,
      checkinAfterMinutes: 120,
      mode: 'group',
      independentDisplay: true,
    });
    await courseCategoryService.update('cat-new', { name: '秋季班' });
    await courseCategoryService.remove('cat-new');

    expect(request.post).toHaveBeenCalledWith(
      '/course-categories',
      expect.objectContaining({ name: '暑期班', mode: 'group' }),
    );
    expect(request.put).toHaveBeenCalledWith('/course-categories/cat-new', { name: '秋季班' });
    expect(request.del).toHaveBeenCalledWith('/course-categories/cat-new');
  });

  it('getById：404 返回 null，其它错误抛出（不静默覆盖）', async () => {
    const { courseCategoryService } = await import('@/services/course-category');
    const { ApiError } = await import('@/utils/request');

    request.get.mockRejectedValueOnce(new ApiError(404, '分类不存在'));
    await expect(courseCategoryService.getById('cat-x')).resolves.toBeNull();

    request.get.mockRejectedValueOnce(new ApiError(500, '服务器错误'));
    await expect(courseCategoryService.getById('cat-x')).rejects.toThrow('服务器错误');
  });
});
