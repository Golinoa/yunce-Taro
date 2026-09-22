import { beforeEach, describe, expect, it, vi } from 'vitest';

const request = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/utils/request', () => request);
vi.mock('@/services/student', () => ({ invalidatePackagesCache: vi.fn() }));

describe('memberCardService.recharge', () => {
  beforeEach(() => vi.resetAllMocks());

  it('posts the unified append-count contract and reads the card back', async () => {
    request.post.mockResolvedValueOnce({ id: 'mc-1', studentId: 'stu-1' });
    request.get.mockResolvedValue({
      id: 'mc-1',
      studentId: 'stu-1',
      cardTypeId: 'ct-1',
      status: 'active',
      purchaseAt: '2026-09-22T00:00:00.000Z',
    });
    const { memberCardService } = await import('@/services/member-card');
    await memberCardService.recharge({
      memberCardId: 'mc-1',
      amount: 10,
      giftAmount: 2,
      purchasePrice: 1200,
      paymentMethod: 'wechat',
      reason: '续费',
      idempotencyKey: 'recharge-1',
    });
    expect(request.post).toHaveBeenNthCalledWith(1, '/card-types/member-cards/mc-1/recharges', {
      amount: 10,
      giftAmount: 2,
      purchasePrice: 1200,
      paymentMethod: 'wechat',
      reason: '续费',
      sourceId: undefined,
      idempotencyKey: 'recharge-1',
    });
    expect(request.get).toHaveBeenCalledWith('/card-types/member-cards/mc-1');
  });
});
