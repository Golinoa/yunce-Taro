/**
 * Service 层 — 店铺配置引导 API
 */
import type { StoreOnboardingProgress } from '@/types/onboarding';


import {
  buildStoreProgressFromVisited,
  clearVisitedMap,
  PAGE_INTRO_STORAGE_KEYS,
} from '@/utils/onboarding-storage';

export const onboardingService = {
  /** 获取教师视图店铺管理配置进度 */
  getStoreProgress: async (): Promise<StoreOnboardingProgress> => {
        const { steps, completedCount, totalCount } = buildStoreProgressFromVisited();
    return { steps, completed: completedCount, total: totalCount };
  },
};

export { PAGE_INTRO_STORAGE_KEYS, clearVisitedMap };
