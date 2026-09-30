/**
 * 日期格式化工具函数
 */

/** 将日期字符串格式化为中文格式：2025年1月1日 */
export function formatDateCN(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

/**
 * 当前月份键，格式 YYYY-MM（后端 data-center 详情的 month 参数要求）。
 * 例：2026-09
 */
export function currentMonthKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** 今天，格式 YYYY-MM-DD（data-center 详情接口的 date 锚点参数） */
export function currentDateKey(date: Date = new Date()): string {
  return `${currentMonthKey(date)}-${String(date.getDate()).padStart(2, '0')}`;
}

/** 解析 YYYY-MM-DD；缺省或非法一律回落到今天 */
export function parseDateKey(key?: string): Date {
  if (key && /^\d{4}-\d{2}-\d{2}$/.test(key)) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date();
}

/**
 * 把日期 Picker 的返回值补全为完整锚点 YYYY-MM-DD。
 * Picker 的 fields 决定返回粒度：年 → "2026"、月 → "2026-09"、日 → "2026-09-29"。
 */
export function normalizeAnchorValue(value: string): string {
  const parts = (value || '').split('-').filter(Boolean);
  if (parts.length >= 3)
    return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
  if (parts.length === 2) return `${parts[0]}-${parts[1].padStart(2, '0')}-01`;
  if (parts.length === 1 && /^\d{4}$/.test(parts[0])) return `${parts[0]}-01-01`;
  return currentDateKey();
}

/**
 * 按统计周期生成日历文案（进入页面即"选中当月"，选中项随锚点变化）。
 * - day   → 2026年9月29日
 * - month → 2026年9月
 * - year  → 2026年
 */
export function formatPeriodDateText(
  period: 'day' | 'month' | 'year',
  anchor: Date = new Date(),
): string {
  const y = anchor.getFullYear();
  const m = anchor.getMonth() + 1;
  if (period === 'day') return `${y}年${m}月${anchor.getDate()}日`;
  if (period === 'month') return `${y}年${m}月`;
  return `${y}年`;
}

/**
 * 格式化金额：最多保留 2 位小数，去除末尾多余的 0
 * - 1300.00 → "1300"
 * - 1300.10 → "1300.1"
 * - 1300.01 → "1300.01"
 * - 1300.011 → "1300.01"
 */
export function formatAmount(value: number): string {
  return parseFloat(value.toFixed(2)).toString();
}
