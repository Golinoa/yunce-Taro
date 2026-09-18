import { describe, expect, it } from 'vitest';
import { clearSingleFlight, singleFlight } from './single-flight';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('single-flight', () => {
  it('并发同 key 只执行一次任务', async () => {
    let calls = 0;
    const task = async () => {
      calls += 1;
      await delay(10);
      return 'ok';
    };

    const results = await Promise.all([
      singleFlight('k1', task),
      singleFlight('k1', task),
      singleFlight('k1', task),
    ]);

    expect(calls).toBe(1);
    expect(results).toEqual(['ok', 'ok', 'ok']);
  });

  it('不同 key 互不影响', async () => {
    let calls = 0;
    const task = async () => {
      calls += 1;
      return calls;
    };

    const [a, b] = await Promise.all([singleFlight('ka', task), singleFlight('kb', task)]);

    expect(calls).toBe(2);
    expect(a).not.toBe(b);
  });

  it('任务结束后不复用结果（只合并并发，不缓存）', async () => {
    let calls = 0;
    const task = async () => {
      calls += 1;
      return calls;
    };

    expect(await singleFlight('k2', task)).toBe(1);
    expect(await singleFlight('k2', task)).toBe(2);
    expect(calls).toBe(2);
  });

  it('任务失败后释放飞行态，可再次调用', async () => {
    let calls = 0;
    const failing = async () => {
      calls += 1;
      if (calls === 1) throw new Error('boom');
      return 'recovered';
    };

    await expect(singleFlight('k3', failing)).rejects.toThrow('boom');
    expect(await singleFlight('k3', failing)).toBe('recovered');
  });

  it('并发失败时所有调用方都拿到同一个 rejection', async () => {
    let calls = 0;
    const failing = async () => {
      calls += 1;
      await delay(10);
      throw new Error('boom');
    };

    const results = await Promise.allSettled([
      singleFlight('k4', failing),
      singleFlight('k4', failing),
    ]);

    expect(calls).toBe(1);
    expect(results.map((r) => r.status)).toEqual(['rejected', 'rejected']);
  });

  it('clearSingleFlight 可强制丢弃飞行态', async () => {
    let calls = 0;
    const task = async () => {
      calls += 1;
      await delay(10);
      return calls;
    };

    const first = singleFlight('k5', task);
    clearSingleFlight('k5');
    const second = singleFlight('k5', task);

    await Promise.all([first, second]);
    expect(calls).toBe(2);
  });
});
