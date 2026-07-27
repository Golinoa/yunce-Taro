import type { FeeMethod } from './course-package';

/**
 * 消课记录 (lesson_records 表)
 */
export interface LessonRecord {
  id: string;
  teacher_id: string;
  /** 操作人教师 ID */
  operator_teacher_id?: string;
  /** 助教教师 ID */
  assistant_teacher_id?: string;
  student_id: string;
  package_id: string;
  lesson_date: string;
  hours_used: number;
  status?: 'normal' | 'cancelled' | 'makeup' | 'leave' | 'absent';
  content?: string;
  performance?: string;
  homework?: string;
  homework_images?: string[];
  fee_amount?: number;
  fee_method?: FeeMethod;
  remaining_hours?: number;
  /** 购买课时扣减量（FIFO 扣减记录） */
  purchased_deduct?: number;
  /** 赠送课时扣减量（FIFO 扣减记录） */
  bonus_deduct?: number;
  /** 撤销状态 */
  revoke_status?: 'none' | 'revoked';
  /** 撤销时间 */
  revoked_at?: string;
  /** 撤销人 */
  revoked_by?: string;
  /** 撤销原因 */
  revoke_reason?: string;
  /** 是否跨科目消课 */
  is_cross_subject?: boolean;
  /** 课包科目 */
  package_subject?: string;
  /** 班级科目 */
  class_subject?: string;
  /** 班级ID（考勤管理用） */
  class_id?: string;
  /** 班级名称（考勤管理用） */
  class_name?: string;
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
  teacher?: {
    name: string;
    avatar_url?: string;
  };
  operator_teacher?: {
    name: string;
    avatar_url?: string;
  };
  assistant_teacher?: {
    name: string;
    avatar_url?: string;
  };
}
