/**
 * 课程模板 Store
 *
 * 管理课程模板列表的加载、创建、更新、复制、删除。
 */
import { create } from 'zustand';
import { courseTemplateService } from '@/services/course-template';
import type { CourseTemplate, CourseTemplateFormData } from '@/types/course-template';
import { logError } from '@/utils/logger';

interface CourseTemplateState {
  /** 当前分类下的课程模板列表 */
  templates: CourseTemplate[];
  /** 是否加载中 */
  loading: boolean;
  /** 错误信息 */
  error: string;
  /** 当前选中的分类 ID */
  activeCategoryId: string;

  /** 按分类 ID 获取课程模板 */
  fetchByCategoryId: (categoryId: string) => Promise<void>;
  /** 创建课程模板 */
  create: (data: CourseTemplateFormData) => Promise<CourseTemplate>;
  /** 更新课程模板 */
  update: (id: string, data: Partial<CourseTemplateFormData>) => Promise<CourseTemplate>;
  /** 复制课程模板 */
  copy: (id: string) => Promise<CourseTemplate>;
  /** 删除课程模板 */
  remove: (id: string) => Promise<void>;
  /** 设置当前分类 ID */
  setActiveCategoryId: (categoryId: string) => void;
  /** 清空错误 */
  clearError: () => void;
}

export const useCourseTemplateStore = create<CourseTemplateState>((set) => ({
  templates: [],
  loading: false,
  error: '',
  activeCategoryId: '',

  fetchByCategoryId: async (categoryId) => {
    set({ loading: true, error: '', activeCategoryId: categoryId });
    try {
      const list = await courseTemplateService.getList(categoryId);
      set({ templates: list, loading: false });
    } catch (err) {
      logError('courseTemplate fetchByCategoryId', err);
      set({ error: '课程加载失败，请重试', loading: false });
    }
  },

  create: async (data) => {
    const created = await courseTemplateService.create(data);
    set((state) => ({
      templates: [created, ...state.templates],
    }));
    return created;
  },

  update: async (id, data) => {
    const updated = await courseTemplateService.update(id, data);
    set((state) => ({
      templates: state.templates.map((item) => (item.id === id ? updated : item)),
    }));
    return updated;
  },

  copy: async (id) => {
    const copied = await courseTemplateService.copy(id);
    set((state) => ({
      templates: [copied, ...state.templates],
    }));
    return copied;
  },

  remove: async (id) => {
    await courseTemplateService.remove(id);
    set((state) => ({
      templates: state.templates.filter((item) => item.id !== id),
    }));
  },

  setActiveCategoryId: (categoryId) => {
    set({ activeCategoryId: categoryId });
  },

  clearError: () => set({ error: '' }),
}));
