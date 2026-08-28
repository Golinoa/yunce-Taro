import Taro from '@tarojs/taro';
import type { IconName } from '@/components/Icon';
import type { StoreOnboardingStep, StoreOnboardingStepKey } from '@/types/onboarding';
import { STORE_ONBOARDING_VISITED_KEY } from '@/utils/auth';

export const PAGE_INTRO_STORAGE_KEYS: Record<StoreOnboardingStepKey, string> = {
  campus: 'campus_settings_intro_hidden',
  venue: 'venue_list_intro_hidden',
  staff: 'teacher_list_intro_hidden',
  course: 'course_management_intro_hidden',
  subject: 'subject_management_intro_hidden',
  package: 'card_management_intro_hidden',
  salary: 'salary_home_intro_hidden',
};

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
    key: 'subject',
    label: '科目管理',
    icon: 'mdi-book-education-outline',
    route: '/package-course/pages/subject-management/index',
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

export type VisitedMap = Partial<Record<StoreOnboardingStepKey, boolean>>;

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

export function markStepVisited(key: StoreOnboardingStepKey): void {
  const visited = getVisitedMap();
  visited[key] = true;
  Taro.setStorageSync(STORE_ONBOARDING_VISITED_KEY, JSON.stringify(visited));
}

export function clearVisitedMap(): void {
  Taro.removeStorageSync(STORE_ONBOARDING_VISITED_KEY);
  Object.values(PAGE_INTRO_STORAGE_KEYS).forEach((key) => {
    Taro.removeStorageSync(key);
  });
}

/** 本地存储驱动的引导进度（不依�?mock 数据层） */
export function buildStoreProgressFromVisited(): {
  steps: StoreOnboardingStep[];
  completedCount: number;
  totalCount: number;
} {
  const visited = getVisitedMap();
  const steps: StoreOnboardingStep[] = STEP_META_LIST.map((meta) => ({
    ...meta,
    completed: visited[meta.key] === true,
  }));
  const completedCount = steps.filter((s) => s.completed).length;
  return { steps, completedCount, totalCount: steps.length };
}
