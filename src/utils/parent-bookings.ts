import Taro from '@tarojs/taro';

export type ParentBookingStatus =
  | 'booked'
  | 'waitlist'
  | 'cancelled'
  | 'completed'
  | 'leave'
  | 'expired';

export interface ParentBookingItem {
  id: string;
  userId: string;
  studentId?: string;
  studentName?: string;
  occurrenceKey: string;
  courseId: string;
  courseName: string;
  courseType: 'group' | 'oneOnOne';
  classId?: string;
  campusId?: string;
  lessonDate: string;
  timeRange: string;
  teacherName: string;
  deadline: string;
  campusName?: string;
  room?: string;
  status: ParentBookingStatus;
  createdAt: string;
}

const STORAGE_KEY = 'yunce:parent-bookings';

export function readAllParentBookings(): ParentBookingItem[] {
  try {
    const raw = Taro.getStorageSync(STORAGE_KEY);
    if (!Array.isArray(raw)) {
      return [];
    }
    return (raw as Array<Omit<ParentBookingItem, 'status'> & { status?: string }>).map((item) => {
      const rawStatus = item.status;
      const status = rawStatus === 'pending' ? 'booked' : rawStatus;
      return {
        ...item,
        // 兼容旧版“待审核”数据，统一迁移为直约成功。
        status: (status === 'booked' ||
        status === 'waitlist' ||
        status === 'cancelled' ||
        status === 'completed' ||
        status === 'leave' ||
        status === 'expired'
          ? status
          : 'booked') as ParentBookingStatus,
      };
    });
  } catch {
    return [];
  }
}

export function readParentBookings(userId: string): ParentBookingItem[] {
  return readAllParentBookings().filter((item) => item.userId === userId);
}

export function readParentBookingById(bookingId: string): ParentBookingItem | null {
  return readAllParentBookings().find((item) => item.id === bookingId) || null;
}

export function writeAllParentBookings(bookings: ParentBookingItem[]) {
  Taro.setStorageSync(STORAGE_KEY, bookings);
}

export function upsertParentBooking(booking: ParentBookingItem) {
  const bookings = readAllParentBookings();
  const nextBookings = bookings.filter((item) => item.id !== booking.id);
  nextBookings.unshift(booking);
  writeAllParentBookings(nextBookings);
}

export function updateParentBookingStatus(bookingId: string, status: ParentBookingStatus) {
  const bookings = readAllParentBookings();
  const nextBookings = bookings.map((item) => (item.id === bookingId ? { ...item, status } : item));
  writeAllParentBookings(nextBookings);
}

export function promoteFirstWaitlistBooking(
  occurrenceKey: string,
  nextStatus: Exclude<ParentBookingStatus, 'cancelled' | 'waitlist'>,
) {
  const bookings = readAllParentBookings();
  const waitlistCandidates = bookings
    .filter((item) => item.occurrenceKey === occurrenceKey && item.status === 'waitlist')
    .sort(
      (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
    );

  const targetBooking = waitlistCandidates[0];
  if (!targetBooking) {
    return null;
  }

  const nextBookings = bookings.map((item) =>
    item.id === targetBooking.id ? { ...item, status: nextStatus } : item,
  );
  writeAllParentBookings(nextBookings);
  return { ...targetBooking, status: nextStatus };
}
