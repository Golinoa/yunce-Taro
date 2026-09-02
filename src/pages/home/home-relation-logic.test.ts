/**
 * 关系 dismiss 判定单测
 */
import { describe, expect, it } from 'vitest';
import { RELATION_DISMISS_KEY, isRelationDismissedToday } from './home-relation-logic';

describe('RELATION_DISMISS_KEY', () => {
  it('保持既有存储 key 口径', () => {
    expect(RELATION_DISMISS_KEY).toBe('yunce:relation-dismiss-date');
  });
});

describe('isRelationDismissedToday', () => {
  it('存储值等于当日 key 时视为已 dismiss', () => {
    expect(isRelationDismissedToday('2026-09-03', '2026-09-03')).toBe(true);
  });

  it('存储值不同或非字符串时不 dismiss', () => {
    expect(isRelationDismissedToday('2026-09-02', '2026-09-03')).toBe(false);
    expect(isRelationDismissedToday(undefined, '2026-09-03')).toBe(false);
    expect(isRelationDismissedToday(null, '2026-09-03')).toBe(false);
    expect(isRelationDismissedToday(123, '2026-09-03')).toBe(false);
  });
});
