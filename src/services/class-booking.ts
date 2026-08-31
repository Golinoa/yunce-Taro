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
    
      void classId;
      void lessonDate;
      void slots;
      throw new Error('批量配置开放时段尚未开通');
      },

  /** 删除开放时段 */
  deleteSlot: async (id: string): Promise<void> => {
    
      void id;
      throw new Error('删除开放时段尚未开通');
      },

  /** 获取单个开放时段详情 */
  getSlotById: async (id: string): Promise<ClassBookingSlot | null> => {
    
      // 后端暂无单条详情：用列表按 id 兜底不可行时返回 null
      void id;
      return null;
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
    
      void actorIds;
      void params;
      return [];
      },

  /** 获取指定班级集合存在开放预约时段的日期列表（日历红点用） */
  getOpenSlotDates: async (classIds: string[]): Promise<string[]> => {
    
      void classIds;
      return [];
      },

  /** 检查并自动开班，返回已开班的 scheduleIds */
  autoOpenSlotsIfNeeded: async (classId: string, lessonDate: string): Promise<string[]> => {
    
      void classId;
      void lessonDate;
      return [];
      },

  /** 更新时段状态（active/rest/full） */
  updateSlotStatus: async (slotId: string, status: ClassBookingSlot['status']): Promise<void> => {
    try {
      await post(`/class-booking/slots/${slotId}`, { status });
    } catch {
      throw new Error('更新时段状态失败');
    }
  },
};
