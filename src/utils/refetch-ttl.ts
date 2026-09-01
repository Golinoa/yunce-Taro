/**
 * Tab/页面再进入拉数闸门（产品口径：缓存优先，禁止每次 useDidShow 无脑全量打库）
 */
export const DEFAULT_TAB_REFETCH_TTL_MS = 60_000;

/** 距上次成功拉取是否仍在 TTL 内（应跳过全量请求） */
export function isWithinRefetchTtl(
  lastFetchedAtMs: number | null | undefined,
  ttlMs: number = DEFAULT_TAB_REFETCH_TTL_MS,
  nowMs: number = Date.now(),
): boolean {
  if (!lastFetchedAtMs || lastFetchedAtMs <= 0) return false;
  return nowMs - lastFetchedAtMs < ttlMs;
}
