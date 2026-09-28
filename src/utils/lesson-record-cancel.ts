/**
 * 「取消 / 停课记录」的公共判定与处理
 *
 * 停课（＝取消本节开课）会给班级每个学员写一条 `status='cancelled'` 的点名记录；
 * 「恢复本节课」就是把这些记录删掉，让本节课回到未点名状态。
 *
 * 课表页（卡片上的「恢复」）与点名页（详情页「恢复本节课」）共用这套口径，
 * 避免两处各写一份、出现"卡上显示已取消、详情页却不能恢复"的不一致。
 */
import type { LessonRecord } from '@/types/lesson-record';

/** 该班级这一天所有「已取消」记录（恢复操作的对象） */
export function filterCancelledRecordsForRestore(
  lessonRecords: LessonRecord[],
  classId: string,
  lessonDate: string,
): LessonRecord[] {
  return lessonRecords.filter(
    (record) =>
      record.class_id === classId &&
      record.lesson_date === lessonDate &&
      record.status === 'cancelled',
  );
}

/** 从列表里剔除该班级这一天的取消记录（恢复后同步本地状态用） */
export function removeCancelledRecordsForDate(
  prev: LessonRecord[],
  classId: string,
  lessonDate: string,
): LessonRecord[] {
  return prev.filter(
    (record) =>
      !(
        record.class_id === classId &&
        record.lesson_date === lessonDate &&
        record.status === 'cancelled'
      ),
  );
}

/**
 * 本节课是否已取消：有记录，且**全部**都是 cancelled。
 * 与课表卡片的 `status==='cancelled'` 判定同一口径（见 `utils/schedule-card-status.ts`）。
 */
export function isLessonCancelled(
  lessonRecords: LessonRecord[],
  classId: string,
  lessonDate: string,
): boolean {
  if (!classId || !lessonDate) return false;
  const records = lessonRecords.filter(
    (record) => record.class_id === classId && record.lesson_date === lessonDate,
  );
  return records.length > 0 && records.every((record) => record.status === 'cancelled');
}
