import { describe, expect, it } from 'vitest';
import { TTL, shouldRefetch, markFetched, clearFetched } from './data-freshness';

describe('data-freshness', () => {
  it('payment TTL=0 永远应拉取', () => {
    expect(shouldRefetch(Date.now(), TTL.payment)).toBe(true);
  });

  it('tab TTL 内跳过，过期再拉', () => {
    const now = 2_000_000;
    expect(shouldRefetch(now - 10_000, TTL.tab, now)).toBe(false);
    expect(shouldRefetch(now - TTL.tab - 1, TTL.tab, now)).toBe(true);
    expect(shouldRefetch(null, TTL.tab, now)).toBe(true);
  });

  it('markFetched / clearFetched', () => {
    const ref = { current: null as number | null };
    markFetched(ref, 123);
    expect(ref.current).toBe(123);
    clearFetched(ref);
    expect(ref.current).toBeNull();
  });
});
