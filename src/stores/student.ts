/**
 * 学员数据 Store
 * 缓存学员列表，避免重复请求；增删改后自动 invalidate
 */
import { create } from 'zustand';
import { studentService } from '@/services/student';
import type { Student } from '@/types/student';
import { TTL } from '@/utils/data-freshness';
import { logError } from '@/utils/logger';

interface StudentState {
  /** 按 teacherId 缓存的学员列表 */
  cache: Record<string, Student[]>;
  /** 加载状态 */
  loading: Record<string, boolean>;
  /** 上次加载时间（用于判断是否需要刷新） */
  lastFetch: Record<string, number>;

  /** 获取教师的学员列表（优先缓存） */
  fetchByTeacher: (teacherId: string, campusId?: string, force?: boolean) => Promise<Student[]>;
  /** 获取家长绑定学员列表（优先缓存） */
  fetchByParent: (parentId: string, force?: boolean) => Promise<Student[]>;
  /** 获取学员详情（从缓存中查找，未命中则请求） */
  fetchById: (studentId: string, teacherId?: string) => Promise<Student | null>;
  /** 创建学员后 invalidate 缓存 */
  invalidate: (teacherId: string, campusId?: string) => void;
  /** 清空家长侧缓存 */
  invalidateParent: (parentId: string) => void;
  /** 更新缓存中的单条学员 */
  updateInCache: (teacherId: string, student: Student, campusId?: string) => void;
  /** 从缓存中移除学员 */
  removeFromCache: (teacherId: string, studentId: string, campusId?: string) => void;
}

/** 缓存有效期（L2 列表） */
const CACHE_TTL = TTL.list;

export const useStudentStore = create<StudentState>((set, get) => ({
  cache: {},
  loading: {},
  lastFetch: {},

  fetchByTeacher: async (teacherId, campusId, force = false) => {
    const { cache, lastFetch } = get();
    const now = Date.now();
    const cacheKey = campusId ? `${teacherId}:${campusId}` : teacherId;

    // 缓存有效且非强制刷新
    if (!force && cache[cacheKey] && lastFetch[cacheKey] && now - lastFetch[cacheKey] < CACHE_TTL) {
      return cache[cacheKey];
    }

    set((s) => ({ loading: { ...s.loading, [cacheKey]: true } }));

    try {
      const list = await studentService.getByTeacher(teacherId, campusId);
      set((s) => ({
        cache: { ...s.cache, [cacheKey]: list },
        loading: { ...s.loading, [cacheKey]: false },
        lastFetch: { ...s.lastFetch, [cacheKey]: now },
      }));
      return list;
    } catch (err) {
      logError('student fetchByTeacher', err);
      set((s) => ({ loading: { ...s.loading, [cacheKey]: false } }));
      return cache[cacheKey] || [];
    }
  },

  fetchByParent: async (parentId, force = false) => {
    const { cache, lastFetch } = get();
    const now = Date.now();
    const cacheKey = `parent:${parentId}`;

    if (!force && cache[cacheKey] && lastFetch[cacheKey] && now - lastFetch[cacheKey] < CACHE_TTL) {
      return cache[cacheKey];
    }

    set((s) => ({ loading: { ...s.loading, [cacheKey]: true } }));

    try {
      const list = await studentService.getByParent(parentId);
      set((s) => ({
        cache: { ...s.cache, [cacheKey]: list },
        loading: { ...s.loading, [cacheKey]: false },
        lastFetch: { ...s.lastFetch, [cacheKey]: now },
      }));
      return list;
    } catch (err) {
      logError('student fetchByParent', err);
      set((s) => ({ loading: { ...s.loading, [cacheKey]: false } }));
      return cache[cacheKey] || [];
    }
  },

  fetchById: async (studentId, teacherId) => {
    // 先从缓存找
    if (teacherId) {
      const cached = get().cache[teacherId]?.find((s) => s.id === studentId);
      if (cached) return cached;
    }
    // 缓存未命中，请求接口
    return studentService.getById(studentId);
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

  invalidateParent: (parentId) => {
    const cacheKey = `parent:${parentId}`;
    set((s) => {
      const nextCache = { ...s.cache };
      const nextLastFetch = { ...s.lastFetch };
      delete nextCache[cacheKey];
      delete nextLastFetch[cacheKey];
      return { cache: nextCache, lastFetch: nextLastFetch };
    });
  },

  updateInCache: (teacherId, student, campusId) => {
    set((s) => {
      const cacheKey = campusId ? `${teacherId}:${campusId}` : teacherId;
      const list = s.cache[cacheKey];
      if (!list) return s;
      const idx = list.findIndex((item) => item.id === student.id);
      if (idx >= 0) {
        const newList = [...list];
        newList[idx] = student;
        return { cache: { ...s.cache, [cacheKey]: newList } };
      }
      // 新增的学员追加到列表
      return { cache: { ...s.cache, [cacheKey]: [...list, student] } };
    });
  },

  removeFromCache: (teacherId, studentId, campusId) => {
    set((s) => {
      const cacheKey = campusId ? `${teacherId}:${campusId}` : teacherId;
      const list = s.cache[cacheKey];
      if (!list) return s;
      return { cache: { ...s.cache, [cacheKey]: list.filter((item) => item.id !== studentId) } };
    });
  },
}));
