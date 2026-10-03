/**
 * 门店入驻申请状态归一化
 *
 * BE 对外统一大写 PENDING|APPROVED|REJECTED；历史/query 可能混用小写。
 * UI 分支一律经本函数后再比较。
 */

export type StoreEntryUiStatus = 'pending' | 'approved' | 'rejected';

/**
 * 将 API/query 状态规范为 UI 小写三态。
 *
 * ⚠️ **无法识别 / 空状态一律返回 null**（不再兜底成 'pending'）。
 * 理由：`isStoreEntryPending(null)` 若为 true，会把「压根没有申请记录」误判成
 * 「已申请待审核」⇒ `shouldRedirectToStoreEntryPending` 把无申请的用户踢进 pending 页，
 * 落在「暂无入驻申请」空态（该空态本身也证明这条路径是错的）。
 * 兜底成 pending 等于把「未知」当「待审核」，是资损级误判。
 */
export function normalizeStoreEntryStatus(
  status: string | null | undefined,
): StoreEntryUiStatus | null {
  const normalized = String(status || '')
    .trim()
    .toUpperCase();
  if (normalized === 'APPROVED') return 'approved';
  if (normalized === 'REJECTED') return 'rejected';
  if (normalized === 'PENDING') return 'pending';
  return null;
}

export function isStoreEntryApproved(status: string | null | undefined): boolean {
  return normalizeStoreEntryStatus(status) === 'approved';
}

export function isStoreEntryRejected(status: string | null | undefined): boolean {
  return normalizeStoreEntryStatus(status) === 'rejected';
}

export function isStoreEntryPending(status: string | null | undefined): boolean {
  return normalizeStoreEntryStatus(status) === 'pending';
}
