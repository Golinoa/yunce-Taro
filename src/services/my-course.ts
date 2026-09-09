/**
 * 我的课程 Service
 *
 * 家长端「我的约课」：生产读 class-booking + private-bookings；本地仅作离线缓存。
 */

import { classBookingService } from '@/services/class-booking';
import { privateBookingService } from '@/services/private-booking';
import { logError } from '@/utils/logger';
import { updateParentBookingStatus } from '@/utils/parent-bookings';

export type MyCourseStatus = 'booked' | 'waiting' | 'pending_evaluate' | 'cancelled';

export interface MyCourseItem {
  id: string;
  /** 关联的预约记录 ID，用于跳转预约详情页 */
  bookingId: string;
  status: MyCourseStatus;
  courseName: string;
  teacherName: string;
  date: string;
  startTime: string;
  endTime: string;
  room?: string;
  campusName?: string;
  queuePosition?: number;
  evaluateDeadline?: string;
  source?: 'private' | 'local' | 'class';
}

function mapPrivateStatus(status: string): MyCourseStatus {
  if (status === 'cancelled') return 'cancelled';
  if (status === 'completed') return 'pending_evaluate';
  return 'booked';
}

function mapClassStatus(status: string, fulfillmentStatus?: string): MyCourseStatus {
  if (status === 'cancelled') return 'cancelled';
  if (status === 'pending') return 'waiting';
  if (fulfillmentStatus === 'completed') return 'pending_evaluate';
  if (fulfillmentStatus === 'leave') return 'cancelled';
  return 'booked';
}

export const myCourseService = {
  /** 获取我的课程列表 */
  getList: async (userId?: string): Promise<MyCourseItem[]> => {
    if (!userId) return [];

    const [privateResult, classResult] = await Promise.allSettled([
      privateBookingService.listMine(),
      classBookingService.listMyRecords(),
    ]);

    const privateItems: MyCourseItem[] =
      privateResult.status === 'fulfilled'
        ? privateResult.value.map((item) => ({
            id: item.id,
            bookingId: item.id,
            status: mapPrivateStatus(item.status),
            courseName: item.courseName || '私教课',
            teacherName: item.teacherName || '老师',
            date: item.lessonDate,
            startTime: item.startTime,
            endTime: item.endTime,
            source: 'private' as const,
          }))
        : [];
    if (privateResult.status === 'rejected') {
      logError('myCourse.listPrivate', privateResult.reason);
    }

    const classItems: MyCourseItem[] =
      classResult.status === 'fulfilled'
        ? classResult.value.map((item) => ({
            id: item.id,
            bookingId: item.id,
            status: mapClassStatus(item.status, item.fulfillment_status),
            courseName: item.slot.class_name || '团课',
            teacherName: item.slot.teacher_name || '老师',
            date: item.slot.lesson_date,
            startTime: item.slot.start_time,
            endTime: item.slot.end_time,
            room: item.slot.room || undefined,
            source: 'class' as const,
          }))
        : [];
    if (classResult.status === 'rejected') {
      logError('myCourse.listClass', classResult.reason);
    }

    const merged = [...privateItems, ...classItems];
    merged.sort((a, b) => `${b.date}${b.startTime}`.localeCompare(`${a.date}${a.startTime}`));
    return merged;
  },

  /** 取消预约/排队 */
  cancel: async (bookingId: string): Promise<void> => {
    let cancelledOnServer = false;
    try {
      await privateBookingService.cancel(bookingId);
      cancelledOnServer = true;
    } catch {
      /* not a private booking */
    }
    if (!cancelledOnServer) {
      try {
        await classBookingService.removeBookingRecord(bookingId);
        cancelledOnServer = true;
      } catch (error) {
        logError('myCourse.cancelClass', error);
      }
    }
    updateParentBookingStatus(bookingId, 'cancelled');
    if (!cancelledOnServer) {
      // 仅本地草稿被取消时不抛错；真源失败则已 log
    }
  },
};
