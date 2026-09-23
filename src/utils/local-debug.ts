import Taro from '@tarojs/taro';

/**
 * 构建期常量。
 *
 * `config/index.ts` 的 `defineConstants` 会把 `process.env.TARO_ENABLE_LOCAL_DEBUG`
 * 在**打包时**替换成字符串字面量，所以这里不带 `typeof process` 的运行时判断时，
 * 表达式会被折叠成 `true` / `false`：
 * - 生产构建（未设该环境变量）→ `false` ⇒ `reportLocalDebug` 立刻 return，
 *   terser 进一步把整个函数体判为不可达并删除 ⇒ **零运行时开销、零包体占用**；
 * - 调试构建（`TARO_ENABLE_LOCAL_DEBUG=true`）→ `true` ⇒ 保留全部诊断输出。
 *
 * ⚠️ 不要改回 `typeof process !== 'undefined' && …` 的运行时判断：那样常量无法折叠，
 * 生产包也会照样执行 storage 读写与 console 输出（曾导致此问题，2026-09-23 修正）。
 * 参考同项目 `utils/logger.ts:78` 的既有写法。
 */
const ENABLE_LOCAL_DEBUG = process.env.TARO_ENABLE_LOCAL_DEBUG === 'true';

/**
 * 只有运行环境真的存在 `process` 时才向本机调试服务上报。
 * 微信小程序运行时没有 `process`，因此真机/开发者工具里这一步不会发请求，
 * 诊断数据靠 storage 落盘 + console 输出获取。
 */
const CAN_POST_TO_DEBUG_SERVER = ENABLE_LOCAL_DEBUG && typeof process !== 'undefined';

const DEBUG_SERVER_URL = 'http://127.0.0.1:7777/event';
const DEBUG_SESSION_ID = 'page-slow-nav';
const DEBUG_BUILD_ID = 'students-debug-20260923-17';
const LOCAL_DEBUG_STORAGE_KEY = '__yunce_local_debug_events__';
const LOCAL_DEBUG_EVENT_LIMIT = 50;

interface LocalDebugPayload {
  hypothesisId: string;
  location: string;
  msg: string;
  data: Record<string, unknown>;
}

/** 诊断用序列化：循环引用/undefined 都不能影响埋点本身 */
function safeStringify(value: unknown): string {
  try {
    const seen = new WeakSet<object>();
    return (
      JSON.stringify(value, (_key, val) => {
        if (typeof val === 'object' && val !== null) {
          if (seen.has(val)) return '[Circular]';
          seen.add(val);
        }
        return val === undefined ? null : val;
      }) ?? 'undefined'
    );
  } catch {
    return '[Unserializable]';
  }
}

/**
 * 本地调试上报统一入口。
 * 默认关闭，仅在显式传入 TARO_ENABLE_LOCAL_DEBUG=true 时启用。
 */
export function reportLocalDebug({ hypothesisId, location, msg, data }: LocalDebugPayload): void {
  // ⚠️ 门禁必须放在函数最前面。
  // 原实现把 storage 落盘和 console.warn 写在门禁之前，导致「默认关闭」只关掉了
  // 网络上报：生产包里每个调用点仍会执行 2 次**同步** storage IO（读 + 写最多 50 条
  // 事件的数组，每次都要整体序列化）+ 一次长字符串 console 输出。
  // 而热路径上调用很密集（request.ts 每请求一次、KingKongSection 每次 render 一次、
  // route-guard 每次路由检查一次），是真实的卡顿来源。2026-09-23 修正。
  if (!ENABLE_LOCAL_DEBUG) {
    return;
  }

  const event = {
    buildId: DEBUG_BUILD_ID,
    sessionId: DEBUG_SESSION_ID,
    runId: 'pre-fix',
    hypothesisId,
    location,
    msg,
    data,
    ts: Date.now(),
  };

  // 真机无法访问开发机的 127.0.0.1，因此同时落盘一份最近事件；
  // 诊断不依赖控制台，也不改变业务请求和页面行为。
  try {
    const raw = Taro.getStorageSync(LOCAL_DEBUG_STORAGE_KEY);
    const previous = Array.isArray(raw) ? raw : typeof raw === 'string' ? JSON.parse(raw) : [];
    const events = Array.isArray(previous) ? previous : [];
    Taro.setStorageSync(
      LOCAL_DEBUG_STORAGE_KEY,
      [...events, event].slice(-LOCAL_DEBUG_EVENT_LIMIT),
    );
  } catch {
    /* ignore diagnostic persistence failures */
  }

  // 把 msg/location/data 提到首参：开发者工具会把对象参数折叠成 `…`，
  // 折叠后关键信息全丢，排查只能靠展开，非常低效。
  // eslint-disable-next-line no-console
  console.warn(
    `[YUNCE_DEBUG] [${event.hypothesisId}] ${event.msg} @ ${event.location} :: ${safeStringify(event.data)}`,
    event,
  );

  if (!CAN_POST_TO_DEBUG_SERVER) {
    return;
  }

  Taro.request({
    url: DEBUG_SERVER_URL,
    method: 'POST',
    data: {
      ...event,
    },
  }).catch(() => {});
}

export { ENABLE_LOCAL_DEBUG };
