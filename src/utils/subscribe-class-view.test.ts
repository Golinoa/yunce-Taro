import Taro from '@tarojs/taro';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetSubscribeClassViewForTest,
  canRunClassViewRenew,
  markClassAssignPromptConsumed,
  markClassViewRenewShown,
} from './subscribe-class-view';

describe('subscribe-class-view', () => {
  beforeEach(() => {
    __resetSubscribeClassViewForTest();
  });

  it('5 分钟内进入班级页可触发 renew', () => {
    markClassAssignPromptConsumed('u1', 'c1');
    expect(canRunClassViewRenew('u1', 'c1')).toBe(true);
    markClassViewRenewShown('u1', 'c1');
    expect(canRunClassViewRenew('u1', 'c1')).toBe(false);
  });

  it('用户或班级不匹配时不触发', () => {
    markClassAssignPromptConsumed('u1', 'c1');
    expect(canRunClassViewRenew('u2', 'c1')).toBe(false);
    expect(canRunClassViewRenew('u1', 'c2')).toBe(false);
  });

  it('超过 5 分钟窗口不触发', () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    markClassAssignPromptConsumed('u1', 'c1');
    vi.spyOn(Date, 'now').mockReturnValue(now + 6 * 60 * 1000);
    expect(canRunClassViewRenew('u1', 'c1')).toBe(false);
    vi.restoreAllMocks();
  });
});
