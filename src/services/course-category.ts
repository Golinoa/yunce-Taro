/**
 * 课程分类 Service 层
 */
import type { CourseCategoryConfig, CourseCategoryFormData } from '@/types/course-category';

export const courseCategoryService = {
  getList: async (): Promise<CourseCategoryConfig[]> => {
    throw new Error('[接口未接通] course-category 后端尚未提供课程分类列表接口');
  },

  getById: async (_id: string): Promise<CourseCategoryConfig | null> => {
    throw new Error('[接口未接通] course-category 后端尚未提供课程分类详情接口');
  },

  create: async (_data: CourseCategoryFormData): Promise<CourseCategoryConfig> => {
    throw new Error('课程分类 API 暂未接通');
  },

  update: async (
    _id: string,
    _data: Partial<CourseCategoryFormData>,
  ): Promise<CourseCategoryConfig> => {
    throw new Error('课程分类 API 暂未接通');
  },

  remove: async (_id: string): Promise<void> => {
    throw new Error('课程分类 API 暂未接通');
  },
};
