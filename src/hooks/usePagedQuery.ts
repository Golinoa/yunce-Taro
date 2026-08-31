/**
 * 通用分页列表 Hook
 *
 * 约定（同类列表改造模板）：
 * - 首屏 pageSize 建议 20～30，禁止一次 pageSize=100/500 当「全部」
 * - 筛选变化必须 reload（page=1），服务端过滤优先于前端全量再滤
 * - 续拉用 loadMore + hasMore；参考 audit-log / 课包流水
 *
 * 优先改造清单：
 * P0 课包流水 getTransactions（已接入 usePagedQuery）
 * P1 教师维度全量：students/classes/schedules/lesson-records/getScheduledClassIds
 *     → 已改 fetchAllPages（API_PAGE_SIZE_BATCH）
 * P1.5 leave / packages / notifications / leads / teachers / campuses / temporary-reschedule
 *     → 已改 fetchAllPages
 * 配置型 getList（科目/场馆等 mock 或小配置）可保持；列表 UI 优先改 usePagedQuery 而非拉全
 */
import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { PaginatedResponse } from '@/utils/pagination';

export interface UsePagedQueryOptions<T> {
  pageSize?: number;
  /** 拉取某一页；page 从 1 开始 */
  fetcher: (page: number, pageSize: number) => Promise<PaginatedResponse<T> | { list: T[]; total: number }>;
  /** 为 false 时不自动请求（例如缺 userId） */
  enabled?: boolean;
}

export interface UsePagedQueryResult<T> {
  list: T[];
  total: number;
  page: number;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  reload: () => Promise<void>;
  loadMore: () => Promise<void>;
  setList: Dispatch<SetStateAction<T[]>>;
}

function normalizeResult<T>(
  res: PaginatedResponse<T> | { list: T[]; total: number },
): { list: T[]; total: number } {
  if ('pagination' in res && res.pagination) {
    return {
      list: res.list || [],
      total: res.pagination.total ?? res.list?.length ?? 0,
    };
  }
  return {
    list: res.list || [],
    total: 'total' in res ? res.total : res.list?.length ?? 0,
  };
}

export function usePagedQuery<T>(options: UsePagedQueryOptions<T>): UsePagedQueryResult<T> {
  const pageSize = options.pageSize ?? 30;
  const enabled = options.enabled !== false;
  const fetcherRef = useRef(options.fetcher);
  fetcherRef.current = options.fetcher;

  const [list, setList] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const hasMore = list.length < total;

  const reload = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const res = normalizeResult(await fetcherRef.current(1, pageSize));
      setList(res.list);
      setTotal(res.total);
      setPage(1);
    } finally {
      setLoading(false);
    }
  }, [enabled, pageSize]);

  const loadMore = useCallback(async () => {
    if (!enabled || loading || loadingMore || list.length >= total) return;
    const nextPage = page + 1;
    setLoadingMore(true);
    try {
      const res = normalizeResult(await fetcherRef.current(nextPage, pageSize));
      setList((prev) => [...prev, ...res.list]);
      setTotal(res.total);
      setPage(nextPage);
    } finally {
      setLoadingMore(false);
    }
  }, [enabled, loading, loadingMore, list.length, total, page, pageSize]);

  return {
    list,
    total,
    page,
    loading,
    loadingMore,
    hasMore,
    reload,
    loadMore,
    setList,
  };
}

export default usePagedQuery;
