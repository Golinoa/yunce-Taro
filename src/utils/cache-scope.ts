/**
 * 缓存作用域解析（G1 命名空间四维来源，同步获取）
 * - orgId / userId / role：来自持久化 profile（`yunce-edu-user-profile`，由 utils/auth persistAuth 维护）
 * - campusId：来自 campus store（切校区即变，zustand getState 同步可取）
 *
 * 任一维度缺失退化为 null → 键中为 '-'：只影响命中（miss 回源），不影响隔离
 * （不同登录态/校区/角色的键必然不同，宁 miss 不串）。
 */
import Taro from '@tarojs/taro';
import { USER_PROFILE_KEY } from '@/services/auth-shared';
import { useCampusStore } from '@/stores/campus';
import type { Profile } from '@/types/profile';
import type { CacheScope } from '@/utils/cache-store';

export function getCacheScope(): CacheScope {
  let orgId: string | null = null;
  let userId: string | null = null;
  let role: string | null = null;
  try {
    const raw = Taro.getStorageSync(USER_PROFILE_KEY) as string | Profile | null;
    if (raw) {
      const profile = (typeof raw === 'string' ? JSON.parse(raw) : raw) as Profile;
      orgId = profile?.currentContext?.organizationId ?? null;
      userId = profile?.id ?? null;
      role = profile?.currentContext?.role ?? null;
    }
  } catch {
    /* 解析失败按未登录处理，维度退化为 null（不阻塞业务） */
  }
  const campusId = useCampusStore.getState().currentCampusId || null;
  return { orgId, userId, role, campusId };
}
