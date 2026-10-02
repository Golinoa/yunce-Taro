/**
 * 点名页加载侧：请假过滤 / 记录回填 / 试听映射 / 会员卡课时匹配（Q2-2 续）
 */
import { leaveService, memberCardService, subjectService } from '@/services';
import type { Subject } from '@/types/campus';
import type { LessonRecord } from '@/types/lesson-record';
import type { MemberCardDetail } from '@/types/member-card';
import type { Student } from '@/types/student';
import { isRecordOfLesson } from '@/utils/lesson-record-scope';
import { getLessonRecordPriority, isWithinLessonOperateWindow } from './lesson-operate';
import type { CheckinStatus, ClassAttendanceMode } from './checkin-status';

export function isDateWithinRange(
  targetDate: string,
  startDate?: string,
  endDate?: string,
): boolean {
  if (!targetDate || !startDate) {
    return false;
  }
  const end = endDate || startDate;
  return targetDate >= startDate && targetDate <= end;
}

export function mapRecordStatusToCheckin(status?: string | null): CheckinStatus {
  if (status === 'leave') return 'leave';
  if (status && !['absent', 'cancelled'].includes(status)) return 'checked';
  return 'absent';
}

/** 审批请假学员 ID（与页内原逻辑一致） */
export function filterApprovedLeaveStudentIds(input: {
  leaves: Array<{
    status: string;
    student_id: string;
    original_date?: string;
    end_date?: string;
  }>;
  students: Array<{ id: string }>;
  lessonDate: string;
}): Set<string> {
  const classStudentIds = new Set(input.students.map((student) => student.id));
  return new Set(
    input.leaves
      .filter(
        (leave) =>
          leave.status === 'approved' &&
          classStudentIds.has(leave.student_id) &&
          isDateWithinRange(input.lessonDate, leave.original_date, leave.end_date),
      )
      .map((leave) => leave.student_id),
  );
}

export type ClassAttendanceState = {
  classRecords: LessonRecord[];
  checkedStudentIds: Set<string>;
  leaveStudentIds: Set<string>;
  recordByStudentId: Map<string, LessonRecord>;
  hasRecords: boolean;
};

export function buildClassAttendanceState(input: {
  records: LessonRecord[];
  classId: string;
  lessonDate: string;
  studentIds: string[];
  /** 本节排课规则 ID；给了才区分「同班同一天的另一节课」，拿不到按不区分兜底 */
  scheduleId?: string;
}): ClassAttendanceState {
  const studentIdSet = new Set(input.studentIds);
  const classRecords = input.records.filter(
    (record) =>
      isRecordOfLesson(record, {
        classId: input.classId,
        lessonDate: input.lessonDate,
        scheduleId: input.scheduleId,
      }) && studentIdSet.has(record.student_id),
  );

  const checkedStudentIds = new Set<string>();
  const leaveStudentIds = new Set<string>();
  classRecords.forEach((record) => {
    const status = mapRecordStatusToCheckin(record.status);
    if (status === 'leave') {
      leaveStudentIds.add(record.student_id);
    } else if (status === 'checked') {
      checkedStudentIds.add(record.student_id);
    }
  });

  const recordByStudentId = new Map<string, LessonRecord>();
  classRecords.forEach((record) => {
    const current = recordByStudentId.get(record.student_id);
    if (getLessonRecordPriority(record) >= getLessonRecordPriority(current)) {
      recordByStudentId.set(record.student_id, record);
    }
  });

  return {
    classRecords,
    checkedStudentIds,
    leaveStudentIds,
    recordByStudentId,
    hasRecords: classRecords.length > 0,
  };
}

export function resolveClassAttendanceMode(input: {
  hasRecords: boolean;
  viewOnly: boolean;
  lessonDate: string;
  now?: Date;
}): ClassAttendanceMode {
  const canOperate = !input.viewOnly && isWithinLessonOperateWindow(input.lessonDate, input.now);
  return input.hasRecords || !canOperate ? 'view' : 'normal';
}

export function buildTrialCheckinMap(input: {
  bookings: Array<{ id: string; trial_student_id: string }>;
  records: LessonRecord[];
  classId: string;
  lessonDate: string;
  /** 本节排课规则 ID；给了才区分「同班同一天的另一节课」 */
  scheduleId?: string;
}): Record<string, CheckinStatus> {
  const trialStudentIds = new Set(input.bookings.map((b) => b.trial_student_id));
  const trialRecords = input.records.filter(
    (record) =>
      isRecordOfLesson(record, {
        classId: input.classId,
        lessonDate: input.lessonDate,
        scheduleId: input.scheduleId,
      }) && trialStudentIds.has(record.student_id),
  );

  const initMap: Record<string, CheckinStatus> = {};
  input.bookings.forEach((booking) => {
    const matched = trialRecords.find((r) => r.student_id === booking.trial_student_id);
    initMap[booking.id] = matched ? mapRecordStatusToCheckin(matched.status) : 'absent';
  });
  return initMap;
}

export async function fetchApprovedLeaveStudentIds(input: {
  teacherId?: string;
  students: Student[];
  lessonDate: string;
}): Promise<Set<string>> {
  if (!input.lessonDate || input.students.length === 0) {
    return new Set();
  }
  const leaveList = await leaveService.getByTeacher(input.teacherId || '');
  return filterApprovedLeaveStudentIds({
    leaves: leaveList,
    students: input.students,
    lessonDate: input.lessonDate,
  });
}

/** 会员卡/学科加载并发上限：班级大时也不瞬间打爆后端 */
const CARD_LOAD_CONCURRENCY = 6;

/** 有上限的并发 map：保持入参顺序，具体错误由回调内部消化 */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  task: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workerCount = Math.min(Math.max(1, limit), items.length);
  const workers = Array.from({ length: workerCount }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await task(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * 批量解析学员「会员卡 + 学科」。
 *
 * 唯一账本是会员卡，学员科目取自卡种的 `cardTypeSubjectId`。
 * 并发上限 6，且同一 subject_id 只查一次（同班同科不重复拉）。
 * 无语义前置：取不到卡时 `memberCards` 落空数组、`subjects` 落 null（由提交侧提示「无可扣课时」）。
 */
export async function loadMemberCardMapsForStudents(students: Student[]): Promise<{
  subjects: Map<string, Subject | null>;
  memberCards: Map<string, MemberCardDetail[]>;
}> {
  const subjects = new Map<string, Subject | null>();
  const memberCards = new Map<string, MemberCardDetail[]>();
  if (students.length === 0) {
    return { subjects, memberCards };
  }

  /** 取卡失败不阻断点名：该学员退化为「无可用课时」，走既有失败提示 */
  await mapWithConcurrency(students, CARD_LOAD_CONCURRENCY, async (student) => {
    try {
      memberCards.set(student.id, (await memberCardService.getByStudent(student.id)) ?? []);
    } catch {
      memberCards.set(student.id, []);
    }
  });

  const subjectIds = new Set<string>();
  memberCards.forEach((cards) => {
    cards.forEach((card) => {
      if (card.cardTypeSubjectId) subjectIds.add(card.cardTypeSubjectId);
    });
  });

  const subjectCache = new Map<string, Subject | null>();
  await mapWithConcurrency([...subjectIds], CARD_LOAD_CONCURRENCY, async (subjectId) => {
    subjectCache.set(subjectId, await subjectService.getById(subjectId));
  });

  memberCards.forEach((cards, studentId) => {
    const subjectId = cards
      .map((card) => card.cardTypeSubjectId)
      .find((value): value is string => Boolean(value));
    subjects.set(studentId, subjectId ? (subjectCache.get(subjectId) ?? null) : null);
  });

  return { subjects, memberCards };
}
