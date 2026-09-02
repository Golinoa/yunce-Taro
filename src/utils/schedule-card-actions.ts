/**
 * 课表卡片操作可见性纯函数（Q2-1）
 *
 * 从 pages/schedule/index.tsx 抽出：过去/非过去日期下的取消、编辑改期、删除按钮规则。
 */
import type dayjs from 'dayjs';
import type { ScheduleCardStatus } from '@/utils/schedule-card-status';

/** 按钮可见性判断所需的最小卡片字段 */
export interface ScheduleCardActionFields {
  canCancelLesson: boolean;
  isTemporaryAdjusted?: boolean;
  startTime: string;
  status: ScheduleCardStatus;
}

export function isPastScheduleDate(selectedDate: dayjs.Dayjs, now: dayjs.Dayjs): boolean {
  return selectedDate.isBefore(now, 'day');
}

export function canCancelLessonButton(
  selectedDate: dayjs.Dayjs,
  startTime: string,
  now: dayjs.Dayjs,
): boolean {
  void startTime;
  return !isPastScheduleDate(selectedDate, now);
}

export function shouldShowCancelLessonAction(
  item: Pick<ScheduleCardActionFields, 'canCancelLesson' | 'status' | 'startTime'>,
  selectedDate: dayjs.Dayjs,
  now: dayjs.Dayjs,
): boolean {
  if (!item.canCancelLesson || item.status === 'cancelled' || item.status === 'done') {
    return false;
  }
  return canCancelLessonButton(selectedDate, item.startTime, now);
}

export function shouldShowEditAndRescheduleButtons(
  selectedDate: dayjs.Dayjs,
  startTime: string,
  now: dayjs.Dayjs,
  isTemporaryAdjusted: boolean,
  status: ScheduleCardStatus,
): boolean {
  void startTime;
  void isTemporaryAdjusted;
  if (status === 'done' || status === 'cancelled') {
    return false;
  }
  return !isPastScheduleDate(selectedDate, now);
}

export function shouldShowDeleteButton(
  selectedDate: dayjs.Dayjs,
  startTime: string,
  now: dayjs.Dayjs,
  isTemporaryAdjusted: boolean,
): boolean {
  void selectedDate;
  void startTime;
  void now;
  void isTemporaryAdjusted;
  return true;
}

export function getCardActionVisibility(
  item: Pick<ScheduleCardActionFields, 'canCancelLesson' | 'isTemporaryAdjusted' | 'startTime' | 'status'>,
  selectedDate: dayjs.Dayjs,
  now: dayjs.Dayjs,
) {
  return {
    canManageBeforeStart: !isPastScheduleDate(selectedDate, now),
    showEditAndReschedule: shouldShowEditAndRescheduleButtons(
      selectedDate,
      item.startTime,
      now,
      Boolean(item.isTemporaryAdjusted),
      item.status,
    ),
    showCancelLesson: shouldShowCancelLessonAction(item, selectedDate, now),
    showDelete: shouldShowDeleteButton(
      selectedDate,
      item.startTime,
      now,
      Boolean(item.isTemporaryAdjusted),
    ),
  };
}

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
