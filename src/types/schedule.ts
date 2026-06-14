/**
 * 排课颜色主题
 */
export type ScheduleColor = 'primary' | 'info' | 'accent' | 'lavender';

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
}
