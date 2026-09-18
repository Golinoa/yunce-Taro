/**
 * 缓存接入助手（B2 · D3 字典落盘 · docs/diagnostics/2026-09-19-frontend-cache-layer-plan.md）
 * - withCache：持久缓存命中 → 免网络；未命中 → 回源并回填（写路径均经 cache-store 护栏）
 * - invalidateDomain：写后失效（B3 轻量版）——字典 CRUD 成功后调用，防冷启动读到旧值
 *
 * 作用域：缺省由 getCacheScope() 同步解析（orgId+userId+role+campusId，G1）；
 * 测试可显式传入 scope 以隔离环境依赖。
 */
import { getCacheScope } from '@/utils/cache-scope';
import type { CacheScope } from '@/utils/cache-store';
import { getCache, invalidateCache, setCache } from '@/utils/cache-store';

export async function withCache<T>(
  domain: string,
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
  scope?: CacheScope,
): Promise<T> {
  const s = scope ?? getCacheScope();
  const hit = getCache<T>(domain, key, s, ttlMs);
  if (hit !== null) return hit;
  const data = await fetcher();
  setCache(domain, key, data, s);
  return data;
}

export function invalidateDomain(domain: string, scope?: CacheScope): void {
  invalidateCache(domain, scope ?? getCacheScope());
}
