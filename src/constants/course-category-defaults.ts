/**
 * 课程分类默认列表（API 未接通或返回空时保留，避免课表/课程 tab 被清空）
 */
import type { CourseCategoryConfig } from '@/types/course-category';

export const DEFAULT_COURSE_CATEGORY_CONFIGS: CourseCategoryConfig[] = [
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

/** API 空列表时回落默认分类（保持独立展示） */
export function resolveCourseCategoriesFromApi(
  list: CourseCategoryConfig[],
): CourseCategoryConfig[] {
  if (!list || list.length === 0) {
    return [...DEFAULT_COURSE_CATEGORY_CONFIGS];
  }
  return [...list].sort((a, b) => a.sortOrder - b.sortOrder);
}
