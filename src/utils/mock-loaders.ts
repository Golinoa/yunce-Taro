/**
 * Mock 模块懒加载器 �?生产包仅�?isUseMock() 分支内触�?import，配�?webpack stub 替换剔除 mock 体积�? */
function lazy<T extends Record<string, unknown>>(loader: () => Promise<T>): () => Promise<T> {
  let promise: Promise<T> | null = null;
  return () => (promise ??= loader());
}

export const loadAuthMock = lazy(() => import('@/data/auth'));
export const loadHomeMock = lazy(() => import('@/data/home'));
export const loadMockDatabase = lazy(() => import('@/data/mock-database'));
export const loadStudentsMock = lazy(() => import('@/data/students'));
export const loadLeadMock = lazy(() => import('@/data/lead'));
export const loadClassBookingMock = lazy(() => import('@/data/class-booking'));
export const loadCourseTemplateMock = lazy(() => import('@/data/course-template'));
export const loadCourseCategoryMock = lazy(() => import('@/data/course-category'));
export const loadFollowRecordsMock = lazy(() => import('@/data/follow-records'));
export const loadMyCourseMock = lazy(() => import('@/data/my-course'));
export const loadMemberCardMock = lazy(() => import('@/data/member-card'));
export const loadStatisticsMock = lazy(() => import('@/data/statistics'));
export const loadStatisticsBaseMock = lazy(() => import('@/data/mock/statistics-base'));
export const loadOrganizationMock = lazy(() => import('@/data/organization'));
export const loadCampusInviteMock = lazy(() => import('@/data/campus-invite'));
export const loadStoreEntryMock = lazy(() => import('@/data/store-entry'));
export const loadSubscribeMessageMock = lazy(() => import('@/data/subscribe-message'));
export const loadFeedbackMock = lazy(() => import('@/data/feedback'));
export const loadAuditLogMock = lazy(() => import('@/data/audit-log'));
export const loadVenueBookingMock = lazy(() => import('@/data/venue-booking'));
export const loadCampusMock = lazy(() => import('@/data/campus'));
export const loadTeacherMock = lazy(() => import('@/data/teacher'));
export const loadCardTypeMock = lazy(() => import('@/data/card-type'));
export const loadLessonDebtMock = lazy(() => import('@/data/lesson-debt'));
export const loadCustomTodosMock = lazy(() => import('@/data/custom-todos'));
export const loadOnboardingMock = lazy(() => import('@/data/onboarding'));
export const loadOpsAlertsMock = lazy(() => import('@/data/ops-alerts'));
export const loadDataCenterMock = lazy(() => import('@/package-statistics/data/data-center-mock'));
