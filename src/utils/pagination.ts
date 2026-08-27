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

export function unwrapPaginatedList<T>(
  data: PaginatedResponse<T> | T[] | null | undefined,
): T[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return data.list ?? [];
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
