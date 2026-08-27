import { vi } from 'vitest';

/**
 * 测试环境桩：替换 @tarojs/taro，避免小程序运行时 API 在 node 环境下报错。
 * 仅提供单测所需的同步存储与无操作 API，不影响被测算法的逻辑断言。
 */
vi.mock('@tarojs/taro', () => {
  const store = new Map<string, unknown>();
  const taro = {
    getStorageSync: (key: string) => store.get(key) ?? '',
    setStorageSync: (key: string, value: unknown) => {
      store.set(key, value);
    },
    removeStorageSync: (key: string) => {
      store.delete(key);
    },
    showToast: () => {},
    showModal: () => Promise.resolve({ confirm: true, cancel: false }),
    addPhoneCalendar: () => Promise.resolve(),
    showLoading: () => {},
    hideLoading: () => {},
    navigateBack: () => {},
    navigateTo: () => Promise.resolve(),
    chooseLocation: () =>
      Promise.resolve({ name: '', address: '', latitude: 0, longitude: 0 }),
    request: () => Promise.resolve({ data: {} }),
  };
  return {
    __esModule: true,
    ...taro,
    default: taro,
  };
});
