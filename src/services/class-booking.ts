/**
 * Service 层 — 班级开放预约 API
 * 定义接口契约，当前由 mock 实现，联调时替换为 request 调用
 */
import type { ClassBookingSlot } from '@/types/class';
import { loadClassBookingMock } from '@/utils/mock-loaders';
import { isUseMock } from '@/utils/build-env';
import type { ClassBookingRecord } from '@/types/class-booking';
import { del, get, post } from '@/utils/request';

export const classBookingService = {
  /** 获取某班级某日期的开放时段 */
  getSlotsByClass: async (classId: string, lessonDate: string): Promise<ClassBookingSlot[]> => {
    if (!isUseMock()) {
      const data = await get<{ list: ClassBookingSlot[] }>(
        `/class-booking/slots?classId=${encodeURIComponent(classId)}&lessonDate=${encodeURIComponent(lessonDate)}`,
      );
      return data.list;
    }
    const { mockGetSlotsByClass } = await loadClassBookingMock();
    return mockGetSlotsByClass(classId, lessonDate);
  },

  /** 批量保存某班级某日时段（配置页用） */
  saveClassDaySlots: async (
    classId: string,
    lessonDate: string,
    slots: Omit<ClassBookingSlot, 'id'>[],
  ): Promise<ClassBookingSlot[]> => {
    if (!isUseMock()) {
      const data = await post<{ list: ClassBookingSlot[] }>('/class-booking/slots/batch', {
        classId,
        lessonDate,
        slots,
      });
      return data.list;
    }
    const { mockSaveClassDaySlots } = await loadClassBookingMock();
    return mockSaveClassDaySlots(classId, lessonDate, slots);
  },

  /** 删除开放时段 */
  deleteSlot: async (id: string): Promise<void> => {
    if (!isUseMock()) {
      await del(`/class-booking/slots/${id}`);
      return;
    }
    const { mockDeleteSlot } = await loadClassBookingMock();
    return mockDeleteSlot(id);
  },

  /** 获取单个开放时段详情 */
  getSlotById: async (id: string): Promise<ClassBookingSlot | null> => {
    if (!isUseMock()) {
      const data = await get<ClassBookingSlot>(`/class-booking/slots/${id}`);
      return data;
    }
    const { mockGetSlotById } = await loadClassBookingMock();
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
    if (!isUseMock()) {
      const data = await post<ClassBookingSlot>(`/class-booking/slots/${id}`, payload);
      return data;
    }
    const { mockUpdateSlot } = await loadClassBookingMock();
    return mockUpdateSlot(id, payload);
  },

  /** 获取某时段的预约记录 */
  getRecordsBySlot: async (slotId: string): Promise<ClassBookingRecord[]> => {
    if (!isUseMock()) {
      const data = await get<{ list: ClassBookingRecord[] }>(
        `/class-booking/slots/${slotId}/records`,
      );
      return data.list;
    }
    const { mockGetRecordsBySlot } = await loadClassBookingMock();
    return mockGetRecordsBySlot(slotId);
  },

  /** 为某时段增加一条预约记录（老师代预约/模拟家长预约） */
  addBookingRecord: async (slotId: string, studentId: string): Promise<ClassBookingRecord> => {
    if (!isUseMock()) {
      const data = await post<ClassBookingRecord>(`/class-booking/slots/${slotId}/records`, {
        studentId,
      });
      return data;
    }
    const { mockAddBookingRecord } = await loadClassBookingMock();
    return mockAddBookingRecord(slotId, studentId);
  },

  /** 移除预约记录 */
  removeBookingRecord: async (recordId: string): Promise<void> => {
    if (!isUseMock()) {
      await del(`/class-booking/records/${recordId}`);
      return;
    }
    const { mockRemoveBookingRecord } = await loadClassBookingMock();
    return mockRemoveBookingRecord(recordId);
  },

  /** 获取指定班级集合存在开放预约时段的日期列表（日历红点用） */
  getOpenSlotDates: async (classIds: string[]): Promise<string[]> => {
    if (!isUseMock()) {
      const data = await get<{ dates: string[] }>(
        `/class-booking/slot-dates?classIds=${encodeURIComponent(classIds.join(','))}`,
      );
      return data.dates;
    }
    const { mockGetOpenSlotDates } = await loadClassBookingMock();
    return mockGetOpenSlotDates(classIds);
  },

  /** 检查并自动开班，返回已开班的 scheduleIds */
  autoOpenSlotsIfNeeded: async (classId: string, lessonDate: string): Promise<string[]> => {
    if (!isUseMock()) {
      const data = await post<{ scheduleIds: string[] }>('/class-booking/auto-open', {
        classId,
        lessonDate,
      });
      return data.scheduleIds;
    }
    const { mockAutoOpenSlotsIfNeeded } = await loadClassBookingMock();
    return mockAutoOpenSlotsIfNeeded(classId, lessonDate);
  },

  /** 更新时段状态（active/rest/full） */
  updateSlotStatus: async (slotId: string, status: ClassBookingSlot['status']): Promise<void> => {
    if (!isUseMock()) {
      await post(`/class-booking/slots/${slotId}/status`, { status });
      return;
    }
    // Mock: 直接修改内存数据
    const { mockUpdateSlotStatus } = await import('@/data/class-booking');
    return mockUpdateSlotStatus(slotId, status);
  },
};
