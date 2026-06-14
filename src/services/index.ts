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
  subjectService,
  formatDateCN,
} from './student';
export type { FeeMethod } from './student';
export { authService } from './auth';
export { homeService } from './home';
export { feedbackService } from './feedback';
export {
  teacherService,
  salaryModelService,
  salarySettingsService,
  teacherScheduleService,
} from './teacher';
