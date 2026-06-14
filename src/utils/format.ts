/**
 * 日期格式化工具函数
 */

/** 将日期字符串格式化为中文格式：2025年1月1日 */
export function formatDateCN(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}
