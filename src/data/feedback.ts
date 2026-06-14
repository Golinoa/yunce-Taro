/**
 * 意见反馈 Mock 数据接口
 */
import type { UserRole } from '@/types/profile';

function delay(ms = 300): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================
// 类型定义
// ============================================
export interface Feedback {
  id: string;
  user_id: string;
  role: UserRole;
  content: string;
  images: string[];
  created_at: string;
}

// ============================================
// Mock 存储
// ============================================
const MOCK_FEEDBACKS: Feedback[] = [];

// ============================================
// 接口
// ============================================

/** 创建反馈 */
export async function mockCreateFeedback(data: {
  user_id: string;
  role: UserRole;
  content: string;
  images: string[];
}): Promise<boolean> {
  await delay(500);
  const feedback: Feedback = {
    id: `fb${Date.now()}`,
    user_id: data.user_id,
    role: data.role,
    content: data.content,
    images: data.images,
    created_at: new Date().toISOString(),
  };
  MOCK_FEEDBACKS.push(feedback);
  return true;
}
