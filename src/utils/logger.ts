/**
 * 安全日志：开发环境打 console；生产/体验版走微信 RealtimeLogManager
 * （不含敏感头/token/密码）
 */
import Taro from '@tarojs/taro';

const isDev =
  typeof process !== 'undefined' &&
  typeof process.env !== 'undefined' &&
  process.env.NODE_ENV === 'development';

type RealtimeLogger = {
  info?: (...args: unknown[]) => void;
  warn?: (...args: unknown[]) => void;
  error?: (...args: unknown[]) => void;
};

let realtime: RealtimeLogger | null | undefined;

function getRealtime(): RealtimeLogger | null {
  if (realtime !== undefined) return realtime;
  try {
    const api = Taro as typeof Taro & {
      getRealtimeLogManager?: () => RealtimeLogger;
    };
    realtime = typeof api.getRealtimeLogManager === 'function' ? api.getRealtimeLogManager() : null;
  } catch {
    realtime = null;
  }
  return realtime;
}

function normalizePayload(err?: unknown): unknown {
  if (err == null) return undefined;
  if (err instanceof Error) {
    return { name: err.name, message: err.message };
  }
  if (typeof err === 'string' || typeof err === 'number' || typeof err === 'boolean') {
    return err;
  }
  try {
    return JSON.parse(JSON.stringify(err));
  } catch {
    return String(err);
  }
}

/** 生产错误上报 + 开发 console */
export function logError(context: string, err?: unknown): void {
  const payload = normalizePayload(err);
  if (isDev) {
    console.error(`[${context}]`, payload ?? err);
  }
  try {
    getRealtime()?.error?.(context, payload);
  } catch {
    /* 实时日志不可用不阻塞业务 */
  }
}

/** 生产告警上报 + 开发 console */
export function logWarn(context: string, msg?: unknown): void {
  const payload = normalizePayload(msg);
  if (isDev) {
    console.warn(`[${context}]`, payload ?? msg);
  }
  try {
    getRealtime()?.warn?.(context, payload);
  } catch {
    /* ignore */
  }
}

/**
 * 诊断日志：测环境包（TARO_ENABLE_LOCAL_DEBUG=true）或 dev 构建输出。
 */
export function logDebug(context: string, msg?: unknown): void {
  if (process.env.TARO_ENABLE_LOCAL_DEBUG === 'true' || isDev) {
    console.warn(`[${context}]`, msg);
  }
}

/** 供 request 打点：path + 状态，禁止带 Authorization */
export function logRequestIssue(
  kind: 'http5xx' | 'timeout' | 'refresh_fail' | 'network',
  detail: { path: string; statusCode?: number; errMsg?: string },
): void {
  const safe = {
    kind,
    path: detail.path,
    statusCode: detail.statusCode,
    errMsg: detail.errMsg?.slice(0, 200),
  };
  if (kind === 'http5xx' || kind === 'refresh_fail') {
    logError(`request:${kind}`, safe);
  } else {
    logWarn(`request:${kind}`, safe);
  }
}
