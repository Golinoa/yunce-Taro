/**
 * 服务器时钟校正（G7 · docs/diagnostics/2026-09-19-frontend-cache-layer-plan.md）
 *
 * 背景：缓存 TTL 判断依赖「现在几点」。若用设备本地时钟：
 * - 设备时钟**偏快** → 缓存瞬间判定过期 → 每次回源，缓存形同失效（变慢）；
 * - 设备时钟**偏慢/被回拨** → 缓存迟迟不过期 → 长期读旧值（数据陈旧）。
 *
 * 后端业务响应体暂无 `serverTime`（Q3 缺口），但网关（nginx / Cloudflare）返回标准
 * HTTP `Date` 响应头——2026-09-19 实测 dev 与 prod 两端均返回且时间准确，秒级精度，
 * 足以支撑分钟~小时级 TTL。故采用零后端改动方案：**每次响应顺带校正一次偏移量**，
 * 后续所有 TTL 判断以 `serverNow()` 为准，与设备时钟解耦。
 *
 * 降级（任一情形均不改变现有行为，等价 `Date.now()`）：
 * - 无 `Date` 头 / 解析失败 → 保持既有偏移（首次为 0）；
 * - 偏移超出 `MAX_TRUSTED_SKEW_MS`（中间件/门户伪造的异常头）→ 忽略，防 TTL 逻辑崩坏；
 * - 偏移 ≤ `SKEW_TOLERANCE_MS` → 视为「时钟正常」，归零且**不落盘**（常规路径零写入）。
 */
import Taro from '@tarojs/taro';

const OFFSET_KEY = 'yunce:clock:offset-v1';

/** 偏移量合理上限：超过 7 天视为异常头，忽略（宁可退回设备时钟，也不让 TTL 失准） */
const MAX_TRUSTED_SKEW_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * 偏差容忍：HTTP `Date` 头为**秒级**精度，且每次请求的 RTT 会带来毫秒级抖动，
 * 故 1s 内的偏差视为「设备时钟正常」，直接归零——常规用户零存储写入。
 */
const SKEW_TOLERANCE_MS = 1_000;

let offsetMs = 0;
let hydrated = false;

/** 首次读取时从存储恢复上次偏移（跨冷启动仍生效） */
function hydrate(): void {
  if (hydrated) return;
  hydrated = true;
  try {
    const raw = Taro.getStorageSync(OFFSET_KEY);
    const n = typeof raw === 'number' ? raw : Number(raw);
    if (Number.isFinite(n) && Math.abs(n) <= MAX_TRUSTED_SKEW_MS) {
      offsetMs = n;
    }
  } catch {
    /* 读不到即保持 0：等价于未校正 */
  }
}

function persist(value: number): void {
  try {
    Taro.setStorageSync(OFFSET_KEY, value);
  } catch {
    /* 落盘失败不影响本次会话（内存已生效） */
  }
}

/**
 * 当前时间（已按服务器时钟校正）。未同步到偏移时等价 `Date.now()`。
 * 所有 TTL 判断（cache-store / membership-cache）都应使用它。
 */
export function serverNow(): number {
  hydrate();
  return Date.now() + offsetMs;
}

/** 当前偏移量（毫秒；正数 = 设备时钟偏慢）。诊断用。 */
export function getServerClockOffsetMs(): number {
  hydrate();
  return offsetMs;
}

/**
 * 用一次 HTTP 响应的 `Date` 头校正时钟。静默失败：
 * 无头 / 非字符串 / 解析失败 / 超限 → 保持现状（不抛错、不影响请求链路）。
 */
export function syncServerClock(header?: Record<string, unknown> | null): void {
  if (!header) return;
  const raw = header.Date ?? header.date;
  if (typeof raw !== 'string' || !raw) return;
  const serverAt = Date.parse(raw);
  if (!Number.isFinite(serverAt)) return;

  const skew = serverAt - Date.now();
  if (Math.abs(skew) > MAX_TRUSTED_SKEW_MS) return;

  hydrate();
  const next = Math.abs(skew) <= SKEW_TOLERANCE_MS ? 0 : skew;
  if (next === offsetMs) return;
  offsetMs = next;
  persist(next);
}
