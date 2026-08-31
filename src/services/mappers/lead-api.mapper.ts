import type {
  Lead,
  LeadBooking,
  LeadCardModel,
  LeadConversion,
  LeadFilterTab,
  LeadFollowUp,
  LeadSummary,
  TrialSlotConfig,
  TrialCourseSlot,
} from '@/types/lead';
import { formatApiDate, formatApiDateTime } from '@/utils/pagination';

type RawRecord = Record<string, unknown>;

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function num(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function mapBackendLead(raw: RawRecord): Lead {
  return {
    id: String(raw.id ?? ''),
    trial_student_id: String(raw.trial_student_id ?? raw.trialStudentId ?? ''),
    child_name: String(raw.child_name ?? raw.childName ?? ''),
    child_nickname: str(raw.child_nickname ?? raw.childNickname),
    child_gender: (raw.child_gender ?? raw.childGender) as Lead['child_gender'],
    child_age: str(raw.child_age ?? raw.childAge),
    avatar_url: str(raw.avatar_url ?? raw.avatarUrl ?? raw.avatar),
    parent_user_id: str(raw.parent_user_id ?? raw.parentUserId),
    parent_name: str(raw.parent_name ?? raw.parentName),
    parent_phone: str(raw.parent_phone ?? raw.parentPhone),
    first_invite_teacher_id: str(raw.first_invite_teacher_id ?? raw.firstInviteTeacherId),
    latest_invite_teacher_id: str(raw.latest_invite_teacher_id ?? raw.latestInviteTeacherId),
    booking_teacher_id: str(raw.booking_teacher_id ?? raw.bookingTeacherId),
    owner_teacher_id: str(raw.owner_teacher_id ?? raw.ownerTeacherId),
    creator_teacher_id: String(raw.creator_teacher_id ?? raw.creatorTeacherId ?? ''),
    campus_id: String(raw.campus_id ?? raw.campusId ?? ''),
    source_type: (raw.source_type ?? raw.sourceType ?? 'manual') as Lead['source_type'],
    source_course_id: str(raw.source_course_id ?? raw.sourceCourseId),
    booking_course_id: str(raw.booking_course_id ?? raw.bookingCourseId),
    source_channel: str(raw.source_channel ?? raw.sourceChannel),
    owner_lock_status: (raw.owner_lock_status ??
      raw.ownerLockStatus ??
      'weak') as Lead['owner_lock_status'],
    owner_lock_reason: raw.owner_lock_reason as Lead['owner_lock_reason'],
    reassign_reason: str(raw.reassign_reason ?? raw.reassignReason),
    status: (raw.status ?? 'new') as Lead['status'],
    notes: str(raw.notes),
    closed_reason: str(raw.closed_reason ?? raw.closedReason),
    first_touch_at: str(raw.first_touch_at ?? raw.firstTouchAt),
    visit_count: num(raw.visit_count ?? raw.visitCount) ?? 0,
    first_ip: str(raw.first_ip ?? raw.firstIp),
    first_region: str(raw.first_region ?? raw.firstRegion),
    last_visit_at: str(raw.last_visit_at ?? raw.lastVisitAt),
    booked_at: str(raw.booked_at ?? raw.bookedAt),
    converted_at: str(raw.converted_at ?? raw.convertedAt),
    duplicate_hint: Boolean(raw.duplicate_hint ?? raw.duplicateHint),
    weak_bind_parent: Boolean(raw.weak_bind_parent ?? raw.weakBindParent),
    created_at: formatApiDateTime(raw.created_at ?? raw.createdAt),
    updated_at: formatApiDateTime(raw.updated_at ?? raw.updatedAt),
  };
}

export function mapBackendLeadBooking(raw: RawRecord): LeadBooking {
  return {
    id: String(raw.id ?? ''),
    lead_id: String(raw.lead_id ?? raw.leadId ?? ''),
    trial_student_id: String(raw.trial_student_id ?? raw.trialStudentId ?? ''),
    trial_mode: (raw.trial_mode ?? raw.trialMode ?? 'group') as LeadBooking['trial_mode'],
    reference_schedule_id: str(raw.reference_schedule_id ?? raw.referenceScheduleId),
    time_offset_minutes: num(raw.time_offset_minutes ?? raw.timeOffsetMinutes),
    class_id: str(raw.class_id ?? raw.classId),
    class_name: str(raw.class_name ?? raw.className),
    course_id: String(raw.course_id ?? raw.courseId ?? ''),
    course_name: String(raw.course_name ?? raw.courseName ?? ''),
    subject_id: str(raw.subject_id ?? raw.subjectId),
    subject_name: str(raw.subject_name ?? raw.subjectName),
    campus_id: String(raw.campus_id ?? raw.campusId ?? ''),
    campus_name: str(raw.campus_name ?? raw.campusName),
    teacher_id: String(raw.teacher_id ?? raw.teacherId ?? ''),
    teacher_name: str(raw.teacher_name ?? raw.teacherName),
    owner_teacher_id: str(raw.owner_teacher_id ?? raw.ownerTeacherId),
    owner_teacher_name: str(raw.owner_teacher_name ?? raw.ownerTeacherName),
    lesson_date: formatApiDate(raw.lesson_date ?? raw.lessonDate),
    start_time: String(raw.start_time ?? raw.startTime ?? ''),
    end_time: String(raw.end_time ?? raw.endTime ?? ''),
    room: str(raw.room),
    status: (raw.status ?? 'pending') as LeadBooking['status'],
    difficulty: raw.difficulty as LeadBooking['difficulty'],
    booking_type: (raw.booking_type ?? raw.bookingType ?? 'proxy') as LeadBooking['booking_type'],
    operator_id: str(raw.operator_id ?? raw.operatorId),
    note: str(raw.note),
    child_name: str(raw.child_name ?? raw.childName),
    parent_name: str(raw.parent_name ?? raw.parentName),
    parent_phone: str(raw.parent_phone ?? raw.parentPhone),
    created_at: formatApiDateTime(raw.created_at ?? raw.createdAt),
    updated_at: formatApiDateTime(raw.updated_at ?? raw.updatedAt),
  };
}

export function mapBackendLeadFollowUp(raw: RawRecord): LeadFollowUp {
  return {
    id: String(raw.id ?? ''),
    lead_id: String(raw.lead_id ?? raw.leadId ?? ''),
    action: (raw.action ?? 'other') as LeadFollowUp['action'],
    intent_level: raw.intent_level as LeadFollowUp['intent_level'],
    content: String(raw.content ?? ''),
    next_follow_up_at: str(raw.next_follow_up_at ?? raw.nextFollowUpAt),
    operator_id: String(raw.operator_id ?? raw.operatorId ?? ''),
    operator_name: str(raw.operator_name ?? raw.operatorName),
    created_at: formatApiDateTime(raw.created_at ?? raw.createdAt),
  };
}

export function mapBackendLeadConversion(raw: RawRecord): LeadConversion {
  return {
    id: String(raw.id ?? ''),
    lead_id: String(raw.lead_id ?? raw.leadId ?? ''),
    conversion_type: (raw.conversion_type ??
      raw.conversionType ??
      'new_student') as LeadConversion['conversion_type'],
    student_id: String(raw.student_id ?? raw.studentId ?? ''),
    merge_to_student_id: str(raw.merge_to_student_id ?? raw.mergeToStudentId),
    operator_id: String(raw.operator_id ?? raw.operatorId ?? ''),
    note: str(raw.note),
    created_at: formatApiDateTime(raw.created_at ?? raw.createdAt),
  };
}

export function mapBackendTrialSlotConfig(raw: RawRecord): TrialSlotConfig {
  return {
    id: String(raw.id ?? ''),
    course_id: String(raw.course_id ?? raw.courseId ?? ''),
    course_name: String(raw.course_name ?? raw.courseName ?? ''),
    subject_id: str(raw.subject_id ?? raw.subjectId),
    subject_name: str(raw.subject_name ?? raw.subjectName),
    campus_id: String(raw.campus_id ?? raw.campusId ?? ''),
    campus_name: str(raw.campus_name ?? raw.campusName),
    teacher_id: String(raw.teacher_id ?? raw.teacherId ?? ''),
    teacher_name: str(raw.teacher_name ?? raw.teacherName),
    lesson_date: formatApiDate(raw.lesson_date ?? raw.lessonDate),
    start_time: String(raw.start_time ?? raw.startTime ?? ''),
    end_time: String(raw.end_time ?? raw.endTime ?? ''),
    room: str(raw.room),
    max_count: Number(raw.max_count ?? raw.maxCount ?? 0),
    current_count: Number(raw.current_count ?? raw.currentCount ?? 0),
    status: (raw.status ?? 'active') as TrialSlotConfig['status'],
    creator_teacher_id: String(raw.creator_teacher_id ?? raw.creatorTeacherId ?? ''),
    creator_teacher_name: str(raw.creator_teacher_name ?? raw.creatorTeacherName),
    note: str(raw.note),
    created_at: formatApiDateTime(raw.created_at ?? raw.createdAt),
    updated_at: formatApiDateTime(raw.updated_at ?? raw.updatedAt),
  };
}

export function mapBackendLeadSummary(raw: RawRecord): LeadSummary {
  return {
    total: Number(raw.total ?? 0),
    following: Number(raw.following ?? 0),
    booked: Number(raw.booked ?? 0),
    closed: Number(raw.closed ?? 0),
    today_trial: Number(raw.today_trial ?? raw.todayTrial ?? 0),
    pending: Number(raw.pending ?? 0),
    converted: Number(raw.converted ?? 0),
  };
}

export function mapBackendLeadCard(raw: RawRecord, viewerTeacherId?: string): LeadCardModel {
  const ownerTeacherId = str(raw.owner_teacher_id ?? raw.ownerTeacherId);
  return {
    id: String(raw.id ?? ''),
    trial_student_id: String(raw.trial_student_id ?? raw.trialStudentId ?? ''),
    child_name: String(raw.child_name ?? raw.childName ?? ''),
    child_nickname: str(raw.child_nickname ?? raw.childNickname),
    avatar_url: str(raw.avatar_url ?? raw.avatarUrl ?? raw.avatar),
    parent_phone: str(raw.parent_phone ?? raw.parentPhone),
    parent_name: str(raw.parent_name ?? raw.parentName),
    status: (raw.status ?? 'new') as LeadCardModel['status'],
    source_type: (raw.source_type ?? raw.sourceType ?? 'manual') as LeadCardModel['source_type'],
    booking_course_name: str(raw.booking_course_name ?? raw.bookingCourseName),
    owner_teacher_name:
      ownerTeacherId && viewerTeacherId && ownerTeacherId === viewerTeacherId ? '我' : undefined,
    owner_lock_status: (raw.owner_lock_status ??
      raw.ownerLockStatus ??
      'weak') as LeadCardModel['owner_lock_status'],
    latest_follow_up_at: str(raw.latest_follow_up_at ?? raw.latestFollowUpAt),
    next_follow_up_at: str(raw.next_follow_up_at ?? raw.nextFollowUpAt),
    created_at: formatApiDateTime(raw.created_at ?? raw.createdAt),
  };
}

export function filterLeadCardsByTab(
  cards: LeadCardModel[],
  filterTab?: LeadFilterTab,
): LeadCardModel[] {
  if (!filterTab || filterTab === 'all') return cards;
  return cards.filter((item) => {
    switch (filterTab) {
      case 'following':
        return ['new', 'pending', 'following', 'not_arrived'].includes(item.status);
      case 'booked':
        return ['booked', 'arrived'].includes(item.status);
      case 'closed':
        return ['closed', 'converted'].includes(item.status);
      default:
        return true;
    }
  });
}

export function mapTrialSlotToCourseSlot(slot: TrialSlotConfig): TrialCourseSlot {
  const total = slot.max_count || 0;
  const current = slot.current_count || 0;
  return {
    id: slot.id,
    courseId: slot.course_id,
    courseName: slot.course_name,
    subjectId: slot.subject_id,
    subjectName: slot.subject_name || '',
    teacherId: slot.teacher_id,
    teacherName: slot.teacher_name || '',
    campusId: slot.campus_id,
    campusName: slot.campus_name || '',
    lessonDate: slot.lesson_date,
    startTime: slot.start_time,
    endTime: slot.end_time,
    room: slot.room,
    availableSlots: Math.max(0, total - current),
    totalSlots: total,
  };
}
