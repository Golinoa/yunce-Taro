import Taro from '@tarojs/taro';

const ENABLE_LOCAL_DEBUG =
  typeof process !== 'undefined' && typeof process.env !== 'undefined'
    ? process.env.TARO_ENABLE_LOCAL_DEBUG === 'true'
    : false;

const DEBUG_SERVER_URL = 'http://127.0.0.1:7777/event';
const DEBUG_SESSION_ID = 'page-slow-nav';

interface LocalDebugPayload {
  hypothesisId: string;
  location: string;
  msg: string;
  data: Record<string, unknown>;
}

/**
 * 本地调试上报统一入口。
 * 默认关闭，仅在显式传入 TARO_ENABLE_LOCAL_DEBUG=true 时启用。
 */
export function reportLocalDebug({
  hypothesisId,
  location,
  msg,
  data,
}: LocalDebugPayload): void {
  if (!ENABLE_LOCAL_DEBUG) {
    return;
  }

  Taro.request({
    url: DEBUG_SERVER_URL,
    method: 'POST',
    data: {
      sessionId: DEBUG_SESSION_ID,
      runId: 'pre-fix',
      hypothesisId,
      location,
      msg,
      data,
      ts: Date.now(),
    },
  }).catch(() => {});
}

export { ENABLE_LOCAL_DEBUG };
