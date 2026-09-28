/**
 * 课表卡片纯判定（Q2-1）
 *
 * 说明（2026-09-28）：原先这里还有一组「卡片操作可见性」函数
 * （`getCardActionVisibility` / `shouldShowCancelLessonAction` /
 * `shouldShowEditAndRescheduleButtons` / `shouldShowDeleteButton` /
 * `canCancelLessonButton` / `isPastScheduleDate`），它们只服务于**课表卡片左滑按钮**；
 * 左滑已整体移除（操作收口到点名页），这组函数随之删除。
 */
import type { ScheduleCardStatus } from '@/utils/schedule-card-status';
import type dayjs from 'dayjs';

/** 历史课：已过日期，或当日已下课/已点名 */
export function isHistoricalClassCard(
  status: ScheduleCardStatus,
  selectedDate: dayjs.Dayjs,
  now: dayjs.Dayjs,
): boolean {
  if (selectedDate.isBefore(now, 'day')) return true;
  return status === 'done' || status === 'ended';
}

/** 未开课（未来或今日未开始）：可约试听/补课 / 点名 / 编辑 */
export function isUpcomingClassCard(status: ScheduleCardStatus): boolean {
  return status === 'upcoming' || status === 'urgent';
}
