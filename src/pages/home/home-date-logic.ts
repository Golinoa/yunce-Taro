/**
 * 首页日期纯逻辑：本地时区 yyyy-mm-dd key（关系 dismiss、未点名提醒等共用）
 */

/** 当日日期 key（yyyy-mm-dd，本地时区）；可注入 now 便于单测 */
export function todayDateKey(now: Date = new Date()): string {
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${mm}-${dd}`;
}
