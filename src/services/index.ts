/**
 * Service 层统一出口
 * 页面只从此文件导入，不直接引用 @/data/*
 */
export {
  studentService,
  packageService,
  packageTemplateService,
  lessonRecordService,
  leaveService,
  classService,
  scheduleService,
  notificationService,
  formatDateCN,
} from './student';
export { courseTemplateService } from './course-template';
export { cardTypeService } from './card-type';
export type { FeeMethod } from './student';
export { temporaryRescheduleService } from './temporary-reschedule';
export {
  login,
  wechatLogin,
  phoneLogin,
  registerStep1,
  registerStep2,
  registerStep3,
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
export type {
  StatsPeriod,
  StatsData,
  QuickEntry,
  HomeOperationContent,
  OperationActionConfig,
  OperationActivityItem,
  OperationBannerItem,
} from './home';
export { feedbackService } from './feedback';
export { uploadService } from './upload';
export type { UploadResult } from './upload';
export {
  teacherService,
  salaryModelService,
  salarySettingsService,
  teacherScheduleService,
} from './teacher';
export {
  campusService,
  salaryModelCampusService,
  payDaySettingsService,
  holidayService,
  businessHoursService,
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
export type { BookableVenue, VenueBookingRecord, VenueBookingSlot } from '@/types/venue-booking';
export { myCourseService } from './my-course';
export type { MyCourseItem, MyCourseStatus } from './my-course';
export { onboardingService } from './onboarding';
export type { StoreOnboardingProgress, StoreOnboardingStep } from '@/types/onboarding';
