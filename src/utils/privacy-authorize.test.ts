import Taro from '@tarojs/taro';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const setNeedAuthorization = vi.fn();
const setStatus = vi.fn();
const setContractName = vi.fn();

vi.mock('@/stores/privacy', () => ({
  usePrivacyStore: {
    getState: () => ({
      setNeedAuthorization,
      setStatus,
      setContractName,
    }),
  },
}));

describe('promptWechatOfficialPrivacyOnPageEnter', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv('TARO_ENV', 'weapp');
  });

  it('进页延迟后调 requirePrivacyAuthorize（微信官方图二）', async () => {
    vi.useFakeTimers();
    const requireSpy = vi.fn().mockImplementation((opt: { success?: () => void }) => {
      opt.success?.();
    });
    (Taro as unknown as { requirePrivacyAuthorize: typeof requireSpy }).requirePrivacyAuthorize =
      requireSpy;
    (Taro as unknown as { getPrivacySetting: typeof Taro.getPrivacySetting }).getPrivacySetting = vi
      .fn()
      .mockImplementation(
        (opt: {
          success?: (r: { needAuthorization: boolean; privacyContractName?: string }) => void;
        }) => {
          opt.success?.({ needAuthorization: true, privacyContractName: '《测试隐私指引》' });
        },
      );

    const { promptWechatOfficialPrivacyOnPageEnter } = await import('@/utils/privacy-authorize');
    promptWechatOfficialPrivacyOnPageEnter('login.page.show', { delayMs: 450 });

    expect(requireSpy).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(450);

    expect(requireSpy).toHaveBeenCalledTimes(1);
    expect(setNeedAuthorization).toHaveBeenCalledWith(false);
    expect(setStatus).toHaveBeenCalledWith('authorized');
    vi.useRealTimers();
  });

  it('已授权时跳过 requirePrivacyAuthorize', async () => {
    vi.useFakeTimers();
    const requireSpy = vi.fn();
    (Taro as unknown as { requirePrivacyAuthorize: typeof requireSpy }).requirePrivacyAuthorize =
      requireSpy;
    (Taro as unknown as { getPrivacySetting: typeof Taro.getPrivacySetting }).getPrivacySetting = vi
      .fn()
      .mockImplementation(
        (opt: {
          success?: (r: { needAuthorization: boolean; privacyContractName?: string }) => void;
        }) => {
          opt.success?.({ needAuthorization: false, privacyContractName: '《测试隐私指引》' });
        },
      );

    const { promptWechatOfficialPrivacyOnPageEnter } = await import('@/utils/privacy-authorize');
    promptWechatOfficialPrivacyOnPageEnter('login.page.show', { delayMs: 0 });
    await vi.advanceTimersByTimeAsync(0);

    expect(requireSpy).not.toHaveBeenCalled();
    expect(setNeedAuthorization).toHaveBeenCalledWith(false);
    expect(setStatus).toHaveBeenCalledWith('authorized');
    vi.useRealTimers();
  });
});

describe('ensurePrivacyAuthorized / ensurePrivacyBeforeAuth', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv('TARO_ENV', 'weapp');
  });

  it('已授权时直接通过', async () => {
    (Taro as unknown as { getPrivacySetting: typeof Taro.getPrivacySetting }).getPrivacySetting = vi
      .fn()
      .mockImplementation((opt: { success?: (r: { needAuthorization: boolean }) => void }) => {
        opt.success?.({ needAuthorization: false });
      });

    const { ensurePrivacyAuthorized } = await import('@/utils/privacy-authorize');
    await expect(ensurePrivacyAuthorized()).resolves.toBeUndefined();
  });

  it('未授权时 ensurePrivacyAuthorized 抛错', async () => {
    (Taro as unknown as { getPrivacySetting: typeof Taro.getPrivacySetting }).getPrivacySetting = vi
      .fn()
      .mockImplementation((opt: { success?: (r: { needAuthorization: boolean }) => void }) => {
        opt.success?.({ needAuthorization: true });
      });

    const { ensurePrivacyAuthorized } = await import('@/utils/privacy-authorize');
    await expect(ensurePrivacyAuthorized()).rejects.toThrow(/隐私/);
  });

  it('ensurePrivacyBeforeAuth：已授权返回 true', async () => {
    (Taro as unknown as { getPrivacySetting: typeof Taro.getPrivacySetting }).getPrivacySetting = vi
      .fn()
      .mockImplementation((opt: { success?: (r: { needAuthorization: boolean }) => void }) => {
        opt.success?.({ needAuthorization: false });
      });

    const { ensurePrivacyBeforeAuth } = await import('@/utils/privacy-authorize');
    await expect(ensurePrivacyBeforeAuth()).resolves.toBe(true);
  });

  it('ensurePrivacyBeforeAuth：未授权返回 false 并 toast', async () => {
    const showToast = vi.spyOn(Taro, 'showToast').mockResolvedValue(undefined as never);
    (Taro as unknown as { getPrivacySetting: typeof Taro.getPrivacySetting }).getPrivacySetting = vi
      .fn()
      .mockImplementation((opt: { success?: (r: { needAuthorization: boolean }) => void }) => {
        opt.success?.({ needAuthorization: true });
      });

    const { ensurePrivacyBeforeAuth } = await import('@/utils/privacy-authorize');
    await expect(ensurePrivacyBeforeAuth()).resolves.toBe(false);
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringMatching(/隐私保护指引/) }),
    );
    showToast.mockRestore();
  });
});

describe('promptPrivacySyncInHandler (同步栈 → 微信官方 require)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv('TARO_ENV', 'weapp');
  });

  it('同步栈内调 require，success → onAuthorized', async () => {
    (
      Taro as unknown as {
        requirePrivacyAuthorize: (o: { success?: () => void }) => void;
      }
    ).requirePrivacyAuthorize = vi.fn().mockImplementation((opt) => {
      opt.success?.();
    });

    const { promptPrivacySyncInHandler } = await import('@/utils/privacy-authorize');
    const onAuthorized = vi.fn();
    const onDenied = vi.fn();
    promptPrivacySyncInHandler(onAuthorized, onDenied);

    expect(onAuthorized).toHaveBeenCalledTimes(1);
    expect(onDenied).not.toHaveBeenCalled();
  });

  it('require fail → onDenied + toast', async () => {
    const showToast = vi.spyOn(Taro, 'showToast').mockResolvedValue(undefined as never);
    (
      Taro as unknown as {
        requirePrivacyAuthorize: (o: { fail?: (e: { errMsg: string }) => void }) => void;
      }
    ).requirePrivacyAuthorize = vi.fn().mockImplementation((opt) => {
      opt.fail?.({ errMsg: 'requirePrivacyAuthorize:fail disagree' });
    });

    const { promptPrivacySyncInHandler } = await import('@/utils/privacy-authorize');
    const onAuthorized = vi.fn();
    const onDenied = vi.fn();
    promptPrivacySyncInHandler(onAuthorized, onDenied);

    expect(onAuthorized).not.toHaveBeenCalled();
    expect(onDenied).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalled();
    showToast.mockRestore();
  });

  it('基础库不支持 require 时 onDenied', async () => {
    (Taro as unknown as { requirePrivacyAuthorize: undefined }).requirePrivacyAuthorize = undefined;

    const { promptPrivacySyncInHandler } = await import('@/utils/privacy-authorize');
    const onAuthorized = vi.fn();
    const onDenied = vi.fn();
    promptPrivacySyncInHandler(onAuthorized, onDenied);

    expect(onAuthorized).not.toHaveBeenCalled();
    expect(onDenied).toHaveBeenCalledTimes(1);
  });
});
