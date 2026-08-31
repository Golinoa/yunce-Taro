/**
 * 课程分类 Service 层
 */
import type { CourseCategoryConfig, CourseCategoryFormData } from '@/types/course-category';

export const courseCategoryService = {
  getList: async (): Promise<CourseCategoryConfig[]> => [],

  getById: async (_id: string): Promise<CourseCategoryConfig | null> => null,

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
