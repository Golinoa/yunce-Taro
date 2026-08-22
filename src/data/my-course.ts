/**
 * 我的课程 Mock 数据
 *
 * 与 parent-bookings 本地存储打通，保证预约详情页可以读取完整数据。
 */
import Taro from '@tarojs/taro';
import type { MyCourseItem, MyCourseStatus } from '@/services/my-course';
import type { ParentBookingItem } from '@/utils/parent-bookings';

const STORAGE_KEY = 'yunce:parent-bookings';

function delay(ms = 80): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const MOCK_COURSES: MyCourseItem[] = [
  {
    id: 'mc-001',
    bookingId: 'pb-mc-001',
    status: 'booked' as MyCourseStatus,
    courseName: '钢琴入门 A 班',
    teacherName: '张老师',
    date: '2026-06-25',
    startTime: '09:00',
    endTime: '10:30',
    room: '曦绘艺术 201 教室',
    campusName: '曦绘艺术',
  },
  {
    id: 'mc-002',
    bookingId: 'pb-mc-002',
    status: 'booked' as MyCourseStatus,
    courseName: '一对一 声乐课',
    teacherName: '李老师',
    date: '2026-06-26',
    startTime: '14:00',
    endTime: '15:00',
    room: '曦绘艺术 305 教室',
    campusName: '曦绘艺术',
  },
  {
    id: 'mc-003',
    bookingId: 'pb-mc-003',
    status: 'waiting' as MyCourseStatus,
    courseName: '舞蹈启蒙班',
    teacherName: '王老师',
    date: '2026-06-27',
    startTime: '10:00',
    endTime: '11:30',
    room: '东区校区 102 教室',
    campusName: '东区校区',
    queuePosition: 3,
  },
  {
    id: 'mc-004',
    bookingId: 'pb-mc-004',
    status: 'pending_evaluate' as MyCourseStatus,
    courseName: '美术创意课',
    teacherName: '赵老师',
    date: '2026-06-20',
    startTime: '15:00',
    endTime: '16:30',
    room: '曦绘艺术 203 教室',
    campusName: '曦绘艺术',
    evaluateDeadline: '2026-06-30',
  },
  {
    id: 'mc-005',
    bookingId: 'pb-mc-005',
    status: 'cancelled' as MyCourseStatus,
    courseName: '小提琴体验课',
    teacherName: '陈老师',
    date: '2026-06-18',
    startTime: '09:30',
    endTime: '10:30',
    room: '曦绘艺术 301 教室',
    campusName: '曦绘艺术',
  },
];

/** 把 MyCourseItem 映射为 ParentBookingItem，写入本地存储 */
function syncToParentBookings(courses: MyCourseItem[]) {
  try {
    const raw = Taro.getStorageSync(STORAGE_KEY);
    const existing: ParentBookingItem[] = Array.isArray(raw) ? raw : [];

    const mapped: ParentBookingItem[] = courses.map((course) => ({
      id: course.bookingId,
      userId: 'current-user',
      studentName: '我的孩子',
      occurrenceKey: `${course.id}_${course.date}`,
      courseId: course.id,
      courseName: course.courseName,
      courseType: 'group',
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

    // 保留非当前用户的记录，替换当前用户的 mock 记录
    const others = existing.filter((item) => !mapped.some((m) => m.id === item.id));
    Taro.setStorageSync(STORAGE_KEY, [...mapped, ...others]);
  } catch {
    // 忽略本地存储异常
  }
}

export async function mockGetMyCourseList(): Promise<MyCourseItem[]> {
  await delay();
  syncToParentBookings(MOCK_COURSES);
  return MOCK_COURSES;
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
