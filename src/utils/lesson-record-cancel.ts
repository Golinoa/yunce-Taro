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
import { isSameLessonSchedule } from '@/utils/lesson-record-scope';

/**
 * 一节课的归属：班课/团课/自定义课程用 `classId`，私教 1对1 用 `studentId`。
 * 两者都给时以 `classId` 为准。
 *
 * ⚠️ 2026-09-30 补充：同班同一天可能排多节课（09:00 与 14:00 各一条规则），
 * 光按班级+日期会让「恢复本节课」**删到另一节课的停课记录**、也会把另一节误判成已取消。
 * 因此再按 `scheduleId` 收窄（口径见 `isSameLessonSchedule`：任一侧为空则不区分）。
 */
export type LessonOwnerTarget = {
  classId?: string | null;
  studentId?: string | null;
  lessonDate: string;
  /** 本节排课规则 ID；拿不到就不按「哪一节」区分 */
  scheduleId?: string | null;
};

/** 记录是否属于该节课 */
function belongsToLesson(record: LessonRecord, target: LessonOwnerTarget): boolean {
  if (record.lesson_date !== target.lessonDate) return false;
  const ownerMatches = target.classId
    ? record.class_id === target.classId
    : target.studentId
      ? record.student_id === target.studentId
      : false;
  if (!ownerMatches) return false;
  return isSameLessonSchedule(record.schedule_id, target.scheduleId);
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

/**
 * 「计入消课展示」的记录 —— **全站唯一真源**（2026-10-03）。
 *
 * 取消一节课会写 `status='cancelled'` 的点名记录；它**不产生消课**
 * （后端已把 `hoursUsed` 归零并回滚卡内课时），所以任何「消课列表 / 消课统计」
 * 都必须先过这个函数，否则会把已取消的课算成消课、或在列表里露出「已取消」的行。
 *
 * 🔴 此前 `record.status !== 'cancelled'` 这个判断散落在 **10+ 处**
 * （消课卡片、上课记录页统计、课表点名统计、孩子详情、试听…），各写一遍。
 * 2026-10-03 实测后果：上课记录页与首页「最近消课」口径不一致 ——
 * 后者曾把 status 硬编码成 `'normal'`，导致同一条已取消记录在一个页面被过滤、
 * 在另一个页面照常渲染。**统一走这里，别再各写一份。**
 *
 * ⚠️ 只滤 `cancelled`：`status='normal'` 但 `hoursUsed=0` 是「点名了但不计消课」
 * （试听 / 挂账），**必须保留**，不能一起滤掉。
 */
export function isCountedLessonRecord(record: LessonRecord): boolean {
  return record.status !== 'cancelled';
}

/** `isCountedLessonRecord` 的数组版：过滤出「计入消课展示」的记录（保持原顺序） */
export function filterCountedLessonRecords(records: LessonRecord[]): LessonRecord[] {
  return records.filter(isCountedLessonRecord);
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
