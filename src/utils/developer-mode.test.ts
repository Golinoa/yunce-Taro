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

  it('完整序列 7-7 解锁', () => {
    let t = 1_000;
    for (let i = 0; i < 6; i += 1) {
      expect(handleVersionNumberTap(t + i * 50)).toBe('progress');
    }
    expect(handleVersionNumberTap(t + 300)).toBe('progress'); // 第 7 次 → 进入停顿

    t += 3_500;
    for (let i = 0; i < 6; i += 1) {
      expect(handleVersionNumberTap(t + i * 50)).toBe('progress');
    }
    expect(handleVersionNumberTap(t + 300)).toBe('unlocked'); // 第 7 次 → 解锁

    expect(isDeveloperModeUnlocked()).toBe(true);
  });

  it('停顿不足 3 秒重置', () => {
    let t = 1_000;
    for (let i = 0; i < 7; i += 1) {
      handleVersionNumberTap(t + i * 50);
    }
    expect(handleVersionNumberTap(t + 500)).toBe('reset');
    expect(isDeveloperModeUnlocked()).toBe(false);
  });

  it('第一阶段未满7次连点第8次重置（未停顿）', () => {
    let t = 1_000;
    for (let i = 0; i < 7; i += 1) {
      handleVersionNumberTap(t + i * 50);
    }
    expect(handleVersionNumberTap(t + 400)).toBe('reset');
    expect(isDeveloperModeUnlocked()).toBe(false);
  });

  it('超过 1 分钟窗口从头计', () => {
    handleVersionNumberTap(0);
    expect(handleVersionNumberTap(61_000)).toBe('progress');
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
