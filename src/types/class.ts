import type { CoursePackage } from './course-package';

/**
 * 班级类型
 */
export type ClassType = 'unlimited' | 'limited' | 'ended';

/**
 * 授课模式
 */
export type TeachMode = 'one_on_one' | 'small_class' | 'large_class';

/**
 * 班级状态
 */
export type ClassStatus = 'active' | 'ended';

/**
 * 班级颜色主题
 */
export type ClassColor = 'primary' | 'red' | 'amber' | 'purple' | 'info' | 'teal';

/**
 * 班级图标（教培相关 emoji）
 */
export type ClassIcon =
  | 'piano'
  | 'dance'
  | 'art'
  | 'calligraphy'
  | 'basketball'
  | 'speech'
  | 'rubik'
  | 'go'
  | 'book'
  | 'music';

/**
 * 班级信息 (classes 表)
 */
export interface Class {
  id: string;
  name: string;
  teacher_id: string;
  note?: string;
  created_at: string;
  updated_at: string;

  // 扩展字段
  type: ClassType;
  teach_mode?: TeachMode; // 授课模式：一对一/小班/大班
  status: ClassStatus;
  schedule?: string; // 显示文本 "每周二、四 14:00-15:30"
  weekdays?: string[]; // 星期选择 ['一','二','四']
  start_time?: string; // 开始时间 "14:00"
  end_time?: string; // 结束时间 "15:30"
  total_lessons?: number; // 总课时（课时制）
  used_lessons: number; // 已消课时
  teachers?: string[]; // 授课老师ID列表
  start_date?: string; // 开始日期（课时制）
  end_date?: string; // 结束日期（课时制）
  color: ClassColor; // 主题色标识
  icon?: ClassIcon; // 班级图标标识
  student_count: number; // 学生数量
  campus_id?: string; // 关联校区ID
  campus_name?: string; // 关联校区名称
}

/**
 * 班级-学生关联 (class_students 表)
 */
export interface ClassStudent {
  id: string;
  class_id: string;
  student_id: string;
  course_packages?: CoursePackage[];
  created_at: string;
}

/**
 * 签到记录
 */
export interface CheckinRecord {
  date: string;
  count: number;
  teacher: string;
  students: string[];
}

/**
 * 班级扩展信息（含学生列表和签到记录）
 */
export interface ClassDetail extends Class {
  studentList: ClassStudentInfo[];
  checkinRecords?: CheckinRecord[];
  pricePerLesson?: number;
  packagePrice?: number;
  totalRevenue?: number;
}

/**
 * 班级中的学生信息
 */
export interface ClassStudentInfo {
  id: string;
  name: string;
  phone?: string;
  color: string;
  hours: number;
  remaining: number | null; // null 表示循环课
  records: { date: string; title: string; hours: number }[];
}
