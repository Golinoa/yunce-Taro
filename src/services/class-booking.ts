/**
 * Service 层 — 班级开放预约 API
 * 定义接口契约，当前由 mock 实现，联调时替换为 request 调用
 */
import {
  mockAddBookingRecord,
  mockAutoOpenSlotsIfNeeded,
  mockDeleteSlot,
  mockGetOpenSlotDates,
  mockGetRecordsBySlot,
  mockGetSlotById,
  mockGetSlotsByClass,
  mockRemoveBookingRecord,
  mockSaveClassDaySlots,
  mockUpdateSlot,
} from '@/data/class-booking';
import type { ClassBookingSlot } from '@/types/class';
import type { ClassBookingRecord } from '@/types/class-booking';
import { del, get, post } from '@/utils/request';

const USE_MOCK =
  typeof process !== 'undefined' && typeof process.env !== 'undefined'
    ? process.env.VITE_USE_MOCK !== 'false'
    : true;

export const classBookingService = {
  /** 获取某班级某日期的开放时段 */
  getSlotsByClass: async (classId: string, lessonDate: string): Promise<ClassBookingSlot[]> => {
    if (!USE_MOCK) {
      const data = await get<{ list: ClassBookingSlot[] }>(
        `/class-booking/slots?classId=${encodeURIComponent(classId)}&lessonDate=${encodeURIComponent(lessonDate)}`,
      );
      return data.list;
    }
    return mockGetSlotsByClass(classId, lessonDate);
  },

  /** 批量保存某班级某日时段（配置页用） */
  saveClassDaySlots: async (
    classId: string,
    lessonDate: string,
    slots: Omit<ClassBookingSlot, 'id'>[],
  ): Promise<ClassBookingSlot[]> => {
    if (!USE_MOCK) {
      const data = await post<{ list: ClassBookingSlot[] }>('/class-booking/slots/batch', {
        classId,
        lessonDate,
        slots,
      });
      return data.list;
    }
    return mockSaveClassDaySlots(classId, lessonDate, slots);
  },

  /** 删除开放时段 */
  deleteSlot: async (id: string): Promise<void> => {
    if (!USE_MOCK) {
      await del(`/class-booking/slots/${id}`);
      return;
    }
    return mockDeleteSlot(id);
  },

  /** 获取单个开放时段详情 */
  getSlotById: async (id: string): Promise<ClassBookingSlot | null> => {
    if (!USE_MOCK) {
      const data = await get<ClassBookingSlot>(`/class-booking/slots/${id}`);
      return data;
    }
    return mockGetSlotById(id);
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
    if (!USE_MOCK) {
      const data = await post<ClassBookingSlot>(`/class-booking/slots/${id}`, payload);
      return data;
    }
    return mockUpdateSlot(id, payload);
  },

  /** 获取某时段的预约记录 */
  getRecordsBySlot: async (slotId: string): Promise<ClassBookingRecord[]> => {
    if (!USE_MOCK) {
      const data = await get<{ list: ClassBookingRecord[] }>(
        `/class-booking/slots/${slotId}/records`,
      );
      return data.list;
    }
    return mockGetRecordsBySlot(slotId);
  },

  /** 为某时段增加一条预约记录（老师代预约/模拟家长预约） */
  addBookingRecord: async (slotId: string, studentId: string): Promise<ClassBookingRecord> => {
    if (!USE_MOCK) {
      const data = await post<ClassBookingRecord>(`/class-booking/slots/${slotId}/records`, {
        studentId,
      });
      return data;
    }
    return mockAddBookingRecord(slotId, studentId);
  },

  /** 移除预约记录 */
  removeBookingRecord: async (recordId: string): Promise<void> => {
    if (!USE_MOCK) {
      await del(`/class-booking/records/${recordId}`);
      return;
    }
    return mockRemoveBookingRecord(recordId);
  },

  /** 获取指定班级集合存在开放预约时段的日期列表（日历红点用） */
  getOpenSlotDates: async (classIds: string[]): Promise<string[]> => {
    if (!USE_MOCK) {
      const data = await get<{ dates: string[] }>(
        `/class-booking/slot-dates?classIds=${encodeURIComponent(classIds.join(','))}`,
      );
      return data.dates;
    }
    return mockGetOpenSlotDates(classIds);
  },

  /** 检查并自动开班，返回已开班的 scheduleIds */
  autoOpenSlotsIfNeeded: async (classId: string, lessonDate: string): Promise<string[]> => {
    if (!USE_MOCK) {
      const data = await post<{ scheduleIds: string[] }>('/class-booking/auto-open', {
        classId,
        lessonDate,
      });
      return data.scheduleIds;
    }
    return mockAutoOpenSlotsIfNeeded(classId, lessonDate);
  },

  /** 更新时段状态（active/rest/full） */
  updateSlotStatus: async (slotId: string, status: ClassBookingSlot['status']): Promise<void> => {
    if (!USE_MOCK) {
      await post(`/class-booking/slots/${slotId}/status`, { status });
      return;
    }
    // Mock: 直接修改内存数据
    const { mockUpdateSlotStatus } = await import('@/data/class-booking');
    return mockUpdateSlotStatus(slotId, status);
  },
};
