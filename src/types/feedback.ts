/**
 * 反馈信息 (feedbacks 表)
 */
export interface Feedback {
  id: string;
  user_id: string;
  role: 'teacher' | 'parent';
  content: string;
  images?: string[];
  created_at: string;
  updated_at: string;
}
