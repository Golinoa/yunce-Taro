/**
 * 课程模板 Service：对接后端 /course-templates 契约。
 */
import type { CourseTemplate, CourseTemplateFormData } from '@/types/course-template';
import { formatApiDateTime } from '@/utils/pagination';
import { ApiError, del, get, post, put } from '@/utils/request';

type BackendCourseTemplate = Record<string, unknown>;

function mapCourseTemplate(raw: BackendCourseTemplate): CourseTemplate {
  return {
    id: String(raw.id ?? ''),
    name: String(raw.name ?? ''),
    categoryId: String(raw.categoryId ?? ''),
    category: (raw.category as CourseTemplate['category']) ?? 'group',
    duration: Number(raw.duration ?? 0),
    capacity: Number(raw.capacity ?? 1),
    status: (raw.status as CourseTemplate['status']) ?? 'active',
    color: raw.color == null ? undefined : String(raw.color),
    subjectId: raw.subjectId == null ? undefined : String(raw.subjectId),
    subjectName: raw.subjectName == null ? undefined : String(raw.subjectName),
    ageGroup: raw.ageGroup as CourseTemplate['ageGroup'],
    customAgeGroup: raw.customAgeGroup == null ? undefined : String(raw.customAgeGroup),
    experiencePrice: raw.experiencePrice == null ? undefined : Number(raw.experiencePrice),
    price: raw.price == null ? undefined : Number(raw.price),
    minOpenCount: raw.minOpenCount == null ? undefined : Number(raw.minOpenCount),
    bookingDeadline: raw.bookingDeadline == null ? undefined : Number(raw.bookingDeadline),
    cancelQueueTime: raw.cancelQueueTime == null ? undefined : Number(raw.cancelQueueTime),
    nonCancelTime: raw.nonCancelTime == null ? undefined : Number(raw.nonCancelTime),
    autoCheckin: raw.autoCheckin as CourseTemplate['autoCheckin'],
    studentSelfCheckin: raw.studentSelfCheckin as CourseTemplate['studentSelfCheckin'],
    allowCheckinRoles: Array.isArray(raw.allowCheckinRoles)
      ? (raw.allowCheckinRoles as CourseTemplate['allowCheckinRoles'])
      : undefined,
    level: raw.level as CourseTemplate['level'],
    customLevel: raw.customLevel == null ? undefined : String(raw.customLevel),
    description: raw.description == null ? undefined : String(raw.description),
    isOnline: raw.isOnline == null ? undefined : Boolean(raw.isOnline),
    onlineMeetingId: raw.onlineMeetingId == null ? undefined : String(raw.onlineMeetingId),
    homeImage: raw.homeImage == null ? undefined : String(raw.homeImage),
    backgroundImage: raw.backgroundImage == null ? undefined : String(raw.backgroundImage),
    teacherId: raw.teacherId == null ? undefined : String(raw.teacherId),
    teacherName: raw.teacherName == null ? undefined : String(raw.teacherName),
    assistantId: raw.assistantId == null ? undefined : String(raw.assistantId),
    assistantName: raw.assistantName == null ? undefined : String(raw.assistantName),
    studentIds: Array.isArray(raw.studentIds) ? raw.studentIds.map(String) : undefined,
    classStartTime: raw.classStartTime == null ? undefined : String(raw.classStartTime),
    classEndTime: raw.classEndTime == null ? undefined : String(raw.classEndTime),
    createdAt: formatApiDateTime(raw.createdAt),
    updatedAt: formatApiDateTime(raw.updatedAt),
  };
}

function toBackendBody(
  data: CourseTemplateFormData | Partial<CourseTemplateFormData>,
): Record<string, unknown> {
  const fields = [
    'name',
    'categoryId',
    'category',
    'duration',
    'capacity',
    'color',
    'subjectId',
    'subjectName',
    'ageGroup',
    'customAgeGroup',
    'experiencePrice',
    'price',
    'minOpenCount',
    'bookingDeadline',
    'cancelQueueTime',
    'nonCancelTime',
    'autoCheckin',
    'studentSelfCheckin',
    'allowCheckinRoles',
    'level',
    'customLevel',
    'description',
    'isOnline',
    'onlineMeetingId',
    'homeImage',
    'backgroundImage',
    'teacherId',
    'teacherName',
    'assistantId',
    'assistantName',
    'studentIds',
    'classStartTime',
    'classEndTime',
  ] as const;
  const body: Record<string, unknown> = {};
  for (const field of fields) {
    if (data[field] !== undefined) body[field] = data[field];
  }
  return body;
}

export const courseTemplateService = {
  getList: async (categoryId?: string): Promise<CourseTemplate[]> => {
    const data = await get<BackendCourseTemplate[] | { list?: BackendCourseTemplate[] }>(
      '/course-templates',
      categoryId ? { categoryId } : undefined,
    );
    const list = Array.isArray(data) ? data : Array.isArray(data?.list) ? data.list : [];
    return list.map(mapCourseTemplate);
  },

  getById: async (id: string): Promise<CourseTemplate | null> => {
    try {
      return mapCourseTemplate(await get<BackendCourseTemplate>(`/course-templates/${id}`));
    } catch (err) {
      // 404 = 记录不存在，返 null；其他错误（网络/权限/500）如实抛出，
      // 避免编辑页以默认值渲染后保存静默覆盖原数据。
      if (err instanceof ApiError && err.code === 404) return null;
      throw err;
    }
  },

  create: async (data: CourseTemplateFormData): Promise<CourseTemplate> =>
    mapCourseTemplate(await post<BackendCourseTemplate>('/course-templates', toBackendBody(data))),

  update: async (id: string, data: Partial<CourseTemplateFormData>): Promise<CourseTemplate> =>
    mapCourseTemplate(
      await put<BackendCourseTemplate>(`/course-templates/${id}`, toBackendBody(data)),
    ),

  copy: async (id: string): Promise<CourseTemplate> =>
    mapCourseTemplate(await post<BackendCourseTemplate>(`/course-templates/${id}/copy`)),

  remove: async (id: string): Promise<void> => {
    await del(`/course-templates/${id}`);
  },
};
