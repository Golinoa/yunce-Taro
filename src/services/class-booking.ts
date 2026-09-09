/**
 * Service 层 — 班级开放预约 API
 * 定义接口契约，当前由 mock 实现，联调时替换为 request 调用
 */
import type { ClassBookingSlot } from '@/types/class';
import type { ClassBookingRecord } from '@/types/class-booking';
import { del, get, post } from '@/utils/request';

export const classBookingService = {
  /** 获取某班级某日期的开放时段 */
  getSlotsByClass: async (classId: string, lessonDate: string): Promise<ClassBookingSlot[]> => {
    const data = await get<{ list: ClassBookingSlot[] }>(
      `/class-booking/slots?classId=${encodeURIComponent(classId)}&lessonDate=${encodeURIComponent(lessonDate)}`,
    );
    return data.list;
  },

  /** 批量保存某班级某日时段（配置页用） */
  saveClassDaySlots: async (
    classId: string,
    lessonDate: string,
    slots: Omit<ClassBookingSlot, 'id'>[],
  ): Promise<ClassBookingSlot[]> => {
    const data = await post<{ list: ClassBookingSlot[] }>('/class-booking/slots/batch', {
      classId,
      lessonDate,
      slots: slots.map((slot) => ({
        teacherId: slot.teacher_id,
        teacherName: slot.teacher_name,
        startTime: slot.start_time,
        endTime: slot.end_time,
        maxCount: slot.max_count,
        status: slot.status,
        room: slot.room,
      })),
    });
    return data.list || [];
  },

  /** 删除开放时段 */
  deleteSlot: async (id: string): Promise<void> => {
    await del(`/class-booking/slots/${id}`);
  },

  /** 获取单个开放时段详情 */
  getSlotById: async (id: string): Promise<ClassBookingSlot | null> => {
    return get<ClassBookingSlot>(`/class-booking/slots/${id}`);
  },

  /** 更新开放时段信息 */
  updateSlot: async (
    id: string,
    payload: Partial<
      Pick<
        ClassBookingSlot,
        'teacher_id' | 'room' | 'lesson_date' | 'start_time' | 'end_time' | 'max_count'
      >
    >,
  ): Promise<ClassBookingSlot> => {
    const data = await post<ClassBookingSlot>(`/class-booking/slots/${id}`, payload);
    return data;
  },

  /** 获取某时段的预约记录 */
  getRecordsBySlot: async (slotId: string): Promise<ClassBookingRecord[]> => {
    const data = await get<{ list: ClassBookingRecord[] }>(
      `/class-booking/slots/${slotId}/records`,
    );
    return data.list;
  },

  /** 为某时段增加一条预约记录（老师代预约/模拟家长预约） */
  addBookingRecord: async (slotId: string, studentId: string): Promise<ClassBookingRecord> => {
    const data = await post<ClassBookingRecord>(`/class-booking/slots/${slotId}/records`, {
      studentId,
    });
    return data;
  },

  /** 移除预约记录 */
  removeBookingRecord: async (recordId: string): Promise<void> => {
    await del(`/class-booking/records/${recordId}`);
    return;
  },

  /** 家长/本人：我的班课预约（含时段） */
  listMyRecords: async (): Promise<
    Array<{
      id: string;
      slot_id: string;
      class_id: string;
      student_id: string;
      student_name?: string;
      status: ClassBookingRecord['status'];
      fulfillment_status?: 'upcoming' | 'completed' | 'leave';
      created_at: string;
      updated_at: string;
      slot: {
        id: string;
        class_id: string;
        class_name?: string | null;
        campus_id: string;
        teacher_id: string;
        teacher_name?: string | null;
        lesson_date: string;
        start_time: string;
        end_time: string;
        max_count?: number;
        current_count?: number;
        status?: ClassBookingSlot['status'];
        room?: string | null;
        booking_kind?: string;
      };
    }>
  > => {
    const data = await get<{
      list: Array<{
        id: string;
        slot_id: string;
        class_id: string;
        student_id: string;
        student_name?: string;
        status: ClassBookingRecord['status'];
        fulfillment_status?: 'upcoming' | 'completed' | 'leave';
        created_at: string;
        updated_at: string;
        slot: {
          id: string;
          class_id: string;
          class_name?: string | null;
          campus_id: string;
          teacher_id: string;
          teacher_name?: string | null;
          lesson_date: string;
          start_time: string;
          end_time: string;
          max_count?: number;
          current_count?: number;
          status?: ClassBookingSlot['status'];
          room?: string | null;
          booking_kind?: string;
        };
      }>;
    }>('/class-booking/my-records');
    return data.list || [];
    return [];
  },

  /** 老师相关的班课开放约记录（含时段） */
  listRelatedBookings: async (
    actorIds: string[],
    params?: { startDate?: string; endDate?: string },
  ): Promise<Array<{ record: ClassBookingRecord; slot: ClassBookingSlot }>> => {
    const records = await classBookingService.listMyRecords();
    return records
      .filter(
        (record) =>
          actorIds.length === 0 ||
          actorIds.includes(record.slot.teacher_id) ||
          actorIds.includes(record.student_id),
      )
      .filter((record) => !params?.startDate || record.slot.lesson_date >= params.startDate)
      .filter((record) => !params?.endDate || record.slot.lesson_date <= params.endDate)
      .map((record) => ({
        record,
        slot: {
          ...record.slot,
          id: record.slot_id,
          class_id: record.class_id,
          teacher_id: record.slot.teacher_id,
          campus_id: record.slot.campus_id,
          lesson_date: record.slot.lesson_date,
          start_time: record.slot.start_time,
          end_time: record.slot.end_time,
          max_count: record.slot.max_count ?? 0,
          current_count: record.slot.current_count ?? 0,
          status: record.slot.status ?? 'active',
          created_at: record.created_at,
          updated_at: record.updated_at,
        } as unknown as ClassBookingSlot,
      }));
  },

  /** 获取指定班级集合存在开放预约时段的日期列表（日历红点用） */
  getOpenSlotDates: async (classIds: string[]): Promise<string[]> => {
    const data = await get<{ dates: string[] }>('/class-booking/open-dates', {
      classIds: classIds.join(','),
    });
    return data.dates || [];
  },

  /** 检查并自动开班，返回已开班的 scheduleIds */
  autoOpenSlotsIfNeeded: async (classId: string, lessonDate: string): Promise<string[]> => {
    // 服务端预约记录已经是开班依据；该兼容入口只返回当前可用时段，避免本机伪造排课。
    const slots = await classBookingService.getSlotsByClass(classId, lessonDate);
    return slots.filter((slot) => slot.status === 'full').map((slot) => slot.id);
  },

  /** 更新时段状态（active/rest/full） */
  updateSlotStatus: async (slotId: string, status: ClassBookingSlot['status']): Promise<void> => {
    try {
      await post(`/class-booking/slots/${slotId}`, { status });
    } catch {
      throw new Error('更新时段状态失败');
    }
  },

  updateRecordStatus: async (
    recordId: string,
    status: 'upcoming' | 'completed' | 'leave',
  ): Promise<void> => {
    await post(`/class-booking/records/${recordId}/status`, { status });
  },
};
