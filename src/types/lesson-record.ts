import type { FeeMethod } from './course-package';

/**
 * 消课记录 (lesson_records 表)
 */
export interface LessonRecord {
  id: string;
  teacher_id: string;
  student_id: string;
  package_id: string;
  lesson_date: string;
  hours_used: number;
  content?: string;
  performance?: string;
  homework?: string;
  homework_images?: string[];
  fee_amount?: number;
  fee_method?: FeeMethod;
  created_at: string;
  updated_at: string;
  // 关联查询字段
  course_package?: {
    name: string;
  };
  student?: {
    name: string;
    avatar_url?: string;
  };
}
