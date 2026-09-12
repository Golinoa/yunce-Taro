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

describe('courseTemplateService', () => {
  beforeEach(() => vi.resetAllMocks());

  it('loads list from /course-templates with optional categoryId', async () => {
    request.get.mockResolvedValue([
      {
        id: 'tpl-1',
        name: '少儿篮球',
        categoryId: 'cat-group',
        category: 'group',
        duration: 60,
        capacity: 12,
        status: 'active',
        createdAt: '2026-09-11T00:00:00.000Z',
        updatedAt: '2026-09-11T00:00:00.000Z',
      },
    ]);
    const { courseTemplateService } = await import('@/services/course-template');
    const list = await courseTemplateService.getList('cat-group');
    expect(list[0]?.name).toBe('少儿篮球');
    expect(request.get).toHaveBeenCalledWith('/course-templates', { categoryId: 'cat-group' });
  });

  it('writes create/update/copy/remove against /course-templates', async () => {
    request.post
      .mockResolvedValueOnce({
        id: 'tpl-1',
        name: '少儿篮球',
        categoryId: 'cat-group',
        category: 'group',
        duration: 60,
        capacity: 12,
        status: 'active',
        createdAt: '2026-09-11T00:00:00.000Z',
        updatedAt: '2026-09-11T00:00:00.000Z',
      })
      .mockResolvedValueOnce({
        id: 'tpl-2',
        name: '少儿篮球（副本）',
        categoryId: 'cat-group',
        category: 'group',
        duration: 60,
        capacity: 12,
        status: 'active',
        createdAt: '2026-09-11T00:00:00.000Z',
        updatedAt: '2026-09-11T00:00:00.000Z',
      });
    request.put.mockResolvedValue({
      id: 'tpl-1',
      name: '少儿篮球进阶',
      categoryId: 'cat-group',
      category: 'group',
      duration: 60,
      capacity: 12,
      status: 'active',
      createdAt: '2026-09-11T00:00:00.000Z',
      updatedAt: '2026-09-11T01:00:00.000Z',
    });
    request.del.mockResolvedValue(undefined);

    const { courseTemplateService } = await import('@/services/course-template');
    await courseTemplateService.create({
      name: '少儿篮球',
      categoryId: 'cat-group',
      category: 'group',
      duration: 60,
      capacity: 12,
    });
    await courseTemplateService.update('tpl-1', { name: '少儿篮球进阶' });
    await courseTemplateService.copy('tpl-1');
    await courseTemplateService.remove('tpl-1');

    expect(request.post).toHaveBeenNthCalledWith(
      1,
      '/course-templates',
      expect.objectContaining({ name: '少儿篮球', categoryId: 'cat-group' }),
    );
    expect(request.put).toHaveBeenCalledWith('/course-templates/tpl-1', {
      name: '少儿篮球进阶',
    });
    expect(request.post).toHaveBeenNthCalledWith(2, '/course-templates/tpl-1/copy');
    expect(request.del).toHaveBeenCalledWith('/course-templates/tpl-1');
  });

  it('getById：404 返回 null，其它错误抛出（不静默覆盖）', async () => {
    const { courseTemplateService } = await import('@/services/course-template');
    const { ApiError } = await import('@/utils/request');

    request.get.mockRejectedValueOnce(new ApiError(404, '课程模板不存在'));
    await expect(courseTemplateService.getById('tpl-x')).resolves.toBeNull();

    request.get.mockRejectedValueOnce(new ApiError(500, '服务器错误'));
    await expect(courseTemplateService.getById('tpl-x')).rejects.toThrow('服务器错误');
  });
});
