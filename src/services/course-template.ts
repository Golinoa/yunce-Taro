/**
 * 课程模板 Service 层
 *
 * 定义接口契约，当前由 mock 实现，联调时替换为真实 request 调用。
 * 切换方式：修改下方 isUseMock() 或统一使用环境变量开关。
 */
import type { CourseTemplate, CourseTemplateFormData } from '@/types/course-template';
import { loadCourseTemplateMock } from '@/utils/mock-loaders';
import { isUseMock } from '@/utils/build-env';

export const courseTemplateService = {
  /** 获取课程模板列表 */
  getList: async (categoryId?: string): Promise<CourseTemplate[]> => {
        if (!isUseMock()) {
      return [];
    }
    const { mockGetCourseTemplates } = await loadCourseTemplateMock();
    return mockGetCourseTemplates(categoryId);
  },

  /** 获取课程模板详情 */
  getById: async (id: string): Promise<CourseTemplate | null> => {
        if (!isUseMock()) {
      return null;
    }
    const { mockGetCourseTemplateById } = await loadCourseTemplateMock();
    return mockGetCourseTemplateById(id);
  },

  /** 创建课程模板 */
  create: async (data: CourseTemplateFormData): Promise<CourseTemplate> => {
        if (!isUseMock()) {
      throw new Error('课程模板 API 暂未接通');
    }
    const { mockCreateCourseTemplate } = await loadCourseTemplateMock();
    return mockCreateCourseTemplate(data);
  },

  /** 更新课程模板 */
  update: async (id: string, data: Partial<CourseTemplateFormData>): Promise<CourseTemplate> => {
        if (!isUseMock()) {
      throw new Error('课程模板 API 暂未接通');
    }
    const { mockUpdateCourseTemplate } = await loadCourseTemplateMock();
    return mockUpdateCourseTemplate(id, data);
  },

  /** 复制课程模板 */
  copy: async (id: string): Promise<CourseTemplate> => {
        if (!isUseMock()) {
      // TODO: real API
    }
    const { mockCopyCourseTemplate } = await loadCourseTemplateMock();
    return mockCopyCourseTemplate(id);
  },

  /** 删除课程模板 */
  remove: async (id: string): Promise<void> => {
        if (!isUseMock()) {
      throw new Error('课程模板 API 暂未接通');
    }
    const { mockRemoveCourseTemplate } = await loadCourseTemplateMock();
    return mockRemoveCourseTemplate(id);
  },
};
