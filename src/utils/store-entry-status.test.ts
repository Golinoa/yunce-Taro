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

  it('空值回落 pending', () => {
    expect(normalizeStoreEntryStatus(undefined)).toBe('pending');
    expect(normalizeStoreEntryStatus('')).toBe('pending');
  });
});
