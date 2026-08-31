/**
 * 补课预约 Service
 */
import Taro from '@tarojs/taro';
import type { MakeupBooking } from '@/types/makeup-booking';

function storageKey(classId: string, lessonDate: string) {
  return `yunce:makeup:${classId}:${lessonDate}`;
}

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
  // 真实联调阶段：本地暂存，点名页可读；后端表就绪后改走 API
  const booking: MakeupBooking = {
    id: `makeup-local-${Date.now()}`,
    student_id: params.studentId,
    class_id: params.classId,
    lesson_date: params.lessonDate,
    start_time: params.startTime,
    end_time: params.endTime,
    teacher_id: params.teacherId || '',
    teacher_name: params.teacherName,
    source: params.source,
    leave_request_id: params.leaveRequestId,
    original_class_id: params.originalClassId,
    note: params.note,
    status: 'confirmed',
    created_by: params.createdBy,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  try {
    const key = storageKey(params.classId, params.lessonDate);
    const raw = Taro.getStorageSync(key);
    const list: MakeupBooking[] = raw ? JSON.parse(String(raw)) : [];
    if (!list.some((b) => b.student_id === booking.student_id && b.status === 'confirmed')) {
      list.unshift(booking);
      Taro.setStorageSync(key, JSON.stringify(list));
    }
  } catch {
    /* ignore storage errors */
  }
  return booking;
}

export async function getMakeupBookingsByClassDate(params: {
  classId: string;
  lessonDate: string;
}): Promise<MakeupBooking[]> {
  try {
    const raw = Taro.getStorageSync(storageKey(params.classId, params.lessonDate));
    const list: MakeupBooking[] = raw ? JSON.parse(String(raw)) : [];
    return list.filter((b) => b.status === 'confirmed');
  } catch {
    return [];
  }
}

export const makeupBookingService = {
  create: createMakeupBooking,
  getByClassDate: getMakeupBookingsByClassDate,
};
