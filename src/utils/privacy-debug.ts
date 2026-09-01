/**
 * 隐私授权全链路诊断日志（仅 dev / build:weapp:dev 输出）
 *
 * 微信开发者工具 Console 过滤：`privacy.trace`
 */
import Taro from '@tarojs/taro';
import { usePrivacyStore } from '@/stores/privacy';

export const PRIVACY_TRACE_PREFIX = '[privacy.trace]';

let traceSeq = 0;
let flowCounter = 0;

function isTraceEnabled(): boolean {
  return (
    process.env.TARO_ENABLE_LOCAL_DEBUG === 'true' ||
    (typeof process !== 'undefined' && process.env.NODE_ENV === 'development')
  );
}

/** 当前页面 route */
export function privacyCurrentRoute(): string {
  try {
    const pages = Taro.getCurrentPages?.() ?? [];
    const last = pages[pages.length - 1] as { route?: string } | undefined;
    return last?.route ?? '(no-page)';
  } catch {
    return '(route-error)';
  }
}

/** store 快照，便于对照 visible / pending / status */
export function privacyStoreSnapshot() {
  const s = usePrivacyStore.getState();
  return {
    visible: s.visible,
    status: s.status,
    needAuthorization: s.needAuthorization,
    prompting: s.prompting,
    pendingCount: s.pendingResolves.length,
    contractName: s.contractName,
  };
}

/** 基础库隐私 API 是否可用 */
export function privacyApiSupport() {
  const taro = Taro as typeof Taro & {
    onNeedPrivacyAuthorization?: unknown;
    requirePrivacyAuthorize?: unknown;
    getPrivacySetting?: unknown;
    openPrivacyContract?: unknown;
  };
  return {
    onNeedPrivacyAuthorization: typeof taro.onNeedPrivacyAuthorization === 'function',
    requirePrivacyAuthorize: typeof taro.requirePrivacyAuthorize === 'function',
    getPrivacySetting: typeof taro.getPrivacySetting === 'function',
    openPrivacyContract: typeof taro.openPrivacyContract === 'function',
  };
}

/** 新流程 id，用于串联一次点击 → require → 登录 */
export function privacyNewFlowId(caller: string): string {
  flowCounter += 1;
  return `${caller}#${flowCounter}`;
}

/**
 * 主 trace 入口 —— 一律 console.warn + 固定前缀，方便过滤
 */
export function privacyTrace(
  step: string,
  detail?: Record<string, unknown>,
): void {
  if (!isTraceEnabled()) return;

  traceSeq += 1;
  const payload = {
    seq: traceSeq,
    route: privacyCurrentRoute(),
    store: privacyStoreSnapshot(),
    ...detail,
  };
  // eslint-disable-next-line no-console
  console.warn(`${PRIVACY_TRACE_PREFIX} ${step}`, payload);
}

/** App 启动时 dump 一次 API 能力 */
export function privacyTraceBootstrap(): void {
  if (!isTraceEnabled()) return;
  privacyTrace('bootstrap', {
    taroEnv: process.env.TARO_ENV,
    localDebug: process.env.TARO_ENABLE_LOCAL_DEBUG,
    apis: privacyApiSupport(),
  });
}

/** 主动查询并打印 getPrivacySetting 完整结果 */
export function privacyTraceQuerySetting(reason: string): void {
  if (process.env.TARO_ENV !== 'weapp') {
    privacyTrace('querySetting.skip', { reason, taroEnv: process.env.TARO_ENV });
    return;
  }
  if (typeof Taro.getPrivacySetting !== 'function') {
    privacyTrace('querySetting.unsupported', { reason });
    return;
  }

  const startedAt = Date.now();
  privacyTrace('querySetting.start', { reason });

  Taro.getPrivacySetting({
    success: (res) => {
      privacyTrace('querySetting.success', {
        reason,
        elapsedMs: Date.now() - startedAt,
        needAuthorization: res.needAuthorization,
        privacyContractName: res.privacyContractName,
        raw: res,
      });
    },
    fail: (err) => {
      privacyTrace('querySetting.fail', {
        reason,
        elapsedMs: Date.now() - startedAt,
        err,
      });
    },
  });
}
