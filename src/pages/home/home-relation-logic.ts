/**
 * 首页关系确认弹窗（R11）纯逻辑：当天 dismiss 判定
 */

/** 关系确认弹窗「暂不选择」当天不再弹的日期存储 key */
export const RELATION_DISMISS_KEY = 'yunce:relation-dismiss-date';

/** 存储值是否等于给定日期 key（表示当天已 dismiss） */
export function isRelationDismissedToday(storedDateKey: unknown, dateKey: string): boolean {
  return typeof storedDateKey === 'string' && storedDateKey === dateKey;
}
