/**
 * 意见反馈 Mock 数据接口
 */
import type { UserRole } from '@/types/profile';

function delay(ms = 50): Promise<void> {
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
const MOCK_FEEDBACKS: Feedback[] = [
  {
    id: 'fb001',
    user_id: 'user-teacher-001',
    role: 'teacher',
    content: '希望增加课表导出功能，方便打印贴在教室门口',
    images: [],
    created_at: '2026-06-20T14:30:00Z',
  },
  {
    id: 'fb002',
    user_id: 'user-principal-001',
    role: 'principal',
    content: '校区运营数据页面加载较慢，希望能优化一下',
    images: [],
    created_at: '2026-06-18T09:15:00Z',
  },
  {
    id: 'fb003',
    user_id: 'user-parent-001',
    role: 'parent',
    content: '建议增加家长端查看孩子上课照片的功能',
    images: [],
    created_at: '2026-06-15T16:45:00Z',
  },
];

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
