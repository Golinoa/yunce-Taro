/**
 * 补课预约 Service
 */
import type { MakeupBooking } from '@/types/makeup-booking';
import { get, post } from '@/utils/request';
import { normalizeLessonStartTime } from '@/utils/schedule-card-build';

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
  /** 本节的开始时段（`09:00`）；给了就只认落在这一节的预约 */
  startTime?: string;
}): Promise<MakeupBooking[]> {
  const data = await get<{ list: MakeupBooking[] }>('/makeup-bookings', {
    classId: params.classId,
    lessonDate: params.lessonDate,
  });
  // 防御过滤：补课预约必须严格落在请求的这节课（class_id + lesson_date）。
  // 不能只信后端的 lessonDate 过滤——若线上后端旧版本忽略该参数返回了全量预约，
  // 名单合并处会把其他日期的补课学员并进本节课，表现为「补课作用于整条排课规则」。
  //
  // 同班同一天还可能排多节课（09:00 与 14:00）：只按班级+日期会把同一天**另一节课**
  // 的补课学员也并进来。调用方给了 startTime 时再收窄到本节；拿不到本节时段
  // （例如从班级列表进入点名页）时保持原行为，不误伤。
  const targetStartTime = normalizeLessonStartTime(params.startTime);
  return (data.list || []).filter(
    (b) =>
      b.status === 'confirmed' &&
      b.lesson_date === params.lessonDate &&
      (!targetStartTime || normalizeLessonStartTime(b.start_time) === targetStartTime),
  );
}

export const makeupBookingService = {
  create: createMakeupBooking,
  getByClassDate: getMakeupBookingsByClassDate,
};
