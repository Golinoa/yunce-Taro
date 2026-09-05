/**
 * 切机构 / 切校区 / 登出时清空 L1–L3 领域缓存，避免串租户假数据
 */
import { invalidateMembershipSkuCache } from '@/services/payment';
import { useCampusStore } from '@/stores/campus';
import { useCardTypeStore } from '@/stores/card-type';
import { useClassStore } from '@/stores/class';
import { useCourseCategoryStore } from '@/stores/course-category';
import { useCourseTemplateStore } from '@/stores/course-template';
import { useLeadStore } from '@/stores/lead';
import { usePackageTemplateStore } from '@/stores/package-template';
import { useStudentStore } from '@/stores/student';
import { useTeacherStore } from '@/stores/teacher';
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
  usePackageTemplateStore.setState({ cache: {}, loading: {}, lastFetch: {} });
  useTeacherStore.getState().invalidateCache();
  useCourseCategoryStore.getState().invalidateCache();
  useCourseTemplateStore.getState().invalidateCache();
  useCardTypeStore.getState().invalidateCache();
  invalidateStoreEntryLatestCache();

  if (scope === 'all') {
    useCampusStore.getState().invalidateCache();
    invalidateMembershipSkuCache();
  } else {
    useCampusStore.getState().invalidateSubjectsCache();
  }
}
