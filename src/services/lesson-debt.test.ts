import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
const post = vi.fn();

vi.mock('@/utils/request', () => ({
  get: (...args: unknown[]) => get(...args),
  post: (...args: unknown[]) => post(...args),
}));

vi.mock('@/utils/pagination', () => ({
  formatApiDateTime: (v: unknown) => (typeof v === 'string' ? v : '2026-09-11T12:00:00.000Z'),
}));

import { lessonDebtService } from './lesson-debt';

describe('lessonDebtService', () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
  });

  it('getPendingByStudent hits /lesson-debts/.../pending', async () => {
    get.mockResolvedValue([
      {
        id: 'd1',
        studentId: 's1',
        hours: 2,
        status: 'pending',
        createdAt: '2026-09-11T12:00:00.000Z',
      },
    ]);
    const list = await lessonDebtService.getPendingByStudent('s1');
    expect(get).toHaveBeenCalledWith('/lesson-debts/students/s1/pending');
    expect(list[0].hours).toBe(2);
  });

  it('settleByStudent posts type and maps notCovered', async () => {
    post.mockResolvedValue({ settledHours: 2, remainingDebtHours: 0.5, notCovered: 0.5 });
    const result = await lessonDebtService.settleByStudent('s1', 'deduct', undefined, 'c1');
    expect(post).toHaveBeenCalledWith('/lesson-debts/students/s1/settle', {
      type: 'deduct',
      memberCardId: 'c1',
    });
    expect(result.settledHours).toBe(2);
    expect(result.notCovered).toBe(0.5);
    expect(result.remainingDebtHours).toBe(0.5);
  });
});
