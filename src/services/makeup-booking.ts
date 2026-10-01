/**
 * 补课预约 Service
 */
import type { MakeupBooking } from '@/types/makeup-booking';
import { isBookingOfLesson } from '@/utils/lesson-identity';
import { get, post } from '@/utils/request';

/**
 * 后端响应（camelCase）→ 前端 `MakeupBooking`（snake_case）。
 *
 * ⚠️ 早先这里**直接把响应当成前端类型用**（没有任何映射），但后端 `mapBooking`
 * 返回的是 camelCase（`lessonDate` / `startTime` / `studentId`…），前端类型是 snake_case
 * ⇒ `b.lesson_date` / `b.start_time` 恒为 undefined，
 * 下面 `getByClassDate` 的防御过滤（`b.lesson_date === params.lessonDate`）会把
 * **所有补课预约过滤掉** —— 表现为「补课学员从不出现在点名名单」。
 */
const mapBackendMakeupBooking = (row: {
  id: string;
  studentId: string;
  classId: string;
  campusId?: string | null;
  lessonDate: string;
  startTime: string;
  endTime: string;
  teacherId?: string | null;
  teacherName?: string | null;
  source?: string | null;
  leaveRequestId?: string | null;
  originalClassId?: string | null;
  /** 属于哪一节（排课编号）；家长请假生成的补课为 null */
  scheduleId?: string | null;
  note?: string | null;
  status?: string | null;
  createdBy?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}): MakeupBooking => ({
  id: row.id,
  student_id: row.studentId,
  class_id: row.classId,
  campus_id: row.campusId ?? undefined,
  lesson_date: row.lessonDate,
  start_time: row.startTime,
  end_time: row.endTime,
  teacher_id: row.teacherId ?? '',
  teacher_name: row.teacherName ?? undefined,
  source: (row.source as MakeupBooking['source']) ?? 'teacher',
  leave_request_id: row.leaveRequestId ?? undefined,
  original_class_id: row.originalClassId ?? undefined,
  schedule_id: row.scheduleId ?? null,
  note: row.note ?? undefined,
  status: (row.status as MakeupBooking['status']) ?? 'confirmed',
  created_by: row.createdBy ?? '',
  created_at: row.createdAt ?? '',
  updated_at: row.updatedAt ?? '',
});

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
  /**
   * 「哪一节」的排课编号（课表卡片的 `id`）。
   * 传了之后，即使这节课后来被同日调课改了时段，预约仍认得它（编号不变）。
   * 家长请假自动生成的补课拿不到 ⇒ 不传，读取端按「班级+日期+时段」兜底。
   */
  scheduleId?: string;
  note?: string;
  createdBy: string;
}): Promise<MakeupBooking> {
  const created = await post<Record<string, unknown>>('/makeup-bookings', {
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
    scheduleId: params.scheduleId,
    note: params.note,
  });
  return mapBackendMakeupBooking(created as Parameters<typeof mapBackendMakeupBooking>[0]);
}

export async function getMakeupBookingsByClassDate(params: {
  classId: string;
  lessonDate: string;
  /** 本节的开始时段（`09:00`）；给了就只认落在这一节的预约 */
  startTime?: string;
  /**
   * 本节所属排课编号。给了就按**编号优先**判定（同日调课改了时段也不会失配），
   * 没给就只按时段兜底（老预约 / 从班级列表入口）。
   */
  scheduleId?: string;
}): Promise<MakeupBooking[]> {
  const data = await get<{ list: Record<string, unknown>[] }>('/makeup-bookings', {
    classId: params.classId,
    lessonDate: params.lessonDate,
  });
  const rows = (data.list || []).map((row) =>
    mapBackendMakeupBooking(row as Parameters<typeof mapBackendMakeupBooking>[0]),
  );
  // 防御过滤：补课预约必须严格落在请求的这节课（class_id + lesson_date）。
  // 不能只信后端的 lessonDate 过滤——若线上后端旧版本忽略该参数返回了全量预约，
  // 名单合并处会把其他日期的补课学员并进本节课，表现为「补课作用于整条排课规则」。
  //
  // 同班同一天还可能排多节课（09:00 与 14:00）：只按班级+日期会把同一天**另一节课**
  // 的补课学员也并进来 ⇒「哪一节」统一走真源 `isBookingOfLesson`（编号优先、时段兜底）。
  // 拿了本节编号后，即使这节课后来被同日调课改了时段，补课学员也不会丢。
  return rows.filter(
    (b) =>
      b.status === 'confirmed' &&
      isBookingOfLesson(
        {
          class_id: b.class_id,
          lesson_date: b.lesson_date,
          schedule_id: b.schedule_id,
          start_time: b.start_time,
        },
        {
          classId: params.classId,
          lessonDate: params.lessonDate,
          startTime: params.startTime,
          scheduleId: params.scheduleId,
        },
      ),
  );
}

export const makeupBookingService = {
  create: createMakeupBooking,
  getByClassDate: getMakeupBookingsByClassDate,
};
