/**
 * 课程分类 Service：对接后端 /course-categories 契约。
 */
import type { CourseCategoryConfig, CourseCategoryFormData } from '@/types/course-category';
import { formatApiDateTime } from '@/utils/pagination';
import { ApiError, del, get, post, put } from '@/utils/request';

type BackendCourseCategory = Record<string, unknown>;

function mapCourseCategory(raw: BackendCourseCategory): CourseCategoryConfig {
  return {
    id: String(raw.id ?? ''),
    name: String(raw.name ?? ''),
    sortOrder: Number(raw.sortOrder ?? 0),
    minOpenCount: Number(raw.minOpenCount ?? 1),
    bookingDeadline: raw.bookingDeadline as CourseCategoryConfig['bookingDeadline'],
    cancelQueueTime: raw.cancelQueueTime as CourseCategoryConfig['cancelQueueTime'],
    nonCancelTime: raw.nonCancelTime as CourseCategoryConfig['nonCancelTime'],
    autoCheckin: raw.autoCheckin as CourseCategoryConfig['autoCheckin'],
    studentSelfCheckin: Boolean(raw.studentSelfCheckin),
    distanceLimit: Boolean(raw.distanceLimit),
    checkinBeforeMinutes: Number(raw.checkinBeforeMinutes ?? 60),
    checkinAfterMinutes: Number(raw.checkinAfterMinutes ?? 120),
    mode: (raw.mode as CourseCategoryConfig['mode']) ?? 'group',
    independentDisplay: Boolean(raw.independentDisplay),
    isSystem: raw.isSystem == null ? undefined : Boolean(raw.isSystem),
    createdAt: formatApiDateTime(raw.createdAt),
    updatedAt: formatApiDateTime(raw.updatedAt),
  };
}

function toBackendBody(
  data: CourseCategoryFormData | Partial<CourseCategoryFormData>,
): Record<string, unknown> {
  const fields = [
    'name',
    'sortOrder',
    'minOpenCount',
    'bookingDeadline',
    'cancelQueueTime',
    'nonCancelTime',
    'autoCheckin',
    'studentSelfCheckin',
    'distanceLimit',
    'checkinBeforeMinutes',
    'checkinAfterMinutes',
    'mode',
    'independentDisplay',
  ] as const;
  const body: Record<string, unknown> = {};
  for (const field of fields) {
    if (data[field] !== undefined) body[field] = data[field];
  }
  return body;
}

export const courseCategoryService = {
  getList: async (): Promise<CourseCategoryConfig[]> => {
    const data = await get<BackendCourseCategory[] | { list?: BackendCourseCategory[] }>(
      '/course-categories',
    );
    const list = Array.isArray(data) ? data : Array.isArray(data?.list) ? data.list : [];
    return list.map(mapCourseCategory);
  },

  getById: async (id: string): Promise<CourseCategoryConfig | null> => {
    try {
      return mapCourseCategory(await get<BackendCourseCategory>(`/course-categories/${id}`));
    } catch (err) {
      // 404 = 记录不存在，返 null；其他错误如实抛出，避免编辑页以默认值覆盖原数据。
      if (err instanceof ApiError && err.code === 404) return null;
      throw err;
    }
  },

  create: async (data: CourseCategoryFormData): Promise<CourseCategoryConfig> =>
    mapCourseCategory(await post<BackendCourseCategory>('/course-categories', toBackendBody(data))),

  update: async (
    id: string,
    data: Partial<CourseCategoryFormData>,
  ): Promise<CourseCategoryConfig> =>
    mapCourseCategory(
      await put<BackendCourseCategory>(`/course-categories/${id}`, toBackendBody(data)),
    ),

  remove: async (id: string): Promise<void> => {
    await del(`/course-categories/${id}`);
  },
};
