/**
 * 我的课程 Service
 *
 * 家长端「我的约课」统一出口，按状态聚合课程数据。
 */
import { mockCancelMyCourse, mockGetMyCourseList } from '@/data/my-course';

export type MyCourseStatus = 'booked' | 'waiting' | 'pending_evaluate' | 'cancelled';

export interface MyCourseItem {
  id: string;
  /** 关联的预约记录 ID，用于跳转预约详情页 */
  bookingId: string;
  status: MyCourseStatus;
  courseName: string;
  teacherName: string;
  date: string;
  startTime: string;
  endTime: string;
  room?: string;
  campusName?: string;
  queuePosition?: number;
  evaluateDeadline?: string;
}

const USE_MOCK =
  typeof process !== 'undefined' && typeof process.env !== 'undefined'
    ? process.env.VITE_USE_MOCK !== 'false'
    : true;

export const myCourseService = {
  /** 获取我的课程列表 */
  getList: async (): Promise<MyCourseItem[]> => {
    if (!USE_MOCK) {
      // TODO: 真实接口联调时替换
      return [];
    }
    return mockGetMyCourseList();
  },

  /** 取消预约/排队 */
  cancel: async (bookingId: string): Promise<void> => {
    if (!USE_MOCK) {
      // TODO: 真实接口联调时替换
      return;
    }
    return mockCancelMyCourse(bookingId);
  },
};
