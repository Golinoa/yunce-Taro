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
  inFlight.set(key, promise);
  // 独立消费一次结果：保证无论调用方是否 catch，飞行态都会被清理
  void promise
    .catch(() => undefined)
    .then(() => {
      if (inFlight.get(key) === promise) inFlight.delete(key);
    });
  return promise;
}

/** 丢弃指定 key 的飞行态（切机构 / 登出等需要强制重拉的场合） */
export function clearSingleFlight(key?: string): void {
  if (key) {
    inFlight.delete(key);
    return;
  }
  inFlight.clear();
}
