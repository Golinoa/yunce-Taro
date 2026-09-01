/**
 * 微信官方隐私授权（图二：系统「用户隐私保护提示」绿按钮）
 *
 * 不注册 onNeedPrivacyAuthorization，requirePrivacyAuthorize 由微信弹出系统原生框。
 */
import Taro from '@tarojs/taro';
import { logDebug } from '@/utils/logger';
import {
  privacyApiSupport,
  privacyNewFlowId,
  privacyTrace,
} from '@/utils/privacy-debug';
import { usePrivacyStore } from '@/stores/privacy';
import { getPrivacyNeedAuthorization } from '@/utils/privacy';

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

function callRequirePrivacyAuthorizeSync(
  flowId: string,
  onSuccess: () => void,
  onFail: (err: { errMsg?: string }) => void,
): void {
  const requirePrivacyAuthorize = getRequirePrivacyAuthorize();

  if (typeof requirePrivacyAuthorize !== 'function') {
    privacyTrace('require.sync.unsupported', { flowId, apis: privacyApiSupport() });
    onFail({ errMsg: '当前基础库不支持隐私授权，请升级微信后重试' });
    return;
  }

  privacyTrace('require.sync.call', { flowId, note: '调用微信官方 requirePrivacyAuthorize（系统图二）' });

  requirePrivacyAuthorize({
    success: () => {
      privacyTrace('require.sync.success', { flowId });
      usePrivacyStore.getState().setNeedAuthorization(false);
      usePrivacyStore.getState().setStatus('authorized');
      onSuccess();
    },
    fail: (err) => {
      logDebug('privacy.requirePrivacyAuthorize.fail', err?.errMsg);
      privacyTrace('require.sync.fail', { flowId, errMsg: err?.errMsg, err });
      onFail(err);
    },
  });
}

export { promptWechatOfficialPrivacyOnPageEnter } from '@/utils/privacy';

/** 用户点击同步栈内 require（其他页面按钮场景，同样走微信官方图二） */
export function promptPrivacySyncInHandler(onAuthorized: () => void, onDenied?: () => void): void {
  const flowId = privacyNewFlowId('syncHandler');

  privacyTrace('syncHandler.enter', {
    flowId,
    note: '用户点击同步栈 → 微信官方 require',
    apis: privacyApiSupport(),
  });

  if (process.env.TARO_ENV !== 'weapp') {
    privacyTrace('syncHandler.skip.nonWeapp', { flowId });
    onAuthorized();
    return;
  }

  callRequirePrivacyAuthorizeSync(
    flowId,
    () => {
      privacyTrace('syncHandler.requireOk → onAuthorized', { flowId });
      onAuthorized();
    },
    (err) => {
      privacyTrace('syncHandler.requireFail', { flowId, errMsg: err?.errMsg });
      Taro.showToast({
        title: '请先同意《隐私保护指引》后才能继续使用',
        icon: 'none',
        duration: 2800,
      });
      onDenied?.();
    },
  );
}

async function isPrivacyAuthorized(): Promise<boolean> {
  const stillNeed = await getPrivacyNeedAuthorization();
  return !stillNeed;
}

export async function promptPrivacyIfNeeded(): Promise<boolean> {
  if (process.env.TARO_ENV !== 'weapp') return true;
  privacyTrace('promptPrivacyIfNeeded.check');
  const ok = await isPrivacyAuthorized();
  privacyTrace('promptPrivacyIfNeeded.done', { ok });
  return ok;
}

export async function ensurePrivacyAuthorized(): Promise<void> {
  if (process.env.TARO_ENV !== 'weapp') return;

  privacyTrace('ensurePrivacyAuthorized.start');
  const ok = await isPrivacyAuthorized();
  if (!ok) {
    privacyTrace('ensurePrivacyAuthorized.throw');
    throw new Error('需要同意隐私保护指引后才能使用本小程序');
  }
  privacyTrace('ensurePrivacyAuthorized.ok');
}

export async function ensurePrivacyBeforeAuth(): Promise<boolean> {
  privacyTrace('ensurePrivacyBeforeAuth.start');
  const ok = await promptPrivacyIfNeeded();
  if (!ok) {
    privacyTrace('ensurePrivacyBeforeAuth.denied');
    Taro.showToast({
      title: '请先同意隐私保护指引后才能继续',
      icon: 'none',
      duration: 2800,
    });
  } else {
    privacyTrace('ensurePrivacyBeforeAuth.ok');
  }
  return ok;
}
