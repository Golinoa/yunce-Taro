/**
 * 微信小程序运行时没有 `AbortController`。
 *
 * 为什么这个 polyfill 是必须的（不是可选优化）：
 * `@tanstack/query-core` 的 `Query.fetch()`（`build/modern/query.js:172`）**第一件事**就是
 * `const abortController = new AbortController()`，且这是全库唯一一处引用。
 * 在小程序里该标识符不存在 → `fetch()` 直接抛 `ReferenceError: AbortController is not defined`：
 * - 异常发生在 `queryFn` 被调用之前 → `queryFn` 一次都不执行（`queryFnRuns` 恒为 0）；
 * - `fetch()` 提前 reject，query 永远停在 `status:'pending' + fetchStatus:'idle'`；
 * - 后端收不到任何请求；页面永久空白。
 *
 * 该缺陷影响**所有**基于 TanStack Query 的页面，只是首页 `useQuery` 恰好先命中缓存、
 * 不易察觉，而学员页（`useInfiniteQuery`）首屏必拉数据，所以最先暴露。
 *
 * 实现刻意保持精简：只覆盖 query-core 实际用到的契约
 * （`signal.aborted` / `signal.reason` / `addEventListener('abort', fn, { once })` /
 * `removeEventListener` / `controller.abort(reason?)`），避免引入
 * `abort-controller` + `event-target-shim` 两个包（主包体积只剩 ~60KB 余量）。
 *
 * 原生已存在时不做任何覆盖（H5 / 新基础库 / Node 测试环境）。
 */

type AbortListener = (event: { type: string; target: unknown }) => void;

interface OnceOptions {
  once?: boolean;
}

export class PolyfillAbortSignal {
  aborted = false;

  reason: unknown = undefined;

  onabort: AbortListener | null = null;

  private readonly listeners = new Set<{ fn: AbortListener; once: boolean }>();

  addEventListener(type: string, listener: AbortListener, options?: OnceOptions): void {
    if (type !== 'abort' || typeof listener !== 'function') {
      return;
    }
    this.listeners.add({ fn: listener, once: Boolean(options?.once) });
  }

  removeEventListener(type: string, listener: AbortListener): void {
    if (type !== 'abort') {
      return;
    }
    for (const entry of Array.from(this.listeners)) {
      if (entry.fn === listener) {
        this.listeners.delete(entry);
      }
    }
  }

  dispatchEvent(event: { type: string }): boolean {
    if (event?.type === 'abort') {
      this.doAbort(new Error('Aborted'));
    }
    return true;
  }

  throwIfAborted(): void {
    if (this.aborted) {
      throw this.reason;
    }
  }

  /** 供 AbortController 调用。已 abort 时幂等。 */
  doAbort(reason: unknown): void {
    if (this.aborted) {
      return;
    }
    this.aborted = true;
    this.reason = reason;
    // 先快照再遍历：once 监听器会在回调里改集合
    const snapshot = Array.from(this.listeners);
    for (const entry of snapshot) {
      if (entry.once) {
        this.listeners.delete(entry);
      }
      entry.fn({ type: 'abort', target: this });
    }
    const handler = this.onabort;
    if (handler) {
      handler({ type: 'abort', target: this });
    }
  }
}

export class PolyfillAbortController {
  readonly signal: PolyfillAbortSignal;

  constructor() {
    this.signal = new PolyfillAbortSignal();
  }

  abort(reason?: unknown): void {
    this.signal.doAbort(reason === undefined ? new Error('Aborted') : reason);
  }
}

/** 安装到全局。返回是否真的安装了（原生存在时返回 false）。 */
export function installAbortControllerPolyfill(target?: Record<string, unknown> | null): boolean {
  const host =
    target ??
    (typeof globalThis === 'undefined' ? null : (globalThis as unknown as Record<string, unknown>));
  if (!host) {
    return false;
  }
  if (typeof host.AbortController !== 'undefined') {
    return false;
  }
  host.AbortController = PolyfillAbortController;
  if (typeof host.AbortSignal === 'undefined') {
    host.AbortSignal = PolyfillAbortSignal;
  }
  return true;
}

// 副作用安装：只要本模块在任何 query 发起 fetch 之前被 import 即生效。
// 别删这行——删掉会让整个应用所有 TanStack Query 请求再次全部失效。
export const ABORT_CONTROLLER_POLYFILL_INSTALLED = installAbortControllerPolyfill();
