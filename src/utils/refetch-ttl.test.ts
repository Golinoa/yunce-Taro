import { describe, expect, it } from 'vitest';
import { DEFAULT_TAB_REFETCH_TTL_MS, isWithinRefetchTtl } from './refetch-ttl';

describe('isWithinRefetchTtl', () => {
  it('无上次时间 → 不在 TTL 内（应拉取）', () => {
    expect(isWithinRefetchTtl(null)).toBe(false);
    expect(isWithinRefetchTtl(undefined)).toBe(false);
    expect(isWithinRefetchTtl(0)).toBe(false);
  });

  it('TTL 内跳过，过期应再拉', () => {
    const now = 1_000_000;
    expect(isWithinRefetchTtl(now - 10_000, DEFAULT_TAB_REFETCH_TTL_MS, now)).toBe(true);
    expect(isWithinRefetchTtl(now - DEFAULT_TAB_REFETCH_TTL_MS - 1, DEFAULT_TAB_REFETCH_TTL_MS, now)).toBe(
      false,
    );
  });
});
