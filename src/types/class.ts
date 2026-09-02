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
 * 班级排课模式
 * - fixed: 固定排课（校区提前排好班级上课时间）
 * - open: 开放预约（只设置时段池，家长自行预约）
 */
export type ClassScheduleMode = 'fixed' | 'open';

/**
 * 班级状态
 * - active: 正常上课
 * - paused: 停课（课表不再展示该班排课/开放时段，可恢复）
 * - ended: 已结课
 */
export type ClassStatus = 'active' | 'paused' | 'ended';

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
 * 课程难度等级
 */
export type ClassLevel = 'all' | 'basic' | 'advanced' | 'expert';

/** 课程难度显示文本 */
export const CLASS_LEVEL_LABELS: Record<ClassLevel, string> = {
  all: '所有人',
  basic: '基础',
  advanced: '进阶',
  expert: '高级',
};

/**
 * 课程难度标签样式（与课表卡片一致：muted 底 + muted 字）
 * 新增课程 / CourseDisplayCard 等展示点统一用此 token，勿各自写 primary。
 */
export const CLASS_LEVEL_BADGE_WRAP = 'rounded-[10rpx] bg-muted px-[14rpx] py-[6rpx]';
export const CLASS_LEVEL_BADGE_TEXT = 'text-[24rpx] font-medium leading-none text-muted-foreground';

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
  /** 排课模式：fixed=固定排课, open=开放预约 */
  schedule_mode?: ClassScheduleMode;
  /** 自动开班条件：manual=手动, full=约满, time=到时间, full_or_time=约满或到时间 */
  auto_open_type?: 'manual' | 'full' | 'time' | 'full_or_time';
  /** 最少预约人数（仅 full/full_or_time 有效），默认等于 max_count */
  min_open_count?: number;
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
  /** 课程难度等级 */
  level?: ClassLevel;
  student_count: number; // 学生数量
  campus_id?: string; // 关联校区ID
  campus_name?: string; // 关联校区名称
  /** 默认上课教室 */
  room?: string;
  /** 科目 ID（用于匹配会员卡课程科目） */
  subject_id?: string;
  /** 课程分类 ID（决定约课首页 Tab 归属） */
  category_id?: string;
  /** 容纳人数；不填表示不限制 */
  capacity?: number;
  /** 单次默认消耗课时（手动消课预填） */
  hours_per_lesson?: number;
  /** 单次授课扣费（元），消课预填 / 薪资展示用 */
  pricePerLesson?: number;
  /** 首页图 CDN URL；传 null 清空 */
  homeImage?: string | null;
  /** 背景图 CDN URL；传 null 清空 */
  backgroundImage?: string | null;
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

/**
 * 班级开放预约时段
 * 用于开放预约制班级：校区设置时段池，家长选择时段预约，约满后开班。
 */
export interface ClassBookingSlot {
  id: string;
  /** 关联班级 ID */
  class_id: string;
  /** 班级名称（冗余展示） */
  class_name?: string;
  /** 校区 ID */
  campus_id: string;
  /** 授课老师 ID */
  teacher_id: string;
  /** 授课老师名称（冗余展示） */
  teacher_name?: string;
  /** 预约日期 YYYY-MM-DD */
  lesson_date: string;
  /** 开始时间 HH:mm */
  start_time: string;
  /** 结束时间 HH:mm */
  end_time: string;
  /** 最大可约人数 */
  max_count: number;
  /** 当前已预约人数 */
  current_count: number;
  /** 状态：active=开放, rest=休息, full=已满 */
  status: 'active' | 'rest' | 'full';
  /** 已预约学员列表（卡片展示头像用） */
  booking_students?: { id: string; name: string; avatar?: string }[];
  /** 本时段自动开班条件，未设置时继承班级配置 */
  auto_open_type?: 'manual' | 'full' | 'time' | 'full_or_time';
  /** 已生成的排课 ID，避免重复开班 */
  opened_schedule_id?: string;
  /** 教室 */
  room?: string;
  created_at: string;
  updated_at: string;
}
