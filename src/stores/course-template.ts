/**
 * 课程模板 Store
 *
 * 管理课程模板列表的加载、创建、更新、复制、删除。
 */
import { create } from 'zustand';
import { courseTemplateService } from '@/services/course-template';
import type { CourseTemplate, CourseTemplateFormData } from '@/types/course-template';
import { TTL } from '@/utils/data-freshness';
import { logError } from '@/utils/logger';

interface CourseTemplateState {
  /** 按分类缓存的课程模板 */
  cache: Record<string, CourseTemplate[]>;
  /** 当前分类下的课程模板列表（与 activeCategoryId 同步） */
  templates: CourseTemplate[];
  /** 是否加载中 */
  loading: boolean;
  /** 错误信息 */
  error: string;
  /** 当前选中的分类 ID */
  activeCategoryId: string;
  lastFetch: Record<string, number>;

  /** 按分类 ID 获取课程模板 */
  fetchByCategoryId: (categoryId: string, force?: boolean) => Promise<void>;
  invalidateCache: () => void;
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

export const useCourseTemplateStore = create<CourseTemplateState>((set, get) => ({
  cache: {},
  templates: [],
  loading: false,
  error: '',
  activeCategoryId: '',
  lastFetch: {},

  fetchByCategoryId: async (categoryId, force = false) => {
    const { cache, lastFetch } = get();
    const now = Date.now();
    if (
      !force &&
      cache[categoryId] &&
      lastFetch[categoryId] &&
      now - lastFetch[categoryId] < TTL.list
    ) {
      set({ templates: cache[categoryId], activeCategoryId: categoryId, loading: false });
      return;
    }
    set({ loading: true, error: '', activeCategoryId: categoryId });
    try {
      const list = await courseTemplateService.getList(categoryId);
      set((s) => ({
        templates: list,
        loading: false,
        cache: { ...s.cache, [categoryId]: list },
        lastFetch: { ...s.lastFetch, [categoryId]: now },
      }));
    } catch (err) {
      logError('courseTemplate fetchByCategoryId', err);
      set({ error: '课程加载失败，请重试', loading: false });
    }
  },

  invalidateCache: () => {
    set({ cache: {}, lastFetch: {}, templates: [] });
  },

  create: async (data) => {
    const created = await courseTemplateService.create(data);
    set((state) => {
      const categoryId = created.categoryId || data.categoryId;
      const bucket =
        state.cache[categoryId] ?? (state.activeCategoryId === categoryId ? state.templates : []);
      const next = [created, ...bucket.filter((item) => item.id !== created.id)];
      return {
        templates: state.activeCategoryId === categoryId ? next : state.templates,
        cache: categoryId ? { ...state.cache, [categoryId]: next } : state.cache,
        lastFetch: categoryId ? { ...state.lastFetch, [categoryId]: Date.now() } : state.lastFetch,
      };
    });
    return created;
  },

  update: async (id, data) => {
    const updated = await courseTemplateService.update(id, data);
    set((state) => {
      const categoryId = updated.categoryId || state.activeCategoryId;
      const nextCache = { ...state.cache };
      // 若分类变更，从旧桶移除
      Object.keys(nextCache).forEach((key) => {
        if (key !== categoryId) {
          nextCache[key] = nextCache[key].filter((item) => item.id !== id);
        }
      });
      const bucket =
        nextCache[categoryId] ?? (state.activeCategoryId === categoryId ? state.templates : []);
      const without = bucket.filter((item) => item.id !== id);
      const next = [updated, ...without];
      nextCache[categoryId] = next;
      return {
        templates:
          state.activeCategoryId === categoryId ? next : state.templates.filter((t) => t.id !== id),
        cache: nextCache,
        lastFetch: { ...state.lastFetch, [categoryId]: Date.now() },
      };
    });
    return updated;
  },

  copy: async (id) => {
    const copied = await courseTemplateService.copy(id);
    set((state) => {
      const categoryId = copied.categoryId || state.activeCategoryId;
      const bucket =
        state.cache[categoryId] ?? (state.activeCategoryId === categoryId ? state.templates : []);
      const next = [copied, ...bucket.filter((item) => item.id !== copied.id)];
      return {
        templates: state.activeCategoryId === categoryId ? next : state.templates,
        cache: categoryId ? { ...state.cache, [categoryId]: next } : state.cache,
        lastFetch: categoryId ? { ...state.lastFetch, [categoryId]: Date.now() } : state.lastFetch,
      };
    });
    return copied;
  },

  remove: async (id) => {
    const before = get().templates.find((item) => item.id === id);
    await courseTemplateService.remove(id);
    set((state) => {
      const categoryId = before?.categoryId || state.activeCategoryId;
      const nextCache = { ...state.cache };
      Object.keys(nextCache).forEach((key) => {
        nextCache[key] = nextCache[key].filter((item) => item.id !== id);
      });
      return {
        templates: state.templates.filter((item) => item.id !== id),
        cache: nextCache,
        lastFetch: categoryId ? { ...state.lastFetch, [categoryId]: Date.now() } : state.lastFetch,
      };
    });
  },

  setActiveCategoryId: (categoryId) => {
    set({ activeCategoryId: categoryId });
  },

  clearError: () => set({ error: '' }),
}));
