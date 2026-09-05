/**
 * 数据新鲜度约定（与 docs/diagnostics 缓存方案对齐）
 * L0 即时 / L1 Tab 短鲜 / L2 列表 / L3 慢变
 */
import { DEFAULT_TAB_REFETCH_TTL_MS, isWithinRefetchTtl } from '@/utils/refetch-ttl';
import type { MutableRefObject } from 'react';

export const TTL = {
  /** L0：支付/履约/配额等 — 不缓存 */
  payment: 0,
  /** L0 弱：配额短窗口（支付返回应用 force） */
  quota: 20_000,
  /** L1：Tab / 数据中心概览 */
  tab: DEFAULT_TAB_REFETCH_TTL_MS,
  /** L2：学员/班级/线索等列表 */
  list: 5 * 60_000,
  /** L2：线索略短 */
  lead: 3 * 60_000,
  /** L3：校区等慢变 */
  campus: 15 * 60_000,
  /** 会员 SKU 货架（改价低频） */
  membershipSku: 60_000,
} as const;

export type FreshnessTtlMs = (typeof TTL)[keyof typeof TTL];

/** 是否应重新拉取（TTL 外或无上次时间） */
export function shouldRefetch(
  lastFetchedAtMs: number | null | undefined,
  ttlMs: number = TTL.tab,
  nowMs: number = Date.now(),
): boolean {
  if (ttlMs <= 0) return true;
  return !isWithinRefetchTtl(lastFetchedAtMs, ttlMs, nowMs);
}

/** 成功拉取后打点 */
export function markFetched(ref: MutableRefObject<number | null>, atMs: number = Date.now()): void {
  ref.current = atMs;
}

/** 强制下次进页重拉（写后失效） */
export function clearFetched(ref: MutableRefObject<number | null>): void {
  ref.current = null;
}
