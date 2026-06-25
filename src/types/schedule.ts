/**
 * 排课颜色主题
 */
export type ScheduleColor = 'primary' | 'info' | 'accent' | 'lavender';

/**
 * 课程类型（左侧时间区配色）
 */
export type CourseType = 'normal' | 'art' | 'music' | 'dance' | 'tech' | 'english';

/**
 * 课程状态
 * - urgent: 即将上课（3分钟内）
 * - upcoming: 待上课
 * - active: 点名中（部分已点名）
 * - done: 已完成（全部点名）
 * - ended: 已下课（未点名）
 */
export type CourseStatus = 'urgent' | 'upcoming' | 'active' | 'done' | 'ended';

/**
 * 星期枚举（1=周一, 7=周日）
 */
export type DayOfWeek = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/**
 * 排课信息 (schedules 表)
 */
export interface Schedule {
  id: string;
  teacher_id: string;
  student_id?: string;
  class_id?: string;
  day_of_week: DayOfWeek;
  start_time: string; // HH:mm 格式
  end_time: string; // HH:mm 格式
  color?: ScheduleColor;
  note?: string;
  reminder_minutes?: number;
  created_at: string;
  updated_at: string;
  // 关联查询字段
  student?: {
    name: string;
  };
  class_info?: {
    name: string;
  };
  // 课程卡片扩展字段
  /** 课程状态 */
  status?: CourseStatus;
  /** 已点名人数 */
  checked_count?: number;
  /** 总学员数 */
  total_count?: number;
  /** 教室 */
  room?: string;
  /** 约课标记 */
  tag?: string;
  /** 课程类型（控制左侧时间区配色） */
  course_type?: CourseType;
  /** 授课老师名称 */
  teacher_name?: string;
}
