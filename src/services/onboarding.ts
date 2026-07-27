/**
 * Service 层 — 店铺配置引导 API
 * 定义接口契约，当前由 mock 实现，联调时替换为 request 调用
 */
import { mockGetStoreProgress } from '@/data/onboarding';
import type { StoreOnboardingProgress } from '@/types/onboarding';
// import { get } from '@/utils/request';

export const onboardingService = {
  /** 获取教师视图店铺管理配置进度 */
  getStoreProgress: (): Promise<StoreOnboardingProgress> => mockGetStoreProgress(),
  // 联调时替换为:
  // getStoreProgress: () => get<StoreOnboardingProgress>('/api/onboarding/store-progress'),
};
