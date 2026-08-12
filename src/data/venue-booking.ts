/**
 * 场地预约模块 — Mock 数据适配层
 */
import dayjs from 'dayjs';
import type { BookableVenue, VenueBookingRecord, VenueBookingSlot } from '@/types/venue-booking';
import { mockGetRoomById, mockGetRooms, mockGetVenueById } from './campus';

function delay(ms = 80): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 内存中的预约记录 */
let mockBookingRecords: VenueBookingRecord[] = [];

/** 单个时段时长（分钟） */
const SLOT_DURATION = 30;

/** 初始化一些 mock 预约记录，让部分时段显示已满/已约 */
function seedMockBookings(): void {
  if (mockBookingRecords.length > 0) return;

  const today = dayjs().format('YYYY-MM-DD');
  const tomorrow = dayjs().add(1, 'day').format('YYYY-MM-DD');
  const rooms = ['room-east-001', 'room-east-002', 'room-center-001'];
  const seedUsers = ['user-parent-001', 'user-parent-002', 'user-parent-003'];

  const records: VenueBookingRecord[] = [];
  rooms.forEach((roomId, roomIndex) => {
    const baseHour = 9 + roomIndex;
    seedUsers.forEach((userId, userIndex) => {
      records.push({
        id: `vb-seed-${roomId}-${today}-${userIndex}`,
        userId,
        userName: `会员${userIndex + 1}`,
        roomId,
        date: today,
        startTime: `${baseHour.toString().padStart(2, '0')}:00`,
        endTime: `${(baseHour + 1).toString().padStart(2, '0')}:00`,
        peopleCount: 1,
        unitPrice: 50,
        totalPrice: 50,
        status: 'confirmed',
        createdAt: dayjs().subtract(1, 'day').toISOString(),
      });
    });
    records.push({
      id: `vb-seed-${roomId}-${tomorrow}-multi`,
      userId: seedUsers[0],
      userName: '会员1',
      roomId,
      date: tomorrow,
      startTime: '14:00',
      endTime: '14:30',
      peopleCount: 2,
      unitPrice: 50,
      totalPrice: 100,
      status: 'confirmed',
      createdAt: dayjs().subtract(1, 'day').toISOString(),
    });
  });

  mockBookingRecords = records;
}

seedMockBookings();

/** 为在场会员生成确定性头像 */
function generateMemberAvatars(count: number): string[] {
  return Array.from({ length: count }, (_, index) => {
    const id = index + 1;
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=member-${id}&backgroundColor=b6e3f4`;
  });
}

/** 计算指定日期在场人数与入场人数 */
function getVenueOccupancy(room: Pick<BookableVenue, 'id' | 'capacity'>, date: string) {
  const todayRecords = mockBookingRecords.filter(
    (record) => record.roomId === room.id && record.date === date && record.status !== 'cancelled',
  );
  const currentCount = Math.min(
    todayRecords.reduce((sum, record) => sum + record.peopleCount, 0),
    room.capacity || 1,
  );
  const todayEntryCount = todayRecords.reduce((sum, record) => sum + record.peopleCount, 0);
  return {
    currentCount,
    todayEntryCount,
    memberAvatars: generateMemberAvatars(currentCount),
  };
}

function parseTimeToMinutes(time: string): number {
  const [hour, minute] = time.split(':').map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return 0;
  }
  return hour * 60 + minute;
}

function minutesToTime(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

/** 生成某日期的时段列表 */
function buildSlotsForRoom(room: BookableVenue, date: string): VenueBookingSlot[] {
  const start = parseTimeToMinutes(room.openTimeStart || '09:00');
  const end = parseTimeToMinutes(room.openTimeEnd || '22:00');
  const slots: VenueBookingSlot[] = [];

  for (let current = start; current + SLOT_DURATION <= end; current += SLOT_DURATION) {
    const slotStart = minutesToTime(current);
    const slotEnd = minutesToTime(current + SLOT_DURATION);
    const slotKey = `${room.id}|${date}|${slotStart}`;

    const bookedCount = mockBookingRecords
      .filter(
        (record) =>
          record.roomId === room.id &&
          record.date === date &&
          record.startTime === slotStart &&
          record.status !== 'cancelled',
      )
      .reduce((sum, record) => sum + record.peopleCount, 0);

    const maxCount = room.capacity || 1;

    slots.push({
      id: slotKey,
      roomId: room.id,
      date,
      startTime: slotStart,
      endTime: slotEnd,
      bookedCount,
      maxCount,
      status: bookedCount >= maxCount ? 'booked' : 'available',
      price: room.pricePerSession || 0,
    });
  }

  return slots;
}

/** 获取可预约场地列表（按校区过滤） */
export async function mockGetBookableVenues(campusId?: string): Promise<BookableVenue[]> {
  await delay();
  const rooms = await mockGetRooms({ campusId });
  const bookingRooms = rooms.filter((room) => room.bookingEnabled && room.status === 'active');
  const today = dayjs().format('YYYY-MM-DD');

  const venues = await Promise.all(
    bookingRooms.map(async (room) => {
      const venue = await mockGetVenueById(room.venueId);
      const occupancy = getVenueOccupancy(room, today);
      return {
        ...room,
        venueName: venue?.name || '未知场馆',
        ...occupancy,
      };
    }),
  );

  return venues;
}

/** 获取可预约场地详情 */
export async function mockGetBookableVenueById(id: string): Promise<BookableVenue | undefined> {
  await delay();
  const room = await mockGetRoomById(id);
  if (!room || !room.bookingEnabled) return undefined;
  const venue = await mockGetVenueById(room.venueId);
  const today = dayjs().format('YYYY-MM-DD');
  const occupancy = getVenueOccupancy(room, today);
  return {
    ...room,
    venueName: venue?.name || '未知场馆',
    ...occupancy,
  };
}

/** 获取某日期场地可预约时段 */
export async function mockGetVenueSlots(roomId: string, date: string): Promise<VenueBookingSlot[]> {
  await delay();
  const room = await mockGetBookableVenueById(roomId);
  if (!room) return [];
  return buildSlotsForRoom(room, date);
}

/** 创建场地预约 */
export async function mockCreateVenueBooking(
  record: Omit<VenueBookingRecord, 'id' | 'createdAt'>,
): Promise<VenueBookingRecord> {
  await delay();
  const created: VenueBookingRecord = {
    ...record,
    id: `vb-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  mockBookingRecords = [...mockBookingRecords, created];
  return created;
}

/** 取消场地预约 */
export async function mockCancelVenueBooking(bookingId: string): Promise<VenueBookingRecord> {
  await delay();
  const record = mockBookingRecords.find((item) => item.id === bookingId);
  if (!record) {
    throw new Error('预约记录不存在');
  }
  const updated: VenueBookingRecord = { ...record, status: 'cancelled' };
  mockBookingRecords = mockBookingRecords.map((item) => (item.id === bookingId ? updated : item));
  return updated;
}

/** 获取我的场地预约记录 */
export async function mockGetMyVenueBookings(userId?: string): Promise<VenueBookingRecord[]> {
  await delay();
  if (!userId) return [];
  return mockBookingRecords.filter(
    (record) => record.userId === userId && record.status !== 'cancelled',
  );
}
