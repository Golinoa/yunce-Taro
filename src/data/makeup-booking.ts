/**
 * 补课预约 Mock
 */
import { CLASSES, STUDENTS } from '@/data/mock-database';
import type { MakeupBooking } from '@/types/makeup-booking';

const delay = (ms = 80) => new Promise((r) => setTimeout(r, ms));

/** 运行时补课预约表（与 mock-database 同生命周期） */
export const MAKEUP_BOOKINGS: MakeupBooking[] = [];

function nextId() {
  return `makeup-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export async function mockCreateMakeupBooking(params: {
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
  await delay();
  const student = STUDENTS.find((s) => s.id === params.studentId);
  const cls = CLASSES.find((c) => c.id === params.classId);

  // 同班同日同学员去重：已有有效预约则直接返回
  const existing = MAKEUP_BOOKINGS.find(
    (b) =>
      b.status === 'confirmed' &&
      b.student_id === params.studentId &&
      b.class_id === params.classId &&
      b.lesson_date === params.lessonDate,
  );
  if (existing) return existing;

  const booking: MakeupBooking = {
    id: nextId(),
    student_id: params.studentId,
    student_name: student?.name,
    class_id: params.classId,
    class_name: cls?.name,
    campus_id: cls?.campusId || student?.campusId,
    lesson_date: params.lessonDate,
    start_time: params.startTime,
    end_time: params.endTime,
    teacher_id: params.teacherId || cls?.teacherId || '',
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
  MAKEUP_BOOKINGS.unshift(booking);
  return booking;
}

export async function mockGetMakeupBookingsByClassDate(params: {
  classId: string;
  lessonDate: string;
}): Promise<MakeupBooking[]> {
  await delay();
  return MAKEUP_BOOKINGS.filter(
    (b) =>
      b.status === 'confirmed' &&
      b.class_id === params.classId &&
      b.lesson_date === params.lessonDate,
  );
}

export async function mockGetMakeupBookingsByTeacher(
  teacherId: string,
  params?: { startDate?: string; endDate?: string },
): Promise<MakeupBooking[]> {
  await delay();
  return MAKEUP_BOOKINGS.filter((b) => {
    if (b.status !== 'confirmed') return false;
    if (b.teacher_id !== teacherId) return false;
    if (params?.startDate && b.lesson_date < params.startDate) return false;
    if (params?.endDate && b.lesson_date > params.endDate) return false;
    return true;
  });
}

export async function mockCancelMakeupBooking(id: string): Promise<boolean> {
  await delay();
  const target = MAKEUP_BOOKINGS.find((b) => b.id === id);
  if (!target) return false;
  target.status = 'cancelled';
  target.updated_at = new Date().toISOString();
  return true;
}
