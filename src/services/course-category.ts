/**
 * 课程分类 Service 层
 *
 * 定义接口契约，当前由 mock 实现，联调时替换为真实 request 调用。
 */
import {
  mockGetCourseCategories,
  mockGetCourseCategoryById,
  mockCreateCourseCategory,
  mockUpdateCourseCategory,
  mockRemoveCourseCategory,
} from '@/data/course-category';
import { mockGetCourseTemplates, mockRemoveCourseTemplate } from '@/data/course-template';
import type { CourseCategoryConfig, CourseCategoryFormData } from '@/types/course-category';

const USE_MOCK =
  typeof process !== 'undefined' && typeof process.env !== 'undefined'
    ? process.env.VITE_USE_MOCK !== 'false'
    : true;

export const courseCategoryService = {
  /** 获取课程分类列表 */
  getList: async (): Promise<CourseCategoryConfig[]> => {
    if (!USE_MOCK) {
      // TODO: 联调时替换为真实 API
      // return await get<CourseCategoryConfig[]>('/course-categories');
    }
    return mockGetCourseCategories();
  },

  /** 获取课程分类详情 */
  getById: async (id: string): Promise<CourseCategoryConfig | null> => {
    if (!USE_MOCK) {
      // TODO: 联调时替换为真实 API
      // return await get<CourseCategoryConfig>(`/course-categories/${id}`);
    }
    return mockGetCourseCategoryById(id);
  },

  /** 创建课程分类 */
  create: async (data: CourseCategoryFormData): Promise<CourseCategoryConfig> => {
    if (!USE_MOCK) {
      // TODO: 联调时替换为真实 API
      // return await post<CourseCategoryConfig>('/course-categories', data);
    }
    return mockCreateCourseCategory(data);
  },

  /** 更新课程分类 */
  update: async (
    id: string,
    data: Partial<CourseCategoryFormData>,
  ): Promise<CourseCategoryConfig> => {
    if (!USE_MOCK) {
      // TODO: 联调时替换为真实 API
      // return await put<CourseCategoryConfig>(`/course-categories/${id}`, data);
    }
    return mockUpdateCourseCategory(id, data);
  },

  /** 删除课程分类（同步删除分类下的课程模板） */
  remove: async (id: string): Promise<void> => {
    if (!USE_MOCK) {
      // TODO: 联调时替换为真实 API
      // await del(`/course-categories/${id}`);
      // return;
    }
    // 级联删除该分类下的课程模板
    const templates = await mockGetCourseTemplates(id);
    await Promise.all(templates.map((item) => mockRemoveCourseTemplate(item.id)));
    return mockRemoveCourseCategory(id);
  },
};
