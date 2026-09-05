import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  REFRESH_SIGNAL,
  setRefreshSignal,
  consumeRefreshSignal,
  emitScheduleRelatedRefresh,
} from './refresh-signal';

const storage = new Map<string, string>();

vi.mock('@tarojs/taro', () => ({
  default: {
    setStorageSync: (k: string, v: string) => storage.set(k, v),
    getStorageSync: (k: string) => storage.get(k) ?? '',
    removeStorageSync: (k: string) => storage.delete(k),
  },
}));

vi.mock('@/utils/logger', () => ({
  logError: vi.fn(),
}));

describe('refresh-signal', () => {
  beforeEach(() => storage.clear());

  it('set 后 consume 一次为 true，再 consume 为 false', () => {
    expect(consumeRefreshSignal(REFRESH_SIGNAL.schedule)).toBe(false);
    setRefreshSignal(REFRESH_SIGNAL.schedule);
    expect(consumeRefreshSignal(REFRESH_SIGNAL.schedule)).toBe(true);
    expect(consumeRefreshSignal(REFRESH_SIGNAL.schedule)).toBe(false);
  });

  it('emitScheduleRelatedRefresh 写入课表/首页/班级三信号', () => {
    emitScheduleRelatedRefresh();
    expect(consumeRefreshSignal(REFRESH_SIGNAL.schedule)).toBe(true);
    expect(consumeRefreshSignal(REFRESH_SIGNAL.home)).toBe(true);
    expect(consumeRefreshSignal(REFRESH_SIGNAL.classes)).toBe(true);
  });
});
