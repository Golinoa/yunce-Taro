import { beforeEach, describe, expect, it, vi } from 'vitest';
import Taro from '@tarojs/taro';
import {
  __resetUnlockSequenceForTest,
  DEVELOPER_MODE_EXPIRES_AT_KEY,
  DEVELOPER_MODE_TTL_MS,
  DEVELOPER_MODE_UNLOCKED_KEY,
  expireDeveloperModeIfNeeded,
  getDeveloperModeRemainingMs,
  handleVersionNumberTap,
  isDeveloperModeUnlocked,
  setDeveloperModeUnlocked,
  verifyDeveloperModePassword,
} from '@/utils/developer-mode';

describe('developer-mode', () => {
  beforeEach(() => {
    Taro.removeStorageSync(DEVELOPER_MODE_UNLOCKED_KEY);
    Taro.removeStorageSync(DEVELOPER_MODE_EXPIRES_AT_KEY);
    __resetUnlockSequenceForTest();
    vi.useRealTimers();
  });

  it('连续点击 7 次解锁', () => {
    const t = 1_000;
    for (let i = 0; i < 6; i += 1) {
      expect(handleVersionNumberTap(t + i * 50)).toBe('progress');
    }
    expect(handleVersionNumberTap(t + 350)).toBe('unlocked');
    expect(isDeveloperModeUnlocked()).toBe(true);
    expect(getDeveloperModeRemainingMs(t + 350)).toBeGreaterThan(DEVELOPER_MODE_TTL_MS - 1000);
  });

  it('超过 5 秒窗口从头计', () => {
    handleVersionNumberTap(0);
    expect(handleVersionNumberTap(5_100)).toBe('progress');
    expect(isDeveloperModeUnlocked()).toBe(false);
  });

  it('密码校验', () => {
    expect(verifyDeveloperModePassword('25')).toBe(true);
    expect(verifyDeveloperModePassword('24')).toBe(false);
  });

  it('可关闭开发者模式', () => {
    setDeveloperModeUnlocked(true);
    expect(isDeveloperModeUnlocked()).toBe(true);
    setDeveloperModeUnlocked(false);
    expect(isDeveloperModeUnlocked()).toBe(false);
  });

  it('10 分钟后自动关闭入口', () => {
    const t0 = 1_000_000;
    setDeveloperModeUnlocked(true, t0);
    expect(isDeveloperModeUnlocked(t0)).toBe(true);
    expect(expireDeveloperModeIfNeeded(t0 + DEVELOPER_MODE_TTL_MS - 1)).toBe(false);
    expect(isDeveloperModeUnlocked(t0 + DEVELOPER_MODE_TTL_MS - 1)).toBe(true);
    expect(expireDeveloperModeIfNeeded(t0 + DEVELOPER_MODE_TTL_MS)).toBe(true);
    expect(isDeveloperModeUnlocked(t0 + DEVELOPER_MODE_TTL_MS)).toBe(false);
  });
});
