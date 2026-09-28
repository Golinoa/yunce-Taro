/**
 * 首页「开启上课提醒」引导单测
 *
 * 关键回归点（2026-09-29）：
 * 1. 额度为准——还能发就不打扰；
 * 2. 拒绝识别——已永久拒绝 / 总开关关闭 / 被封禁时静默，不再白弹；
 * 3. 微信状态读取失败时按"未知"处理，不得误判成 blocked 而永久不引导。
 */
import Taro from '@tarojs/taro';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearGuideThrottle,
  decideReminderGuide,
  hasDialogShownToday,
  isBannerCooling,
  markBannerDismissed,
  markDialogShown,
  readSubscribePermission,
} from './subscribe-reminder-guide';
import type { ReminderGuideInput, SubscribePermissionSnapshot } from './subscribe-reminder-guide';

vi.mock('@tarojs/taro', () => ({
  default: {
    getSetting: vi.fn(),
    getStorageSync: vi.fn(),
    setStorageSync: vi.fn(),
    removeStorageSync: vi.fn(),
  },
}));

const TMPL = 'tmpl-class-remind';

/** 内存版 storage，在 beforeEach 里接到 mock 上 */
let mem: Record<string, unknown> = {};

beforeEach(() => {
  vi.clearAllMocks();
  mem = {};
  vi.mocked(Taro.getStorageSync).mockImplementation((key: string) => mem[key] ?? '');
  vi.mocked(Taro.setStorageSync).mockImplementation((key: string, value: unknown) => {
    mem[key] = value;
  });
  vi.mocked(Taro.removeStorageSync).mockImplementation((key: string) => {
    delete mem[key];
  });
});

const perm = (over: Partial<SubscribePermissionSnapshot> = {}): SubscribePermissionSnapshot => ({
  mainSwitch: true,
  statusByTmplId: { [TMPL]: 'unknown' },
  ok: true,
  ...over,
});

const baseInput: ReminderGuideInput = {
  hasCourseToday: true,
  quotaRemain: 0,
  masterEnabled: true,
  permission: perm(),
  tmplId: TMPL,
};

describe('decideReminderGuide', () => {
  it('今天没课 → 不引导', () => {
    expect(decideReminderGuide({ ...baseInput, hasCourseToday: false })).toBe('none');
  });

  it('额度还够 → 不打扰（额度为准）', () => {
    expect(decideReminderGuide({ ...baseInput, quotaRemain: 3 })).toBe('none');
  });

  it('额度为 0 且状态未知 → 引导', () => {
    expect(decideReminderGuide(baseInput)).toBe('guide');
  });

  it('后端标记 needsReactivate → 即使 remain>0 也引导', () => {
    expect(decideReminderGuide({ ...baseInput, quotaRemain: 1, needsReactivate: true })).toBe(
      'guide',
    );
  });

  it('用户已永久拒绝 → 静默（弹也弹不出来）', () => {
    expect(
      decideReminderGuide({
        ...baseInput,
        permission: perm({ statusByTmplId: { [TMPL]: 'reject' } }),
      }),
    ).toBe('blocked');
  });

  it('模板被后台封禁 → 静默', () => {
    expect(
      decideReminderGuide({
        ...baseInput,
        permission: perm({ statusByTmplId: { [TMPL]: 'ban' } }),
      }),
    ).toBe('blocked');
  });

  it('微信订阅总开关关闭 → 静默', () => {
    expect(decideReminderGuide({ ...baseInput, permission: perm({ mainSwitch: false }) })).toBe(
      'blocked',
    );
  });

  it('应用内总开关关闭 → 不引导', () => {
    expect(decideReminderGuide({ ...baseInput, masterEnabled: false })).toBe('none');
  });

  it('未取到模板 id → 不引导', () => {
    expect(decideReminderGuide({ ...baseInput, tmplId: '' })).toBe('none');
  });

  it('权限读取失败（ok=false）→ 仍按未知处理，引导而非静默', () => {
    expect(decideReminderGuide({ ...baseInput, permission: perm({ ok: false }) })).toBe('guide');
  });
});

describe('readSubscribePermission', () => {
  it('正常解析总开关与各模板状态', async () => {
    vi.mocked(Taro.getSetting).mockResolvedValue({
      subscriptionsSetting: { mainSwitch: true, itemSettings: { [TMPL]: 'accept' } },
    } as unknown as Taro.getSetting.SuccessCallbackResult);

    const snap = await readSubscribePermission([TMPL]);
    expect(snap.ok).toBe(true);
    expect(snap.mainSwitch).toBe(true);
    expect(snap.statusByTmplId[TMPL]).toBe('accept');
  });

  it('未勾选「总是保持」→ unknown（不能据此断定没授权）', async () => {
    vi.mocked(Taro.getSetting).mockResolvedValue({
      subscriptionsSetting: { mainSwitch: true, itemSettings: {} },
    } as unknown as Taro.getSetting.SuccessCallbackResult);

    const snap = await readSubscribePermission([TMPL]);
    expect(snap.statusByTmplId[TMPL]).toBe('unknown');
  });

  it('接口失败 → ok=false 且 mainSwitch 保持 true（不误判 blocked）', async () => {
    vi.mocked(Taro.getSetting).mockRejectedValue(new Error('fail'));

    const snap = await readSubscribePermission([TMPL]);
    expect(snap.ok).toBe(false);
    expect(snap.mainSwitch).toBe(true);
    expect(snap.statusByTmplId[TMPL]).toBe('unknown');
  });
});

describe('引导节流', () => {
  it('弹框一天最多一次', () => {
    expect(hasDialogShownToday()).toBe(false);
    markDialogShown();
    expect(hasDialogShownToday()).toBe(true);
  });

  it('关闭引导条后进入冷却', () => {
    expect(isBannerCooling()).toBe(false);
    markBannerDismissed();
    expect(isBannerCooling()).toBe(true);
  });

  it('授权成功后清理节流状态', () => {
    markBannerDismissed();
    expect(isBannerCooling()).toBe(true);
    clearGuideThrottle();
    expect(isBannerCooling()).toBe(false);
  });
});
