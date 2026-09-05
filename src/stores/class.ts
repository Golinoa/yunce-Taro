/**
 * 班级数据 Store
 * 缓存班级列表，避免重复请求
 */
import { create } from 'zustand';
import { classService } from '@/services';
import type { Class } from '@/types/class';
import { TTL } from '@/utils/data-freshness';
import { logError } from '@/utils/logger';

interface ClassState {
  cache: Record<string, Class[]>;
  loading: Record<string, boolean>;
  lastFetch: Record<string, number>;

  fetchByTeacher: (teacherId: string, campusId?: string, force?: boolean) => Promise<Class[]>;
  invalidate: (teacherId: string, campusId?: string) => void;
  updateInCache: (teacherId: string, cls: Class, campusId?: string) => void;
  removeFromCache: (teacherId: string, classId: string, campusId?: string) => void;
}

const CACHE_TTL = TTL.list;

export const useClassStore = create<ClassState>((set, get) => ({
  cache: {},
  loading: {},
  lastFetch: {},

  fetchByTeacher: async (teacherId, campusId, force = false) => {
    const { cache, lastFetch } = get();
    const now = Date.now();
    const cacheKey = campusId ? `${teacherId}:${campusId}` : teacherId;

    if (!force && cache[cacheKey] && lastFetch[cacheKey] && now - lastFetch[cacheKey] < CACHE_TTL) {
      return cache[cacheKey];
    }

    set((s) => ({ loading: { ...s.loading, [cacheKey]: true } }));

    try {
      const list = await classService.getByTeacher(teacherId, campusId);
      set((s) => ({
        cache: { ...s.cache, [cacheKey]: list },
        loading: { ...s.loading, [cacheKey]: false },
        lastFetch: { ...s.lastFetch, [cacheKey]: now },
      }));
      return list;
    } catch (err) {
      logError('class fetchByTeacher', err);
      set((s) => ({ loading: { ...s.loading, [cacheKey]: false } }));
      return cache[cacheKey] || [];
    }
  },

  invalidate: (teacherId, campusId) => {
    set((s) => {
      const nextCache = { ...s.cache };
      const nextLastFetch = { ...s.lastFetch };
      if (campusId) {
        const cacheKey = `${teacherId}:${campusId}`;
        delete nextCache[cacheKey];
        delete nextLastFetch[cacheKey];
      } else {
        Object.keys(nextCache).forEach((key) => {
          if (key === teacherId || key.startsWith(`${teacherId}:`)) {
            delete nextCache[key];
            delete nextLastFetch[key];
          }
        });
      }
      return { cache: nextCache, lastFetch: nextLastFetch };
    });
  },

  updateInCache: (teacherId, cls, campusId) => {
    set((s) => {
      const cacheKey = campusId ? `${teacherId}:${campusId}` : teacherId;
      const list = s.cache[cacheKey];
      if (!list) return s;
      const idx = list.findIndex((item) => item.id === cls.id);
      if (idx >= 0) {
        const newList = [...list];
        newList[idx] = cls;
        return { cache: { ...s.cache, [cacheKey]: newList } };
      }
      return { cache: { ...s.cache, [cacheKey]: [...list, cls] } };
    });
  },

  removeFromCache: (teacherId, classId, campusId) => {
    set((s) => {
      const cacheKey = campusId ? `${teacherId}:${campusId}` : teacherId;
      const list = s.cache[cacheKey];
      if (!list) return s;
      return { cache: { ...s.cache, [cacheKey]: list.filter((item) => item.id !== classId) } };
    });
  },
}));
