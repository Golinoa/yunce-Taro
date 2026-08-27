/**
 * Service 层 — 店铺配置引导 API
 * 定义接口契约，当前由 mock 实现，联调时替换为 request 调用
 */
import { clearVisitedMap, mockGetStoreProgress, PAGE_INTRO_STORAGE_KEYS } from '@/data/onboarding';
import type { StoreOnboardingProgress } from '@/types/onboarding';

export const onboardingService = {
  /** 获取教师视图店铺管理配置进度（后端未提供，始终走本地进度计算） */
  getStoreProgress: (): Promise<StoreOnboardingProgress> => mockGetStoreProgress(),
};

// 页面介绍弹框存储 Key 常量，页面层统一引用 services 出口
export { PAGE_INTRO_STORAGE_KEYS };

// 重置店铺配置引导（清除步骤访问记录 + 各页面「不再提醒」弹框状态）
export { clearVisitedMap };
