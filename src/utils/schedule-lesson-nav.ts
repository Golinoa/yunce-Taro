/**
 * 课表 → 点名/消课页导航（Q2-1）
 * 统一 URL 与前置校验，避免 pages/schedule 内多处手拼 query。
 */
import type dayjs from 'dayjs';
import { canOperateHistoricalLesson } from '@/utils/schedule-guard';
import {
  isHistoricalClassCard,
  type ScheduleCardActionFields,
} from '@/utils/schedule-card-actions';
import type { ScheduleCardStatus } from '@/utils/schedule-card-status';

export type LessonFormNavFields = {
  id: string;
  classId?: string;
  hasTrialStudent?: boolean;
  status: ScheduleCardStatus;
  bookingTag?: string;
};

export type LessonFormNavParams = {
  scheduleId?: string;
  classId: string;
  lessonDate: string;
  lessonTime?: string;
  hasTrialStudent?: boolean;
  action?: 'supplement';
  viewOnly?: boolean;
};

export function buildLessonFormPath(params: LessonFormNavParams): string {
  const query = [
    `classId=${encodeURIComponent(params.classId)}`,
    `lessonDate=${encodeURIComponent(params.lessonDate)}`,
  ];
  if (params.scheduleId) {
    query.unshift(`scheduleId=${encodeURIComponent(params.scheduleId)}`);
  }
  if (params.lessonTime) {
    query.push(`lessonTime=${encodeURIComponent(params.lessonTime)}`);
  }
  if (params.hasTrialStudent) {
    query.push('hasTrialStudent=1');
  }
  if (params.action === 'supplement') {
    query.push('action=supplement');
  }
  if (params.viewOnly) {
    query.push('viewOnly=1');
  }
  return `/package-course/pages/lesson-form/index?${query.join('&')}`;
}

export function validateSupplementNav(
  item: Pick<LessonFormNavFields, 'classId' | 'status'>,
  actionDate: dayjs.Dayjs,
  now: dayjs.Dayjs,
): string | null {
  if (!item.classId) return '当前课程缺少班级信息';
  if (item.status === 'cancelled') return '已取消课程无法补录';
  if (!isHistoricalClassCard(item.status, actionDate, now)) return '未下课课程请先点名';
  if (!canOperateHistoricalLesson(actionDate, now)) return '已超过 30 天补录期限';
  return null;
}

export function validateRollCallNav(
  item: Pick<LessonFormNavFields, 'status'>,
  actionDate: dayjs.Dayjs,
  now: dayjs.Dayjs,
): string | null {
  if (item.status === 'cancelled') return '已取消课程无法点名';
  if (isHistoricalClassCard(item.status, actionDate, now)) return '历史课程请使用补录';
  return null;
}

export function validateOpenSlotRollCallNav(slot: {
  status?: string;
  class_id?: string;
}): string | null {
  if (slot.status === 'rest') return '休息时段无法点名';
  if (!slot.class_id) return '当前时段缺少班级信息';
  return null;
}

export type SchedulePrimaryActionKind = 'booking' | 'supplement' | 'view' | 'checkin';

export function resolveSchedulePrimaryActionKind(
  item: Pick<LessonFormNavFields, 'bookingTag' | 'status'>,
  actionDate: dayjs.Dayjs,
  now: dayjs.Dayjs,
): SchedulePrimaryActionKind {
  if (item.bookingTag) return 'booking';
  if (isHistoricalClassCard(item.status, actionDate, now)) {
    return canOperateHistoricalLesson(actionDate, now) ? 'supplement' : 'view';
  }
  return 'checkin';
}

export function buildSupplementLessonFormPath(
  item: LessonFormNavFields,
  actionDate: dayjs.Dayjs,
): string {
  return buildLessonFormPath({
    scheduleId: item.id,
    classId: item.classId || '',
    lessonDate: actionDate.format('YYYY-MM-DD'),
    hasTrialStudent: item.hasTrialStudent,
    action: item.status === 'done' ? 'supplement' : undefined,
  });
}

export function buildViewOnlyLessonFormPath(
  item: LessonFormNavFields,
  actionDate: dayjs.Dayjs,
): string {
  return buildLessonFormPath({
    scheduleId: item.id,
    classId: item.classId || '',
    lessonDate: actionDate.format('YYYY-MM-DD'),
    hasTrialStudent: item.hasTrialStudent,
    viewOnly: true,
  });
}

export function buildCheckinLessonFormPath(
  item: LessonFormNavFields,
  actionDate: dayjs.Dayjs,
): string {
  return buildLessonFormPath({
    scheduleId: item.id,
    classId: item.classId || '',
    lessonDate: actionDate.format('YYYY-MM-DD'),
    hasTrialStudent: item.hasTrialStudent,
  });
}

export function buildOpenSlotRollCallPath(slot: {
  class_id: string;
  lesson_date: string;
  start_time: string;
  opened_schedule_id?: string;
}): string {
  return buildLessonFormPath({
    scheduleId: slot.opened_schedule_id || undefined,
    classId: slot.class_id,
    lessonDate: slot.lesson_date,
    lessonTime: slot.start_time,
  });
}

export function buildScheduleFormEditPath(scheduleId: string): string {
  return `/package-course/pages/schedule-form/index?id=${encodeURIComponent(scheduleId)}`;
}

export function buildScheduleFormReschedulePath(
  scheduleId: string,
  lessonDate: string,
): string {
  return (
    `/package-course/pages/schedule-form/index?id=${encodeURIComponent(scheduleId)}` +
    `&mode=reschedule&lessonDate=${encodeURIComponent(lessonDate)}`
  );
}

export function buildBookingPagePath(date: string): string {
  return `/package-course/pages/booking/index?date=${encodeURIComponent(date)}`;
}

/** 编辑前校验文案；null 表示可跳转 */
export function validateEditScheduleNav(
  item: Pick<ScheduleCardActionFields, 'canCancelLesson' | 'isTemporaryAdjusted' | 'startTime' | 'status'>,
  selectedDate: dayjs.Dayjs,
  now: dayjs.Dayjs,
  visibility: { showEditAndReschedule: boolean },
): string | null {
  if (isHistoricalClassCard(item.status, selectedDate, now)) {
    return '历史课程不支持编辑';
  }
  if (!visibility.showEditAndReschedule) {
    return '当前课程不支持编辑';
  }
  return null;
}
