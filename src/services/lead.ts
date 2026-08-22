/**
 * Service 层 — 试听线索相关 API
 *
 * 定义接口契约，当前由 mock 实现，联调时替换为 request 调用。
 * 规范：mock 函数用 mock 前缀，联调时只改 Service 一行切换。
 */
import {
  mockGetLeadsByTeacher,
  mockGetLeadById,
  mockGetLeadCardsByTeacher,
  mockGetLeadSummary,
  mockCreateLead,
  mockCreateLeadFromInvite,
  mockUpdateLeadStatus,
  mockUpdateLead,
  mockReassignLead,
  mockDeleteLead,
  mockCreateLeadBooking,
  mockBatchCreateProxyBookings,
  mockBookTrialByClass,
  mockGetLeadBookings,
  mockGetLeadBookingsByTeacher,
  mockCancelLeadBooking,
  mockRestoreLeadBooking,
  mockUpdateLeadBooking,
  mockGetLeadFollowUps,
  mockCreateFollowUp,
  mockGetLeadConversions,
  mockCreateConversion,
  mockGetTrialCourseSlots,
  mockGetTrialSlotConfigs,
  mockGetTrialSlotConfigById,
  mockCreateTrialSlotConfig,
  mockUpdateTrialSlotConfig,
  mockDeleteTrialSlotConfig,
  type TrialCourseSlot,
} from '@/data/lead';
import type {
  Lead,
  LeadBooking,
  LeadBookingDifficulty,
  LeadFollowUp,
  LeadConversion,
  LeadCardModel,
  LeadSummary,
  LeadFormData,
  LeadStatus,
  LeadFilterTab,
  TrialSlotConfig,
} from '@/types/lead';

// ============================================
// Mock 开关：联调时改为 false 即可切换到 API
// ============================================
const USE_MOCK = true;

// ============================================
// 线索 CRUD
// ============================================

/** 获取老师的线索列表 */
export async function getLeadsByTeacher(teacherId: string): Promise<Lead[]> {
  if (USE_MOCK) return mockGetLeadsByTeacher(teacherId);
  // TODO: 联调时替换为 API
  // return get<Lead[]>(`/leads?teacher_id=${teacherId}`);
  return mockGetLeadsByTeacher(teacherId);
}

/** 获取线索详情 */
export async function getLeadById(leadId: string): Promise<Lead | null> {
  if (USE_MOCK) return mockGetLeadById(leadId);
  // TODO: return get<Lead>(`/leads/${leadId}`);
  return mockGetLeadById(leadId);
}

/** 获取线索卡片列表（带筛选） */
export async function getLeadCards(
  teacherId: string,
  filterTab?: LeadFilterTab,
): Promise<LeadCardModel[]> {
  if (USE_MOCK) return mockGetLeadCardsByTeacher(teacherId, filterTab);
  // TODO: return get<LeadCardModel[]>(`/leads/cards?teacher_id=${teacherId}&filter=${filterTab}`);
  return mockGetLeadCardsByTeacher(teacherId, filterTab);
}

/** 获取线索统计摘要 */
export async function getLeadSummary(teacherId: string): Promise<LeadSummary> {
  if (USE_MOCK) return mockGetLeadSummary(teacherId);
  // TODO: return get<LeadSummary>(`/leads/summary?teacher_id=${teacherId}`);
  return mockGetLeadSummary(teacherId);
}

/** 创建线索（手动录入） */
export async function createLead(data: LeadFormData, teacherId: string): Promise<Lead> {
  if (USE_MOCK) return mockCreateLead(data, teacherId);
  // TODO: return post<Lead>('/leads', { ...data, creator_teacher_id: teacherId });
  return mockCreateLead(data, teacherId);
}

/** 通过邀约链接创建线索（家长注册后自动触发） */
export async function createLeadFromInvite(params: {
  parentUserId: string;
  parentName?: string;
  parentPhone?: string;
  childName: string;
  childNickname?: string;
  teacherId: string;
  campusId: string;
  sourceType: 'share_link' | 'qr';
  sourceCourseId?: string;
}): Promise<Lead> {
  if (USE_MOCK) return mockCreateLeadFromInvite(params);
  // TODO: return post<Lead>('/leads/invite', params);
  return mockCreateLeadFromInvite(params);
}

/** 更新线索状态 */
export async function updateLeadStatus(
  leadId: string,
  status: LeadStatus,
  extra?: { closed_reason?: string },
): Promise<Lead | null> {
  if (USE_MOCK) return mockUpdateLeadStatus(leadId, status, extra);
  // TODO: return put<Lead>(`/leads/${leadId}/status`, { status, ...extra });
  return mockUpdateLeadStatus(leadId, status, extra);
}

/** 更新线索信息 */
export async function updateLead(
  leadId: string,
  data: Partial<Lead>,
  options?: { forceReassign?: boolean },
): Promise<Lead | null> {
  if (USE_MOCK) return mockUpdateLead(leadId, data, options);
  // TODO: return put<Lead>(`/leads/${leadId}`, data);
  return mockUpdateLead(leadId, data, options);
}

/** 线索改派（专用入口，锁定态需显式 forceReassign，记录改派原因与审计） */
export async function reassignLead(
  leadId: string,
  newOwnerId: string,
  reason: string,
  opts?: { forceReassign?: boolean; operatorId?: string },
): Promise<Lead | null> {
  if (USE_MOCK) return mockReassignLead(leadId, newOwnerId, reason, opts);
  // TODO: return put<Lead>(`/leads/${leadId}/reassign`, { new_owner_id: newOwnerId, reason, ...opts });
  return mockReassignLead(leadId, newOwnerId, reason, opts);
}

/** 删除线索 */
export async function deleteLead(leadId: string): Promise<boolean> {
  if (USE_MOCK) return mockDeleteLead(leadId);
  // TODO: return del(`/leads/${leadId}`);
  return mockDeleteLead(leadId);
}

// ============================================
// 试听预约
// ============================================

/** 创建试听预约 */
export async function createLeadBooking(params: {
  leadId: string;
  trialMode?: 'group' | 'private';
  referenceScheduleId?: string;
  timeOffsetMinutes?: number;
  classId?: string;
  className?: string;
  courseId: string;
  courseName: string;
  subjectId?: string;
  subjectName?: string;
  campusId: string;
  campusName?: string;
  teacherId: string;
  teacherName?: string;
  lessonDate: string;
  startTime: string;
  endTime: string;
  room?: string;
  bookingType: 'self' | 'proxy';
  operatorId?: string;
  note?: string;
}): Promise<LeadBooking> {
  if (USE_MOCK) return mockCreateLeadBooking(params);
  // TODO: return post<LeadBooking>('/leads/bookings', params);
  return mockCreateLeadBooking(params);
}

/** 根据班级快速预约试听（课表卡片入口） */
export async function bookTrialByClass(params: {
  leadId: string;
  classId: string;
  className?: string;
  lessonDate: string;
  startTime: string;
  endTime: string;
  teacherId?: string;
  teacherName?: string;
  operatorId?: string;
  note?: string;
}): Promise<LeadBooking> {
  if (USE_MOCK) return mockBookTrialByClass(params);
  // TODO: return post<LeadBooking>('/leads/bookings/by-class', params);
  return mockBookTrialByClass(params);
}

/** 获取线索的预约列表 */
export async function getLeadBookings(leadId: string): Promise<LeadBooking[]> {
  if (USE_MOCK) return mockGetLeadBookings(leadId);
  // TODO: return get<LeadBooking[]>(`/leads/${leadId}/bookings`);
  return mockGetLeadBookings(leadId);
}

/** 获取老师的所有试听预约（用于课表标记试听班级） */
export async function getLeadBookingsByTeacher(
  teacherId: string,
  params?: { startDate?: string; endDate?: string; status?: LeadBooking['status'] },
): Promise<LeadBooking[]> {
  if (USE_MOCK) return mockGetLeadBookingsByTeacher(teacherId, params);
  // TODO: return get<LeadBooking[]>('/leads/bookings', { teacher_id: teacherId, ...params });
  return mockGetLeadBookingsByTeacher(teacherId, params);
}

/** 取消试听预约 */
export async function cancelLeadBooking(bookingId: string): Promise<LeadBooking | null> {
  if (USE_MOCK) return mockCancelLeadBooking(bookingId);
  // TODO: return put<LeadBooking>(`/leads/bookings/${bookingId}/cancel`);
  return mockCancelLeadBooking(bookingId);
}

/** 恢复已取消的试听预约 */
export async function restoreLeadBooking(bookingId: string): Promise<LeadBooking | null> {
  if (USE_MOCK) return mockRestoreLeadBooking(bookingId);
  // TODO: return put<LeadBooking>(`/leads/bookings/${bookingId}/restore`);
  return mockRestoreLeadBooking(bookingId);
}

/** 更新试听预约 */
export async function updateLeadBooking(
  bookingId: string,
  data: {
    lessonDate?: string;
    startTime?: string;
    endTime?: string;
    courseName?: string;
    childName?: string;
    note?: string;
    teacherId?: string;
    difficulty?: LeadBookingDifficulty;
    room?: string;
    trialMode?: LeadBooking['trial_mode'];
  },
): Promise<LeadBooking | null> {
  if (USE_MOCK) return mockUpdateLeadBooking(bookingId, data);
  // TODO: return put<LeadBooking>(`/leads/bookings/${bookingId}`, data);
  return mockUpdateLeadBooking(bookingId, data);
}

// ============================================
// 跟进记录
// ============================================

/** 获取线索的跟进记录 */
export async function getLeadFollowUps(leadId: string): Promise<LeadFollowUp[]> {
  if (USE_MOCK) return mockGetLeadFollowUps(leadId);
  // TODO: return get<LeadFollowUp[]>(`/leads/${leadId}/follow-ups`);
  return mockGetLeadFollowUps(leadId);
}

/** 创建跟进记录 */
export async function createFollowUp(params: {
  leadId: string;
  action: LeadFollowUp['action'];
  intentLevel?: LeadFollowUp['intent_level'];
  content: string;
  nextFollowUpAt?: string;
  operatorId: string;
  operatorName?: string;
}): Promise<LeadFollowUp> {
  if (USE_MOCK) return mockCreateFollowUp(params);
  // TODO: return post<LeadFollowUp>(`/leads/${params.leadId}/follow-ups`, params);
  return mockCreateFollowUp(params);
}

// ============================================
// 转化记录
// ============================================

/** 获取线索的转化记录 */
export async function getLeadConversions(leadId: string): Promise<LeadConversion[]> {
  if (USE_MOCK) return mockGetLeadConversions(leadId);
  // TODO: return get<LeadConversion[]>(`/leads/${leadId}/conversions`);
  return mockGetLeadConversions(leadId);
}

/** 创建转化记录（转正式学员） */
export async function createConversion(params: {
  leadId: string;
  conversionType: LeadConversion['conversion_type'];
  studentId: string;
  mergeToStudentId?: string;
  operatorId: string;
  note?: string;
}): Promise<LeadConversion> {
  if (USE_MOCK) return mockCreateConversion(params);
  // TODO: return post<LeadConversion>(`/leads/${params.leadId}/conversions`, params);
  return mockCreateConversion(params);
}

// ============================================
// 可预约课程（试听专用）
// ============================================

/** 获取试听可预约课程列表 */
export async function getTrialCourseSlots(campusId?: string): Promise<TrialCourseSlot[]> {
  if (USE_MOCK) return mockGetTrialCourseSlots(campusId);
  // TODO: return get<TrialCourseSlot[]>(`/leads/trial-slots?campus_id=${campusId}`);
  return mockGetTrialCourseSlots(campusId);
}

// ============================================
// 独立试听时段配置
// ============================================

/** 获取独立试听时段列表 */
export async function getTrialSlotConfigs(
  teacherId?: string,
  campusId?: string,
): Promise<TrialSlotConfig[]> {
  if (USE_MOCK) return mockGetTrialSlotConfigs(teacherId, campusId);
  // TODO: return get<TrialSlotConfig[]>(`/trial-slot-configs?teacher_id=${teacherId}&campus_id=${campusId}`);
  return mockGetTrialSlotConfigs(teacherId, campusId);
}

/** 获取独立试听时段详情 */
export async function getTrialSlotConfigById(id: string): Promise<TrialSlotConfig | null> {
  if (USE_MOCK) return mockGetTrialSlotConfigById(id);
  // TODO: return get<TrialSlotConfig>(`/trial-slot-configs/${id}`);
  return mockGetTrialSlotConfigById(id);
}

/** 创建独立试听时段 */
export async function createTrialSlotConfig(
  data: Omit<TrialSlotConfig, 'id' | 'current_count' | 'created_at' | 'updated_at'>,
): Promise<TrialSlotConfig> {
  if (USE_MOCK) return mockCreateTrialSlotConfig(data);
  // TODO: return post<TrialSlotConfig>('/trial-slot-configs', data);
  return mockCreateTrialSlotConfig(data);
}

/** 更新独立试听时段 */
export async function updateTrialSlotConfig(
  id: string,
  data: Partial<TrialSlotConfig>,
): Promise<TrialSlotConfig | null> {
  if (USE_MOCK) return mockUpdateTrialSlotConfig(id, data);
  // TODO: return put<TrialSlotConfig>(`/trial-slot-configs/${id}`, data);
  return mockUpdateTrialSlotConfig(id, data);
}

/** 删除独立试听时段 */
export async function deleteTrialSlotConfig(id: string): Promise<boolean> {
  if (USE_MOCK) return mockDeleteTrialSlotConfig(id);
  // TODO: return del(`/trial-slot-configs/${id}`);
  return mockDeleteTrialSlotConfig(id);
}

/** 批量创建代约预约（支持会员+线索混合） */
export async function batchCreateProxyBookings(params: {
  memberIds: string[];
  leadIds: string[];
  /** 会员消耗的课包映射：memberId -> packageId */
  memberPackages?: Record<string, string>;
  teacherId: string;
  teacherName?: string;
  lessonDate: string;
  startTime: string;
  endTime: string;
  courseId: string;
  courseName: string;
  campusId: string;
  trialMode?: 'group' | 'private';
  operatorId?: string;
  note?: string;
}): Promise<LeadBooking[]> {
  if (USE_MOCK) return mockBatchCreateProxyBookings(params);
  // TODO: return post<LeadBooking[]>('/leads/bookings/batch-proxy', params);
  return mockBatchCreateProxyBookings(params);
}

// ============================================
// Service 对象导出（统一出口）
// ============================================

export const leadService = {
  getLeadsByTeacher,
  getLeadById,
  getLeadCards,
  getLeadSummary,
  createLead,
  createLeadFromInvite,
  updateLeadStatus,
  updateLead,
  reassignLead,
  deleteLead,
  createLeadBooking,
  batchCreateProxyBookings,
  bookTrialByClass,
  getLeadBookings,
  getLeadBookingsByTeacher,
  cancelLeadBooking,
  restoreLeadBooking,
  updateLeadBooking,
  getLeadFollowUps,
  createFollowUp,
  getLeadConversions,
  createConversion,
  getTrialCourseSlots,
  getTrialSlotConfigs,
  getTrialSlotConfigById,
  createTrialSlotConfig,
  updateTrialSlotConfig,
  deleteTrialSlotConfig,
};

export type { TrialCourseSlot, TrialSlotConfig };
