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
 * 格式化金额：最多保留 2 位小数，去除末尾多余的 0
 * - 1300.00 → "1300"
 * - 1300.10 → "1300.1"
 * - 1300.01 → "1300.01"
 * - 1300.011 → "1300.01"
 */
export function formatAmount(value: number): string {
  return parseFloat(value.toFixed(2)).toString();
}
