/**
 * Service 层 — 首页相关 API
 */
import {
  mockGetTeacher,
  mockGetStudents,
  mockGetTodaySchedules,
  mockGetRecentRecords,
  mockGetStudentPackages,
  mockGetTotalRemainingHours,
  mockGetUnreadCount,
  mockGetTodayRecordCount,
  mockGetStudentsByParent as mockHomeGetStudentsByParent,
  mockGetSchedulesByStudent,
  mockGetRecordsByStudent as mockHomeGetRecordsByStudent,
  mockGetPackagesByStudent as mockHomeGetPackagesByStudent,
} from '@/data/home';
import type { CoursePackage } from '@/types/course-package';
import type { LessonRecord } from '@/types/lesson-record';
import type { Schedule } from '@/types/schedule';
import type { Student } from '@/types/student';
import type { Teacher } from '@/types/teacher';

export const homeService = {
  /** 获取教师信息 */
  getTeacher: (userId: string) => mockGetTeacher(userId),

  /** 获取教师的学生列表 */
  getStudents: (teacherId: string, limit?: number) => mockGetStudents(teacherId, limit),

  /** 获取今日排课 */
  getTodaySchedules: (teacherId: string) => mockGetTodaySchedules(teacherId),

  /** 获取最近消课记录 */
  getRecentRecords: (teacherId: string, limit?: number) => mockGetRecentRecords(teacherId, limit),

  /** 获取学生的课时套餐 */
  getStudentPackages: (studentId: string) => mockGetStudentPackages(studentId),

  /** 获取教师所有学生的剩余课时总数 */
  getTotalRemainingHours: (teacherId: string) => mockGetTotalRemainingHours(teacherId),

  /** 获取未读通知数 */
  getUnreadCount: (userId: string) => mockGetUnreadCount(userId),

  /** 获取今日已消课数 */
  getTodayRecordCount: (teacherId: string) => mockGetTodayRecordCount(teacherId),

  // 家长端
  getStudentsByParent: (parentId: string) => mockHomeGetStudentsByParent(parentId),
  getSchedulesByStudent: (studentId: string) => mockGetSchedulesByStudent(studentId),
  getRecordsByStudent: (studentId: string, limit?: number) =>
    mockHomeGetRecordsByStudent(studentId, limit),
  getPackagesByStudent: (studentId: string) => mockHomeGetPackagesByStudent(studentId),
};
