/**
 * 全局 QueryClient 单例
 *
 * 以前 QueryClient 在 app.tsx 内部创建，切校区 / 切机构 / 登出时拿不到实例，
 * 无法用 TanStack 的 invalidateQueries 清缓存 —— 只有 zustand 缓存被清，
 * 于是「切了校区列表还是旧数据」（2026-09-24 修复）。
 * 这里提到模块级单例：app.tsx 注入同一个实例，resetDomainCaches 可直接失效其缓存。
 */
import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '@/utils/request';

/** 全局查询默认 stale 时间（与首页同源 30s） */
export const QUERY_STALE_TIME_MS = 30_000;

/**
 * 仅对「可重试」的瞬时失败做有限重试，绝不重试鉴权终态（401/403）：
 * - 网络/超时 → ApiError.code === -1
 * - 网关 429 限流 / 5xx 抖动 → 后端恢复后大概率成功，重试值得
 * - 401/403 是会话/权限终态，重试只会反复打后端、可能触发踢下线，必须跳过
 * 弱网下任一次抖动请求若直接失败，用户看到的是空白/报错；重试两次（指数退避）
 * 能显著抬高「抖一下就恢复」场景下的可用性，且不会放大鉴权失败。
 */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) return false;
  const code = error instanceof ApiError ? error.code : (error as { code?: number })?.code;
  if (code === 401 || code === 403) return false;
  return code === -1 || code === 429 || (typeof code === 'number' && code >= 500 && code < 600);
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: QUERY_STALE_TIME_MS,
      refetchOnWindowFocus: false,
      // 网络恢复后自动回源刷新（高可用）：弱网期间的缓存数据在重连后更新，
      // 不会一直停留在陈旧态；鉴权请求走 request 层单飞，不受 query 重试影响。
      refetchOnReconnect: true,
      retry: shouldRetry,
    },
  },
});
