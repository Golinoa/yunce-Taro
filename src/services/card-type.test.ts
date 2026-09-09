import { beforeEach, describe, expect, it, vi } from 'vitest';

const request = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  del: vi.fn(),
}));

vi.mock('@/utils/request', () => request);

describe('cardTypeService', () => {
  beforeEach(() => vi.resetAllMocks());

  it('maps paginated list and keeps money in cents', async () => {
    request.get.mockResolvedValue({
      list: [
        {
          id: 'card-type-1',
          name: '月卡',
          kind: 'count',
          status: 'active',
          scopes: ['course'],
          categoryIds: [],
          price: 12000,
          validDays: 30,
          stats: { sold: 2, inUse: 1, usedUp: 1, notActivated: 0, frozen: 0 },
          createdAt: '2026-09-10T00:00:00.000Z',
          updatedAt: '2026-09-10T00:00:00.000Z',
        },
      ],
      pagination: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
    });

    const { cardTypeService } = await import('@/services/card-type');
    await expect(cardTypeService.getList()).resolves.toMatchObject([
      { id: 'card-type-1', price: 12000, stats: { sold: 2 } },
    ]);
    expect(request.get).toHaveBeenCalledWith('/card-types', { page: 1, pageSize: 100 });
  });

  it('uses backend write contracts and strips FE-only fields', async () => {
    request.post.mockResolvedValue({ id: 'new-card', name: '新卡', kind: 'count' });
    const { cardTypeService } = await import('@/services/card-type');
    await cardTypeService.create({
      name: '新卡',
      kind: 'count',
      status: 'active',
      scopes: ['course'],
      bookingMethod: 'course',
      categoryIds: [],
      cardCategory: 'formal',
      validDays: 30,
      price: 1000,
      freezeCount: 0,
      freezeDays: 0,
      dailyMaxBookings: 0,
      weeklyMaxBookings: 0,
      monthlyMaxBookings: 0,
      freeCancelCount: 0,
      advanceBookingMinutes: 0,
      availableWeekdays: [],
      isGiftCard: false,
      allowTransfer: false,
      usageLimit: 0,
      commissionCalc: 'salary',
      subjectId: 'local-only',
    });
    expect(request.post).toHaveBeenCalledWith(
      '/card-types',
      expect.not.objectContaining({ subjectId: expect.anything() }),
    );
  });

  it('toggles status through PATCH', async () => {
    request.patch.mockResolvedValue({ id: 'card-type-1', status: 'inactive' });
    const { cardTypeService } = await import('@/services/card-type');
    await cardTypeService.toggleStatus('card-type-1', 'inactive');
    expect(request.patch).toHaveBeenCalledWith('/card-types/card-type-1/status', {
      status: 'inactive',
    });
  });
});
