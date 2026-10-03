import { describe, expect, it } from 'vitest';
import {
  isStoreEntryApproved,
  isStoreEntryPending,
  isStoreEntryRejected,
  normalizeStoreEntryStatus,
} from './store-entry-status';

describe('normalizeStoreEntryStatus', () => {
  it('PENDING/pending 均视为审核中', () => {
    expect(normalizeStoreEntryStatus('PENDING')).toBe('pending');
    expect(normalizeStoreEntryStatus('pending')).toBe('pending');
    expect(isStoreEntryPending('PENDING')).toBe(true);
  });

  it('APPROVED/approved 均视为通过', () => {
    expect(normalizeStoreEntryStatus('APPROVED')).toBe('approved');
    expect(isStoreEntryApproved('approved')).toBe(true);
  });

  it('REJECTED/rejected 均视为驳回', () => {
    expect(normalizeStoreEntryStatus('REJECTED')).toBe('rejected');
    expect(isStoreEntryRejected('rejected')).toBe(true);
  });

  /**
   * 回归：空值/未知状态曾兜底成 'pending'，导致「压根没有申请记录」被误判成
   * 「已申请待审核」⇒ shouldRedirectToStoreEntryPending 把用户踢进 pending 页，
   * 落在「暂无入驻申请」空态。未知必须返回 null。
   */
  it('空值返回 null（无申请 ≠ 待审核）', () => {
    expect(normalizeStoreEntryStatus(undefined)).toBeNull();
    expect(normalizeStoreEntryStatus(null)).toBeNull();
    expect(normalizeStoreEntryStatus('')).toBeNull();
    expect(isStoreEntryPending(undefined)).toBe(false);
    expect(isStoreEntryPending('')).toBe(false);
    expect(isStoreEntryRejected(undefined)).toBe(false);
    expect(isStoreEntryApproved(undefined)).toBe(false);
  });

  it('未知/非法状态返回 null，不再当 pending', () => {
    expect(normalizeStoreEntryStatus('UNKNOWN')).toBeNull();
    expect(normalizeStoreEntryStatus('foo')).toBeNull();
    expect(isStoreEntryPending('DRAFT')).toBe(false);
  });
});
