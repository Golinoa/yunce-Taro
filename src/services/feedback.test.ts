import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreateFeedback = vi.fn(async () => true);

vi.mock('@/utils/mock-loaders', () => ({
  loadFeedbackMock: vi.fn(async () => ({ mockCreateFeedback })),
}));

vi.mock('@/utils/request', () => ({
  post: vi.fn(async () => undefined),
}));

describe('feedbackService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('mock 模式下动态加载并调用 mockCreateFeedback', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'true');
    const { feedbackService } = await import('@/services/feedback');
    const { loadFeedbackMock } = await import('@/utils/mock-loaders');

    await feedbackService.create({
      user_id: 'u1',
      role: 'teacher',
      content: 'hello',
      images: [],
    });

    expect(loadFeedbackMock).toHaveBeenCalled();
    expect(mockCreateFeedback).toHaveBeenCalled();
  });

  it('真实模式走 POST /feedback', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false');
    const { post } = await import('@/utils/request');
    const { feedbackService } = await import('@/services/feedback');

    await feedbackService.create({
      user_id: 'u1',
      role: 'teacher',
      content: 'hello',
      images: [],
    });

    expect(post).toHaveBeenCalledWith('/feedback', expect.any(Object));
    expect(mockCreateFeedback).not.toHaveBeenCalled();
  });
});
