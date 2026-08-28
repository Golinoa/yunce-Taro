/**
 * Service 层 — 场地预约 API
 * 定义接口契约，mock/real API 通过 isUseMock() 统一开关切换
 */
import type { BookableVenue, VenueBookingRecord, VenueBookingSlot } from '@/types/venue-booking';
import { loadVenueBookingMock } from '@/utils/mock-loaders';
import { isUseMock } from '@/utils/build-env';
import { del, get, post, put } from '@/utils/request';

export const venueBookingService = {
  /** 获取可预约场地列表（可按校区过滤） */
  getBookableVenues: async (campusId?: string): Promise<BookableVenue[]> => {
    if (!isUseMock()) {
      return get<BookableVenue[]>('/venue-booking/venues', campusId ? { campusId } : undefined);
    }
    const { mockGetBookableVenues } = await loadVenueBookingMock();
    return mockGetBookableVenues(campusId);
  },

  /** 获取可预约场地详情 */
  getBookableVenueById: async (id: string): Promise<BookableVenue | null> => {
    if (!isUseMock()) {
      const detail = await get<BookableVenue>(`/venue-booking/venues/${id}`);
      return detail ?? null;
    }
    const { mockGetBookableVenueById } = await loadVenueBookingMock();
    return (await mockGetBookableVenueById(id)) ?? null;
  },

  /** 获取某日期场地可预约时段 */
  getSlots: async (roomId: string, date: string): Promise<VenueBookingSlot[]> => {
    if (!isUseMock()) {
      return get<VenueBookingSlot[]>(`/venue-booking/venues/${roomId}/slots`, { date });
    }
    const { mockGetVenueSlots } = await loadVenueBookingMock();
    return mockGetVenueSlots(roomId, date);
  },

  /** 创建场地预约 */
  createBooking: async (
    record: Omit<VenueBookingRecord, 'id' | 'createdAt'>,
  ): Promise<VenueBookingRecord> => {
    if (!isUseMock()) {
      return post<VenueBookingRecord>('/venue-booking/bookings', record as Record<string, unknown>);
    }
    const { mockCreateVenueBooking } = await loadVenueBookingMock();
    return mockCreateVenueBooking(record);
  },

  /** 取消场地预约 */
  cancelBooking: async (bookingId: string): Promise<VenueBookingRecord> => {
    if (!isUseMock()) {
      return put<VenueBookingRecord>(`/venue-booking/bookings/${bookingId}/cancel`);
    }
    const { mockCancelVenueBooking } = await loadVenueBookingMock();
    return mockCancelVenueBooking(bookingId);
  },

  /** 获取我的场地预约记录 */
  getMyBookings: async (userId?: string): Promise<VenueBookingRecord[]> => {
    if (!isUseMock()) {
      return get<VenueBookingRecord[]>(
        '/venue-booking/bookings/my',
        userId ? { userId } : undefined,
      );
    }
    const { mockGetMyVenueBookings } = await loadVenueBookingMock();
    return mockGetMyVenueBookings(userId);
  },

  /** 场地预约确认到场（负责人操作） */
  checkInBooking: async (bookingId: string): Promise<VenueBookingRecord | null> => {
    if (!isUseMock()) {
      return put<VenueBookingRecord>(`/venue-booking/bookings/${bookingId}/check-in`);
    }
    const { mockCheckInVenueBooking } = await loadVenueBookingMock();
    return mockCheckInVenueBooking(bookingId);
  },

  /** 删除场地预约记录 */
  deleteBooking: async (bookingId: string): Promise<boolean> => {
    if (!isUseMock()) {
      await del(`/venue-booking/bookings/${bookingId}`);
      return true;
    }
    const { mockCancelVenueBooking } = await loadVenueBookingMock();
    const cancelled = await mockCancelVenueBooking(bookingId);
    return !!cancelled;
  },
};
