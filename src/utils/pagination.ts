/** 后端 paginated() 统一分页响应 */
export interface PaginatedResponse<T> {
  list: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

/** 与后端 list validator max 对齐，单页勿超过此值 */
export const API_PAGE_SIZE_MAX = 100;
/** 需要「分类/教师下全量」时的分批页大小（≤ max） */
export const API_PAGE_SIZE_BATCH = 50;

export function unwrapPaginatedList<T>(
  data: PaginatedResponse<T> | T[] | null | undefined,
): T[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return data.list ?? [];
}

/** 把接口返回规范成 PaginatedResponse，便于 fetchAllPages */
export function asPaginatedResponse<T>(
  data: PaginatedResponse<T> | T[] | null | undefined,
  page: number,
  pageSize: number,
): PaginatedResponse<T> {
  if (!data) {
    return { list: [], pagination: { page, pageSize, total: 0, totalPages: 1 } };
  }
  if (Array.isArray(data)) {
    return {
      list: data,
      pagination: { page, pageSize, total: data.length, totalPages: 1 },
    };
  }
  return {
    list: data.list ?? [],
    pagination: data.pagination ?? {
      page,
      pageSize,
      total: data.list?.length ?? 0,
      totalPages: 1,
    },
  };
}

/**
 * 分批拉完分页接口（前后端一致：每页 ≤ API_PAGE_SIZE_MAX）。
 * 用于「必须拿到某分类/教师下全部数据」的场景，禁止一次 pageSize=100/500 假全量。
 */
export async function fetchAllPages<T>(
  fetchPage: (page: number, pageSize: number) => Promise<PaginatedResponse<T>>,
  pageSize: number = API_PAGE_SIZE_BATCH,
): Promise<T[]> {
  const size = Math.min(Math.max(1, pageSize), API_PAGE_SIZE_MAX);
  const first = await fetchPage(1, size);
  const totalPages = Math.max(1, first.pagination?.totalPages || 1);
  const all = [...(first.list || [])];
  for (let page = 2; page <= totalPages; page += 1) {
    const next = await fetchPage(page, size);
    all.push(...(next.list || []));
  }
  return all;
}

export function formatApiDate(value: unknown): string {
  if (value == null || value === '') return '';
  if (typeof value === 'string') return value.slice(0, 10);
  return String(value).slice(0, 10);
}

export function formatApiDateTime(value: unknown): string {
  if (value == null || value === '') return '';
  if (typeof value === 'string') return value;
  return new Date(String(value)).toISOString();
}
