import { vi } from 'vitest';

// hammerjs（@tarojs/taro 内部依赖）在 node 环境引用 window/document/navigator，
// 打桩避免测试套件加载崩溃
{
  const g = globalThis as Record<string, unknown>;
  if (typeof g.window === 'undefined') {
    g.window = {};
  }
  if (typeof g.document === 'undefined') {
    g.document = {
      createElement: () => ({
        getContext: () => null,
        addEventListener: () => {},
        removeEventListener: () => {},
        setAttribute: () => {},
        style: {},
      }),
      addEventListener: () => {},
      removeEventListener: () => {},
      body: {},
    };
  }
  if (typeof g.navigator === 'undefined') {
    g.navigator = { userAgent: 'node' };
  }
}

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
    chooseLocation: () => Promise.resolve({ name: '', address: '', latitude: 0, longitude: 0 }),
    request: () => Promise.resolve({ data: {} }),
  };
  return {
    __esModule: true,
    ...taro,
    default: taro,
  };
});

/**
 * 拦截 @tarojs/components（@tarojs/taro 内部 side-effect import）：
 * node 环境无 DOM/构建时全局常量（ENABLE_INNER_HTML 等），组件在单测中仅需占位。
 */
vi.mock('@tarojs/components', () => {
  const stub = () => null;
  const components: Record<string, unknown> = {
    __esModule: true,
    default: stub,
  };
  const NAMES = [
    'View',
    'Text',
    'Image',
    'ScrollView',
    'Input',
    'Textarea',
    'Button',
    'Picker',
    'PickerView',
    'PickerViewColumn',
    'Swiper',
    'SwiperItem',
    'Navigator',
    'Video',
    'Canvas',
    'Checkbox',
    'Radio',
    'Switch',
    'Slider',
    'Progress',
    'Icon',
    'RichText',
    'WebView',
    'Map',
    'CoverView',
    'CoverImage',
    'Form',
    'Label',
    'Block',
    'Audio',
    'Camera',
    'LivePlayer',
    'Ad',
    'OfficialAccount',
    'OpenData',
    'KeyboardAccessory',
  ];
  for (const name of NAMES) {
    components[name] = stub;
  }
  return components;
});
