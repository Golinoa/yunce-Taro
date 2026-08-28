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
import type { TrialCourseSlot } from '@/data/lead';
import { isUseMock } from '@/utils/build-env';
import { loadLeadMock } from '@/utils/mock-loaders';
import { del, get, patch, post, put } from '@/utils/request';
import {
  type PaginatedResponse,
  unwrapPaginatedList,
} from '@/utils/pagination';

async function fetchLeadList(params: Record<string, unknown>) {
  const data = await get<PaginatedResponse<Record<string, unknown>>>('/leads', params);
  return unwrapPaginatedList(data).map(mapBackendLead);
}

async function fetchLeadBookings(params: Record<string, unknown>) {
  const data = await get<PaginatedResponse<Record<string, unknown>>>('/leads/bookings', params);
  return unwrapPaginatedList(data).map(mapBackendLeadBooking);
}

async function fetchLeadFollowUps(params: Record<string, unknown>) {
  const data = await get<PaginatedResponse<Record<string, unknown>>>('/leads/follow-ups', params);
  return unwrapPaginatedList(data).map(mapBackendLeadFollowUp);
}

async function fetchTrialSlotList(params: Record<string, unknown>) {
  const data = await get<PaginatedResponse<Record<string, unknown>>>('/leads/trial-slots', params);
  return unwrapPaginatedList(data).map(mapBackendTrialSlotConfig);
}

export async function getLeadsByTeacher(teacherId: string): Promise<Lead[]> {
  if (isUseMock()) { const { mockGetLeadsByTeacher } = await loadLeadMock(); return mockGetLeadsByTeacher(teacherId); }
  return fetchLeadList({ teacherId, page: 1, pageSize: 100 });
}

export async function getLeadById(leadId: string): Promise<Lead | null> {
  if (isUseMock()) { const { mockGetLeadById } = await loadLeadMock(); return mockGetLeadById(leadId); }
  const detail = await get<Record<string, unknown>>(`/leads/${leadId}`);
  if (!detail) return null;
  return mapBackendLead(detail);
}

export async function getLeadCards(
  teacherId: string,
  filterTab?: LeadFilterTab,
): Promise<LeadCardModel[]> {
  if (isUseMock()) { const { mockGetLeadCardsByTeacher } = await loadLeadMock(); return mockGetLeadCardsByTeacher(teacherId, filterTab); }
  const leads = await fetchLeadList({ teacherId, page: 1, pageSize: 100, filterTab });
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
  if (isUseMock()) { const { mockGetLeadSummary } = await loadLeadMock(); return mockGetLeadSummary(teacherId); }
  const summary = await get<Record<string, unknown>>('/leads/summary', { teacherId });
  return mapBackendLeadSummary(summary);
}

export async function createLead(data: LeadFormData, teacherId: string): Promise<Lead> {
  if (isUseMock()) { const { mockCreateLead } = await loadLeadMock(); return mockCreateLead(data, teacherId); }
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
  teacherId: string;
  campusId: string;
  sourceType: 'share_link' | 'qr';
  sourceCourseId?: string;
}): Promise<Lead> {
  if (isUseMock()) { const { mockCreateLeadFromInvite } = await loadLeadMock(); return mockCreateLeadFromInvite(params); }
  const created = await post<Record<string, unknown>>('/leads', {
    childName: params.childName,
    childNickname: params.childNickname,
    parentName: params.parentName,
    parentPhone: params.parentPhone,
    campusId: params.campusId,
    sourceCourseId: params.sourceCourseId,
    sourceType: params.sourceType,
  });
  return mapBackendLead(created);
}

export async function updateLeadStatus(
  leadId: string,
  status: LeadStatus,
  extra?: { closed_reason?: string },
): Promise<Lead | null> {
  if (isUseMock()) { const { mockUpdateLeadStatus } = await loadLeadMock(); return mockUpdateLeadStatus(leadId, status, extra); }
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
  if (isUseMock()) { const { mockUpdateLead } = await loadLeadMock(); return mockUpdateLead(leadId, data, options); }
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
  if (isUseMock()) { const { mockReassignLead } = await loadLeadMock(); return mockReassignLead(leadId, newOwnerId, reason, opts); }
  return updateLead(
    leadId,
    {
      owner_teacher_id: newOwnerId,
      reassign_reason: reason,
    },
    opts,
  );
}

export async function deleteLead(leadId: string): Promise<boolean> {
  if (isUseMock()) { const { mockDeleteLead } = await loadLeadMock(); return mockDeleteLead(leadId); }
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
  if (isUseMock()) { const { mockCreateLeadBooking } = await loadLeadMock(); return mockCreateLeadBooking(params); }
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
  if (isUseMock()) { const { mockBookTrialByClass } = await loadLeadMock(); return mockBookTrialByClass(params); }
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
  if (isUseMock()) { const { mockGetLeadBookings } = await loadLeadMock(); return mockGetLeadBookings(leadId); }
  return fetchLeadBookings({ leadId, page: 1, pageSize: 100 });
}

export async function getLeadBookingsByTeacher(
  teacherId: string,
  params?: { startDate?: string; endDate?: string; status?: LeadBooking['status'] },
): Promise<LeadBooking[]> {
  if (isUseMock()) { const { mockGetLeadBookingsByTeacher } = await loadLeadMock(); return mockGetLeadBookingsByTeacher(teacherId, params); }
  return fetchLeadBookings({
    teacherId,
    startDate: params?.startDate,
    endDate: params?.endDate,
    status: params?.status,
    page: 1,
    pageSize: 100,
  });
}

export async function checkInPrivateLeadBooking(
  bookingId: string,
): Promise<LeadBooking | null> {
  if (isUseMock()) { const { mockCheckInPrivateLeadBooking } = await loadLeadMock(); return mockCheckInPrivateLeadBooking(bookingId); }
  const updated = await put<Record<string, unknown>>(`/leads/bookings/${bookingId}`, {
    status: 'completed',
  });
  return mapBackendLeadBooking(updated);
}

export async function cancelLeadBooking(bookingId: string): Promise<LeadBooking | null> {
  if (isUseMock()) { const { mockCancelLeadBooking } = await loadLeadMock(); return mockCancelLeadBooking(bookingId); }
  const updated = await post<Record<string, unknown>>(`/leads/bookings/${bookingId}/cancel`);
  return mapBackendLeadBooking(updated);
}

export async function restoreLeadBooking(bookingId: string): Promise<LeadBooking | null> {
  if (isUseMock()) { const { mockRestoreLeadBooking } = await loadLeadMock(); return mockRestoreLeadBooking(bookingId); }
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
  if (isUseMock()) { const { mockUpdateLeadBooking } = await loadLeadMock(); return mockUpdateLeadBooking(bookingId, data); }
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
  if (isUseMock()) { const { mockGetLeadFollowUps } = await loadLeadMock(); return mockGetLeadFollowUps(leadId); }
  return fetchLeadFollowUps({ leadId, page: 1, pageSize: 100 });
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
  if (isUseMock()) { const { mockCreateFollowUp } = await loadLeadMock(); return mockCreateFollowUp(params); }
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
  if (isUseMock()) { const { mockGetLeadConversions } = await loadLeadMock(); return mockGetLeadConversions(leadId); }
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
  if (isUseMock()) { const { mockCreateConversion } = await loadLeadMock(); return mockCreateConversion(params); }
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
  if (isUseMock()) { const { mockGetTrialCourseSlots } = await loadLeadMock(); return mockGetTrialCourseSlots(campusId); }
  const slots = await fetchTrialSlotList({
    campusId,
    status: 'active',
    page: 1,
    pageSize: 100,
  });
  return slots.map(mapTrialSlotToCourseSlot);
}

export async function getTrialSlotConfigs(
  teacherId?: string,
  campusId?: string,
): Promise<TrialSlotConfig[]> {
  if (isUseMock()) { const { mockGetTrialSlotConfigs } = await loadLeadMock(); return mockGetTrialSlotConfigs(teacherId, campusId); }
  return fetchTrialSlotList({
    teacherId,
    campusId,
    page: 1,
    pageSize: 100,
  });
}

export async function getTrialSlotConfigById(id: string): Promise<TrialSlotConfig | null> {
  if (isUseMock()) { const { mockGetTrialSlotConfigById } = await loadLeadMock(); return mockGetTrialSlotConfigById(id); }
  const list = await fetchTrialSlotList({ page: 1, pageSize: 100 });
  return list.find((item) => item.id === id) ?? null;
}

export async function createTrialSlotConfig(
  data: Omit<TrialSlotConfig, 'id' | 'current_count' | 'created_at' | 'updated_at'>,
): Promise<TrialSlotConfig> {
  if (isUseMock()) { const { mockCreateTrialSlotConfig } = await loadLeadMock(); return mockCreateTrialSlotConfig(data); }
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
  if (isUseMock()) { const { mockUpdateTrialSlotConfig } = await loadLeadMock(); return mockUpdateTrialSlotConfig(id, data); }
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
  if (isUseMock()) { const { mockDeleteTrialSlotConfig } = await loadLeadMock(); return mockDeleteTrialSlotConfig(id); }
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
  if (isUseMock()) { const { mockBatchCreateProxyBookings } = await loadLeadMock(); return mockBatchCreateProxyBookings(params); }
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
  checkInPrivateLeadBooking,
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
