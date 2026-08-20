import type { StoreOnboardingProgress, StoreOnboardingStep } from '@/types/onboarding';

export interface StoreOnboardingProps {
  /** 进度数据 */
  data: StoreOnboardingProgress;
  /** 加载中 */
  loading?: boolean;
  /** 步骤点击回调 */
  onStepClick: (step: StoreOnboardingStep) => void;
  /** 非步骤入口（学员信箱）点击回调 */
  onExtraClick?: () => void;
  /** 额外类名 */
  className?: string;
}
