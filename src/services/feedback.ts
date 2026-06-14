/**
 * Service 层 — 意见反馈 API
 */
import { mockCreateFeedback } from '@/data/feedback';
import type { UserRole } from '@/types/profile';

export const feedbackService = {
  /** 创建反馈 */
  create: (data: { user_id: string; role: UserRole; content: string; images: string[] }) =>
    mockCreateFeedback(data),
};
