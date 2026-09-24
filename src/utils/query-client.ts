/**
 * 全局 QueryClient 单例
 *
 * 以前 QueryClient 在 app.tsx 内部创建，切校区 / 切机构 / 登出时拿不到实例，
 * 无法用 TanStack 的 invalidateQueries 清缓存 —— 只有 zustand 缓存被清，
 * 于是「切了校区列表还是旧数据」（2026-09-24 修复）。
 * 这里提到模块级单例：app.tsx 注入同一个实例，resetDomainCaches 可直接失效其缓存。
 */
import { QueryClient } from '@tanstack/react-query';

/** 全局查询默认 stale 时间（与首页同源 30s） */
export const QUERY_STALE_TIME_MS = 30_000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: QUERY_STALE_TIME_MS,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: false,
    },
  },
});
