/**
 * 排课规则「这一天还算不算数」的唯一真源（用户口径 2026-10-01）
 *
 * ## 背景：规则被删除后，历史课表不能跟着消失
 *
 * 课表卡片是**按规则推导**出来的：`buildScheduleCardsForDate` 取 `dayOfWeek` 命中的规则逐条展开成卡片。
 * 所以只要规则没了（物理删除），这条规则在**所有日期**上的卡片都会消失 —— 包括**已经上过课、已经点过名**的过去日期。
 * 而 `LessonRecord` 兜不住这件事：记录只有 `lessonDate` + `duration`，**没有时段列**，
 * 重建不出卡片要显示的 `HH:mm-HH:mm`。⇒ **历史卡片只能靠规则本身存活**。
 *
 * 因此「删除排课」改为**软停止**（后端 `deleteSchedule` 写 `status='STOPPED' + stoppedAt`），
 * 而所有按日期展开课次的读取端都必须用本函数收窄：**日期 ≤ stoppedAt 才出课**。
 *
 * ## 与后端的口径对齐（不要另立一套）
 *
 * 后端 `schedule.service.ts` 里早就这么判：
 * `OR: [{ status: 'ACTIVE' }, { status: 'STOPPED', stoppedAt: { gte: targetDate } }]`（`getTodaySchedule`）
 * 与周视图的 `s.status === 'ACTIVE' || (s.status === 'STOPPED' && d <= s.stoppedAt)`，以及 `dateRangeFilter`。
 *
 * ## 边界（都是有意选择）
 *
 * - **只认 `STOPPED`**：`PAUSED`（暂停）不在本函数管辖内（后端对 PAUSED 是整体不出课，口径另议）。
 * - **缺 `stopped_at` 不拦**：老数据可能只有 status 没时刻 ⇒ 宁可多显示（与「宁可多显示，不能吞记录」同一条原则）。
 * - **按「天」比较**：`stoppedAt` 是时刻（删除那一秒），当天仍算出课 —— 与后端 `d <= stoppedAt` 一致。
 */
import type { ScheduleRuleStatus } from '@/types/schedule';
import type dayjs from 'dayjs';

/** 判定所需的最小字段（Schedule 的真子集，便于单测与跨模块复用） */
export interface ScheduleRuleEffectiveLike {
  rule_status?: ScheduleRuleStatus;
  stopped_at?: string;
  /** 规则生效首日（排课表单「开始日期」，默认今天）；空缺 = 不设下限 */
  start_date?: string;
  /** 规则生效末日（排课表单「结束日期」/按次数结束）；空缺 = 不设上限 */
  end_date?: string;
}

/** 取日期部分（`2026-10-01T12:00:00.000Z` / `2026-10-01` → `2026-10-01`） */
function toDatePart(value: string): string {
  return (value || '').trim().slice(0, 10);
}

/**
 * 这条排课规则在 `date` 这天是否仍然成立（还应该有课）。
 *
 * 两道收窄，缺一不可：
 *
 * 1. **规则有效期**：`start_date ≤ 日期 ≤ end_date`（空缺不设限）—— 与后端 `dateRangeFilter` 同口径。
 *    后端早就这么收窄（首页今日课表 / 周视图），而前端卡片此前完全忽略 ⇒ 两种可见问题：
 *    - 设了「开始日期 = 下月」的规则，本周课表就已经排上了（与首页今日课表打架）；
 *    - **"删了规则再重建"**：新规则的 `start_date` 是**今天**，不收窄 ⇒ 历史日期会同时渲染
 *      **老（已停止）+ 新** 两条规则 ⇒ 同一节课出现两张卡片。
 *
 * 2. **删除 / 停止**：`STOPPED` 的规则只在 `stopped_at` 当天及更早成立（历史保留、以后不再排）。
 *
 * @param rule 含 `rule_status` / `stopped_at` / `start_date` / `end_date` 的规则
 * @param date 目标日期：`dayjs` 对象或 `YYYY-MM-DD` 字符串（兼容两种调用方）
 */
export function isScheduleRuleEffectiveOnDate(
  rule: ScheduleRuleEffectiveLike,
  date: dayjs.Dayjs | string,
): boolean {
  const target =
    typeof date === 'string' ? toDatePart(date) : toDatePart(date.format('YYYY-MM-DD'));

  // ① 规则有效期（两段都是 `YYYY-MM-DD`，字典序即时间序）
  const start = toDatePart(rule.start_date || '');
  if (start && target < start) return false;
  const end = toDatePart(rule.end_date || '');
  if (end && target > end) return false;

  // ② 删除 / 停止
  if (rule.rule_status !== 'STOPPED') return true;

  const stoppedDate = toDatePart(rule.stopped_at || '');
  if (!stoppedDate) return true;

  return target <= stoppedDate;
}
