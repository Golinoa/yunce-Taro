/**
 * FE-15 根因的**复现实验**（不是模拟，直接用真的 @tanstack/query-core）。
 *
 * 生产现象（用户真机日志 `students-debug-20260923-05`）：
 *   queryFnRuns: 0        ← queryFn 一次都没执行
 *   status: 'pending' / fetchStatus: 'idle'
 *   error: null           ← 没有任何报错（async 内抛错被吞成 rejected promise）
 *   手动 query.fetch() → ReferenceError: AbortController is not defined
 *
 * 本文件验证：
 *   ① 复现：全局删掉 AbortController 后，query.fetch() 确实让 queryFn 零执行、
 *      状态停在 pending/idle，并抛 ReferenceError；
 *   ② 修复：装上 polyfill 后，同一个 query 能正常执行 queryFn 并拿到数据。
 */
import { InfiniteQueryObserver, QueryClient } from '@tanstack/query-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installAbortControllerPolyfill } from './abort-controller-polyfill';

type HostWithAbort = Record<string, unknown>;

/** 删掉全局 AbortController / AbortSignal，返回还原函数。 */
function stripAbortController(): () => void {
  const host = globalThis as HostWithAbort;
  const saved = { AbortController: host.AbortController, AbortSignal: host.AbortSignal };
  delete host.AbortController;
  delete host.AbortSignal;
  return () => {
    host.AbortController = saved.AbortController;
    host.AbortSignal = saved.AbortSignal;
  };
}

interface Page {
  list: { id: string }[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

function makePage(): Page {
  return {
    list: [{ id: 's1' }],
    pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
  };
}

/** 建一个与学员页同构的 infinite query（无 observer 订阅也照样 fetch）。 */
function setupQuery(queryFn: () => Promise<Page>) {
  const client = new QueryClient({
    // 与生产一致：全局 retry: false（src/app.tsx）
    defaultOptions: { queries: { retry: false, staleTime: 30_000 } },
  });
  const seenFetchStatus: string[] = [];
  const unsubscribe = client.getQueryCache().subscribe((event) => {
    if (event.type === 'updated') {
      seenFetchStatus.push((event.query.state as { fetchStatus: string }).fetchStatus);
    }
  });
  // 保留 observer 引用，模拟页面持有 observer（生产 observerCount 恒为 1）
  const observer = new InfiniteQueryObserver(client, {
    queryKey: ['students', 'teacher', 'u1', 'c1', ''],
    initialPageParam: 1,
    queryFn,
    getNextPageParam: () => undefined,
  });
  const query = client.getQueryCache().find({
    queryKey: ['students', 'teacher', 'u1', 'c1', ''],
  }) as unknown as { fetch: () => Promise<unknown>; state: Record<string, unknown> };
  return { client, observer, query, seenFetchStatus, unsubscribe };
}

describe('FE-15 复现：缺 AbortController 会让 TanStack Query 静默失效', () => {
  let restore: (() => void) | null = null;

  beforeEach(() => {
    restore = stripAbortController();
  });

  afterEach(() => {
    restore?.();
    restore = null;
  });

  it('① 缺 AbortController：queryFn 零执行、状态停在 pending/idle、无 error、抛 ReferenceError', async () => {
    const queryFn = vi.fn(async () => makePage());
    const { query, seenFetchStatus, unsubscribe, client } = setupQuery(queryFn);

    let thrown: unknown = null;
    await query.fetch().catch((error: unknown) => {
      thrown = error;
    });

    const err = thrown as { name?: string; message?: string } | null;

    // 关键补充事实：抛出点（`new AbortController()`）在 `dispatch({ type: 'fetch' })` **之前**，
    // 所以 query 状态一次都没变过 —— 这正是「日志里看不到任何报错、只见状态不动」的确切原因。
    expect(seenFetchStatus).toEqual([]);

    // —— 与生产日志逐条对齐 ——
    expect(queryFn).toHaveBeenCalledTimes(0); // 生产 queryFnRuns: 0
    expect(query.state.status).toBe('pending'); // 生产 status: 'pending'
    expect(query.state.fetchStatus).toBe('idle'); // 生产 fetchStatus: 'idle'
    expect(query.state.error).toBeNull(); // 生产 error: null（静默！）

    // 真实异常被 async 吞掉，只能靠 catch 拿到
    expect(err?.name).toBe('ReferenceError');
    expect(String(err?.message)).toContain('AbortController');

    unsubscribe();
    client.clear();
  });

  it('② 装上 polyfill 后：queryFn 正常执行并拿到数据', async () => {
    const queryFn = vi.fn(async () => makePage());

    const installed = installAbortControllerPolyfill();
    expect(installed).toBe(true);

    const { query, client, unsubscribe } = setupQuery(queryFn);

    await query.fetch();

    expect(queryFn).toHaveBeenCalledTimes(1);
    expect(query.state.status).toBe('success');
    expect((query.state.data as { pages: Page[] }).pages).toHaveLength(1);

    unsubscribe();
    client.clear();
  });
});
