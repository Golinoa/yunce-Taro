/**
 * 班级数据 Store
 * 缓存班级列表，避免重复请求
 */
import { create } from 'zustand';
import { classService } from '@/services';
import type { Class } from '@/types/class';

interface ClassState {
  cache: Record<string, Class[]>;
  loading: Record<string, boolean>;
  lastFetch: Record<string, number>;

  fetchByTeacher: (teacherId: string, force?: boolean) => Promise<Class[]>;
  invalidate: (teacherId: string) => void;
  updateInCache: (teacherId: string, cls: Class) => void;
  removeFromCache: (teacherId: string, classId: string) => void;
}

const CACHE_TTL = 5 * 60 * 1000;

export const useClassStore = create<ClassState>((set, get) => ({
  cache: {},
  loading: {},
  lastFetch: {},

  fetchByTeacher: async (teacherId, force = false) => {
    const { cache, lastFetch } = get();
    const now = Date.now();

    if (
      !force &&
      cache[teacherId] &&
      lastFetch[teacherId] &&
      now - lastFetch[teacherId] < CACHE_TTL
    ) {
      return cache[teacherId];
    }

    set((s) => ({ loading: { ...s.loading, [teacherId]: true } }));

    try {
      const list = await classService.getByTeacher(teacherId);
      set((s) => ({
        cache: { ...s.cache, [teacherId]: list },
        loading: { ...s.loading, [teacherId]: false },
        lastFetch: { ...s.lastFetch, [teacherId]: now },
      }));
      return list;
    } catch {
      set((s) => ({ loading: { ...s.loading, [teacherId]: false } }));
      return cache[teacherId] || [];
    }
  },

  invalidate: (teacherId) => {
    set((s) => ({
      cache: { ...s.cache, [teacherId]: undefined },
      lastFetch: { ...s.lastFetch, [teacherId]: 0 },
    }));
  },

  updateInCache: (teacherId, cls) => {
    set((s) => {
      const list = s.cache[teacherId];
      if (!list) return s;
      const idx = list.findIndex((item) => item.id === cls.id);
      if (idx >= 0) {
        const newList = [...list];
        newList[idx] = cls;
        return { cache: { ...s.cache, [teacherId]: newList } };
      }
      return { cache: { ...s.cache, [teacherId]: [...list, cls] } };
    });
  },

  removeFromCache: (teacherId, classId) => {
    set((s) => {
      const list = s.cache[teacherId];
      if (!list) return s;
      return { cache: { ...s.cache, [teacherId]: list.filter((item) => item.id !== classId) } };
    });
  },
}));
