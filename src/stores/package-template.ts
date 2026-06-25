/**
 * 课包模板 Store
 * 缓存教师的课包模板列表
 */
import { create } from 'zustand';
import { packageTemplateService } from '@/services';
import type { CoursePackageTemplate } from '@/types/course-package';

interface PackageTemplateState {
  cache: Record<string, CoursePackageTemplate[]>;
  loading: Record<string, boolean>;
  lastFetch: Record<string, number>;

  fetchByTeacher: (teacherId: string, force?: boolean) => Promise<CoursePackageTemplate[]>;
  invalidate: (teacherId: string) => void;
  updateInCache: (teacherId: string, tpl: CoursePackageTemplate) => void;
  removeFromCache: (teacherId: string, tplId: string) => void;
}

const CACHE_TTL = 5 * 60 * 1000;

export const usePackageTemplateStore = create<PackageTemplateState>((set, get) => ({
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
      const list = await packageTemplateService.getByTeacher(teacherId);
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
      cache: { ...s.cache, [teacherId]: undefined } as PackageTemplateState['cache'],
      lastFetch: { ...s.lastFetch, [teacherId]: 0 },
    }));
  },

  updateInCache: (teacherId, tpl) => {
    set((s) => {
      const list = s.cache[teacherId];
      if (!list) return s;
      const idx = list.findIndex((item) => item.id === tpl.id);
      if (idx >= 0) {
        const newList = [...list];
        newList[idx] = tpl;
        return { cache: { ...s.cache, [teacherId]: newList } };
      }
      return { cache: { ...s.cache, [teacherId]: [...list, tpl] } };
    });
  },

  removeFromCache: (teacherId, tplId) => {
    set((s) => {
      const list = s.cache[teacherId];
      if (!list) return s;
      return { cache: { ...s.cache, [teacherId]: list.filter((item) => item.id !== tplId) } };
    });
  },
}));
