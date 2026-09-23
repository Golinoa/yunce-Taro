import { describe, expect, it, vi } from 'vitest';
import {
  PolyfillAbortController,
  PolyfillAbortSignal,
  installAbortControllerPolyfill,
} from './abort-controller-polyfill';

describe('abort-controller-polyfill', () => {
  it('初始 signal 未 abort（tanstack 的 cancelled 判定依赖这一点）', () => {
    const controller = new PolyfillAbortController();
    expect(controller.signal.aborted).toBe(false);
    expect(controller.signal.reason).toBeUndefined();
  });

  it('abort() 置位 aborted 并记录 reason，且幂等', () => {
    const controller = new PolyfillAbortController();
    controller.abort(new Error('first'));
    expect(controller.signal.aborted).toBe(true);
    expect((controller.signal.reason as Error).message).toBe('first');

    controller.abort(new Error('second'));
    expect((controller.signal.reason as Error).message).toBe('first');
  });

  it('abort() 不带参数时给出默认 Error（不抛 undefined）', () => {
    const controller = new PolyfillAbortController();
    controller.abort();
    expect(controller.signal.reason).toBeInstanceOf(Error);
  });

  it("addEventListener('abort', fn, { once: true }) 只触发一次", () => {
    const controller = new PolyfillAbortController();
    const listener = vi.fn();
    controller.signal.addEventListener('abort', listener, { once: true });

    controller.abort();
    controller.abort();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0]).toMatchObject({ type: 'abort' });
  });

  it('removeEventListener 能摘掉监听', () => {
    const controller = new PolyfillAbortController();
    const listener = vi.fn();
    controller.signal.addEventListener('abort', listener);
    controller.signal.removeEventListener('abort', listener);

    controller.abort();

    expect(listener).not.toHaveBeenCalled();
  });

  it('onabort 赋值形式也会触发', () => {
    const controller = new PolyfillAbortController();
    const listener = vi.fn();
    controller.signal.onabort = listener;

    controller.abort();

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('throwIfAborted 仅在已 abort 时抛出 reason', () => {
    const controller = new PolyfillAbortController();
    expect(() => controller.signal.throwIfAborted()).not.toThrow();

    const reason = new Error('stop');
    controller.abort(reason);
    expect(() => controller.signal.throwIfAborted()).toThrow(reason);
  });

  it('非 abort 事件名被忽略（避免误触发）', () => {
    const signal = new PolyfillAbortSignal();
    const listener = vi.fn();
    signal.addEventListener('change', listener);

    signal.doAbort(new Error('x'));

    expect(listener).not.toHaveBeenCalled();
  });

  it('安装到空对象时写入 AbortController / AbortSignal', () => {
    const host: Record<string, unknown> = {};
    expect(installAbortControllerPolyfill(host)).toBe(true);
    expect(host.AbortController).toBe(PolyfillAbortController);
    expect(host.AbortSignal).toBe(PolyfillAbortSignal);
  });

  it('原生已存在时不覆盖（H5 / 新基础库 / 测试环境）', () => {
    const native = class NativeAbortController {};
    const host: Record<string, unknown> = { AbortController: native };

    expect(installAbortControllerPolyfill(host)).toBe(false);
    expect(host.AbortController).toBe(native);
  });

  it('原生 AbortController 存在时完全不改动全局（AbortSignal 也不动）', () => {
    const native = class NativeAbortController {};
    const host: Record<string, unknown> = { AbortController: native };

    installAbortControllerPolyfill(host);

    expect(host.AbortController).toBe(native);
    expect(host.AbortSignal).toBeUndefined();
  });
});
