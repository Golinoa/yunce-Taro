import { beforeEach, describe, expect, it } from 'vitest';
import Taro from '@tarojs/taro';
import {
  __resetUnlockSequenceForTest,
  DEVELOPER_MODE_UNLOCKED_KEY,
  handleVersionNumberTap,
  isDeveloperModeUnlocked,
  setDeveloperModeUnlocked,
  verifyDeveloperModePassword,
} from '@/utils/developer-mode';

describe('developer-mode', () => {
  beforeEach(() => {
    Taro.removeStorageSync(DEVELOPER_MODE_UNLOCKED_KEY);
    __resetUnlockSequenceForTest();
  });

  it('连续点击 7 次解锁', () => {
    const t = 1_000;
    for (let i = 0; i < 6; i += 1) {
      expect(handleVersionNumberTap(t + i * 50)).toBe('progress');
    }
    expect(handleVersionNumberTap(t + 350)).toBe('unlocked');
    expect(isDeveloperModeUnlocked()).toBe(true);
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
});
