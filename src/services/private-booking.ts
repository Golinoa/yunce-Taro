/**
 * 家长私教自约 Service — 对齐后端 /private-bookings
 */
import { del, get, post } from '@/utils/request';

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
        return post<PrivateBookingItem>('/private-bookings', payload);
  },

  listMine: async (): Promise<PrivateBookingItem[]> => {
    const list = await get<PrivateBookingItem[]>('/private-bookings/my');
    return list || [];
  },

  cancel: async (id: string): Promise<PrivateBookingItem> => {
        return post<PrivateBookingItem>(`/private-bookings/${id}/cancel`);
  },
};
