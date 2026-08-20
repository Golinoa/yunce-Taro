import type { IconName } from '@/components/Icon';

/**
 * 店铺管理 onboarding 步骤标识
 */
export type StoreOnboardingStepKey =
  | 'campus'
  | 'venue'
  | 'staff'
  | 'course'
  | 'subject'
  | 'package'
  | 'salary';

/**
 * 店铺管理 onboarding 单步配置项
 */
export interface StoreOnboardingStep {
  /** 步骤标识 */
  key: StoreOnboardingStepKey;
  /** 展示名称 */
  label: string;
  /** MDI 图标名 */
  icon: IconName;
  /** 跳转路径 */
  route: string;
  /** 是否已完成 */
  completed: boolean;
}

/**
 * 店铺管理 onboarding 整体进度
 */
export interface StoreOnboardingProgress {
  /** 总步骤数 */
  total: number;
  /** 已完成数 */
  completed: number;
  /** 步骤详情 */
  steps: StoreOnboardingStep[];
}
