/**
 * 课程模板类型定义
 *
 * 课程模板是课程的基础配置，用于在排课时快速选择课程信息。
 * 与 Class（班级实例）不同，课程模板不包含学生、老师、具体排课时间等运行时数据。
 */

import type { ClassLevel } from './class';

/**
 * 课程分类
 * - class: 班课
 * - group: 团课
 * - private: 私教
 */
export type CourseCategory = 'class' | 'group' | 'private';

/**
 * 课程模板状态
 */
export type CourseTemplateStatus = 'active' | 'disabled';

/**
 * 签到角色
 */
export type CheckinRole = 'teacher' | 'assistant' | 'receptionist';

/**
 * 课程模板（课程配置）
 */
export interface CourseTemplate {
  /** 课程模板 ID */
  id: string;
  /** 课程名称 */
  name: string;
  /** 所属分类 ID */
  categoryId: string;
  /** 课程分类（模式：班课 / 团课 / 私教） */
  category: CourseCategory;
  /** 课程时长（分钟） */
  duration: number;
  /** 容纳人数，私教默认为 1 */
  capacity: number;
  /** 课程状态 */
  status: CourseTemplateStatus;
  /** 课程颜色 */
  color?: string;
  /** 所属科目/技能 ID */
  subjectId?: string;
  /** 所属科目/技能名称 */
  subjectName?: string;
  /** 年龄组 */
  ageGroup?: 'child' | 'teen' | 'adult' | 'mix';
  /** 新客体验价（分） */
  experiencePrice?: number;
  /** 单价（分） */
  price?: number;
  /** 最低开课人数 */
  minOpenCount?: number;
  /** 截止预约时间（分钟，课前多久截止） */
  bookingDeadline?: number;
  /** 取消排队时间（分钟） */
  cancelQueueTime?: number;
  /** 不可取消时间（分钟） */
  nonCancelTime?: number;
  /** 自动签到 */
  autoCheckin?: 'follow_category' | 'allow' | 'forbid';
  /** 学员自助签到 */
  studentSelfCheckin?: 'follow_category' | 'allow' | 'forbid';
  /** 允许签到角色 */
  allowCheckinRoles?: CheckinRole[];
  /** 课程难度 */
  level?: ClassLevel;
  /** 课程简介 */
  description?: string;
  /** 是否线上课 */
  isOnline?: boolean;
  /** 线上课会议号 */
  onlineMeetingId?: string;
  /** 首页课程底图 */
  homeImage?: string;
  /** 课程背景图 */
  backgroundImage?: string;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
}

/** 课程分类标签 */
export interface CourseCategoryItem {
  key: CourseCategory;
  label: string;
}

/** 创建/更新课程模板表单 */
export interface CourseTemplateFormData {
  name: string;
  categoryId: string;
  category: CourseCategory;
  duration: number;
  capacity: number;
  color?: string;
  subjectId?: string;
  ageGroup?: 'child' | 'teen' | 'adult' | 'mix';
  experiencePrice?: number;
  price?: number;
  minOpenCount?: number;
  bookingDeadline?: number;
  cancelQueueTime?: number;
  nonCancelTime?: number;
  autoCheckin?: 'follow_category' | 'allow' | 'forbid';
  studentSelfCheckin?: 'follow_category' | 'allow' | 'forbid';
  allowCheckinRoles?: CheckinRole[];
  level?: ClassLevel;
  description?: string;
  isOnline?: boolean;
  onlineMeetingId?: string;
  homeImage?: string;
  backgroundImage?: string;
}
