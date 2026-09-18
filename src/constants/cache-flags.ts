/**
 * 缓存层灰度开关（G6 · docs/diagnostics/2026-09-19-frontend-cache-layer-plan.md §2）
 *
 * 铁律：cacheEnabled 默认 false —— 所有持久化缓存读写在关闭时**空转**
 * （get 一律早返回 null / set 直接跳过），prod 行为与直连完全一致。
 * 灰度开启前需业务方回签计划 §8（资损清单复核 / 家长↔教师隔离 / serverTime / 白名单机构）。
 *
 * 回退不靠 revert：出问题把 cacheEnabled 置 false 即恢复直连。
 */
export const CACHE_FLAGS = {
  /** 总开关：默认关闭（休眠），灰度时置 true 或按机构白名单放开 */
  cacheEnabled: false,
  /** 灰度白名单 orgId；空数组 = cacheEnabled=true 时全量放开 */
  enabledOrgIds: [] as string[],
};

/**
 * 某机构是否启用持久缓存。
 * - 总开关关闭 → 一律 false（不管白名单）
 * - 白名单为空 → 总开关开启即全量
 * - 白名单非空 → 仅命中 orgId 放开
 */
export function isCacheEnabledForOrg(orgId?: string | null): boolean {
  if (!CACHE_FLAGS.cacheEnabled) return false;
  if (CACHE_FLAGS.enabledOrgIds.length === 0) return true;
  return Boolean(orgId && CACHE_FLAGS.enabledOrgIds.includes(orgId));
}
