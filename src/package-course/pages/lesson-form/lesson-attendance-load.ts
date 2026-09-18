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

/** 学员课包/学科加载并发上限：班级大时也不瞬间打爆后端 */
const PACKAGE_LOAD_CONCURRENCY = 6;

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
 * 批量解析学员「最优课包 + 学科」。
 *
 * 原实现为 `for` + `await` 串行：N 个学员等价于 N 次包请求 + N 次学科请求串行累加。
 * 现在：① 课包并发拉取（带上限）；② 同一 subject_id 只查一次（同班同科不再重复拉）。
 * 结果语义不变：无可用课包的学员不进 map；有课包但无学科的学员 subjects 落 null。
 */
export async function loadPackageMapsForStudents(
  students: Student[],
  hoursUsed: number,
): Promise<{
  packages: Map<string, CoursePackage>;
  subjects: Map<string, Subject | null>;
}> {
  const packages = new Map<string, CoursePackage>();
  const subjects = new Map<string, Subject | null>();
  if (students.length === 0) {
    return { packages, subjects };
  }

  const bestByStudent = await mapWithConcurrency(
    students,
    PACKAGE_LOAD_CONCURRENCY,
    async (student) => {
      const pkgs = await packageService.getActiveByStudent(student.id);
      return pickBestPackage(pkgs, hoursUsed);
    },
  );

  const subjectIds = new Set<string>();
  bestByStudent.forEach((best, index) => {
    if (!best) return;
    packages.set(students[index].id, best);
    if (best.subject_id) subjectIds.add(best.subject_id);
  });

  const subjectCache = new Map<string, Subject | null>();
  await mapWithConcurrency([...subjectIds], PACKAGE_LOAD_CONCURRENCY, async (subjectId) => {
    subjectCache.set(subjectId, await subjectService.getById(subjectId));
  });

  bestByStudent.forEach((best, index) => {
    if (!best) return;
    subjects.set(
      students[index].id,
      best.subject_id ? (subjectCache.get(best.subject_id) ?? null) : null,
    );
  });

  return { packages, subjects };
}
