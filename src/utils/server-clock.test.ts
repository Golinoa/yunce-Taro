/**
 * server-clock 单测（G7：用 HTTP `Date` 响应头校正 TTL 时间源）
 * 覆盖：正常校正 / 秒级容忍 / 降级不改变行为 / 异常头护栏 / 跨冷启动恢复
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
  };
});

vi.mock('@tarojs/taro', () => ({ default: taroStub }));

const OFFSET_KEY = 'yunce:clock:offset-v1';
/** 基准时刻（毫秒为 0，避免 Date 头秒级截断带来的取整噪声） */
const T0 = Date.parse('2026-09-19T14:00:00.000Z');

/** 每个用例取独立模块实例，避免模块级 offset/hydrated 状态串味 */
async function freshModule() {
  vi.resetModules();
  return import('./server-clock');
}

beforeEach(() => {
  taroStub.map.clear();
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('降级：未同步时行为与校正前一致', () => {
  it('无偏移 → serverNow() === Date.now()，且不写存储', async () => {
    const { serverNow, getServerClockOffsetMs } = await freshModule();
    expect(getServerClockOffsetMs()).toBe(0);
    expect(serverNow()).toBe(T0);
    expect(taroStub.map.size).toBe(0);
  });

  it('无 header / 缺 Date / 非字符串 / 无法解析 → 保持偏移 0', async () => {
    const { syncServerClock, getServerClockOffsetMs } = await freshModule();
    syncServerClock(undefined);
    syncServerClock(null);
    syncServerClock({});
    syncServerClock({ Date: 123 as unknown as string });
    syncServerClock({ Date: 'not-a-date' });
    expect(getServerClockOffsetMs()).toBe(0);
    expect(taroStub.map.size).toBe(0);
  });
});

describe('正常校正', () => {
  it('设备时钟慢 1 小时 → 偏移 +3600000，serverNow 跟随服务器', async () => {
    const { syncServerClock, serverNow, getServerClockOffsetMs } = await freshModule();
    syncServerClock({ Date: new Date(T0 + 3_600_000).toUTCString() });
    expect(getServerClockOffsetMs()).toBe(3_600_000);
    expect(serverNow()).toBe(T0 + 3_600_000);
    expect(taroStub.map.get(OFFSET_KEY)).toBe(3_600_000);
  });

  it('设备时钟快 2 小时 → 偏移为负', async () => {
    const { syncServerClock, getServerClockOffsetMs } = await freshModule();
    syncServerClock({ Date: new Date(T0 - 7_200_000).toUTCString() });
    expect(getServerClockOffsetMs()).toBe(-7_200_000);
  });

  it('小写 date 头同样生效（微信侧 header 键可能被规范化）', async () => {
    const { syncServerClock, getServerClockOffsetMs } = await freshModule();
    syncServerClock({ date: new Date(T0 + 3_600_000).toUTCString() });
    expect(getServerClockOffsetMs()).toBe(3_600_000);
  });
});

describe('秒级容忍：时钟正常时零写入', () => {
  it('偏差 ≤1s → 视为正常，归零且不落盘', async () => {
    const { syncServerClock, getServerClockOffsetMs } = await freshModule();
    syncServerClock({ Date: new Date(T0 + 400).toUTCString() });
    expect(getServerClockOffsetMs()).toBe(0);
    expect(taroStub.map.size).toBe(0);
  });

  it('先有偏移，随后时钟恢复正常 → 偏移被清回 0', async () => {
    const { syncServerClock, getServerClockOffsetMs } = await freshModule();
    syncServerClock({ Date: new Date(T0 + 3_600_000).toUTCString() });
    expect(getServerClockOffsetMs()).toBe(3_600_000);
    syncServerClock({ Date: new Date(T0 + 200).toUTCString() });
    expect(getServerClockOffsetMs()).toBe(0);
  });
});

describe('异常头护栏', () => {
  it('偏移超过 7 天 → 忽略（防中间件伪造 Date 崩坏 TTL）', async () => {
    const { syncServerClock, getServerClockOffsetMs } = await freshModule();
    syncServerClock({ Date: new Date(T0 + 30 * 24 * 3600_000).toUTCString() });
    expect(getServerClockOffsetMs()).toBe(0);
    expect(taroStub.map.size).toBe(0);
  });
});

describe('跨冷启动恢复', () => {
  it('偏移落盘后，重新载入模块仍生效', async () => {
    const mod1 = await freshModule();
    mod1.syncServerClock({ Date: new Date(T0 + 3_600_000).toUTCString() });
    expect(taroStub.map.get(OFFSET_KEY)).toBe(3_600_000);

    const mod2 = await freshModule();
    expect(mod2.getServerClockOffsetMs()).toBe(3_600_000);
    expect(mod2.serverNow()).toBe(T0 + 3_600_000);
  });

  it('存储里的越界值（历史脏数据）不被采信', async () => {
    taroStub.map.set(OFFSET_KEY, 30 * 24 * 3600_000);
    const { getServerClockOffsetMs } = await freshModule();
    expect(getServerClockOffsetMs()).toBe(0);
  });
});
