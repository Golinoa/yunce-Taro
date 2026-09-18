/**
 * 并发去重（single-flight）：同一 key 的请求在飞行中时复用同一个 Promise。
 *
 * 解决的问题：页面 useEffect 与 useDidShow 存在竞态——useEffect 发起请求后
 * 尚未 markFetched，useDidShow 判定"未拉取"会再发一次；登录后多处预取叠加
 * 也会让同一接口在同一瞬间被调用多次。
 *
 * 契约：只合并并发，不缓存结果。数据新鲜度仍由 utils/data-freshness.ts 的
 * TTL 控制——响应返回即从表中移除，下次调用照常发请求。
 */

const inFlight = new Map<string, Promise<unknown>>();

export function singleFlight<T>(key: string, task: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key);
  if (existing) return existing as Promise<T>;

  const promise = task();
  // 用 finally 把「清理飞行态」并进返回 Promise 的 settle 链：
  // 调用方 await 到结果时该 key 必已从表中移除 —— 保证「只合并并发、不缓存结果」。
  // （改用 .then 清理会排在调用方 await 之后，紧接着的第二次调用会误命中旧结果。）
  const tracked = promise.finally(() => {
    if (inFlight.get(key) === tracked) inFlight.delete(key);
  });
  inFlight.set(key, tracked);
  return tracked;
}

/** 丢弃指定 key 的飞行态（切机构 / 登出等需要强制重拉的场合） */
export function clearSingleFlight(key?: string): void {
  if (key) {
    inFlight.delete(key);
    return;
  }
  inFlight.clear();
}
