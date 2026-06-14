/**
 * 云策教务 - 类型定义统一导出
 */

// 用户与认证
export type { UserRole, Profile, AuthSession } from './profile';

// 教师
export type {
  Teacher,
  TeacherRole,
  SalaryStatus,
  TeacherStatus,
  ResignType,
  SalaryModelType,
  DeductionType,
  Deduction,
  SalaryModel,
  ClassRateOverride,
  PayHistoryRecord,
  TeacherUIModel,
  TeacherFilter,
  PendingPayAction,
  SalarySettings,
} from './teacher';

// 学生与家长
export type { Student, StudentParent } from './student';

// 课时套餐
export type { PackageStatus, FeeMethod, CoursePackage } from './course-package';

// 科目
export type { Subject } from './subject';

// 消课记录
export type { LessonRecord } from './lesson-record';

// 班级
export type {
  Class,
  ClassStudent,
  ClassType,
  ClassStatus,
  ClassColor,
  ClassDetail,
  ClassStudentInfo,
  CheckinRecord,
} from './class';

// 排课
export type { ScheduleColor, DayOfWeek, Schedule } from './schedule';

// 请假
export type { LeaveType, LeaveStatus, LeaveRequest } from './leave-request';

// 通知
export type { NotificationType, Notification } from './notification';

// 反馈
export type { Feedback } from './feedback';
