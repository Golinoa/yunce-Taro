/**
 * 课程分类 Store
 *
 * 管理课程分类列表、加载状态，以及分类的增删改查。
 */
import { create } from 'zustand';
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

const DEFAULT_CATEGORIES: CourseCategoryConfig[] = [
  {
    id: 'cat-class',
    name: '班课',
    sortOrder: 1,
    minOpenCount: 1,
    bookingDeadline: 'at_start',
    cancelQueueTime: 'at_start',
    nonCancelTime: 'at_start',
    autoCheckin: 'at_end',
    studentSelfCheckin: true,
    distanceLimit: false,
    checkinBeforeMinutes: 60,
    checkinAfterMinutes: 120,
    mode: 'class',
    independentDisplay: true,
    isSystem: true,
    createdAt: '2026-07-01T10:00:00Z',
    updatedAt: '2026-07-01T10:00:00Z',
  },
  {
    id: 'cat-group',
    name: '团课',
    sortOrder: 2,
    minOpenCount: 1,
    bookingDeadline: 'at_start',
    cancelQueueTime: 'at_start',
    nonCancelTime: 'at_start',
    autoCheckin: 'at_end',
    studentSelfCheckin: true,
    distanceLimit: false,
    checkinBeforeMinutes: 60,
    checkinAfterMinutes: 120,
    mode: 'group',
    independentDisplay: true,
    isSystem: true,
    createdAt: '2026-07-01T10:00:00Z',
    updatedAt: '2026-07-01T10:00:00Z',
  },
  {
    id: 'cat-private',
    name: '私教',
    sortOrder: 3,
    minOpenCount: 1,
    bookingDeadline: 'at_start',
    cancelQueueTime: 'at_start',
    nonCancelTime: 'at_start',
    autoCheckin: 'at_end',
    studentSelfCheckin: true,
    distanceLimit: false,
    checkinBeforeMinutes: 60,
    checkinAfterMinutes: 120,
    mode: 'private',
    independentDisplay: true,
    isSystem: true,
    createdAt: '2026-07-01T10:00:00Z',
    updatedAt: '2026-07-01T10:00:00Z',
  },
];

export const useCourseCategoryStore = create<CourseCategoryState>((set, get) => ({
  categories: [...DEFAULT_CATEGORIES],
  loading: false,
  error: null,
  activeCategoryId: DEFAULT_CATEGORIES[0]?.id ?? '',

  fetchList: async () => {
    set({ loading: true, error: null });
    try {
      const list = await courseCategoryService.getList();
      // 按 sortOrder 升序排列
      const sorted = [...list].sort((a, b) => a.sortOrder - b.sortOrder);
      set({ categories: sorted });
    } catch (err) {
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
