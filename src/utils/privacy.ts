/**
 * 隐私合规初始化
 */
import Taro from '@tarojs/taro';
import { usePrivacyStore } from '@/stores/privacy';
import { logDebug } from '@/utils/logger';

let listenerReady = false;
let listenerReadyWaiters: Array<() => void> = [];

export interface InitPrivacyOptions {
  /** @deprecated 保留兼容；启动不再据此主动弹窗 */
  shortcutColdStart?: boolean;
}

function markListenerReady(): void {
  listenerReady = true;
  const waiters = listenerReadyWaiters;
  listenerReadyWaiters = [];
  waiters.forEach((w) => w());
}

/** 等待隐私监听已注册（ensurePrivacy 前调用） */
export function waitPrivacyListenerReady(timeoutMs = 5000): Promise<void> {
  if (listenerReady) return Promise.resolve();
  if (process.env.TARO_ENV !== 'weapp') return Promise.resolve();

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      listenerReadyWaiters = listenerReadyWaiters.filter((w) => w !== onReady);
      resolve();
    }, timeoutMs);
    const onReady = () => {
      clearTimeout(timer);
      resolve();
    };
    listenerReadyWaiters.push(onReady);
  });
}

export function isPrivacyListenerReady(): boolean {
  return listenerReady || process.env.TARO_ENV !== 'weapp';
}

export function getPrivacyNeedAuthorization(): Promise<boolean> {
  if (process.env.TARO_ENV !== 'weapp') return Promise.resolve(false);

  return new Promise((resolve) => {
    Taro.getPrivacySetting({
      success: (res) => {
        logDebug('privacy.getPrivacySetting', {
          needAuthorization: res.needAuthorization,
          privacyContractName: res.privacyContractName,
        });
        usePrivacyStore.getState().setContractName(res.privacyContractName);
        usePrivacyStore.getState().setNeedAuthorization(res.needAuthorization);
        if (!res.needAuthorization) {
          usePrivacyStore.getState().setStatus('authorized');
        }
        resolve(Boolean(res.needAuthorization));
      },
      fail: (err) => {
        logDebug('privacy.getPrivacySetting.fail', err);
        usePrivacyStore.getState().setNeedAuthorization(true);
        usePrivacyStore.getState().setStatus('need');
        resolve(true);
      },
    });
  });
}

export function registerPrivacyListener(): void {
  if (process.env.TARO_ENV !== 'weapp') {
    markListenerReady();
    return;
  }
  if (listenerReady) {
    return;
  }

  if (typeof Taro.onNeedPrivacyAuthorization !== 'function') {
    logDebug('privacy.registerListener', '当前基础库/Taro 不支持 onNeedPrivacyAuthorization');
    markListenerReady();
    return;
  }

  Taro.onNeedPrivacyAuthorization((resolve) => {
    usePrivacyStore.getState().enqueue(resolve);
  });
  markListenerReady();
}

export function initPrivacy(_options?: InitPrivacyOptions): void {
  if (process.env.TARO_ENV !== 'weapp') return;

  Taro.getPrivacySetting({
    success: (res) => {
      const store = usePrivacyStore.getState();
      store.setContractName(res.privacyContractName);
      store.setNeedAuthorization(res.needAuthorization);
      if (!res.needAuthorization) {
        store.setStatus('authorized');
      } else {
        store.setStatus('need');
      }
    },
    fail: () => {
      usePrivacyStore.getState().setStatus('unknown');
    },
  });
}

function getRequirePrivacyAuthorize():
  | ((opt: { success?: () => void; fail?: (err: { errMsg?: string }) => void }) => void)
  | undefined {
  return (
    Taro as typeof Taro & {
      requirePrivacyAuthorize?: (opt: {
        success?: () => void;
        fail?: (err: { errMsg?: string }) => void;
      }) => void;
    }
  ).requirePrivacyAuthorize;
}

export interface OfficialPrivacyPageEnterOptions {
  /** 等待页面过渡完成后再弹窗，默认 450ms */
  delayMs?: number;
}

export const PRIVACY_DENIED_TOAST = '请先同意《隐私保护指引》后才能继续使用';

function markPrivacyAuthorized(): void {
  usePrivacyStore.getState().setNeedAuthorization(false);
  usePrivacyStore.getState().setStatus('authorized');
}

function markPrivacyDenied(): void {
  usePrivacyStore.getState().setStatus('denied');
}

function showPrivacyDeniedToast(): void {
  Taro.showToast({
    title: PRIVACY_DENIED_TOAST,
    icon: 'none',
    duration: 2800,
  });
}

function invokeOfficialPrivacyRequire(handlers: {
  showDeniedToast?: boolean;
  onSuccess?: () => void;
  onFail?: (err: { errMsg?: string }) => void;
}): void {
  const requirePrivacyAuthorize = getRequirePrivacyAuthorize();
  if (typeof requirePrivacyAuthorize !== 'function') {
    if (handlers.showDeniedToast) {
      showPrivacyDeniedToast();
    }
    handlers.onFail?.({ errMsg: 'unsupported' });
    return;
  }

  requirePrivacyAuthorize({
    success: () => {
      markPrivacyAuthorized();
      handlers.onSuccess?.();
    },
    fail: (err) => {
      markPrivacyDenied();
      if (handlers.showDeniedToast) {
        showPrivacyDeniedToast();
      }
      handlers.onFail?.(err);
    },
  });
}

/**
 * 用户点击同步栈内唤起微信官方隐私弹窗（图二）。
 * 已授权时直接执行回调，避免重复弹窗。
 */
export function promptOfficialPrivacyOnUserAction(
  reason: string,
  onAuthorized: () => void,
  onDenied?: () => void,
): void {
  void reason;

  if (process.env.TARO_ENV !== 'weapp') {
    onAuthorized();
    return;
  }

  const store = usePrivacyStore.getState();
  if (store.status === 'authorized' && !store.needAuthorization) {
    onAuthorized();
    return;
  }

  invokeOfficialPrivacyRequire({
    showDeniedToast: true,
    onSuccess: onAuthorized,
    onFail: () => onDenied?.(),
  });
}

/**
 * 进入页面时唤起微信官方隐私弹窗（图二）。
 * 放在主包 privacy 模块，避免分包 sub-common chunk 加载失败。
 * @returns 取消函数（页面 hide/unmount 时调用，避免延迟弹窗误触发）
 */
export function promptWechatOfficialPrivacyOnPageEnter(
  reason: string,
  options?: OfficialPrivacyPageEnterOptions,
): () => void {
  if (process.env.TARO_ENV !== 'weapp') return () => {};
  void reason;

  const delayMs = options?.delayMs ?? 450;

  const timer = setTimeout(() => {
    if (typeof Taro.getPrivacySetting !== 'function') {
      invokeOfficialPrivacyRequire({});
      return;
    }

    Taro.getPrivacySetting({
      success: (res) => {
        usePrivacyStore.getState().setContractName(res.privacyContractName);
        if (!res.needAuthorization) {
          usePrivacyStore.getState().setNeedAuthorization(false);
          usePrivacyStore.getState().setStatus('authorized');
          return;
        }
        usePrivacyStore.getState().setNeedAuthorization(true);
        usePrivacyStore.getState().setStatus('need');
        invokeOfficialPrivacyRequire({});
      },
      fail: () => {
        invokeOfficialPrivacyRequire({});
      },
    });
  }, delayMs);

  return () => clearTimeout(timer);
}
