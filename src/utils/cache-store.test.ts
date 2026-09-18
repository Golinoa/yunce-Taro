/**
 * cache-store 单测（交叉验证 B1 护栏：G1/G2/G4/G5/G6/G7）
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CACHE_FLAGS } from '@/constants/cache-flags';
import {
  buildCacheKey,
  CACHE_SCHEMA_VERSION,
  clearAllCache,
  clearIfVersionMismatch,
  getCache,
  invalidateCache,
  runWithInflight,
  setCache,
  type CacheScope,
} from '@/utils/cache-store';

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

const scope: CacheScope = { orgId: 'org-a', userId: 'u-1', role: 'teacher', campusId: 'c-1' };
const DOMAIN = 'test-domain';
const KEY = 'k1';

function enable() {
  CACHE_FLAGS.cacheEnabled = true;
  CACHE_FLAGS.enabledOrgIds = [];
}

beforeEach(() => {
  taroStub.map.clear();
  CACHE_FLAGS.cacheEnabled = false;
  CACHE_FLAGS.enabledOrgIds = [];
  vi.restoreAllMocks();
});

describe('G6 回退开关（默认休眠）', () => {
  it('cacheEnabled=false：get 一律返回 null，set 不落盘', () => {
    expect(getCache(DOMAIN, KEY, scope, 60_000)).toBeNull();
    setCache(DOMAIN, KEY, { a: 1 }, scope);
    expect(taroStub.map.size).toBe(0);
  });

  it('cacheEnabled=false：invalidate 不触碰存储', () => {
    enable();
    setCache(DOMAIN, KEY, { a: 1 }, scope);
    CACHE_FLAGS.cacheEnabled = false;
    invalidateCache(DOMAIN, scope);
    expect(taroStub.map.size).toBe(1);
  });

  it('clearAllCache 是清场按钮：即使开关关闭也必须能清（回滚场景兜底）', () => {
    enable();
    setCache(DOMAIN, KEY, { a: 1 }, scope);
    CACHE_FLAGS.cacheEnabled = false;
    clearAllCache();
    expect(taroStub.map.size).toBe(0);
  });
});

describe('G1 命名空间隔离', () => {
  it('org/user/role/campus 任一维度不同 → 键不同', () => {
    const a = buildCacheKey(DOMAIN, KEY, { orgId: 'org-a', role: 'teacher' });
    const b = buildCacheKey(DOMAIN, KEY, { orgId: 'org-b', role: 'teacher' });
    const c = buildCacheKey(DOMAIN, KEY, { orgId: 'org-a', role: 'parent' });
    const d = buildCacheKey(DOMAIN, KEY, { orgId: 'org-a', campusId: 'c-2' });
    expect(new Set([a, b, c, d]).size).toBe(4);
  });

  it('A 机构写入，B 机构读不到（串租户防护）', () => {
    enable();
    setCache(DOMAIN, KEY, { v: 'A' }, { orgId: 'org-a', role: 'teacher' });
    expect(getCache(DOMAIN, KEY, { orgId: 'org-b', role: 'teacher' }, 60_000)).toBeNull();
    expect(getCache(DOMAIN, KEY, { orgId: 'org-a', role: 'teacher' }, 60_000)).toEqual({ v: 'A' });
  });

  it('同用户家长↔教师角色不共享缓存', () => {
    enable();
    setCache(DOMAIN, KEY, { v: 'teacher' }, { orgId: 'org-a', userId: 'u-1', role: 'teacher' });
    expect(
      getCache(DOMAIN, KEY, { orgId: 'org-a', userId: 'u-1', role: 'parent' }, 60_000),
    ).toBeNull();
  });

  it('白名单机构才启用', () => {
    CACHE_FLAGS.cacheEnabled = true;
    CACHE_FLAGS.enabledOrgIds = ['org-a'];
    setCache(DOMAIN, KEY, { v: 1 }, { orgId: 'org-b', role: 'teacher' });
    expect(taroStub.map.size).toBe(0);
    setCache(DOMAIN, KEY, { v: 1 }, { orgId: 'org-a', role: 'teacher' });
    expect(taroStub.map.size).toBe(1);
  });
});

describe('G7 TTL（Date.now 降级时间源）', () => {
  it('ttl<=0 永不命中', () => {
    enable();
    setCache(DOMAIN, KEY, { v: 1 }, scope);
    expect(getCache(DOMAIN, KEY, scope, 0)).toBeNull();
  });

  it('过期后返回 null', () => {
    enable();
    setCache(DOMAIN, KEY, { v: 1 }, scope);
    const k = buildCacheKey(DOMAIN, KEY, scope);
    const box = taroStub.map.get(k) as { at: number; data: unknown };
    box.at = Date.now() - 60_001;
    taroStub.map.set(k, box);
    expect(getCache(DOMAIN, KEY, scope, 60_000)).toBeNull();
  });
});

describe('G5 容量与异常', () => {
  it('单 key 超 1MB 拒绝写入', () => {
    enable();
    const big = 'x'.repeat(1024 * 1024 + 1);
    setCache(DOMAIN, KEY, big, scope);
    expect(taroStub.map.size).toBe(0);
  });

  it('总量超 2MB 拒绝写入并埋点', () => {
    enable();
    const spy = vi
      .spyOn(taroStub, 'getStorageInfoSync')
      .mockReturnValue({ keys: [], currentSize: 3 * 1024 });
    setCache(DOMAIN, KEY, { v: 1 }, scope);
    expect(taroStub.map.size).toBe(0);
    spy.mockRestore();
  });
});

describe('G4 inflight 去重', () => {
  it('同 key 并发任务只执行一次', async () => {
    let calls = 0;
    const task = async () => {
      calls += 1;
      await new Promise((r) => setTimeout(r, 10));
      return 'ok';
    };
    const [a, b] = await Promise.all([runWithInflight('t1', task), runWithInflight('t1', task)]);
    expect(calls).toBe(1);
    expect(a).toBe('ok');
    expect(b).toBe('ok');
  });

  it('任务完成后释放 inflight（可重新执行）', async () => {
    let calls = 0;
    const task = async () => {
      calls += 1;
      return calls;
    };
    await runWithInflight('t2', task);
    await runWithInflight('t2', task);
    expect(calls).toBe(2);
  });
});

describe('G2 版本护栏', () => {
  it('版本不符即整体清空持久缓存', () => {
    enable();
    setCache(DOMAIN, KEY, { v: 1 }, scope);
    clearIfVersionMismatch('1.0.0');
    expect(getCache(DOMAIN, KEY, scope, 60_000)).toEqual({ v: 1 });
    clearIfVersionMismatch('2.0.0');
    expect(getCache(DOMAIN, KEY, scope, 60_000)).toBeNull();
  });

  it('版本键本身不受 clearAll 清除逻辑误伤（非 cc: 前缀）', () => {
    enable();
    clearIfVersionMismatch('1.0.0');
    expect(taroStub.map.get('yunce:cc:app-version')).toBe('1.0.0');
  });

  it('schema 前缀随 CACHE_SCHEMA_VERSION 变化', () => {
    expect(buildCacheKey(DOMAIN, KEY, scope).startsWith(`yunce:cc:v${CACHE_SCHEMA_VERSION}:`)).toBe(
      true,
    );
  });
});

describe('失效入口', () => {
  it('invalidateCache(域) 清空该域全部 key；跨域不受影响', () => {
    enable();
    setCache('d1', 'k1', 1, scope);
    setCache('d1', 'k2', 2, scope);
    setCache('d2', 'k1', 3, scope);
    invalidateCache('d1', scope);
    expect(getCache('d1', 'k1', scope, 60_000)).toBeNull();
    expect(getCache('d1', 'k2', scope, 60_000)).toBeNull();
    expect(getCache('d2', 'k1', scope, 60_000)).toBe(3);
  });
});
