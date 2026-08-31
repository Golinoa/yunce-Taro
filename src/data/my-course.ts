/**
 * 我的课程 Mock 数据
 *
 * 与 parent-bookings 本地存储打通；优先展示赵小红妈妈等种子约课。
 */
import Taro from '@tarojs/taro';
import { getMockParentBookingsByUser } from '@/data/my-booking-seed';
import type { MyCourseItem, MyCourseStatus } from '@/services/my-course';
import type { ParentBookingItem } from '@/utils/parent-bookings';

const STORAGE_KEY = 'yunce:parent-bookings';
/** 家长端演示默认账号：赵小红妈妈 */
const DEMO_PARENT_USER_ID = 'user-parent-002';

function delay(ms = 80): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mapParentStatus(status: ParentBookingItem['status']): MyCourseStatus {
  if (status === 'waitlist') return 'waiting';
  if (status === 'completed') return 'pending_evaluate';
  if (status === 'cancelled' || status === 'expired' || status === 'leave') return 'cancelled';
  return 'booked';
}

function mapSeedToMyCourse(item: ParentBookingItem): MyCourseItem {
  const [startTime = '00:00', endTime = '00:00'] = (item.timeRange || '').split('-');
  return {
    id: item.id,
    bookingId: item.id,
    status: mapParentStatus(item.status),
    courseName: item.courseName,
    teacherName: item.teacherName,
    date: item.lessonDate,
    startTime,
    endTime,
    room: item.room ? `${item.campusName || ''} ${item.room}`.trim() : item.campusName,
    campusName: item.campusName,
  };
}

/** 把 MyCourseItem 映射为 ParentBookingItem，写入本地存储 */
function syncToParentBookings(courses: MyCourseItem[], userId: string) {
  try {
    const raw = Taro.getStorageSync(STORAGE_KEY);
    const existing: ParentBookingItem[] = Array.isArray(raw) ? raw : [];

    const mapped: ParentBookingItem[] = courses.map((course) => ({
      id: course.bookingId,
      userId,
      studentName: '赵小红',
      studentId: 'stu-002',
      occurrenceKey: `${course.id}_${course.date}`,
      courseId: course.id,
      courseName: course.courseName,
      courseType: course.courseName.includes('一对一') ? 'oneOnOne' : 'group',
      lessonDate: course.date,
      timeRange: `${course.startTime}-${course.endTime}`,
      teacherName: course.teacherName,
      deadline: course.date,
      campusName: course.campusName,
      room: course.room,
      status:
        course.status === 'pending_evaluate'
          ? 'completed'
          : course.status === 'waiting'
            ? 'waitlist'
            : (course.status as 'booked' | 'cancelled' | 'completed' | 'leave' | 'expired'),
      createdAt: new Date().toISOString(),
    }));

    const others = existing.filter((item) => !mapped.some((m) => m.id === item.id));
    Taro.setStorageSync(STORAGE_KEY, [...mapped, ...others]);
  } catch {
    // 忽略本地存储异常
  }
}

export async function mockGetMyCourseList(): Promise<MyCourseItem[]> {
  await delay();
  const seeds = getMockParentBookingsByUser(DEMO_PARENT_USER_ID)
    .map(mapSeedToMyCourse)
    .sort((a, b) => `${b.date}${b.startTime}`.localeCompare(`${a.date}${a.startTime}`));
  syncToParentBookings(seeds, DEMO_PARENT_USER_ID);
  return seeds;
}

export async function mockCancelMyCourse(id: string): Promise<void> {
  await delay();
  try {
    const raw = Taro.getStorageSync(STORAGE_KEY);
    const bookings: ParentBookingItem[] = Array.isArray(raw) ? raw : [];
    const target = bookings.find((b) => b.id === id);
    if (target) {
      target.status = 'cancelled';
      Taro.setStorageSync(STORAGE_KEY, bookings);
    }
  } catch {
    // 忽略本地存储异常
  }
}
