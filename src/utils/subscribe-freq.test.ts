import Taro from '@tarojs/taro';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  canShowDepletedPrompt,
  canShowLowQuotaBanner,
  canShowReactivatePrompt,
  markDepletedPromptShown,
  markLowQuotaBannerShown,
  markReactivatePromptShown,
} from './subscribe-freq';

const USER = 'freq-user';

describe('subscribe-freq', () => {
  beforeEach(() => {
    Taro.removeStorageSync('yunce:subscribe-freq');
    vi.useRealTimers();
  });

  it('首次可展示 depleted 弹框', () => {
    expect(canShowDepletedPrompt(USER, 'todo_remind')).toBe(true);
  });

  it('7 天内不重复展示 depleted 弹框', () => {
    markDepletedPromptShown(USER, 'todo_remind');
    expect(canShowDepletedPrompt(USER, 'todo_remind')).toBe(false);

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 7 * 24 * 60 * 60 * 1000);
    expect(canShowDepletedPrompt(USER, 'todo_remind')).toBe(true);
  });

  it('24 小时内不重复展示低额度横幅', () => {
    markLowQuotaBannerShown(USER, 'class_remind');
    expect(canShowLowQuotaBanner(USER, 'class_remind')).toBe(false);

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 24 * 60 * 60 * 1000);
    expect(canShowLowQuotaBanner(USER, 'class_remind')).toBe(true);
  });

  it('14 天内不重复展示再激活弹框', () => {
    markReactivatePromptShown(USER, 'todo_remind');
    expect(canShowReactivatePrompt(USER, 'todo_remind')).toBe(false);

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 14 * 24 * 60 * 60 * 1000);
    expect(canShowReactivatePrompt(USER, 'todo_remind')).toBe(true);
  });
});
