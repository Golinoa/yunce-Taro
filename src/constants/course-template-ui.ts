/** 课程模板 UI 常量（与 mock 数据分离） */
import type { CheckinRole, CourseCategory, CourseCategoryItem } from '@/types/course-template';

/** 默认课程分类 */
export const DEFAULT_COURSE_CATEGORIES: CourseCategoryItem[] = [
  { key: 'class', label: '班课' },
  { key: 'group', label: '团课' },
  { key: 'private', label: '私教' },
];

/** 课程分类映射表 */
export const COURSE_CATEGORY_LABEL: Record<CourseCategory, string> = {
  class: '班课',
  group: '团课',
  private: '私教',
};

/** 课程颜色选项（统一色板，与班级颜色 classColorHex 一致，用户口径 2026-08-23） */
export const COURSE_COLOR_OPTIONS = [
  '#5EC8A8', // primary 薄荷绿
  '#6BA3D6', // info 天蓝
  '#9B7ED8', // purple 紫罗兰
  '#D4A24E', // amber 琥珀
  '#E57373', // red 绯红
  '#4FC3B7', // teal 青碧
];

/** 年龄组选项 */
export const AGE_GROUP_OPTIONS: { label: string; value: 'child' | 'teen' | 'adult' | 'mix' }[] = [
  { label: '儿童', value: 'child' },
  { label: '青少年', value: 'teen' },
  { label: '成人', value: 'adult' },
  { label: '混合', value: 'mix' },
];

/** 学员自助签到选项 */
export const STUDENT_SELF_CHECKIN_OPTIONS: {
  label: string;
  value: 'follow_category' | 'allow' | 'forbid';
}[] = [
  { label: '跟随分类', value: 'follow_category' },
  { label: '允许', value: 'allow' },
  { label: '禁止', value: 'forbid' },
];

/** 允许签到角色选项 */
export const CHECKIN_ROLE_OPTIONS: { label: string; value: CheckinRole }[] = [
  { label: '教练', value: 'teacher' },
  { label: '助教', value: 'assistant' },
  { label: '前台', value: 'receptionist' },
];

/** 科目选项 */
export const SUBJECT_OPTIONS: { label: string; value: string }[] = [
  { label: '美术', value: 'art' },
  { label: '书法', value: 'calligraphy' },
  { label: '钢琴', value: 'piano' },
  { label: '舞蹈', value: 'dance' },
  { label: '声乐', value: 'vocal' },
  { label: '吉他', value: 'guitar' },
  { label: '架子鼓', value: 'drum' },
  { label: '瑜伽', value: 'yoga' },
  { label: '拳击', value: 'boxing' },
];

/** 截止时间选项（分钟） */
export const DEADLINE_OPTIONS: { label: string; value: number }[] = [
  { label: '课前 15 分钟', value: 15 },
  { label: '课前 30 分钟', value: 30 },
  { label: '课前 1 小时', value: 60 },
  { label: '课前 2 小时', value: 120 },
  { label: '课前 6 小时', value: 360 },
  { label: '课前 12 小时', value: 720 },
  { label: '课前 24 小时', value: 1440 },
];
