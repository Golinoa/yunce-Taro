/**
 * 课程模板 Service 层
 */
import type { CourseTemplate, CourseTemplateFormData } from '@/types/course-template';

export const courseTemplateService = {
  /** 获取课程模板列表 */
  getList: async (_categoryId?: string): Promise<CourseTemplate[]> => [],

  /** 获取课程模板详情 */
  getById: async (_id: string): Promise<CourseTemplate | null> => null,

  /** 创建课程模板 */
  create: async (_data: CourseTemplateFormData): Promise<CourseTemplate> => {
    throw new Error('课程模板 API 暂未接通');
  },

  /** 更新课程模板 */
  update: async (
    _id: string,
    _data: Partial<CourseTemplateFormData>,
  ): Promise<CourseTemplate> => {
    throw new Error('课程模板 API 暂未接通');
  },

  /** 复制课程模板 */
  copy: async (_id: string): Promise<CourseTemplate> => {
    throw new Error('课程模板 API 暂未接通');
  },

  /** 删除课程模板 */
  remove: async (_id: string): Promise<void> => {
    throw new Error('课程模板 API 暂未接通');
  },
};
