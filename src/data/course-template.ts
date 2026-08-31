/**
 * 课程模板 Mock 数据层
 *
 * 默认课程分类：班课 / 团课 / 私教
 * 提供课程模板的增删改查、复制等 mock 实现。
 */
import { DEFAULT_CATEGORY_IDS } from '@/data/course-category';
import type {
  CheckinRole,
  CourseCategory,
  CourseCategoryItem,
  CourseTemplate,
  CourseTemplateFormData,
} from '@/types/course-template';

// ============================================
// 常量池
// ============================================

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

// ============================================
// Mock 数据
// ============================================

let MOCK_TEMPLATES: CourseTemplate[] = [
  // 班课示例已迁到 CLASSES（cls-art-sketch / cls-calligraphy-basic），此处仅保留团课/私教模板
  {
    id: 'course-003',
    name: '成人瑜伽团课',
    categoryId: DEFAULT_CATEGORY_IDS.group,
    category: 'group',
    duration: 60,
    capacity: 20,
    status: 'active',
    color: '#10B981',
    subjectId: 'yoga',
    subjectName: '瑜伽',
    ageGroup: 'adult',
    experiencePrice: 6900,
    price: 39900,
    minOpenCount: 5,
    bookingDeadline: 60,
    cancelQueueTime: 60,
    nonCancelTime: 120,
    autoCheckin: 'allow',
    studentSelfCheckin: 'allow',
    allowCheckinRoles: ['teacher', 'assistant', 'receptionist'],
    level: 'all',
    description: '哈他瑜伽基础练习，放松身心、改善体态。',
    isOnline: false,
    createdAt: '2026-07-05T10:00:00Z',
    updatedAt: '2026-07-18T10:00:00Z',
  },
  {
    id: 'course-004',
    name: '私教 1v1 拳击',
    categoryId: DEFAULT_CATEGORY_IDS.private,
    category: 'private',
    duration: 60,
    capacity: 1,
    status: 'active',
    color: '#EF4444',
    subjectId: 'boxing',
    subjectName: '拳击',
    ageGroup: 'adult',
    experiencePrice: 19900,
    price: 59900,
    minOpenCount: 1,
    bookingDeadline: 120,
    cancelQueueTime: 120,
    nonCancelTime: 240,
    autoCheckin: 'forbid',
    studentSelfCheckin: 'forbid',
    allowCheckinRoles: ['teacher'],
    level: 'advanced',
    description: '一对一拳击训练，提升体能与格斗技巧。',
    isOnline: false,
    createdAt: '2026-07-08T10:00:00Z',
    updatedAt: '2026-07-20T10:00:00Z',
  },
];

// ============================================
// Mock CRUD
// ============================================

function delay(ms = 200): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nowISO(): string {
  return new Date().toISOString();
}

export async function mockGetCourseTemplates(categoryId?: string): Promise<CourseTemplate[]> {
  await delay();
  if (!categoryId) return [...MOCK_TEMPLATES];
  return MOCK_TEMPLATES.filter((item) => item.categoryId === categoryId);
}

export async function mockGetCourseTemplateById(id: string): Promise<CourseTemplate | null> {
  await delay();
  return MOCK_TEMPLATES.find((item) => item.id === id) || null;
}

export async function mockCreateCourseTemplate(
  data: CourseTemplateFormData,
): Promise<CourseTemplate> {
  await delay(300);
  const created: CourseTemplate = {
    ...data,
    id: `course-${Date.now()}`,
    status: 'active',
    createdAt: nowISO(),
    updatedAt: nowISO(),
    // subjectName 由 FormData 传入（从科目管理数据源查找）
  };
  MOCK_TEMPLATES.unshift(created);
  return created;
}

export async function mockUpdateCourseTemplate(
  id: string,
  data: Partial<CourseTemplateFormData>,
): Promise<CourseTemplate> {
  await delay(300);
  const idx = MOCK_TEMPLATES.findIndex((item) => item.id === id);
  if (idx < 0) throw new Error('课程模板不存在');
  const updated: CourseTemplate = {
    ...MOCK_TEMPLATES[idx],
    ...data,
    subjectName: data.subjectName ?? MOCK_TEMPLATES[idx].subjectName,
    updatedAt: nowISO(),
  };
  MOCK_TEMPLATES[idx] = updated;
  return updated;
}

export async function mockCopyCourseTemplate(id: string): Promise<CourseTemplate> {
  await delay(300);
  const source = MOCK_TEMPLATES.find((item) => item.id === id);
  if (!source) throw new Error('课程模板不存在');
  const copied: CourseTemplate = {
    ...source,
    id: `course-${Date.now()}`,
    name: `${source.name}（复制）`,
    status: 'active',
    createdAt: nowISO(),
    updatedAt: nowISO(),
  };
  MOCK_TEMPLATES.unshift(copied);
  return copied;
}

export async function mockRemoveCourseTemplate(id: string): Promise<void> {
  await delay(200);
  MOCK_TEMPLATES = MOCK_TEMPLATES.filter((item) => item.id !== id);
}
