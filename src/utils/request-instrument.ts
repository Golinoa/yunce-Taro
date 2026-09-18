/**
 * 请求度量仪表（P0 取证用）
 *
 * 设计原则：**只观测、不干预**。
 * - 仅在请求发起时记录「url / method / 起始时间戳」，**不改变请求参数、返回值与错误行为**；
 * - 数据只存在于内存（环形缓冲，默认 200 条），**不写本地存储、不发网络**；
 * - 不读任何业务状态，页面卸载不影响。
 *
 * 用途（对应评估方案 v2 的 L2/L5/L9）：
 * 1. 统计「同一 URL+参数在单次停留内被触发几次」→ 判断重复触发（须结合触发源分析）；
 * 2. 按时间排序观察请求是否串行（串行深度 >2 记为瀑布嫌疑）；
 * 3. 结合 `markFirstScreen` 与启动时刻，计算首屏耗时与首屏请求数。
 *
 * 注意：本文件**不是缓存、不是去重**，它只是把现状变得可观测。
 */

export interface RequestRecord {
  url: string;
  method: string;
  /** 发起时刻（Date.now()） */
  startAt: number;
}

/** 环形缓冲上限：够分析一次会话，又不占内存 */
const MAX_RECORDS = 200;

let records: RequestRecord[] = [];
let firstScreenAt: number | null = null;

/** 记录一次请求发起（由 request.ts 调用） */
export function beginRequest(url: string, method: string): void {
  records.push({ url, method, startAt: Date.now() });
  if (records.length > MAX_RECORDS) {
    records.shift();
  }
}

/** 导出快照（按顺序，便于看串行关系） */
export function dumpRequests(): RequestRecord[] {
  return records.map((r) => ({ ...r }));
}

/** 按 url 聚合计数（用于「重复触发」判据；只看起始时间窗内的记录） */
export function countByUrl(sinceTs?: number): Array<{ url: string; count: number }> {
  const scoped =
    typeof sinceTs === 'number' ? records.filter((r) => r.startAt >= sinceTs) : records;
  const map = new Map<string, number>();
  for (const r of scoped) {
    map.set(r.url, (map.get(r.url) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([url, count]) => ({ url, count }))
    .sort((a, b) => b.count - a.count);
}

/** 清空（重新取证时用） */
export function clearRequests(): void {
  records = [];
  firstScreenAt = null;
}

/**
 * 标记「首屏渲染完成」。
 * 惰性：只记第一次，重复调用无副作用。
 */
export function markFirstScreen(at: number = Date.now()): void {
  if (firstScreenAt === null) {
    firstScreenAt = at;
  }
}

/** 取首屏完成时刻（未完成返回 null） */
export function getFirstScreenAt(): number | null {
  return firstScreenAt;
}

/**
 * 冷启动窗口概括：给出「启动 → 首屏完成」期间的请求数与耗时。
 * @param bootAt 冷启动时刻（可由 launch-scene 的 markAppColdStart 提供）
 */
export function summarizeColdStart(bootAt?: number | null): {
  bootAt: number | null;
  firstScreenAt: number | null;
  firstScreenMs: number | null;
  requestCount: number;
  topUrls: Array<{ url: string; count: number }>;
} {
  const hasBoot = typeof bootAt === 'number' && bootAt > 0;
  const windowStart = hasBoot ? (bootAt as number) : null;
  const scoped = windowStart === null ? records : records.filter((r) => r.startAt >= windowStart);
  const firstScreenMs =
    hasBoot && firstScreenAt !== null ? firstScreenAt - (bootAt as number) : null;
  return {
    bootAt: hasBoot ? (bootAt as number) : null,
    firstScreenAt,
    firstScreenMs,
    requestCount: scoped.length,
    topUrls: countByUrl(windowStart ?? undefined).slice(0, 10),
  };
}
