/**
 * Service 层 — 场地预约 API
 * 定义接口契约，mock/real API 通过 USE_MOCK 统一开关切换
 */
import {
  mockCancelVenueBooking,
  mockCheckInVenueBooking,
  mockCreateVenueBooking,
  mockGetBookableVenueById,
  mockGetBookableVenues,
  mockGetMyVenueBookings,
  mockGetVenueSlots,
} from '@/data/venue-booking';
import type { BookableVenue, VenueBookingRecord, VenueBookingSlot } from '@/types/venue-booking';
import { del, get, post, put } from '@/utils/request';

const USE_MOCK =
  typeof process !== 'undefined' && typeof process.env !== 'undefined'
    ? process.env.VITE_USE_MOCK !== 'false'
    : true;

export const venueBookingService = {
  /** 获取可预约场地列表（可按校区过滤） */
  getBookableVenues: async (campusId?: string): Promise<BookableVenue[]> => {
    if (!USE_MOCK) {
      return get<BookableVenue[]>('/venue-booking/venues', campusId ? { campusId } : undefined);
    }
    return mockGetBookableVenues(campusId);
  },

  /** 获取可预约场地详情 */
  getBookableVenueById: async (id: string): Promise<BookableVenue | null> => {
    if (!USE_MOCK) {
      const detail = await get<BookableVenue>(`/venue-booking/venues/${id}`);
      return detail ?? null;
    }
    return (await mockGetBookableVenueById(id)) ?? null;
  },

  /** 获取某日期场地可预约时段 */
  getSlots: async (roomId: string, date: string): Promise<VenueBookingSlot[]> => {
    if (!USE_MOCK) {
      return get<VenueBookingSlot[]>(`/venue-booking/venues/${roomId}/slots`, { date });
    }
    return mockGetVenueSlots(roomId, date);
  },

  /** 创建场地预约 */
  createBooking: async (
    record: Omit<VenueBookingRecord, 'id' | 'createdAt'>,
  ): Promise<VenueBookingRecord> => {
    if (!USE_MOCK) {
      return post<VenueBookingRecord>('/venue-booking/bookings', record as Record<string, unknown>);
    }
    return mockCreateVenueBooking(record);
  },

  /** 取消场地预约 */
  cancelBooking: async (bookingId: string): Promise<VenueBookingRecord> => {
    if (!USE_MOCK) {
      return put<VenueBookingRecord>(`/venue-booking/bookings/${bookingId}/cancel`);
    }
    return mockCancelVenueBooking(bookingId);
  },

  /** 获取我的场地预约记录 */
  getMyBookings: async (userId?: string): Promise<VenueBookingRecord[]> => {
    if (!USE_MOCK) {
      return get<VenueBookingRecord[]>(
        '/venue-booking/bookings/my',
        userId ? { userId } : undefined,
      );
    }
    return mockGetMyVenueBookings(userId);
  },

  /** 场地预约确认到场（负责人操作） */
  checkInBooking: async (bookingId: string): Promise<VenueBookingRecord | null> => {
    if (!USE_MOCK) {
      return put<VenueBookingRecord>(`/venue-booking/bookings/${bookingId}/check-in`);
    }
    return mockCheckInVenueBooking(bookingId);
  },

  /** 删除场地预约记录 */
  deleteBooking: async (bookingId: string): Promise<boolean> => {
    if (!USE_MOCK) {
      await del(`/venue-booking/bookings/${bookingId}`);
      return true;
    }
    const cancelled = await mockCancelVenueBooking(bookingId);
    return !!cancelled;
  },
};
