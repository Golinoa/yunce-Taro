/**
 * Service 层 — 意见反馈 API
 */
import { post } from '@/utils/request';
import { mockCreateFeedback } from '@/data/feedback';
import type { UserRole } from '@/types/profile';

const USE_MOCK =
  typeof process !== 'undefined' && typeof process.env !== 'undefined'
    ? process.env.VITE_USE_MOCK !== 'false'
    : true;

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
    if (!USE_MOCK) {
      await post('/feedback', {
        type: data.type || 'OTHER',
        content: data.content,
        images: data.images,
        contact: data.contact,
      });
      return true;
    }

    return mockCreateFeedback({
      user_id: data.user_id,
      role: data.role,
      content: data.content,
      images: data.images,
    });
  },
};
