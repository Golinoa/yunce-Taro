/**
 * 场地预约模块 — Mock 数据适配层
 */
import dayjs from 'dayjs';
import type { BookableVenue, VenueBookingRecord, VenueBookingSlot } from '@/types/venue-booking';
import { DEFAULT_VENUE_MANAGER_USER_ID, ROOMS, VENUES } from '@/data/mock-database';
import { resolveMyTeachingActorIds, getActorScope } from '@/data/students';
import { mockGetRoomById, mockGetRooms, mockGetVenueById } from './campus';

function delay(ms = 80): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 内存中的预约记录 */
let mockBookingRecords: VenueBookingRecord[] = [];

/** 单个时段时长（分钟） */
const SLOT_DURATION = 30;

function resolveRoomManagerUserId(roomId: string): string {
  const room = ROOMS.find((item) => item.id === roomId);
  if (room?.managerUserId) return room.managerUserId;
  const venue = VENUES.find((item) => item.id === room?.venueId);
  return venue?.managerUserId || DEFAULT_VENUE_MANAGER_USER_ID;
}

/**
 * 初始化 mock 预约：
 * - 今日仅 1 条（首页今日课表「场地」形态各 1 张）
 * - 明日保留少量，供场地预约页展示已约态
 */
function seedMockBookings(): void {
  if (mockBookingRecords.length > 0) return;

  const today = dayjs().format('YYYY-MM-DD');
  const tomorrow = dayjs().add(1, 'day').format('YYYY-MM-DD');
  const homeRoomId = 'room-center-101';

  mockBookingRecords = [
    {
      id: `vb-seed-${homeRoomId}-${today}-home`,
      userId: 'user-parent-001',
      userName: '会员1',
      roomId: homeRoomId,
      date: today,
      startTime: '15:00',
      endTime: '16:00',
      peopleCount: 1,
      unitPrice: 50,
      totalPrice: 50,
      status: 'confirmed',
      managerUserId: resolveRoomManagerUserId(homeRoomId),
      createdAt: dayjs().subtract(1, 'day').toISOString(),
    },
    {
      id: `vb-seed-${homeRoomId}-${tomorrow}-sample`,
      userId: 'user-parent-001',
      userName: '会员1',
      roomId: homeRoomId,
      date: tomorrow,
      startTime: '14:00',
      endTime: '14:30',
      peopleCount: 2,
      unitPrice: 50,
      totalPrice: 100,
      status: 'confirmed',
      managerUserId: resolveRoomManagerUserId(homeRoomId),
      createdAt: dayjs().subtract(1, 'day').toISOString(),
    },
  ];
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
    managerUserId: resolveRoomManagerUserId(record.roomId),
    createdAt: new Date().toISOString(),
  };
  mockBookingRecords = [...mockBookingRecords, created];
  const room = await mockGetRoomById(record.roomId);
  notifyVenueBookingStakeholders(created, room?.name || '场地');
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

/** 新建预约时通知场地负责人与机构管理员（站内；联调后走订阅消息） */
function notifyVenueBookingStakeholders(record: VenueBookingRecord, roomName: string): void {
  const managerUserId = record.managerUserId || resolveRoomManagerUserId(record.roomId);
  const adminUserId = DEFAULT_VENUE_MANAGER_USER_ID;
  void managerUserId;
  void adminUserId;
  void roomName;
  // Mock：联调阶段由后端 notification + subscribe-message 推送给 managerUserId 与 admin 角色
}

/** 获取当天本人负责场馆下的场地预约（负责人或管理员可见） */
export function filterMyTodayVenueBookings(
  actorOrUserId: string,
  campusId?: string,
): VenueBookingRecord[] {
  const actorIds = new Set(resolveMyTeachingActorIds(actorOrUserId));
  const scope = getActorScope(actorOrUserId);
  const isAdmin = scope.role === 'admin' || scope.role === 'principal';
  const today = dayjs().format('YYYY-MM-DD');

  const managedRoomIds = new Set<string>();
  ROOMS.forEach((room) => {
    const managerId = room.managerUserId || resolveRoomManagerUserId(room.id);
    if (isAdmin || actorIds.has(managerId)) {
      if (!campusId || room.campusId === campusId) {
        managedRoomIds.add(room.id);
      }
    }
  });

  return mockBookingRecords.filter((record) => {
    if (record.date !== today) return false;
    if (record.status === 'cancelled') return false;
    if (!managedRoomIds.has(record.roomId)) return false;
    return true;
  });
}

/** 场地预约签到（负责人确认到场） */
export async function mockCheckInVenueBooking(
  bookingId: string,
): Promise<VenueBookingRecord | null> {
  await delay();
  const record = mockBookingRecords.find((item) => item.id === bookingId);
  if (!record || record.status === 'cancelled') return null;
  const updated: VenueBookingRecord = { ...record, status: 'checked_in' };
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
