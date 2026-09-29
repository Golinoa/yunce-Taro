/**
 * 「取消 / 停课记录」的公共判定与处理
 *
 * 停课（＝取消本节开课）会给该班每个学员写一条 `status='cancelled'` 的点名记录；
 * 「恢复本节课」就是把这些记录删掉，让本节课回到未点名状态。
 *
 * 课表页（卡片上的「恢复」）与点名页（详情页「恢复本节课」）共用这套口径，
 * 避免两处各写一份、出现"卡上显示已取消、详情页却不能恢复"的不一致。
 *
 * ⚠️ 2026-09-29 修正：原先只按 `classId` 匹配，导致**私教（1对1）**的课
 * ——排课没有班级、点名记录的 `classId` 为空——既判定不出"已取消"、
 * 也恢复不了。现改为按「归属」匹配：有班级按班级，否则按学员。
 */
import type { LessonRecord } from '@/types/lesson-record';

/**
 * 一节课的归属：班课/团课/自定义课程用 `classId`，私教 1对1 用 `studentId`。
 * 两者都给时以 `classId` 为准。
 */
export type LessonOwnerTarget = {
  classId?: string | null;
  studentId?: string | null;
  lessonDate: string;
};

/** 记录是否属于该节课 */
function belongsToLesson(record: LessonRecord, target: LessonOwnerTarget): boolean {
  if (record.lesson_date !== target.lessonDate) return false;
  if (target.classId) return record.class_id === target.classId;
  if (target.studentId) return record.student_id === target.studentId;
  return false;
}

/** 该节课所有「已取消」记录（恢复操作的对象） */
export function filterCancelledRecordsForRestore(
  lessonRecords: LessonRecord[],
  target: LessonOwnerTarget,
): LessonRecord[] {
  return lessonRecords.filter(
    (record) => belongsToLesson(record, target) && record.status === 'cancelled',
  );
}

/** 从列表里剔除该节课的取消记录（恢复后同步本地状态用） */
export function removeCancelledRecordsForDate(
  prev: LessonRecord[],
  target: LessonOwnerTarget,
): LessonRecord[] {
  return prev.filter(
    (record) => !(belongsToLesson(record, target) && record.status === 'cancelled'),
  );
}

/**
 * 本节课是否已取消：有记录，且**全部**都是 cancelled。
 * 与课表卡片的 `status==='cancelled'` 判定同一口径
 * （卡片侧见 `utils/schedule-card-build.ts`，同样按"有班级看班级、否则看学员"匹配）。
 */
export function isLessonCancelled(
  lessonRecords: LessonRecord[],
  target: LessonOwnerTarget,
): boolean {
  if (!target.lessonDate) return false;
  if (!target.classId && !target.studentId) return false;
  const records = lessonRecords.filter((record) => belongsToLesson(record, target));
  return records.length > 0 && records.every((record) => record.status === 'cancelled');
}
