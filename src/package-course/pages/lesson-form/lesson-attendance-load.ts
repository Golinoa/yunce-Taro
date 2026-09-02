/**
 * 点名页加载侧：请假过滤 / 记录回填 / 试听映射 / 课包匹配（Q2-2 续）
 */
import { leaveService, packageService, subjectService } from '@/services';
import type { Subject } from '@/types/campus';
import type { CoursePackage } from '@/types/course-package';
import type { LessonRecord } from '@/types/lesson-record';
import type { Student } from '@/types/student';
import { pickBestPackage } from '@/utils/package-helper';
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
}): ClassAttendanceState {
  const studentIdSet = new Set(input.studentIds);
  const classRecords = input.records.filter(
    (record) =>
      record.class_id === input.classId &&
      record.lesson_date === input.lessonDate &&
      studentIdSet.has(record.student_id),
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
}): Record<string, CheckinStatus> {
  const trialStudentIds = new Set(input.bookings.map((b) => b.trial_student_id));
  const trialRecords = input.records.filter(
    (record) =>
      record.class_id === input.classId &&
      record.lesson_date === input.lessonDate &&
      trialStudentIds.has(record.student_id),
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

export async function loadPackageMapsForStudents(
  students: Student[],
  hoursUsed: number,
): Promise<{
  packages: Map<string, CoursePackage>;
  subjects: Map<string, Subject | null>;
}> {
  const packages = new Map<string, CoursePackage>();
  const subjects = new Map<string, Subject | null>();
  for (const student of students) {
    const pkgs = await packageService.getActiveByStudent(student.id);
    const best = pickBestPackage(pkgs, hoursUsed);
    if (!best) continue;
    packages.set(student.id, best);
    if (best.subject_id) {
      const sub = await subjectService.getById(best.subject_id);
      subjects.set(student.id, sub);
    } else {
      subjects.set(student.id, null);
    }
  }
  return { packages, subjects };
}
