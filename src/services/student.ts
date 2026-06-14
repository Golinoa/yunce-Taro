/**
 * Service 层 — 学员相关 API
 * 定义接口契约，当前由 mock 实现，联调时替换为 request 调用
 */
import {
  mockGetStudentsByTeacher,
  mockGetStudentsByParent,
  mockGetStudentById,
  mockCreateStudent,
  mockUpdateStudent,
  mockDeleteStudent,
  mockCheckDuplicateName,
  mockGetParentsByStudent,
  mockRemoveParentFromStudent,
  mockFindStudentByInviteCode,
  mockBindParentToStudent,
  mockGetPackagesByStudent,
  mockGetPackageById,
  mockCreatePackage,
  mockUpdatePackage,
  mockDeductPackageHours,
  mockGetActivePackagesByStudent,
  mockGetPackageTemplates,
  mockCreatePackageTemplate,
  mockUpdatePackageTemplate,
  mockDeletePackageTemplate,
  mockGetRecordsByStudent,
  mockGetLessonRecordsByTeacher,
  mockGetLessonRecordsByTeacherAndMonth,
  mockGetLessonRecordsByTeacherAndRange,
  mockGetLessonRecordsByStudent,
  mockCreateLessonRecord,
  mockGetLessonRecordById,
  mockDeleteLessonRecord,
  mockGetLeavesByStudent,
  mockGetLeavesByTeacher,
  mockCreateLeaveRequest,
  mockUpdateLeaveRequestStatus,
  mockGetClassesByTeacher,
  mockGetClassById,
  mockGetStudentsByClass,
  mockGetClassStudentCount,
  mockCreateClass,
  mockUpdateClass,
  mockDeleteClass,
  mockRemoveStudentFromClass,
  mockAddStudentsToClass,
  mockTransferStudent,
  mockEndClass,
  mockGetSchedulesByTeacher,
  mockGetScheduleById,
  mockCreateSchedule,
  mockUpdateSchedule,
  mockDeleteSchedule,
  mockCheckScheduleConflict,
  mockGetNotificationsByReceiver,
  mockMarkNotificationAsRead,
  mockMarkAllNotificationsAsRead,
  mockGetSubjects,
  mockGetSubjectById,
  mockSendNotification,
  pickBestPackage,
  formatDateCN,
} from '@/data/students';
import type { Class, ClassStudent } from '@/types/class';
import type {
  CoursePackage,
  CoursePackageTemplate,
  FeeMethod,
  RechargeFormData,
} from '@/types/course-package';
import type { LeaveRequest } from '@/types/leave-request';
import type { LessonRecord } from '@/types/lesson-record';
import type { Notification } from '@/types/notification';
import type { Schedule } from '@/types/schedule';
import type { Student, StudentParent } from '@/types/student';
import type { Subject } from '@/types/subject';

// ============================================
// Mock 数据（从 @/data/students 迁移，作为唯一数据源）
// ============================================

// ============================================
// 学员 Service
// ============================================
export const studentService = {
  /** 获取教师的学员列表 */
  getByTeacher: (teacherId: string) => mockGetStudentsByTeacher(teacherId),
  // 联调时替换为:
  // getByTeacher: (teacherId: string) => get<Student[]>(`/api/teachers/${teacherId}/students`),

  /** 获取家长绑定的学员列表 */
  getByParent: (parentId: string) => mockGetStudentsByParent(parentId),

  /** 获取学员详情 */
  getById: (studentId: string) => mockGetStudentById(studentId),

  /** 创建学员 */
  create: (data: Omit<Student, 'id' | 'created_at' | 'updated_at'>) => mockCreateStudent(data),

  /** 更新学员 */
  update: (studentId: string, data: Partial<Student>) => mockUpdateStudent(studentId, data),

  /** 删除学员 */
  remove: (studentId: string) => mockDeleteStudent(studentId),

  /** 重名检测 */
  checkDuplicateName: (teacherId: string, name: string, excludeId?: string) =>
    mockCheckDuplicateName(teacherId, name, excludeId),

  /** 获取学员的绑定家长 */
  getParents: (studentId: string) => mockGetParentsByStudent(studentId),

  /** 解绑家长 */
  removeParent: (bindingId: string) => mockRemoveParentFromStudent(bindingId),

  /** 通过邀请码查找学员 */
  findByInviteCode: (code: string) => mockFindStudentByInviteCode(code),

  /** 绑定家长到学员 */
  bindParent: (studentId: string, parentId: string) => mockBindParentToStudent(studentId, parentId),
};

// ============================================
// 课包 Service
// ============================================
export const packageService = {
  /** 获取学员的课包列表 */
  getByStudent: (studentId: string) => mockGetPackagesByStudent(studentId),

  /** 获取课包详情 */
  getById: (packageId: string) => mockGetPackageById(packageId),

  /** 创建课包 */
  create: (data: Omit<CoursePackage, 'id' | 'created_at' | 'updated_at'>) =>
    mockCreatePackage(data),

  /** 更新课包 */
  update: (packageId: string, data: Partial<CoursePackage>) => mockUpdatePackage(packageId, data),

  /** 扣减课时（悲观更新：以服务端返回为准） */
  deductHours: (packageId: string, hours: number) => mockDeductPackageHours(packageId, hours),

  /** 获取学员的活跃课包 */
  getActiveByStudent: (studentId: string) => mockGetActivePackagesByStudent(studentId),

  /** 自动匹配最优课包 */
  pickBest: (packages: CoursePackage[], hoursNeeded: number, subjectId?: string) =>
    pickBestPackage(packages, hoursNeeded, subjectId),

  /** 课时充值（含赠送课时+分期） */
  createRecharge: (data: RechargeFormData): Promise<CoursePackage> => {
    const giftHours = data.gift_hours || 0;
    const totalWithGift = data.total_hours + giftHours;
    const now = new Date().toISOString();
    const pkg: CoursePackage = {
      id: `pkg-${Date.now()}`,
      teacher_id: '',
      student_id: data.student_id,
      name: data.name || '课时充值',
      total_hours: totalWithGift,
      remaining_hours: totalWithGift,
      status: 'active',
      valid_days: data.valid_days,
      fee_amount: data.fee_amount,
      fee_method: data.fee_method,
      note: data.note,
      created_at: now,
      updated_at: now,
      template_id: data.template_id,
      gift_hours: giftHours,
      installment_enabled: data.installment_enabled,
      installment_period: data.installment_period,
      installment_schedule: data.installment_schedule,
    };
    // 联调时替换为:
    // return post<CoursePackage>('/api/packages/recharge', data);
    return Promise.resolve(pkg);
  },
};

// ============================================
// 课包模板 Service
// ============================================
export const packageTemplateService = {
  /** 获取教师的课包模板列表 */
  getByTeacher: (teacherId: string) => mockGetPackageTemplates(teacherId),

  /** 创建课包模板 */
  create: (data: Omit<CoursePackageTemplate, 'id' | 'created_at' | 'updated_at'>) =>
    mockCreatePackageTemplate(data),

  /** 更新课包模板 */
  update: (templateId: string, data: Partial<CoursePackageTemplate>) =>
    mockUpdatePackageTemplate(templateId, data),

  /** 删除课包模板 */
  remove: (templateId: string) => mockDeletePackageTemplate(templateId),
};

// ============================================
// 消课记录 Service
// ============================================
export const lessonRecordService = {
  /** 获取学员的消课记录 */
  getByStudent: (studentId: string) => mockGetRecordsByStudent(studentId),

  /** 获取教师的消课记录 */
  getByTeacher: (teacherId: string) => mockGetLessonRecordsByTeacher(teacherId),

  /** 按月份获取教师的消课记录 */
  getByTeacherAndMonth: (teacherId: string, year: number, month: number) =>
    mockGetLessonRecordsByTeacherAndMonth(teacherId, year, month),

  /** 按日期范围获取教师的消课记录 */
  getByTeacherAndRange: (teacherId: string, startDate: string, endDate: string) =>
    mockGetLessonRecordsByTeacherAndRange(teacherId, startDate, endDate),

  /** 获取学员消课记录（别名） */
  getRecordsByStudent: (studentId: string) => mockGetLessonRecordsByStudent(studentId),

  /** 创建消课记录（悲观更新：成功后才更新 UI） */
  create: (data: Omit<LessonRecord, 'id' | 'created_at' | 'updated_at'>) =>
    mockCreateLessonRecord(data),

  /** 获取单条消课记录 */
  getById: (recordId: string) => mockGetLessonRecordById(recordId),

  /** 删除消课记录 */
  remove: (recordId: string) => mockDeleteLessonRecord(recordId),
};

// ============================================
// 请假 Service
// ============================================
export const leaveService = {
  getByStudent: (studentId: string) => mockGetLeavesByStudent(studentId),
  getByTeacher: (teacherId: string) => mockGetLeavesByTeacher(teacherId),
  create: (data: Omit<LeaveRequest, 'id' | 'created_at' | 'updated_at'>) =>
    mockCreateLeaveRequest(data),
  updateStatus: (leaveId: string, status: 'approved' | 'rejected') =>
    mockUpdateLeaveRequestStatus(leaveId, status),
};

// ============================================
// 班级 Service
// ============================================
export const classService = {
  getByTeacher: (teacherId: string) => mockGetClassesByTeacher(teacherId),
  getById: (classId: string) => mockGetClassById(classId),
  getStudents: (classId: string) => mockGetStudentsByClass(classId),
  getStudentCount: (classId: string) => mockGetClassStudentCount(classId),
  create: (data: Omit<Class, 'id' | 'created_at' | 'updated_at'>) => mockCreateClass(data),
  update: (classId: string, data: Partial<Class>) => mockUpdateClass(classId, data),
  remove: (classId: string) => mockDeleteClass(classId),
  removeStudent: (classId: string, studentId: string) =>
    mockRemoveStudentFromClass(classId, studentId),
  addStudents: (classId: string, studentIds: string[]) =>
    mockAddStudentsToClass(classId, studentIds),
  transferStudent: (classId: string, targetClassId: string, studentId: string) =>
    mockTransferStudent(classId, targetClassId, studentId),
  end: (classId: string) => mockEndClass(classId),
};

// ============================================
// 排课 Service
// ============================================
export const scheduleService = {
  getByTeacher: (teacherId: string) => mockGetSchedulesByTeacher(teacherId),
  getById: (scheduleId: string) => mockGetScheduleById(scheduleId),
  create: (data: Omit<Schedule, 'id' | 'created_at' | 'updated_at'>) => mockCreateSchedule(data),
  update: (scheduleId: string, data: Partial<Schedule>) => mockUpdateSchedule(scheduleId, data),
  remove: (scheduleId: string) => mockDeleteSchedule(scheduleId),
  checkConflict: (
    teacherId: string,
    dayOfWeek: number,
    startTime: string,
    endTime: string,
    excludeId?: string,
  ) => mockCheckScheduleConflict(teacherId, dayOfWeek, startTime, endTime, excludeId),
};

// ============================================
// 通知 Service
// ============================================
export const notificationService = {
  getByReceiver: (receiverId: string) => mockGetNotificationsByReceiver(receiverId),
  markAsRead: (notificationId: string) => mockMarkNotificationAsRead(notificationId),
  markAllAsRead: (receiverId: string) => mockMarkAllNotificationsAsRead(receiverId),
  send: (data: {
    sender_id: string;
    receiver_id: string;
    title: string;
    content: string;
    related_id?: string;
  }) => mockSendNotification(data),
};

// ============================================
// 科目 Service
// ============================================
export const subjectService = {
  getAll: () => mockGetSubjects(),
  getById: (subjectId: string) => mockGetSubjectById(subjectId),
};

// ============================================
// 工具函数
// ============================================
export { formatDateCN };
export type { FeeMethod };
