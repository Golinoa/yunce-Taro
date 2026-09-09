/**
 * 补课预约 Service
 */
import type { MakeupBooking } from '@/types/makeup-booking';
import { get, post } from '@/utils/request';

export async function createMakeupBooking(params: {
  studentId: string;
  classId: string;
  lessonDate: string;
  startTime: string;
  endTime: string;
  teacherId?: string;
  teacherName?: string;
  source: 'teacher' | 'parent';
  leaveRequestId?: string;
  originalClassId?: string;
  note?: string;
  createdBy: string;
}): Promise<MakeupBooking> {
  return post<MakeupBooking>('/makeup-bookings', {
    studentId: params.studentId,
    classId: params.classId,
    lessonDate: params.lessonDate,
    startTime: params.startTime,
    endTime: params.endTime,
    teacherId: params.teacherId,
    teacherName: params.teacherName,
    source: params.source,
    leaveRequestId: params.leaveRequestId,
    originalClassId: params.originalClassId,
    note: params.note,
  });
}

export async function getMakeupBookingsByClassDate(params: {
  classId: string;
  lessonDate: string;
}): Promise<MakeupBooking[]> {
  const data = await get<{ list: MakeupBooking[] }>('/makeup-bookings', {
    classId: params.classId,
    lessonDate: params.lessonDate,
  });
  return (data.list || []).filter((b) => b.status === 'confirmed');
}

export const makeupBookingService = {
  create: createMakeupBooking,
  getByClassDate: getMakeupBookingsByClassDate,
};
