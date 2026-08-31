/**
 * Service 层 — 场地预约 API
 * 契约对齐后端 `/venues/*`；mock 仅开发开关开启时使用
 */
import type { BookableVenue, VenueBookingRecord, VenueBookingSlot } from '@/types/venue-booking';


import { del, get, post } from '@/utils/request';

type RawRecord = Record<string, unknown>;

interface BackendRoomItem {
  id: string;
  venueId: string;
  venueName?: string;
  name: string;
  capacity?: number;
  status?: string;
  managerUserId?: string | null;
}

interface BackendAvailableSlot {
  id: string;
  startTime: string;
  endTime: string;
  availableRooms: Array<{ id: string; name: string; capacity?: number }>;
}

interface BackendVenueBooking {
  id: string;
  venueId: string;
  venueName?: string;
  roomId: string;
  roomName?: string;
  date: string | Date;
  startTime: string;
  endTime: string;
  purpose?: string | null;
  bookerId: string;
  status: string;
  remark?: string | null;
  createdAt?: string | Date;
}

const mapStatus = (status?: string): VenueBookingRecord['status'] => {
  const upper = String(status || '').toUpperCase();
  if (upper === 'CANCELLED') return 'cancelled';
  if (upper === 'COMPLETED') return 'checked_in';
  if (upper === 'CONFIRMED') return 'confirmed';
  return 'pending';
};

const toDateStr = (value: string | Date | undefined): string => {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
};

const mapRoomToBookable = (room: BackendRoomItem): BookableVenue => ({
  id: room.id,
  name: room.name,
  venueId: room.venueId,
  venueName: room.venueName || '',
  capacity: room.capacity ?? 1,
  campusId: '',
  status: room.status === 'INACTIVE' ? 'inactive' : 'active',
  currentCount: 0,
  todayEntryCount: 0,
  memberAvatars: [],
  managerUserId: room.managerUserId || undefined,
});

const mapBooking = (item: BackendVenueBooking): VenueBookingRecord => ({
  id: item.id,
  userId: item.bookerId,
  userName: '',
  roomId: item.roomId,
  date: toDateStr(item.date),
  startTime: item.startTime,
  endTime: item.endTime,
  peopleCount: 1,
  unitPrice: 0,
  totalPrice: 0,
  status: mapStatus(item.status),
  createdAt:
    typeof item.createdAt === 'string'
      ? item.createdAt
      : item.createdAt?.toISOString?.() || new Date().toISOString(),
});

export const venueBookingService = {
  /** 获取可预约场地列表（可按校区过滤；后端教室列表） */
  getBookableVenues: async (campusId?: string): Promise<BookableVenue[]> => {
    
      // 先按校区取场馆，再拉教室；无校区则直接拉教室列表
      if (campusId) {
        const venues = await get<{ list?: Array<{ id: string }> } | Array<{ id: string }>>(
          '/venues/',
          { campusId, page: 1, pageSize: 100, status: 'ACTIVE' },
        );
        const venueList = Array.isArray(venues) ? venues : venues.list || [];
        const roomGroups = await Promise.all(
          venueList.map((v) =>
            get<{ list?: BackendRoomItem[] } | BackendRoomItem[]>('/venues/rooms/list', {
              venueId: v.id,
              page: 1,
              pageSize: 100,
              status: 'ACTIVE',
            }),
          ),
        );
        return roomGroups
          .flatMap((group) => (Array.isArray(group) ? group : group.list || []))
          .map(mapRoomToBookable);
      }
      const data = await get<{ list?: BackendRoomItem[] } | BackendRoomItem[]>(
        '/venues/rooms/list',
        { page: 1, pageSize: 100, status: 'ACTIVE' },
      );
      const list = Array.isArray(data) ? data : data.list || [];
      return list.map(mapRoomToBookable);
      },

  /** 获取可预约场地详情（教室） */
  getBookableVenueById: async (id: string): Promise<BookableVenue | null> => {
    
      const room = await get<BackendRoomItem>(`/venues/rooms/${id}`);
      return room ? mapRoomToBookable(room) : null;
      },

  /** 获取某日期教室可预约时段 */
  getSlots: async (roomId: string, date: string): Promise<VenueBookingSlot[]> => {
    
      const room = await get<BackendRoomItem>(`/venues/rooms/${roomId}`);
      if (!room?.venueId) return [];
      const available = await get<{ slots?: BackendAvailableSlot[] } | BackendAvailableSlot[]>(
        '/venues/slots/available',
        { venueId: room.venueId, roomId, date },
      );
      const slots = Array.isArray(available) ? available : available.slots || [];
      return slots.map((slot) => {
        const roomAvailable = (slot.availableRooms || []).some((r) => r.id === roomId);
        return {
          id: `${roomId}:${date}:${slot.startTime}`,
          roomId,
          date,
          startTime: slot.startTime,
          endTime: slot.endTime,
          bookedCount: roomAvailable ? 0 : 1,
          maxCount: room.capacity ?? 1,
          status: roomAvailable ? 'available' : 'booked',
          price: 0,
        };
      });
      },

  /** 创建场地预约（对齐 BE: venueId/roomId/date/start/end） */
  createBooking: async (
    record: Omit<VenueBookingRecord, 'id' | 'createdAt'> & { venueId?: string },
  ): Promise<VenueBookingRecord> => {
    
      let venueId = record.venueId;
      if (!venueId) {
        const room = await get<BackendRoomItem>(`/venues/rooms/${record.roomId}`);
        venueId = room?.venueId;
      }
      if (!venueId) {
        throw new Error('缺少场地信息，无法预约');
      }
      const created = await post<BackendVenueBooking>('/venues/bookings', {
        venueId,
        roomId: record.roomId,
        date: record.date,
        startTime: record.startTime,
        endTime: record.endTime,
        purpose: record.userName ? `家长预约·${record.userName}` : '场地预约',
        remark:
          record.peopleCount > 1 ? `人数 ${record.peopleCount}` : undefined,
      });
      return {
        ...mapBooking(created),
        userId: record.userId,
        userName: record.userName,
        peopleCount: record.peopleCount,
        unitPrice: record.unitPrice,
        totalPrice: record.totalPrice,
      };
      },

  /** 取消场地预约 */
  cancelBooking: async (bookingId: string): Promise<VenueBookingRecord> => {
    
      const updated = await post<BackendVenueBooking>(`/venues/bookings/${bookingId}/cancel`);
      return mapBooking(updated);
      },

  /** 获取我的场地预约记录 */
  getMyBookings: async (userId?: string): Promise<VenueBookingRecord[]> => {
    
      const list = await get<BackendVenueBooking[]>('/venues/bookings/my');
      return (list || []).map(mapBooking);
      },

  /** 与我相关的场地预约（负责人或预约人）——后端无 related 时降级为我的预约 */
  listRelatedBookings: async (
    actorIds: string[],
    params?: { startDate?: string; endDate?: string },
  ): Promise<VenueBookingRecord[]> => {
    
      const mine = await venueBookingService.getMyBookings();
      return mine.filter((item) => {
        if (params?.startDate && item.date < params.startDate) return false;
        if (params?.endDate && item.date > params.endDate) return false;
        return actorIds.length === 0 || actorIds.includes(item.userId);
      });
      },

  /** 场地预约确认到场（负责人操作） */
  checkInBooking: async (bookingId: string): Promise<VenueBookingRecord | null> => {
    
      const updated = await post<BackendVenueBooking>(`/venues/bookings/${bookingId}/check-in`);
      return mapBooking(updated);
      },

  /** 删除场地预约记录 */
  deleteBooking: async (bookingId: string): Promise<boolean> => {
    
      await del(`/venues/bookings/${bookingId}`);
      return true;
        return !!cancelled;
  },
};
