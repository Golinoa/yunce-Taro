/**
 * 学生信息 (students 表)
 */
import type { FeeMethod, PackageStatus, PackageType } from './course-package';

export interface Student {
  id: string;
  name: string;
  teacher_id: string;
  invite_code: string;
  avatar_url?: string;
  nickname?: string;
  gender?: 'male' | 'female' | 'other';
  birthday?: string;
  phone?: string;
  address?: string;
  note?: string;
  parent_id?: string;
  fee_amount?: number;
  fee_method?: FeeMethod;
  status?: 'active' | 'deleted';
  created_at: string;
  updated_at: string;
  // 关联查询字段
  course_packages?: {
    id: string;
    name: string;
    type?: PackageType;
    total_hours: number;
    remaining_hours: number;
    purchased_remaining: number;
    bonus_remaining: number;
    status?: PackageStatus;
    subject_id?: string;
    fee_amount?: number;
    fee_method?: FeeMethod;
    note?: string;
    created_at: string;
  }[];
}

/**
 * 家长-学生绑定关系 (student_parents 表)
 */
export interface StudentParent {
  id: string;
  student_id: string;
  parent_id: string;
  parent?: {
    id: string;
    name: string;
    phone?: string;
  };
  created_at: string;
}

// ============================================
// 学员管理 - 排序 / 筛选 / 统计 类型
// ============================================

/** 排序类型 */
export type StudentSort = 'default' | 'hours-desc' | 'hours-asc' | 'name-asc' | 'name-desc';

/** 课时状态筛选 */
export type StudentFilter = 'all' | 'sufficient' | 'low' | 'expiring' | 'expired' | 'owe';

/** 科目筛选 */
export type SubjectFilter = string;

/** 课包标签（卡片展示用） */
export interface PackageTag {
  name: string;
  remainingHours: number;
  color: 'primary' | 'amber' | 'danger' | 'purple' | 'accent' | 'info';
}

/** 欠课信息 */
export interface OweInfo {
  /** 缺课节数 */
  oweCount: number;
  /** 缺课日期列表 */
  oweDates: string[];
}

/** 学员课时进度 */
export interface StudentProgress {
  used: number;
  total: number;
  percentage: number;
  status: 'normal' | 'warn' | 'danger';
}

/** 统计摘要 */
export interface StudentSummary {
  total: number;
  sufficient: number;
  low: number;
  owe: number;
}

/** 学员卡片状态 */
export type StudentCardStatus = 'sufficient' | 'low' | 'expiring' | 'expired' | 'owe';

/** 排序选项配置 */
export const SORT_OPTIONS: { value: StudentSort; label: string }[] = [
  { value: 'default', label: '默认排序' },
  { value: 'hours-desc', label: '课时从多到少' },
  { value: 'hours-asc', label: '课时从少到多' },
  { value: 'name-asc', label: '姓名A-Z' },
  { value: 'name-desc', label: '姓名Z-A' },
];

/** 课时状态筛选选项 */
export const FILTER_OPTIONS: { value: StudentFilter; label: string; dotColor: string }[] = [
  { value: 'all', label: '全部', dotColor: '#a0b8ad' },
  { value: 'sufficient', label: '课时充足', dotColor: '#5EC8A8' },
  { value: 'low', label: '课时不足', dotColor: '#d4a24e' },
  { value: 'expiring', label: '即将过期', dotColor: '#6ba3d6' },
  { value: 'expired', label: '已过期', dotColor: '#D94040' },
  { value: 'owe', label: '欠课', dotColor: '#e88aaa' },
];

/** 科目筛选选项 */
export const SUBJECT_OPTIONS: { value: SubjectFilter; label: string }[] = [
  { value: 'all', label: '全部科目' },
  { value: 'piano', label: '钢琴' },
  { value: 'vocal', label: '声乐' },
  { value: 'theory', label: '乐理' },
  { value: 'calligraphy', label: '书法' },
  { value: 'general', label: '通用' },
];
