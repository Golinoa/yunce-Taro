/**
 * Service 层 — 试听线索相关 API
 */
import {
  filterLeadCardsByTab,
  mapBackendLead,
  mapBackendLeadBooking,
  mapBackendLeadConversion,
  mapBackendLeadFollowUp,
  mapBackendLeadSummary,
  mapBackendTrialSlotConfig,
  mapTrialSlotToCourseSlot,
} from '@/services/mappers/lead-api.mapper';
import type {
  Lead,
  LeadBooking,
  LeadBookingDifficulty,
  LeadCardModel,
  LeadConversion,
  LeadFollowUp,
  LeadFormData,
  LeadFilterTab,
  LeadStatus,
  LeadSummary,
  TrialSlotConfig,
} from '@/types/lead';
import type { TrialCourseSlot } from '@/types/lead';


import { del, get, patch, post, put } from '@/utils/request';
import {
  API_PAGE_SIZE_BATCH,
  asPaginatedResponse,
  fetchAllPages,
  type PaginatedResponse,
} from '@/utils/pagination';

async function fetchLeadListPage(
  params: Record<string, unknown>,
): Promise<PaginatedResponse<Lead>> {
  const page = Number(params.page) || 1;
  const pageSize = Number(params.pageSize) || API_PAGE_SIZE_BATCH;
  const data = await get<PaginatedResponse<Record<string, unknown>>>('/leads', params);
  const normalized = asPaginatedResponse(data, page, pageSize);
  return {
    list: normalized.list.map(mapBackendLead),
    pagination: normalized.pagination,
  };
}

async function fetchLeadBookingsPage(
  params: Record<string, unknown>,
): Promise<PaginatedResponse<LeadBooking>> {
  const page = Number(params.page) || 1;
  const pageSize = Number(params.pageSize) || API_PAGE_SIZE_BATCH;
  const data = await get<PaginatedResponse<Record<string, unknown>>>('/leads/bookings', params);
  const normalized = asPaginatedResponse(data, page, pageSize);
  return {
    list: normalized.list.map(mapBackendLeadBooking),
    pagination: normalized.pagination,
  };
}

async function fetchLeadFollowUpsPage(
  params: Record<string, unknown>,
): Promise<PaginatedResponse<LeadFollowUp>> {
  const page = Number(params.page) || 1;
  const pageSize = Number(params.pageSize) || API_PAGE_SIZE_BATCH;
  const data = await get<PaginatedResponse<Record<string, unknown>>>('/leads/follow-ups', params);
  const normalized = asPaginatedResponse(data, page, pageSize);
  return {
    list: normalized.list.map(mapBackendLeadFollowUp),
    pagination: normalized.pagination,
  };
}

async function fetchTrialSlotListPage(
  params: Record<string, unknown>,
): Promise<PaginatedResponse<TrialSlotConfig>> {
  const page = Number(params.page) || 1;
  const pageSize = Number(params.pageSize) || API_PAGE_SIZE_BATCH;
  const data = await get<PaginatedResponse<Record<string, unknown>>>('/leads/trial-slots', params);
  const normalized = asPaginatedResponse(data, page, pageSize);
  return {
    list: normalized.list.map(mapBackendTrialSlotConfig),
    pagination: normalized.pagination,
  };
}

export async function getLeadsByTeacher(teacherId: string): Promise<Lead[]> {
    return fetchAllPages(
    (page, pageSize) => fetchLeadListPage({ teacherId, page, pageSize }),
    API_PAGE_SIZE_BATCH,
  );
}

export async function getLeadById(leadId: string): Promise<Lead | null> {
    const detail = await get<Record<string, unknown>>(`/leads/${leadId}`);
  if (!detail) return null;
  return mapBackendLead(detail);
}

export async function getLeadCards(
  teacherId: string,
  filterTab?: LeadFilterTab,
): Promise<LeadCardModel[]> {
    const leads = await fetchAllPages(
    (page, pageSize) => fetchLeadListPage({ teacherId, page, pageSize, filterTab }),
    API_PAGE_SIZE_BATCH,
  );
  const cards = leads.map((lead) => ({
    id: lead.id,
    trial_student_id: lead.trial_student_id,
    child_name: lead.child_name,
    child_nickname: lead.child_nickname,
    parent_phone: lead.parent_phone,
    parent_name: lead.parent_name,
    status: lead.status,
    source_type: lead.source_type,
    booking_course_name: undefined,
    owner_teacher_name:
      lead.owner_teacher_id === teacherId || lead.creator_teacher_id === teacherId
        ? '我'
        : undefined,
    owner_lock_status: lead.owner_lock_status,
    latest_follow_up_at: undefined,
    next_follow_up_at: undefined,
    created_at: lead.created_at,
  }));
  return filterLeadCardsByTab(cards, filterTab);
}

export async function getLeadSummary(teacherId: string): Promise<LeadSummary> {
    const summary = await get<Record<string, unknown>>('/leads/summary', { teacherId });
  return mapBackendLeadSummary(summary);
}

export async function createLead(data: LeadFormData, teacherId: string): Promise<Lead> {
    const created = await post<Record<string, unknown>>('/leads', {
    childName: data.child_name,
    childNickname: data.child_nickname,
    childGender: data.child_gender,
    childAge: data.child_age,
    parentName: data.parent_name,
    parentPhone: data.parent_phone,
    campusId: data.campus_id,
    subjectId: data.subject_id,
    sourceCourseId: data.source_course_id,
    sourceType: data.source_type || 'manual',
    notes: data.notes,
  });
  return mapBackendLead(created);
}

export async function createLeadFromInvite(params: {
  parentUserId: string;
  parentName?: string;
  parentPhone?: string;
  childName: string;
  childNickname?: string;
  childGender?: 'male' | 'female';
  childAge?: string;
  teacherId: string;
  campusId: string;
  sourceType: 'share_link' | 'qr';
  sourceCourseId?: string;
  visitorKey?: string;
}): Promise<Lead> {
    const created = await post<Record<string, unknown>>('/leads', {
    childName: params.childName,
    childNickname: params.childNickname,
    childGender: params.childGender,
    childAge: params.childAge,
    parentName: params.parentName,
    parentPhone: params.parentPhone,
    parentUserId: params.parentUserId,
    inviteTeacherId: params.teacherId,
    visitorKey: params.visitorKey,
    campusId: params.campusId,
    sourceCourseId: params.sourceCourseId,
    sourceType: params.sourceType,
  });
  return mapBackendLead(created);
}

/** 家长邀约落地页一键提交（公开）：建线索 + 可选本场预约 */
export async function submitInviteLanding(params: {
  teacherId: string;
  campusId: string;
  sourceType?: 'share_link' | 'qr';
  childName: string;
  childNickname?: string;
  childGender?: 'male' | 'female';
  childAge?: string;
  parentName?: string;
  parentPhone?: string;
  parentUserId?: string;
  visitorKey?: string;
  sourceCourseId?: string;
  type?: 'class_lesson' | 'group_slot';
  classId?: string;
  className?: string;
  scheduleId?: string;
  slotId?: string;
  date?: string;
  start?: string;
  end?: string;
  /** 过期场次应传 false，仅留线索意向 */
  bookLesson?: boolean;
}): Promise<{
  success: boolean;
  message: string;
  lead_id: string;
  booking_id: string | null;
  status: string;
  booking_status: string | null;
  lesson_expired: boolean;
  booked: boolean;
}> {
    return post(
    '/leads/landing/submit',
    {
      teacherId: params.teacherId,
      campusId: params.campusId,
      sourceType: params.sourceType || 'share_link',
      childName: params.childName,
      childNickname: params.childNickname,
      childGender: params.childGender,
      childAge: params.childAge,
      parentName: params.parentName,
      parentPhone: params.parentPhone,
      parentUserId: params.parentUserId,
      visitorKey: params.visitorKey,
      sourceCourseId: params.sourceCourseId,
      type: params.type,
      classId: params.classId,
      className: params.className,
      scheduleId: params.scheduleId,
      slotId: params.slotId,
      date: params.date,
      start: params.start,
      end: params.end,
      bookLesson: params.bookLesson,
    },
    { skipAuth: true },
  );
}

/** 邀约落地页访问埋点（公开接口，服务端记 IP） */
export async function trackLandingVisit(params: {
  teacherId: string;
  campusId: string;
  sourceType?: 'share_link' | 'qr' | 'manual';
  parentUserId?: string;
  visitorKey?: string;
  leadId?: string;
  inviteCode?: string;
  lessonExpired?: boolean;
  lessonKey?: string;
  className?: string;
  date?: string;
  start?: string;
  end?: string;
}): Promise<{
  visit_id?: string;
  lead_id?: string | null;
  visit_count: number;
  first_ip?: string | null;
  last_visit_at?: string;
  attributed: boolean;
  expired_watch?: {
    counted: boolean;
    view_count: number;
    already_notified: boolean;
  };
}> {
    return post('/leads/landing/visit', {
    teacherId: params.teacherId,
    campusId: params.campusId,
    sourceType: params.sourceType,
    parentUserId: params.parentUserId,
    visitorKey: params.visitorKey,
    leadId: params.leadId,
    inviteCode: params.inviteCode,
    lessonExpired: params.lessonExpired,
    lessonKey: params.lessonKey,
    className: params.className,
    date: params.date,
    start: params.start,
    end: params.end,
  }, { skipAuth: true });
}

export async function updateLeadStatus(
  leadId: string,
  status: LeadStatus,
  extra?: { closed_reason?: string },
): Promise<Lead | null> {
    await patch<Record<string, unknown>>(`/leads/${leadId}/status`, {
    status,
    closedReason: extra?.closed_reason,
  });
  return getLeadById(leadId);
}

export async function updateLead(
  leadId: string,
  data: Partial<Lead>,
  options?: { forceReassign?: boolean },
): Promise<Lead | null> {
    await put<Record<string, unknown>>(`/leads/${leadId}`, {
    childName: data.child_name,
    childNickname: data.child_nickname,
    childGender: data.child_gender,
    childAge: data.child_age,
    parentName: data.parent_name,
    parentPhone: data.parent_phone,
    status: data.status,
    notes: data.notes,
    closedReason: data.closed_reason,
  });
  return getLeadById(leadId);
}

export async function reassignLead(
  leadId: string,
  newOwnerId: string,
  reason: string,
  opts?: { forceReassign?: boolean; operatorId?: string },
): Promise<Lead | null> {
    await post<Record<string, unknown>>(`/leads/${leadId}/reassign`, {
    ownerTeacherId: newOwnerId,
    reason,
  });
  return getLeadById(leadId);
}

export async function deleteLead(leadId: string): Promise<boolean> {
    await del(`/leads/${leadId}`);
  return true;
}

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
    const created = await post<Record<string, unknown>>('/leads/bookings', {
    leadId: params.leadId,
    trialMode: params.trialMode ?? 'group',
    referenceScheduleId: params.referenceScheduleId,
    timeOffsetMinutes: params.timeOffsetMinutes,
    classId: params.classId,
    className: params.className,
    courseId: params.courseId,
    courseName: params.courseName,
    subjectId: params.subjectId,
    subjectName: params.subjectName,
    campusId: params.campusId,
    campusName: params.campusName,
    teacherId: params.teacherId,
    teacherName: params.teacherName,
    lessonDate: params.lessonDate,
    startTime: params.startTime,
    endTime: params.endTime,
    room: params.room,
    bookingType: params.bookingType,
    operatorId: params.operatorId,
    note: params.note,
  });
  return mapBackendLeadBooking(created);
}

export async function bookTrialByClass(params: {
  leadId: string;
  classId: string;
  className?: string;
  campusId?: string;
  lessonDate: string;
  startTime: string;
  endTime: string;
  teacherId?: string;
  teacherName?: string;
  operatorId?: string;
  note?: string;
}): Promise<LeadBooking> {
    return createLeadBooking({
    leadId: params.leadId,
    classId: params.classId,
    className: params.className,
    courseId: params.classId,
    courseName: params.className || '试听课',
    campusId: params.campusId || '',
    teacherId: params.teacherId || '',
    teacherName: params.teacherName,
    lessonDate: params.lessonDate,
    startTime: params.startTime,
    endTime: params.endTime,
    bookingType: 'proxy',
    operatorId: params.operatorId,
    note: params.note,
  });
}

export async function getLeadBookings(leadId: string): Promise<LeadBooking[]> {
    return fetchAllPages(
    (page, pageSize) => fetchLeadBookingsPage({ leadId, page, pageSize }),
    API_PAGE_SIZE_BATCH,
  );
}

export async function getLeadBookingsByTeacher(
  teacherId: string,
  params?: { startDate?: string; endDate?: string; status?: LeadBooking['status'] },
): Promise<LeadBooking[]> {
    return fetchAllPages(
    (page, pageSize) =>
      fetchLeadBookingsPage({
        teacherId,
        startDate: params?.startDate,
        endDate: params?.endDate,
        status: params?.status,
        page,
        pageSize,
      }),
    API_PAGE_SIZE_BATCH,
  );
}

/** 校长/管理员：按校区查看试听预约 */
export async function getLeadBookingsByCampus(
  campusId?: string,
  params?: { startDate?: string; endDate?: string; status?: LeadBooking['status'] },
): Promise<LeadBooking[]> {
    return fetchAllPages(
    (page, pageSize) =>
      fetchLeadBookingsPage({
        campusId,
        startDate: params?.startDate,
        endDate: params?.endDate,
        status: params?.status,
        page,
        pageSize,
      }),
    API_PAGE_SIZE_BATCH,
  );
}

export async function checkInPrivateLeadBooking(
  bookingId: string,
): Promise<LeadBooking | null> {
    const updated = await put<Record<string, unknown>>(`/leads/bookings/${bookingId}`, {
    status: 'completed',
  });
  return mapBackendLeadBooking(updated);
}

/** 手动标记试听未到 */
export async function markLeadBookingNoShow(
  bookingId: string,
): Promise<LeadBooking | null> {
    const updated = await put<Record<string, unknown>>(`/leads/bookings/${bookingId}`, {
    status: 'no_show',
  });
  return mapBackendLeadBooking(updated);
}

export async function cancelLeadBooking(bookingId: string): Promise<LeadBooking | null> {
    const updated = await post<Record<string, unknown>>(`/leads/bookings/${bookingId}/cancel`);
  return mapBackendLeadBooking(updated);
}

export async function restoreLeadBooking(bookingId: string): Promise<LeadBooking | null> {
    const updated = await post<Record<string, unknown>>(`/leads/bookings/${bookingId}/restore`);
  return mapBackendLeadBooking(updated);
}

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
    const updated = await put<Record<string, unknown>>(`/leads/bookings/${bookingId}`, {
    lessonDate: data.lessonDate,
    startTime: data.startTime,
    endTime: data.endTime,
    courseName: data.courseName,
    childName: data.childName,
    note: data.note,
    teacherId: data.teacherId,
    difficulty: data.difficulty,
    room: data.room,
    trialMode: data.trialMode,
  });
  return mapBackendLeadBooking(updated);
}

export async function getLeadFollowUps(leadId: string): Promise<LeadFollowUp[]> {
    return fetchAllPages(
    (page, pageSize) => fetchLeadFollowUpsPage({ leadId, page, pageSize }),
    API_PAGE_SIZE_BATCH,
  );
}

export async function createFollowUp(params: {
  leadId: string;
  action: LeadFollowUp['action'];
  intentLevel?: LeadFollowUp['intent_level'];
  content: string;
  nextFollowUpAt?: string;
  operatorId: string;
  operatorName?: string;
}): Promise<LeadFollowUp> {
    const created = await post<Record<string, unknown>>('/leads/follow-ups', {
    leadId: params.leadId,
    action: params.action,
    intentLevel: params.intentLevel,
    content: params.content,
    nextFollowUpAt: params.nextFollowUpAt,
  });
  return mapBackendLeadFollowUp(created);
}

export async function getLeadConversions(leadId: string): Promise<LeadConversion[]> {
    const detail = await get<Record<string, unknown>>(`/leads/${leadId}`);
  const conversions = Array.isArray(detail.conversions) ? detail.conversions : [];
  return conversions.map((item) => mapBackendLeadConversion(item as Record<string, unknown>));
}

export async function createConversion(params: {
  leadId: string;
  conversionType: LeadConversion['conversion_type'];
  studentId: string;
  mergeToStudentId?: string;
  operatorId: string;
  note?: string;
}): Promise<LeadConversion> {
    const created = await post<Record<string, unknown>>('/leads/conversions', {
    leadId: params.leadId,
    conversionType: params.conversionType,
    studentId: params.studentId,
    mergeToStudentId: params.mergeToStudentId,
    note: params.note,
  });
  return mapBackendLeadConversion(created);
}

export async function getTrialCourseSlots(campusId?: string): Promise<TrialCourseSlot[]> {
    const slots = await fetchAllPages(
    (page, pageSize) =>
      fetchTrialSlotListPage({
        campusId,
        status: 'active',
        page,
        pageSize,
      }),
    API_PAGE_SIZE_BATCH,
  );
  return slots.map(mapTrialSlotToCourseSlot);
}

export async function getTrialSlotConfigs(
  teacherId?: string,
  campusId?: string,
): Promise<TrialSlotConfig[]> {
    return fetchAllPages(
    (page, pageSize) =>
      fetchTrialSlotListPage({
        teacherId,
        campusId,
        page,
        pageSize,
      }),
    API_PAGE_SIZE_BATCH,
  );
}

export async function getTrialSlotConfigById(id: string): Promise<TrialSlotConfig | null> {
    const list = await fetchAllPages(
    (page, pageSize) => fetchTrialSlotListPage({ page, pageSize }),
    API_PAGE_SIZE_BATCH,
  );
  return list.find((item) => item.id === id) ?? null;
}

export async function createTrialSlotConfig(
  data: Omit<TrialSlotConfig, 'id' | 'current_count' | 'created_at' | 'updated_at'>,
): Promise<TrialSlotConfig> {
    const created = await post<Record<string, unknown>>('/leads/trial-slots', {
    courseId: data.course_id,
    courseName: data.course_name,
    subjectId: data.subject_id,
    subjectName: data.subject_name,
    campusId: data.campus_id,
    campusName: data.campus_name,
    teacherId: data.teacher_id,
    teacherName: data.teacher_name,
    lessonDate: data.lesson_date,
    startTime: data.start_time,
    endTime: data.end_time,
    room: data.room,
    maxCount: data.max_count,
    note: data.note,
  });
  return mapBackendTrialSlotConfig(created);
}

export async function updateTrialSlotConfig(
  id: string,
  data: Partial<TrialSlotConfig>,
): Promise<TrialSlotConfig | null> {
    const updated = await put<Record<string, unknown>>(`/leads/trial-slots/${id}`, {
    courseName: data.course_name,
    subjectName: data.subject_name,
    lessonDate: data.lesson_date,
    startTime: data.start_time,
    endTime: data.end_time,
    room: data.room,
    maxCount: data.max_count,
    status: data.status,
    note: data.note,
  });
  return mapBackendTrialSlotConfig(updated);
}

export async function deleteTrialSlotConfig(id: string): Promise<boolean> {
    await del(`/leads/trial-slots/${id}`);
  return true;
}

export async function batchCreateProxyBookings(params: {
  memberIds: string[];
  leadIds: string[];
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
    const results: LeadBooking[] = [];
  for (const leadId of params.leadIds) {
    results.push(
      await createLeadBooking({
        leadId,
        trialMode: params.trialMode,
        courseId: params.courseId,
        courseName: params.courseName,
        campusId: params.campusId,
        teacherId: params.teacherId,
        teacherName: params.teacherName,
        lessonDate: params.lessonDate,
        startTime: params.startTime,
        endTime: params.endTime,
        bookingType: 'proxy',
        operatorId: params.operatorId,
        note: params.note,
      }),
    );
  }
  return results;
}

export const leadService = {
  getLeadsByTeacher,
  getLeadById,
  getLeadCards,
  getLeadSummary,
  createLead,
  createLeadFromInvite,
  submitInviteLanding,
  trackLandingVisit,
  updateLeadStatus,
  updateLead,
  reassignLead,
  deleteLead,
  createLeadBooking,
  batchCreateProxyBookings,
  bookTrialByClass,
  getLeadBookings,
  getLeadBookingsByTeacher,
  getLeadBookingsByCampus,
  cancelLeadBooking,
  checkInPrivateLeadBooking,
  markLeadBookingNoShow,
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
