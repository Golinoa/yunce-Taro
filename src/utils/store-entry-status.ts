/**
 * 门店入驻申请状态归一化
 *
 * BE 对外统一大写 PENDING|APPROVED|REJECTED；历史/query 可能混用小写。
 * UI 分支一律经本函数后再比较。
 */

export type StoreEntryUiStatus = 'pending' | 'approved' | 'rejected';

/** 将 API/query 状态规范为 UI 小写三态 */
export function normalizeStoreEntryStatus(status: string | null | undefined): StoreEntryUiStatus {
  const normalized = String(status || '')
    .trim()
    .toUpperCase();
  if (normalized === 'APPROVED') return 'approved';
  if (normalized === 'REJECTED') return 'rejected';
  return 'pending';
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
