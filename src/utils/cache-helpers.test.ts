/**
 * cache-helpers 单测（B2/B3 轻量：命中免网络 / 未命中回源回填 / 关闭直连 / 写后失效）
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CACHE_FLAGS } from '@/constants/cache-flags';
import { invalidateDomain, withCache } from '@/utils/cache-helpers';

const taroStub = vi.hoisted(() => {
  const map = new Map<string, unknown>();
  return {
    map,
    getStorageSync: (k: string) => map.get(k),
    setStorageSync: (k: string, v: unknown) => {
      map.set(k, v);
    },
    removeStorageSync: (k: string) => {
      map.delete(k);
    },
    getStorageInfoSync: () => ({ keys: Array.from(map.keys()), currentSize: 0 }),
  };
});

vi.mock('@tarojs/taro', () => ({ default: taroStub }));
vi.mock('@/utils/cache-scope', () => ({
  getCacheScope: () => SCOPE,
}));

const SCOPE = { orgId: 'org-a', userId: 'u-1', role: 'teacher', campusId: 'c-1' };

function enable() {
  CACHE_FLAGS.cacheEnabled = true;
  CACHE_FLAGS.enabledOrgIds = [];
}

beforeEach(() => {
  taroStub.map.clear();
  enable();
});

describe('withCache（D3 字典落盘）', () => {
  it('未命中 → 调 fetcher 并回填持久缓存', async () => {
    let calls = 0;
    const fetcher = async () => {
      calls += 1;
      return [{ id: 'a' }];
    };
    const first = await withCache('dict', 'list', 60_000, fetcher);
    expect(calls).toBe(1);
    expect(first).toEqual([{ id: 'a' }]);
    // 二次调用：命中，fetcher 不再执行
    const second = await withCache('dict', 'list', 60_000, fetcher);
    expect(calls).toBe(1);
    expect(second).toEqual([{ id: 'a' }]);
    expect(taroStub.map.size).toBe(1);
  });

  it('ttl=0 永不命中（禁缓存域兜底）', async () => {
    let calls = 0;
    const fetcher = async () => {
      calls += 1;
      return 'x';
    };
    await withCache('dict', 'k', 0, fetcher);
    await withCache('dict', 'k', 0, fetcher);
    expect(calls).toBe(2);
  });

  it('开关关闭 → 直连且不落盘（行为与接缓存前一致）', async () => {
    CACHE_FLAGS.cacheEnabled = false;
    let calls = 0;
    const fetcher = async () => {
      calls += 1;
      return 'y';
    };
    const r1 = await withCache('dict', 'k', 60_000, fetcher);
    const r2 = await withCache('dict', 'k', 60_000, fetcher);
    expect(calls).toBe(2);
    expect(r1).toBe('y');
    expect(r2).toBe('y');
    expect(taroStub.map.size).toBe(0);
  });
});

describe('invalidateDomain（B3 轻量 · 写后失效）', () => {
  it('失效后 withCache 重新回源（拿到写后新值）', async () => {
    let value = 'old';
    const fetcher = async () => value;
    await withCache('dict', 'k', 60_000, fetcher);
    expect(await withCache('dict', 'k', 60_000, fetcher)).toBe('old');
    value = 'new'; // 模拟写后
    invalidateDomain('dict');
    expect(await withCache('dict', 'k', 60_000, fetcher)).toBe('new');
  });

  it('失效只清目标域，不影响其他域', async () => {
    await withCache('d1', 'k', 60_000, async () => 'v1');
    await withCache('d2', 'k', 60_000, async () => 'v2');
    invalidateDomain('d1');
    expect(await withCache('d2', 'k', 60_000, async () => 'v2x')).toBe('v2');
  });
});
