/**
 * 切机构 / 切校区 / 登出时清空 L1–L3 领域缓存，避免串租户假数据
 */
import { invalidateMembershipBootstrapCache } from '@/services/membership-cache';
import { invalidateMembershipSkuCache } from '@/services/payment';
import { clearPermissionCache } from '@/services/permission';
import { useCampusStore } from '@/stores/campus';
import { useCardTypeStore } from '@/stores/card-type';
import { useClassStore } from '@/stores/class';
import { useCourseCategoryStore } from '@/stores/course-category';
import { useCourseTemplateStore } from '@/stores/course-template';
import { useLeadStore } from '@/stores/lead';
import { useStudentStore } from '@/stores/student';
import { useTeacherStore } from '@/stores/teacher';
import { clearAllCache } from '@/utils/cache-store';
import { clearLessonRosterCache } from '@/utils/lesson-roster-cache';
import { queryClient } from '@/utils/query-client';
import { invalidateStoreEntryLatestCache } from '@/utils/store-entry-onboarding';

export type ResetDomainCachesScope = 'all' | 'campus';

/**
 * @param scope `all` 含校区列表；`campus` 仅清依赖校区的列表缓存（保留校区列表）
 */
export function resetDomainCaches(scope: ResetDomainCachesScope = 'all'): void {
  useStudentStore.setState({ cache: {}, loading: {}, lastFetch: {} });
  useClassStore.setState({ cache: {}, loading: {}, lastFetch: {} });
  useLeadStore.setState({
    cache: {},
    loading: {},
    lastFetch: {},
    summaryCache: {},
  });
  useTeacherStore.getState().invalidateCache();
  useCourseCategoryStore.getState().invalidateCache();
  useCourseTemplateStore.getState().invalidateCache();
  useCardTypeStore.getState().invalidateCache();
  invalidateStoreEntryLatestCache();
  // 点名页名单内存快照（模块级、不落盘）：切机构/切身份后绝不能再沿用上一身份的名单
  clearLessonRosterCache();

  // TanStack Query 缓存：此前只清 zustand，切校区后 queryKey 不变 → 列表仍是旧校区数据。
  // 统一失效全部 query，让下一次渲染按新校区重新拉取。
  void queryClient.invalidateQueries();

  if (scope === 'all') {
    useCampusStore.getState().invalidateCache();
    invalidateMembershipSkuCache();
    invalidateMembershipBootstrapCache();
    // 权限配置为机构级：切机构时清本地缓存，避免串租户授权
    clearPermissionCache();
    // B3 轻量：切机构/切身份/登出时连带清持久缓存（命名空间本已四维隔离，此处双保险）
    clearAllCache();
  } else {
    useCampusStore.getState().invalidateSubjectsCache();
  }
}
