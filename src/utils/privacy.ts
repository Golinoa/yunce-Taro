/**
 * 隐私合规初始化
 */
import Taro from '@tarojs/taro';
import { logDebug } from '@/utils/logger';
import {
  privacyApiSupport,
  privacyNewFlowId,
  privacyTrace,
  privacyTraceBootstrap,
  privacyTraceQuerySetting,
} from '@/utils/privacy-debug';
import { usePrivacyStore } from '@/stores/privacy';

let listenerReady = false;
let listenerReadyWaiters: Array<() => void> = [];

export interface InitPrivacyOptions {
  /** @deprecated 保留兼容；启动不再据此主动弹窗 */
  shortcutColdStart?: boolean;
}

function markListenerReady(): void {
  listenerReady = true;
  privacyTrace('listener.ready');
  const waiters = listenerReadyWaiters;
  listenerReadyWaiters = [];
  waiters.forEach((w) => w());
}

/** 等待隐私监听已注册（ensurePrivacy 前调用） */
export function waitPrivacyListenerReady(timeoutMs = 5000): Promise<void> {
  if (listenerReady) return Promise.resolve();
  if (process.env.TARO_ENV !== 'weapp') return Promise.resolve();

  privacyTrace('listener.wait.start', { timeoutMs });

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      listenerReadyWaiters = listenerReadyWaiters.filter((w) => w !== onReady);
      privacyTrace('listener.wait.timeout', { timeoutMs });
      resolve();
    }, timeoutMs);
    const onReady = () => {
      clearTimeout(timer);
      privacyTrace('listener.wait.resolved');
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

  privacyTrace('getPrivacyNeedAuthorization.start');

  return new Promise((resolve) => {
    Taro.getPrivacySetting({
      success: (res) => {
        logDebug('privacy.getPrivacySetting', {
          needAuthorization: res.needAuthorization,
          privacyContractName: res.privacyContractName,
        });
        privacyTrace('getPrivacyNeedAuthorization.success', {
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
        privacyTrace('getPrivacyNeedAuthorization.fail', { err });
        usePrivacyStore.getState().setNeedAuthorization(true);
        usePrivacyStore.getState().setStatus('need');
        resolve(true);
      },
    });
  });
}

export function registerPrivacyListener(): void {
  privacyTraceBootstrap();

  if (process.env.TARO_ENV !== 'weapp') {
    markListenerReady();
    return;
  }
  if (listenerReady) {
    privacyTrace('registerListener.skip', { reason: 'already-ready' });
    return;
  }

  if (typeof Taro.onNeedPrivacyAuthorization !== 'function') {
    logDebug('privacy.registerListener', '当前基础库/Taro 不支持 onNeedPrivacyAuthorization');
    privacyTrace('registerListener.unsupported', { apis: privacyApiSupport() });
    markListenerReady();
    return;
  }

  privacyTrace('registerListener.attach');

  Taro.onNeedPrivacyAuthorization((resolve, eventInfo) => {
    privacyTrace('onNeedPrivacyAuthorization.fired', {
      referrer: (eventInfo as { referrer?: string } | undefined)?.referrer,
      eventInfo,
    });
    usePrivacyStore.getState().enqueue(resolve);
  });
  markListenerReady();
}

export function initPrivacy(_options?: InitPrivacyOptions): void {
  if (process.env.TARO_ENV !== 'weapp') return;

  privacyTrace('initPrivacy.start', { options: _options });

  Taro.getPrivacySetting({
    success: (res) => {
      privacyTrace('initPrivacy.getPrivacySetting.success', {
        needAuthorization: res.needAuthorization,
        privacyContractName: res.privacyContractName,
      });
      const store = usePrivacyStore.getState();
      store.setContractName(res.privacyContractName);
      store.setNeedAuthorization(res.needAuthorization);
      if (!res.needAuthorization) {
        store.setStatus('authorized');
      } else {
        store.setStatus('need');
      }
    },
    fail: (err) => {
      privacyTrace('initPrivacy.getPrivacySetting.fail', { err });
      usePrivacyStore.getState().setStatus('unknown');
    },
  });
}

/** 登录页等场景：主动 dump 一次微信侧隐私状态（不改变业务逻辑） */
export function debugDumpPrivacySetting(reason: string): void {
  privacyTraceQuerySetting(reason);
}

function getRequirePrivacyAuthorize():
  | ((opt: {
      success?: () => void;
      fail?: (err: { errMsg?: string }) => void;
    }) => void)
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

function invokeOfficialPrivacyRequire(reason: string, flowId: string): void {
  privacyTrace('officialPrivacy.pageEnter', { reason, flowId });

  const requirePrivacyAuthorize = getRequirePrivacyAuthorize();
  if (typeof requirePrivacyAuthorize !== 'function') {
    privacyTrace('officialPrivacy.unsupported', { reason, flowId });
    return;
  }

  requirePrivacyAuthorize({
    success: () => {
      privacyTrace('officialPrivacy.pageEnter.success', { reason, flowId });
      usePrivacyStore.getState().setNeedAuthorization(false);
      usePrivacyStore.getState().setStatus('authorized');
    },
    fail: (err) => {
      privacyTrace('officialPrivacy.pageEnter.fail', { reason, flowId, errMsg: err?.errMsg, err });
      usePrivacyStore.getState().setStatus('denied');
    },
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

  const delayMs = options?.delayMs ?? 450;
  const flowId = privacyNewFlowId('pageEnter');
  privacyTrace('officialPrivacy.pageEnter.schedule', { reason, flowId, delayMs });

  const timer = setTimeout(() => {
    if (typeof Taro.getPrivacySetting !== 'function') {
      invokeOfficialPrivacyRequire(reason, flowId);
      return;
    }

    Taro.getPrivacySetting({
      success: (res) => {
        usePrivacyStore.getState().setContractName(res.privacyContractName);
        if (!res.needAuthorization) {
          privacyTrace('officialPrivacy.pageEnter.skip.alreadyAuthorized', { reason, flowId });
          usePrivacyStore.getState().setNeedAuthorization(false);
          usePrivacyStore.getState().setStatus('authorized');
          return;
        }
        usePrivacyStore.getState().setNeedAuthorization(true);
        usePrivacyStore.getState().setStatus('need');
        invokeOfficialPrivacyRequire(reason, flowId);
      },
      fail: (err) => {
        privacyTrace('officialPrivacy.pageEnter.queryFail', { reason, flowId, err });
        invokeOfficialPrivacyRequire(reason, flowId);
      },
    });
  }, delayMs);

  return () => clearTimeout(timer);
}
