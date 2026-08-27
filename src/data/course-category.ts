/**
 * 课程分类 Mock 数据层
 *
 * 默认内置班课 / 团课 / 私教三个分类，支持新增、编辑、删除自定义分类。
 */
import type {
  CategoryAutoCheckinValue,
  CategoryTimeValue,
  CourseCategoryConfig,
  CourseCategoryFormData,
  CourseCategoryMode,
} from '@/types/course-category';

// ============================================
// 常量池
// ============================================

/** 默认系统分类 ID */
export const DEFAULT_CATEGORY_IDS = {
  class: 'cat-class',
  group: 'cat-group',
  private: 'cat-private',
} as const;

/** 课程管理 · 班课 Tab 直达链接（首页「班级管理」等入口复用） */
export const COURSE_MANAGEMENT_CLASS_TAB_URL =
  `/package-course/pages/course-management/index?categoryId=${DEFAULT_CATEGORY_IDS.class}`;

/** 课程模式选项（不含线上课） */
export const CATEGORY_MODE_OPTIONS: {
  label: string;
  value: CourseCategoryMode;
  description: string;
}[] = [
  { label: '班课', value: 'class', description: '固定班级成员' },
  { label: '团课', value: 'group', description: '用户自主预约' },
  { label: '私教', value: 'private', description: '按老师预约' },
];

/** 时间选择选项（截止预约 / 取消排队 / 不可取消，custom 仅用于唤起自定义输入） */
export const CATEGORY_TIME_OPTIONS: { label: string; value: CategoryTimeValue | 'custom' }[] = [
  { label: '不限制', value: 'unlimited' },
  { label: '开课时', value: 'at_start' },
  { label: '开课前1小时', value: 1 },
  { label: '开课前2小时', value: 2 },
  { label: '自定义', value: 'custom' },
];

/** 自动签到选项（custom 仅用于唤起自定义输入） */
export const CATEGORY_AUTO_CHECKIN_OPTIONS: {
  label: string;
  value: CategoryAutoCheckinValue | 'custom';
}[] = [
  { label: '关闭', value: 'off' },
  { label: '开课时', value: 'at_start' },
  { label: '结束时', value: 'at_end' },
  { label: '结束后1小时', value: 1 },
  { label: '结束后2小时', value: 2 },
  { label: '自定义', value: 'custom' },
];

/**
 * 格式化分类时间显示文本
 * @param value 时间配置值
 * @param mode 'before' 表示开课前，'after' 表示结束后
 */
export function formatCategoryTime(
  value: CategoryTimeValue | CategoryAutoCheckinValue | 'custom',
  mode: 'before' | 'after' = 'before',
): string {
  if (value === 'unlimited') return '不限制';
  if (value === 'off') return '关闭';
  if (value === 'at_start') return '开课时';
  if (value === 'at_end') return '结束时';
  if (value === 'custom') return '自定义';
  if (typeof value === 'number') {
    return mode === 'before' ? `开课前${value}小时` : `结束后${value}小时`;
  }
  return '';
}

/**
 * 判断时间值是否为自定义数字
 */
export function isCustomTimeValue(value: CategoryTimeValue | CategoryAutoCheckinValue): boolean {
  return typeof value === 'number' && value > 0;
}

/** 模式标签映射 */
export const CATEGORY_MODE_LABEL: Record<CourseCategoryMode, string> = {
  class: '班课',
  group: '团课',
  private: '私教',
};

// ============================================
// Mock 数据
// ============================================

let MOCK_CATEGORIES: CourseCategoryConfig[] = [
  {
    id: 'cat-class',
    name: '班课',
    sortOrder: 1,
    minOpenCount: 1,
    bookingDeadline: 'at_start',
    cancelQueueTime: 'at_start',
    nonCancelTime: 'at_start',
    autoCheckin: 'at_end',
    studentSelfCheckin: true,
    distanceLimit: false,
    checkinBeforeMinutes: 60,
    checkinAfterMinutes: 120,
    mode: 'class',
    independentDisplay: true,
    isSystem: true,
    createdAt: '2026-07-01T10:00:00Z',
    updatedAt: '2026-07-01T10:00:00Z',
  },
  {
    id: 'cat-group',
    name: '团课',
    sortOrder: 2,
    minOpenCount: 1,
    bookingDeadline: 'at_start',
    cancelQueueTime: 'at_start',
    nonCancelTime: 'at_start',
    autoCheckin: 'at_end',
    studentSelfCheckin: true,
    distanceLimit: false,
    checkinBeforeMinutes: 60,
    checkinAfterMinutes: 120,
    mode: 'group',
    independentDisplay: true,
    isSystem: true,
    createdAt: '2026-07-01T10:00:00Z',
    updatedAt: '2026-07-01T10:00:00Z',
  },
  {
    id: 'cat-private',
    name: '私教',
    sortOrder: 3,
    minOpenCount: 1,
    bookingDeadline: 'at_start',
    cancelQueueTime: 'at_start',
    nonCancelTime: 'at_start',
    autoCheckin: 'at_end',
    studentSelfCheckin: true,
    distanceLimit: false,
    checkinBeforeMinutes: 60,
    checkinAfterMinutes: 120,
    mode: 'private',
    independentDisplay: true,
    isSystem: true,
    createdAt: '2026-07-01T10:00:00Z',
    updatedAt: '2026-07-01T10:00:00Z',
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

export async function mockGetCourseCategories(): Promise<CourseCategoryConfig[]> {
  await delay();
  return [...MOCK_CATEGORIES].sort((a, b) => a.sortOrder - b.sortOrder);
}

/** 同步读取当前分类列表（首页今日课表标签等纯映射场景） */
export function listCourseCategoriesSync(): CourseCategoryConfig[] {
  return [...MOCK_CATEGORIES];
}

export async function mockGetCourseCategoryById(id: string): Promise<CourseCategoryConfig | null> {
  await delay();
  return MOCK_CATEGORIES.find((item) => item.id === id) || null;
}

export async function mockCreateCourseCategory(
  data: CourseCategoryFormData,
): Promise<CourseCategoryConfig> {
  await delay(300);
  const created: CourseCategoryConfig = {
    ...data,
    id: `cat-${Date.now()}`,
    isSystem: false,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  };
  MOCK_CATEGORIES.unshift(created);
  return created;
}

export async function mockUpdateCourseCategory(
  id: string,
  data: Partial<CourseCategoryFormData>,
): Promise<CourseCategoryConfig> {
  await delay(300);
  const idx = MOCK_CATEGORIES.findIndex((item) => item.id === id);
  if (idx < 0) throw new Error('课程分类不存在');
  const updated: CourseCategoryConfig = {
    ...MOCK_CATEGORIES[idx],
    ...data,
    updatedAt: nowISO(),
  };
  MOCK_CATEGORIES[idx] = updated;
  return updated;
}

export async function mockRemoveCourseCategory(id: string): Promise<void> {
  await delay(200);
  const target = MOCK_CATEGORIES.find((item) => item.id === id);
  if (target?.isSystem) throw new Error('系统内置分类不可删除');
  MOCK_CATEGORIES = MOCK_CATEGORIES.filter((item) => item.id !== id);
}
