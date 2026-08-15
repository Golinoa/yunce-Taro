/**
 * Onboarding Mock 数据层
 *
 * 配置完成判断标准：用户是否访问过对应配置页面（本地存储记录）
 * - 目的是引导用户"点进去配置"，而非检查数据库有没有数据
 * - 点击步骤跳转时自动标记为已访问
 * - 重置新手引导时清除访问记录
 */
import Taro from '@tarojs/taro';
import type { IconName } from '@/components/Icon';
import type {
  StoreOnboardingProgress,
  StoreOnboardingStep,
  StoreOnboardingStepKey,
} from '@/types/onboarding';
import { STORE_ONBOARDING_VISITED_KEY } from '@/utils/auth';

// ============================================
// 店铺配置 6 步骤页面「页面介绍弹框 - 不再提醒」存储 Key
// 统一维护，便于重置引导流程时一并清除
// ============================================
export const PAGE_INTRO_STORAGE_KEYS: Record<StoreOnboardingStepKey, string> = {
  campus: 'campus_settings_intro_hidden',
  venue: 'venue_list_intro_hidden',
  staff: 'teacher_list_intro_hidden',
  course: 'course_management_intro_hidden',
  package: 'card_management_intro_hidden',
  salary: 'salary_home_intro_hidden',
};

function delay(ms = 80): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const STEP_META_LIST: Array<{
  key: StoreOnboardingStepKey;
  label: string;
  icon: IconName;
  route: string;
}> = [
  {
    key: 'campus',
    label: '门店管理',
    icon: 'mdi-office-building-outline',
    route: '/package-settings/pages/campus-settings/index',
  },
  {
    key: 'venue',
    label: '场地管理',
    icon: 'mdi-map-marker-outline',
    route: '/package-settings/pages/venue-list/index',
  },
  {
    key: 'staff',
    label: '员工管理',
    icon: 'mdi-account-group-outline',
    route: '/package-teacher/pages/teacher-list/index',
  },
  {
    key: 'course',
    label: '课程管理',
    icon: 'mdi-book-open-variant-outline',
    route: '/package-course/pages/course-management/index',
  },
  {
    key: 'package',
    label: '卡种管理',
    icon: 'mdi-credit-card-outline',
    route: '/package-course/pages/card-management/index',
  },
  {
    key: 'salary',
    label: '薪资管理',
    icon: 'mdi-wallet-outline',
    route: '/package-teacher/pages/salary-home/index',
  },
];

// ============================================
// 访问记录读写工具
// ============================================

/** 访问记录类型 */
export type VisitedMap = Partial<Record<StoreOnboardingStepKey, boolean>>;

/** 从本地存储读取访问记录 */
export function getVisitedMap(): VisitedMap {
  try {
    const raw = Taro.getStorageSync(STORE_ONBOARDING_VISITED_KEY);
    if (!raw) return {};
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return parsed as VisitedMap;
  } catch {
    return {};
  }
}

/** 标记某步骤为已访问 */
export function markStepVisited(key: StoreOnboardingStepKey): void {
  const visited = getVisitedMap();
  visited[key] = true;
  Taro.setStorageSync(STORE_ONBOARDING_VISITED_KEY, JSON.stringify(visited));
}

/** 清除全部访问记录及 6 个配置页面的「不再提醒」弹框状态（重置新手引导时调用） */
export function clearVisitedMap(): void {
  Taro.removeStorageSync(STORE_ONBOARDING_VISITED_KEY);
  Object.values(PAGE_INTRO_STORAGE_KEYS).forEach((key) => {
    Taro.removeStorageSync(key);
  });
}

// ============================================
// 进度计算
// ============================================

/**
 * 获取店铺管理配置进度（mock 实现）
 *
 * 判断标准：用户是否访问过对应配置页面
 * - 新注册用户：没有任何访问记录，全部未完成 → 显示引导态
 * - 访问过某个页面：该步骤标记为完成
 * - 重置后：清除访问记录，全部回到未完成
 */
export async function mockGetStoreProgress(): Promise<StoreOnboardingProgress> {
  await delay();

  const visited = getVisitedMap();

  const steps: StoreOnboardingStep[] = STEP_META_LIST.map((meta) => ({
    ...meta,
    completed: visited[meta.key] === true,
  }));

  const completedCount = steps.filter((step) => step.completed).length;

  return {
    total: steps.length,
    completed: completedCount,
    steps,
  };
}
