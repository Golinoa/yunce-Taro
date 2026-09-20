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
    }
  },
}));

vi.mock('@/utils/request', () => request);

describe('classService course category contract', () => {
  beforeEach(() => vi.resetAllMocks());

  const categoryId = '11111111-1111-4111-8111-111111111111';

  it('writes categoryId and maps categoryId back to category_id', async () => {
    request.put.mockResolvedValue({
      id: 'class-1',
      name: '钢琴班',
      categoryId,
      createdAt: '2026-09-20T00:00:00.000Z',
      status: 'ACTIVE',
    });

    const { classService } = await import('@/services/class');
    const updated = await classService.update('class-1', { category_id: categoryId });

    expect(request.put).toHaveBeenCalledWith(
      '/classes/class-1',
      expect.objectContaining({ categoryId }),
    );
    expect(updated.category_id).toBe(categoryId);
  });

  it('maps the persisted categoryId from class detail for edit回显', async () => {
    request.get.mockResolvedValue({
      id: 'class-1',
      name: '钢琴班',
      categoryId,
      createdAt: '2026-09-20T00:00:00.000Z',
      status: 'ACTIVE',
    });

    const { classService } = await import('@/services/class');
    const loaded = await classService.getById('class-1');

    expect(loaded?.category_id).toBe(categoryId);
  });
});
