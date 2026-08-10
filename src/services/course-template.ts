/**
 * 课程模板 Service 层
 *
 * 定义接口契约，当前由 mock 实现，联调时替换为真实 request 调用。
 * 切换方式：修改下方 USE_MOCK 或统一使用环境变量开关。
 */
import {
  mockGetCourseTemplates,
  mockGetCourseTemplateById,
  mockCreateCourseTemplate,
  mockUpdateCourseTemplate,
  mockCopyCourseTemplate,
  mockRemoveCourseTemplate,
} from '@/data/course-template';
import type { CourseTemplate, CourseTemplateFormData } from '@/types/course-template';

const USE_MOCK =
  typeof process !== 'undefined' && typeof process.env !== 'undefined'
    ? process.env.VITE_USE_MOCK !== 'false'
    : true;

export const courseTemplateService = {
  /** 获取课程模板列表 */
  getList: async (categoryId?: string): Promise<CourseTemplate[]> => {
    if (!USE_MOCK) {
      // TODO: 联调时替换为真实 API
      // const params = new URLSearchParams();
      // if (categoryId) params.set('categoryId', categoryId);
      // return await get<CourseTemplate[]>(`/course-templates?${params.toString()}`);
    }
    return mockGetCourseTemplates(categoryId);
  },

  /** 获取课程模板详情 */
  getById: async (id: string): Promise<CourseTemplate | null> => {
    if (!USE_MOCK) {
      // TODO: 联调时替换为真实 API
      // return await get<CourseTemplate>(`/course-templates/${id}`);
    }
    return mockGetCourseTemplateById(id);
  },

  /** 创建课程模板 */
  create: async (data: CourseTemplateFormData): Promise<CourseTemplate> => {
    if (!USE_MOCK) {
      // TODO: 联调时替换为真实 API
      // return await post<CourseTemplate>('/course-templates', data);
    }
    return mockCreateCourseTemplate(data);
  },

  /** 更新课程模板 */
  update: async (id: string, data: Partial<CourseTemplateFormData>): Promise<CourseTemplate> => {
    if (!USE_MOCK) {
      // TODO: 联调时替换为真实 API
      // return await put<CourseTemplate>(`/course-templates/${id}`, data);
    }
    return mockUpdateCourseTemplate(id, data);
  },

  /** 复制课程模板 */
  copy: async (id: string): Promise<CourseTemplate> => {
    if (!USE_MOCK) {
      // TODO: 联调时替换为真实 API
      // return await post<CourseTemplate>(`/course-templates/${id}/copy`, {});
    }
    return mockCopyCourseTemplate(id);
  },

  /** 删除课程模板 */
  remove: async (id: string): Promise<void> => {
    if (!USE_MOCK) {
      // TODO: 联调时替换为真实 API
      // await del(`/course-templates/${id}`);
      // return;
    }
    return mockRemoveCourseTemplate(id);
  },
};
