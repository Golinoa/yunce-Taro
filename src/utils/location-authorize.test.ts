import Taro from '@tarojs/taro';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tarojs/taro', () => ({
  default: {
    getSetting: vi.fn(),
    authorize: vi.fn(),
    showModal: vi.fn(),
    openSetting: vi.fn(),
  },
}));

describe('ensureUserLocationAuthorized', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv('TARO_ENV', 'weapp');
  });

  it('已授权直接 true', async () => {
    vi.mocked(Taro.getSetting).mockResolvedValue({
      authSetting: { 'scope.userLocation': true },
    } as Taro.getSetting.SuccessCallbackResult);

    const { ensureUserLocationAuthorized } = await import('./location-authorize');
    await expect(ensureUserLocationAuthorized()).resolves.toBe(true);
    expect(Taro.authorize).not.toHaveBeenCalled();
  });

  it('未授权时走 authorize', async () => {
    vi.mocked(Taro.getSetting).mockResolvedValue({
      authSetting: {},
    } as Taro.getSetting.SuccessCallbackResult);
    vi.mocked(Taro.authorize).mockResolvedValue({ errMsg: 'authorize:ok' });

    const { ensureUserLocationAuthorized } = await import('./location-authorize');
    await expect(ensureUserLocationAuthorized()).resolves.toBe(true);
    expect(Taro.authorize).toHaveBeenCalledWith({ scope: 'scope.userLocation' });
  });

  it('authorize 拒绝后引导 openSetting', async () => {
    vi.mocked(Taro.getSetting)
      .mockResolvedValueOnce({ authSetting: {} } as Taro.getSetting.SuccessCallbackResult)
      .mockResolvedValueOnce({
        authSetting: { 'scope.userLocation': true },
      } as Taro.getSetting.SuccessCallbackResult);
    vi.mocked(Taro.authorize).mockRejectedValue({ errMsg: 'authorize:fail auth deny' });
    vi.mocked(Taro.showModal).mockResolvedValue({
      confirm: true,
      cancel: false,
      errMsg: 'showModal:ok',
    });
    vi.mocked(Taro.openSetting).mockResolvedValue({
      authSetting: { 'scope.userLocation': true },
    } as Taro.openSetting.SuccessCallbackResult);

    const { ensureUserLocationAuthorized } = await import('./location-authorize');
    await expect(ensureUserLocationAuthorized()).resolves.toBe(true);
    expect(Taro.openSetting).toHaveBeenCalled();
  });
});
