import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/request', () => ({
  post: vi.fn(async () => undefined),
}));

describe('feedbackService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('走 POST /feedback', async () => {
    const { post } = await import('@/utils/request');
    const { feedbackService } = await import('@/services/feedback');

    await feedbackService.create({
      user_id: 'u1',
      role: 'teacher',
      content: 'hello',
      images: [],
    });

    expect(post).toHaveBeenCalledWith('/feedback', expect.any(Object));
  });
});
