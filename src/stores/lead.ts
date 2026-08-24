/**
 * 试听线索数据 Store
 * 缓存线索列表与统计摘要，增删改后自动 invalidate
 */
import { create } from 'zustand';
import { leadService } from '@/services/lead';
import type { LeadCardModel, LeadFilterTab, LeadSummary } from '@/types/lead';
import { logError } from '@/utils/logger';

interface LeadState {
  /** 按 teacherId 缓存的线索卡片列表 */
  cache: Record<string, LeadCardModel[]>;
  /** 按 teacherId 缓存的统计摘要 */
  summaryCache: Record<string, LeadSummary>;
  /** 加载状态 */
  loading: Record<string, boolean>;
  /** 上次加载时间 */
  lastFetch: Record<string, number>;
  /** 当前筛选 Tab */
  activeFilterTab: LeadFilterTab;

  /** 获取线索卡片列表（优先缓存） */
  fetchCards: (
    teacherId: string,
    filterTab?: LeadFilterTab,
    force?: boolean,
  ) => Promise<LeadCardModel[]>;
  /** 获取线索统计摘要 */
  fetchSummary: (teacherId: string, force?: boolean) => Promise<LeadSummary>;
  /** 设置当前筛选 Tab */
  setActiveFilterTab: (tab: LeadFilterTab) => void;
  /** 创建/更新/删除后 invalidate 缓存 */
  invalidate: (teacherId: string) => void;
}

/** 缓存有效期 3 分钟 */
const CACHE_TTL = 3 * 60 * 1000;

export const useLeadStore = create<LeadState>((set, get) => ({
  cache: {},
  summaryCache: {},
  loading: {},
  lastFetch: {},
  activeFilterTab: 'following',

  fetchCards: async (teacherId, filterTab, force = false) => {
    const { cache, lastFetch } = get();
    const now = Date.now();
    const tab = filterTab || get().activeFilterTab;
    const cacheKey = `${teacherId}::${tab}`;

    // 缓存有效且非强制刷新
    if (!force && cache[cacheKey] && lastFetch[cacheKey] && now - lastFetch[cacheKey] < CACHE_TTL) {
      return cache[cacheKey];
    }

    set((s) => ({ loading: { ...s.loading, [cacheKey]: true } }));

    try {
      const list = await leadService.getLeadCards(teacherId, tab);
      set((s) => ({
        cache: { ...s.cache, [cacheKey]: list },
        loading: { ...s.loading, [cacheKey]: false },
        lastFetch: { ...s.lastFetch, [cacheKey]: now },
      }));
      return list;
    } catch (err) {
      logError('lead fetchCards', err);
      set((s) => ({ loading: { ...s.loading, [cacheKey]: false } }));
      return cache[cacheKey] || [];
    }
  },

  fetchSummary: async (teacherId, force = false) => {
    const { summaryCache, lastFetch } = get();
    const now = Date.now();
    const summaryKey = `${teacherId}::summary`;

    if (
      !force &&
      summaryCache[teacherId] &&
      lastFetch[summaryKey] &&
      now - lastFetch[summaryKey] < CACHE_TTL
    ) {
      return summaryCache[teacherId];
    }

    try {
      const summary = await leadService.getLeadSummary(teacherId);
      set((s) => ({
        summaryCache: { ...s.summaryCache, [teacherId]: summary },
        lastFetch: { ...s.lastFetch, [summaryKey]: now },
      }));
      return summary;
    } catch (err) {
      logError('lead fetchSummary', err);
      return (
        summaryCache[teacherId] || {
          total: 0,
          following: 0,
          booked: 0,
          closed: 0,
        }
      );
    }
  },

  setActiveFilterTab: (tab) => {
    set({ activeFilterTab: tab });
  },

  invalidate: (teacherId) => {
    set((s) => {
      const newCache = { ...s.cache };
      const newLastFetch = { ...s.lastFetch };
      // 清除该 teacherId 的所有缓存（不同 tab）
      for (const key of Object.keys(newCache)) {
        if (key.startsWith(`${teacherId}::`)) {
          delete newCache[key];
          delete newLastFetch[key];
        }
      }
      return {
        cache: newCache,
        lastFetch: newLastFetch,
        summaryCache: { ...s.summaryCache, [teacherId]: undefined } as LeadState['summaryCache'],
      };
    });
  },
}));
