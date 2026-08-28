/**
 * Service 层 — 意见反馈 API
 */
import type { UserRole } from '@/types/profile';
import { loadFeedbackMock } from '@/utils/mock-loaders';
import { isUseMock } from '@/utils/build-env';
import { post } from '@/utils/request';

export type FeedbackType = 'BUG' | 'FEATURE' | 'OTHER';

export const feedbackService = {
  /** 创建反馈 */
  create: async (data: {
    user_id: string;
    role: UserRole;
    type?: FeedbackType;
    content: string;
    images: string[];
    contact?: string;
  }) => {
    if (!isUseMock()) {
      await post('/feedback', {
        type: data.type || 'OTHER',
        content: data.content,
        images: data.images,
        contact: data.contact,
      });
      return true;
    }

    const { mockCreateFeedback } = await loadFeedbackMock();

    return mockCreateFeedback({
      user_id: data.user_id,
      role: data.role,
      content: data.content,
      images: data.images,
    });
  },
};
