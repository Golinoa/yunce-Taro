/**
 * 课程分类配置类型定义
 *
 * 课程分类是可配置的业务实体，每个分类对应一种课程模式（班课 / 团课 / 私教）。
 * 分类配置作为新建课程时的默认值来源，也控制约课首页的展示方式。
 */

/** 课程模式（暂不包含线上课） */
export type CourseCategoryMode = 'class' | 'group' | 'private';

/**
 * 分类时间配置值（单位：小时）
 * - 'unlimited': 不限制
 * - 'at_start': 开课时
 * - number: 开课前/结束后 N 小时（正整数）
 */
export type CategoryTimeValue = 'unlimited' | 'at_start' | number;

/**
 * 自动签到配置值（单位：小时）
 * - 'off': 关闭
 * - 'at_start': 开课时
 * - 'at_end': 结束时
 * - number: 结束后 N 小时（正整数）
 */
export type CategoryAutoCheckinValue = 'off' | 'at_start' | 'at_end' | number;

/**
 * 课程分类配置
 */
export interface CourseCategoryConfig {
  /** 分类 ID */
  id: string;
  /** 分类名称 */
  name: string;
  /** 分类排列顺序 */
  sortOrder: number;
  /** 最低开课人数 */
  minOpenCount: number;
  /** 截止预约时间（小时） */
  bookingDeadline: CategoryTimeValue;
  /** 取消排队时间（小时） */
  cancelQueueTime: CategoryTimeValue;
  /** 不可取消时间（小时） */
  nonCancelTime: CategoryTimeValue;
  /** 自动签到（小时） */
  autoCheckin: CategoryAutoCheckinValue;
  /** 学员自助签到 */
  studentSelfCheckin: boolean;
  /** 签到距离限制 */
  distanceLimit: boolean;
  /** 课前可签到（分钟） */
  checkinBeforeMinutes: number;
  /** 课后可签到（分钟） */
  checkinAfterMinutes: number;
  /** 课程模式 */
  mode: CourseCategoryMode;
  /** 独立展示：在约课首页作为独立标签展示 */
  independentDisplay: boolean;
  /** 是否系统内置（内置分类不可删除） */
  isSystem?: boolean;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
}

/** 创建/更新课程分类表单 */
export interface CourseCategoryFormData {
  name: string;
  sortOrder: number;
  minOpenCount: number;
  bookingDeadline: CategoryTimeValue;
  cancelQueueTime: CategoryTimeValue;
  nonCancelTime: CategoryTimeValue;
  autoCheckin: CategoryAutoCheckinValue;
  studentSelfCheckin: boolean;
  distanceLimit: boolean;
  checkinBeforeMinutes: number;
  checkinAfterMinutes: number;
  mode: CourseCategoryMode;
  independentDisplay: boolean;
}
