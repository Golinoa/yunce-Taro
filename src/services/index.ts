/**
 * Service 层统一出口
 * 页面只从此文件导入，不直接引用 @/data/*
 */
export { studentService, formatDateCN } from './student';
export { scheduleService } from './schedule';
export { packageService, packageTemplateService, invalidatePackagesCache } from './package';
export { lessonRecordService } from './lesson-record';
export { classService } from './class';
export { leaveService } from './leave';
export { notificationService } from './notification';
export { studentParentService } from './student-parents';
export { courseTemplateService } from './course-template';
export { cardTypeService } from './card-type';
export type { FeeMethod } from './student';
export { temporaryRescheduleService } from './temporary-reschedule';
export { makeupBookingService } from './makeup-booking';
export {
  login,
  wechatLogin,
  bindWechatCredentials,
  bindAccountEmail,
  sendBindEmailCode,
  phoneLogin,
  registerStep1,
  registerStep1ByEmail,
  registerStep2,
  registerStep3,
  prepareEmailLogin,
  prepareEmailRegister,
  registerWithEmailPassword,
  signUp,
  verifyCampusCode,
  verifyStudentCode,
  validateInviteCode,
  getSession,
  switchIdentity,
  addIdentity,
  restoreRegisterDrafts,
  logout,
} from './auth';
export type { LoginResult, RegisterStep1Result, RegisterDraft } from './auth';
export { homeService } from './home';
export type { StatsPeriod, StatsData, QuickEntry } from './home';
export { todoService, clearStudentRechargeTodoState } from './todo';
export type { TodoListParams, TodoListView, TodoListItem } from './todo';
export { feedbackService } from './feedback';
export { uploadService } from './upload';
export type { UploadResult, UploadType, UploadOptions } from './upload';
export { teacherService, salaryModelService, salarySettingsService } from './teacher';
export {
  campusService,
  salaryModelCampusService,
  payDaySettingsService,
  holidayService,
  notifyService,
  campusDataService,
  subjectService,
  venueService,
  roomService,
} from './campus';
export { statisticsService } from './statistics';
export { dataCenterService } from './data-center';
export { leadService } from './lead';
export type { TrialCourseSlot } from './lead';
export { classBookingService } from './class-booking';
export { venueBookingService } from './venue-booking';
export { bookingConfigService } from './booking-config';
export { opsAlertService } from './ops-alerts';
export type { AttendanceAnomalyItem, RenewalReminderItem } from './ops-alerts';
export type { BookableVenue, VenueBookingRecord, VenueBookingSlot } from '@/types/venue-booking';
export { myBookingService, getMyRelatedBookings, sortMyBookingsNearToFar } from './my-booking';
export type {
  MyBookingCard,
  MyBookingDateRange,
  MyBookingNavigatePayload,
  MyBookingSourceType,
  MyBookingStatus,
} from '@/types/my-booking';
export { myCourseService } from './my-course';
export type { MyCourseItem, MyCourseStatus } from './my-course';
export { onboardingService } from './onboarding';
export type { StoreOnboardingProgress, StoreOnboardingStep } from '@/types/onboarding';
export { subscribeMessageService } from './subscribe-message';
export { calendarSyncService } from './calendar-sync';
export { organizationService } from './organization';
export type {
  OrganizationInfo,
  PendingRelation,
  Membership,
  MyOrganizationResult,
  BindOrganizationResult,
  BindByCodeResult,
  BindByCodeKind,
  ShareContext,
  StudentParentRelation,
} from './organization';
export { storeEntryService, saveStoreEntryDraft, readStoreEntryDraft } from './store-entry';
export type { StoreEntryLatestResult } from '@/types/store-entry';
