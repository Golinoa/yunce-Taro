/**
 * 学员数据 Store
 * 缓存学员列表，避免重复请求；增删改后自动 invalidate
 */
import { create } from 'zustand';
import { studentService } from '@/services';
import type { Student } from '@/types/student';

interface StudentState {
  /** 按 teacherId 缓存的学员列表 */
  cache: Record<string, Student[]>;
  /** 加载状态 */
  loading: Record<string, boolean>;
  /** 上次加载时间（用于判断是否需要刷新） */
  lastFetch: Record<string, number>;

  /** 获取教师的学员列表（优先缓存） */
  fetchByTeacher: (teacherId: string, force?: boolean) => Promise<Student[]>;
  /** 获取学员详情（从缓存中查找，未命中则请求） */
  fetchById: (studentId: string, teacherId?: string) => Promise<Student | null>;
  /** 创建学员后 invalidate 缓存 */
  invalidate: (teacherId: string) => void;
  /** 更新缓存中的单条学员 */
  updateInCache: (teacherId: string, student: Student) => void;
  /** 从缓存中移除学员 */
  removeFromCache: (teacherId: string, studentId: string) => void;
}

/** 缓存有效期 5 分钟 */
const CACHE_TTL = 5 * 60 * 1000;

export const useStudentStore = create<StudentState>((set, get) => ({
  cache: {},
  loading: {},
  lastFetch: {},

  fetchByTeacher: async (teacherId, force = false) => {
    const { cache, lastFetch } = get();
    const now = Date.now();

    // 缓存有效且非强制刷新
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
      const list = await studentService.getByTeacher(teacherId);
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

  fetchById: async (studentId, teacherId) => {
    // 先从缓存找
    if (teacherId) {
      const cached = get().cache[teacherId]?.find((s) => s.id === studentId);
      if (cached) return cached;
    }
    // 缓存未命中，请求接口
    return studentService.getById(studentId);
  },

  invalidate: (teacherId) => {
    set((s) => ({
      cache: { ...s.cache, [teacherId]: undefined },
      lastFetch: { ...s.lastFetch, [teacherId]: 0 },
    }));
  },

  updateInCache: (teacherId, student) => {
    set((s) => {
      const list = s.cache[teacherId];
      if (!list) return s;
      const idx = list.findIndex((item) => item.id === student.id);
      if (idx >= 0) {
        const newList = [...list];
        newList[idx] = student;
        return { cache: { ...s.cache, [teacherId]: newList } };
      }
      // 新增的学员追加到列表
      return { cache: { ...s.cache, [teacherId]: [...list, student] } };
    });
  },

  removeFromCache: (teacherId, studentId) => {
    set((s) => {
      const list = s.cache[teacherId];
      if (!list) return s;
      return { cache: { ...s.cache, [teacherId]: list.filter((item) => item.id !== studentId) } };
    });
  },
}));
