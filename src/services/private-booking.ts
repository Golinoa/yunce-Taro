/**
 * 家长私教自约 Service — 对齐后端 /private-bookings
 */
import { del, get, post } from '@/utils/request';
import { isUseMock } from '@/utils/build-env';

export interface PrivateBookingItem {
  id: string;
  teacherId: string;
  studentId: string;
  studentName?: string | null;
  teacherName?: string | null;
  courseName?: string | null;
  lessonDate: string;
  startTime: string;
  endTime: string;
  status: string;
  campusId?: string | null;
  createdAt?: string;
}

export const privateBookingService = {
  create: async (payload: {
    teacherId: string;
    studentId: string;
    lessonDate: string;
    startTime: string;
    endTime: string;
    courseName?: string;
    teacherName?: string;
    campusId?: string;
  }): Promise<PrivateBookingItem> => {
    if (isUseMock()) {
      return {
        id: `mock-pb-${Date.now()}`,
        ...payload,
        status: 'booked',
        createdAt: new Date().toISOString(),
      };
    }
    return post<PrivateBookingItem>('/private-bookings', payload);
  },

  listMine: async (): Promise<PrivateBookingItem[]> => {
    if (isUseMock()) return [];
    const list = await get<PrivateBookingItem[]>('/private-bookings/my');
    return list || [];
  },

  cancel: async (id: string): Promise<PrivateBookingItem> => {
    if (isUseMock()) {
      return {
        id,
        teacherId: '',
        studentId: '',
        lessonDate: '',
        startTime: '',
        endTime: '',
        status: 'cancelled',
      };
    }
    return post<PrivateBookingItem>(`/private-bookings/${id}/cancel`);
  },
};
