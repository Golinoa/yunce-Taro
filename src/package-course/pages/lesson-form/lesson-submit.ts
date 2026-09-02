/**
 * 点名页提交：校验 / 路由 / 摘要 / 提交锁包装（Q2-2）
 */
import type { SubmitLock } from '@/utils/submit-lock';
import type { CheckinStatus, ClassAttendanceMode } from './checkin-status';

export type LessonSubmitKind = 'blocked-edit' | 'single' | 'supplement' | 'edit' | 'class';

export function resolveLessonSubmitKind(input: {
  isEditEntryAttempt: boolean;
  mode: 'single' | 'class';
  isAlreadyChecked: boolean;
  attendanceMode: ClassAttendanceMode;
}): LessonSubmitKind {
  if (input.isEditEntryAttempt) return 'blocked-edit';
  if (input.mode === 'single') return 'single';
  if (input.isAlreadyChecked && input.attendanceMode === 'supplement') return 'supplement';
  if (input.isAlreadyChecked && input.attendanceMode === 'edit') return 'edit';
  return 'class';
}

export function validateHoursUsed(hoursUsed: number): string | null {
  if (hoursUsed <= 0) return '消课课时必须大于0';
  return null;
}

export function validateSupplementSave(input: {
  selectedClassId?: string | null;
  supplementCount: number;
  hoursUsed: number;
}): string | null {
  if (!input.selectedClassId) return '请选择班级';
  if (input.supplementCount === 0) return '请先补录学员';
  return validateHoursUsed(input.hoursUsed);
}

export function validateIncrementalEditSave(input: {
  selectedClassId?: string | null;
  hoursUsed: number;
}): string | null {
  if (!input.selectedClassId) return '请选择班级';
  return validateHoursUsed(input.hoursUsed);
}

export function validateSingleSubmit(input: {
  hasStudent: boolean;
  hasPackage: boolean;
  hoursUsed: number;
}): string | null {
  if (!input.hasStudent) return '请选择学生';
  if (!input.hasPackage) return '没有可用课包';
  return validateHoursUsed(input.hoursUsed);
}

export function validateClassSubmit(input: {
  selectedClassId?: string | null;
  formalCount: number;
  trialCount: number;
  hoursUsed: number;
}): string | null {
  if (!input.selectedClassId) return '请选择班级';
  if (input.formalCount === 0 && input.trialCount === 0) return '班级内暂无学员';
  return validateHoursUsed(input.hoursUsed);
}

export function buildClassAttendanceSummary(input: {
  presentCount: number;
  leaveCount: number;
  absentCount: number;
  hoursUsed: number;
  trialPresentCount: number;
  trialAbsentCount: number;
  hasTrials: boolean;
}): string {
  const trialSummary = input.hasTrials
    ? `；试听学员签到${input.trialPresentCount}名，未到${input.trialAbsentCount}名（不扣课时）`
    : '';
  if (input.presentCount > 0) {
    return `签到${input.presentCount}名，请假${input.leaveCount}名，未到${input.absentCount}名；签到学员每人消课${input.hoursUsed}课时${trialSummary}。`;
  }
  return `本次无签到学员，将记录请假${input.leaveCount}名、未到${input.absentCount}名，不扣减课时${trialSummary}。`;
}

export function filterChangedAttendanceStudents<T extends { id: string }>(
  students: T[],
  getCurrentStatus: (id: string) => CheckinStatus,
  baseline: Map<string, CheckinStatus>,
): T[] {
  return students.filter((student) => {
    const currentStatus = getCurrentStatus(student.id);
    const baselineStatus = baseline.get(student.id) || 'absent';
    return currentStatus !== baselineStatus;
  });
}

/** 占锁后执行；已占用返回 'busy'，不跑 work */
export async function withSubmitLock(
  lock: SubmitLock,
  setSubmitting: (value: boolean) => void,
  work: () => Promise<void>,
): Promise<'ok' | 'busy'> {
  if (!lock.tryAcquire()) return 'busy';
  setSubmitting(true);
  try {
    await work();
    return 'ok';
  } finally {
    lock.release();
    setSubmitting(false);
  }
}
