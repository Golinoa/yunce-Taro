/**
 * 课程分类 Store
 *
 * 管理课程分类列表、加载状态，以及分类的增删改查。
 * API 未接通返回空时保留默认班课/团课/私教，避免课表独立 tab 被清空。
 */
import { create } from 'zustand';
import {
  DEFAULT_COURSE_CATEGORY_CONFIGS,
  resolveCourseCategoriesFromApi,
} from '@/constants/course-category-defaults';
import { courseCategoryService } from '@/services/course-category';
import type {
  CourseCategoryConfig,
  CourseCategoryFormData,
  CourseCategoryMode,
} from '@/types/course-category';

interface CourseCategoryState {
  /** 分类列表 */
  categories: CourseCategoryConfig[];
  /** 加载状态 */
  loading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 当前激活的分类 ID */
  activeCategoryId: string;

  /** 获取分类列表 */
  fetchList: () => Promise<void>;
  /** 设置当前激活分类 ID */
  setActiveCategoryId: (id: string) => void;
  /** 根据分类 ID 获取对应课程模式 */
  getModeById: (id: string) => CourseCategoryMode | undefined;
  /** 创建分类 */
  create: (data: CourseCategoryFormData) => Promise<CourseCategoryConfig>;
  /** 更新分类 */
  update: (id: string, data: Partial<CourseCategoryFormData>) => Promise<CourseCategoryConfig>;
  /** 删除分类 */
  remove: (id: string) => Promise<void>;
}

export const useCourseCategoryStore = create<CourseCategoryState>((set, get) => ({
  categories: [...DEFAULT_COURSE_CATEGORY_CONFIGS],
  loading: false,
  error: null,
  activeCategoryId: DEFAULT_COURSE_CATEGORY_CONFIGS[0]?.id ?? '',

  fetchList: async () => {
    set({ loading: true, error: null });
    try {
      const list = await courseCategoryService.getList();
      const next = resolveCourseCategoriesFromApi(list);
      const currentId = get().activeCategoryId;
      const activeCategoryId = next.some((c) => c.id === currentId)
        ? currentId
        : (next[0]?.id ?? '');
      set({ categories: next, activeCategoryId });
    } catch (err) {
      // 失败时保留已有默认/缓存分类，仅记错误（课表勿因失败清空 tab）
      set({ error: err instanceof Error ? err.message : '加载分类失败' });
    } finally {
      set({ loading: false });
    }
  },

  setActiveCategoryId: (id) => {
    set({ activeCategoryId: id });
  },

  getModeById: (id) => {
    return get().categories.find((item) => item.id === id)?.mode;
  },

  create: async (data) => {
    const created = await courseCategoryService.create(data);
    set((state) => {
      const next = [...state.categories, created].sort((a, b) => a.sortOrder - b.sortOrder);
      return { categories: next, activeCategoryId: created.id };
    });
    return created;
  },

  update: async (id, data) => {
    const updated = await courseCategoryService.update(id, data);
    set((state) => {
      const next = state.categories
        .map((item) => (item.id === id ? updated : item))
        .sort((a, b) => a.sortOrder - b.sortOrder);
      return { categories: next };
    });
    return updated;
  },

  remove: async (id) => {
    await courseCategoryService.remove(id);
    set((state) => {
      const next = state.categories.filter((item) => item.id !== id);
      const nextActiveId =
        state.activeCategoryId === id ? (next[0]?.id ?? '') : state.activeCategoryId;
      return { categories: next, activeCategoryId: nextActiveId };
    });
  },
}));
