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

/** 课程颜色选项 */
export const COURSE_COLOR_OPTIONS = [
  '#3B6EF5',
  '#EF4444',
  '#F59E0B',
  '#10B981',
  '#8B5CF6',
  '#0EA5E9',
  '#EC4899',
  '#6366F1',
  '#14B8A6',
  '#F97316',
  '#84CC16',
  '#06B6D4',
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
  {
    id: 'course-001',
    name: '美术素描班',
    categoryId: DEFAULT_CATEGORY_IDS.class,
    category: 'class',
    duration: 90,
    capacity: 12,
    status: 'active',
    color: '#3B6EF5',
    subjectId: 'art',
    subjectName: '美术',
    ageGroup: 'teen',
    experiencePrice: 9900,
    price: 29900,
    minOpenCount: 4,
    bookingDeadline: 60,
    cancelQueueTime: 60,
    nonCancelTime: 120,
    autoCheckin: 'follow_category',
    studentSelfCheckin: 'follow_category',
    allowCheckinRoles: ['teacher', 'receptionist'],
    level: 'basic',
    description: '零基础素描入门，培养观察力与造型能力。',
    isOnline: false,
    // 已排入 10 名学员，编辑时若将容量改到 10 以下应触发「人数超限」拦截
    studentIds: [
      'stu-001', 'stu-002', 'stu-003', 'stu-004', 'stu-005',
      'stu-006', 'stu-007', 'stu-008', 'stu-009', 'stu-010',
    ],
    createdAt: '2026-07-01T10:00:00Z',
    updatedAt: '2026-07-15T10:00:00Z',
  },
  {
    id: 'course-002',
    name: '书法基础班',
    categoryId: DEFAULT_CATEGORY_IDS.class,
    category: 'class',
    duration: 60,
    capacity: 10,
    status: 'active',
    color: '#8B5CF6',
    subjectId: 'calligraphy',
    subjectName: '书法',
    ageGroup: 'child',
    experiencePrice: 4900,
    price: 19900,
    minOpenCount: 3,
    bookingDeadline: 30,
    cancelQueueTime: 30,
    nonCancelTime: 60,
    autoCheckin: 'follow_category',
    studentSelfCheckin: 'follow_category',
    allowCheckinRoles: ['teacher', 'receptionist'],
    level: 'all',
    description: '硬笔书法基础训练，规范书写姿势与笔画。',
    isOnline: false,
    createdAt: '2026-07-02T10:00:00Z',
    updatedAt: '2026-07-16T10:00:00Z',
  },
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
