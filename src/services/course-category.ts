/**
 * 课程分类 Service 层
 *
 * 定义接口契约，当前由 mock 实现，联调时替换为真实 request 调用。
 */
import type { CourseCategoryConfig, CourseCategoryFormData } from '@/types/course-category';
import { loadCourseCategoryMock, loadCourseTemplateMock } from '@/utils/mock-loaders';
import { isUseMock } from '@/utils/build-env';

export const courseCategoryService = {
  /** 获取课程分类列表 */
  getList: async (): Promise<CourseCategoryConfig[]> => {
        if (!isUseMock()) {
      return [];
    }
    const { mockGetCourseCategories } = await loadCourseCategoryMock();
    return mockGetCourseCategories();
  },

  /** 获取课程分类详情 */
  getById: async (id: string): Promise<CourseCategoryConfig | null> => {
        if (!isUseMock()) {
      return null;
    }
    const { mockGetCourseCategoryById } = await loadCourseCategoryMock();
    return mockGetCourseCategoryById(id);
  },

  /** 创建课程分类 */
  create: async (data: CourseCategoryFormData): Promise<CourseCategoryConfig> => {
        if (!isUseMock()) {
      throw new Error('课程分类 API 暂未接通');
    }
    const { mockCreateCourseCategory } = await loadCourseCategoryMock();
    return mockCreateCourseCategory(data);
  },

  /** 更新课程分类 */
  update: async (
    id: string,
    data: Partial<CourseCategoryFormData>,
  ): Promise<CourseCategoryConfig> => {
        if (!isUseMock()) {
      throw new Error('课程分类 API 暂未接通');
    }
    const { mockUpdateCourseCategory } = await loadCourseCategoryMock();
    return mockUpdateCourseCategory(id, data);
  },

  /** 删除课程分类（同步删除分类下的课程模板） */
  remove: async (id: string): Promise<void> => {
    if (!isUseMock()) {
      throw new Error('课程分类 API 暂未接通');
    }
    const { mockGetCourseTemplates, mockRemoveCourseTemplate } = await loadCourseTemplateMock();
    const { mockRemoveCourseCategory } = await loadCourseCategoryMock();
    const templates = await mockGetCourseTemplates(id);
    await Promise.all(templates.map((item) => mockRemoveCourseTemplate(item.id)));
    return mockRemoveCourseCategory(id);
  },
};
