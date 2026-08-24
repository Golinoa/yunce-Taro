/**
 * 松果排课 - 类型定义统一导出
 */

// 用户与认证
export type { UserRole, Profile, AuthSession } from './profile';
export type { TodoItem } from './home-todo';
export type { TodoQuadrant } from './todo-quadrant';

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
export type {
  PackageStatus,
  FeeMethod,
  CoursePackage,
  RefundFormData,
  PackageTransaction,
  PackageTransactionType,
} from './course-package';

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
export type { TemporaryReschedule } from './temporary-reschedule';

// 请假
export type { LeaveType, LeaveStatus, LeaveRequest } from './leave-request';

// 通知
export type { NotificationType, Notification } from './notification';

// 反馈
export type { Feedback } from './feedback';

// 试听线索
export type {
  LeadStatus,
  LeadSourceType,
  OwnerLockStatus,
  OwnerLockReason,
  Lead,
  LeadBookingStatus,
  TrialMode,
  LeadBooking,
  TrialSlotStatus,
  TrialSlotConfig,
  FollowUpAction,
  IntentLevel,
  LeadFollowUp,
  ConversionType,
  LeadConversion,
  LeadFilterTab,
  LeadSort,
  LeadSummary,
  LeadCardModel,
  LeadFormData,
} from './lead';
export {
  LEAD_STATUS_META,
  LEAD_SOURCE_META,
  LEAD_FILTER_TAB_OPTIONS,
  FOLLOW_UP_ACTION_META,
  INTENT_LEVEL_META,
} from '../constants/lead';

// 校区设置
export type {
  CampusType,
  PartnerMode,
  CampusUIModel,
  CampusStats,
  CampusFormData,
  SalaryModelType as CampusSalaryModelType,
  SalaryModel as CampusSalaryModel,
  PayDayMode,
  PayDaySettings,
  HolidayStatus,
  Holiday,
  BusinessHours,
  SpecialDate,
} from './campus';
