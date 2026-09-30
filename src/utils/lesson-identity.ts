/**
 * 「哪一节课」的身份口径（唯一真源）
 *
 * ## 为什么需要这一层
 *
 * 一节课在系统里**没有独立编号实体**，只有 `Schedule`（排课规则）的主键可当身份。
 * 一个班可以在同一天排多节课（实测：初级书法班周一有 09:00 与 14:00 两条规则）。
 * 早先各处用「班级 + 日期（±时段）」判定"哪一节"，出过两起真实事故：
 *
 * 1. **只给一节课加试听，整条排课规则/整天的课都挂「试听」** —— 少了"第几节"这个维度；
 * 2. **同日临时调课后，试听学员从点名名单消失** —— 时段是**可变属性**：
 *    临时调课只写 `TemporaryReschedule`，**从不改 `Schedule` 行**，所以改时间后
 *    旧预约（存的是旧时段）就认不出这节课了。
 *
 * ## 口径
 *
 * - **一节课的身份 = `(scheduleId, lessonDate)`**
 *   （`scheduleId` = 排课表主键 = 卡片 `ScheduleCardItem.id`；规则横跨很多日期，故必须带日期）
 * - 归属对象：班课/团课比 `classId`，私教 1 对 1 比 `studentId`
 * - **判定优先比排课编号**；拿不到编号才回落比时段
 *
 * ⚠️ **不许再新造课次编号**：`Schedule.id` 就是编号，系统里早就有。
 *
 * ## 记录与预约的兜底**故意不一样**（别写成同一套）
 *
 * | 数据 | 有无时段 | 缺编号时 |
 * | --- | --- | --- |
 * | 记录 `LessonRecord` | ❌ **没有时段列** | **不区分**（宁可多显示，不能吞记录） |
 * | 预约（试听 / 补课） | ✅ 有 `startTime` | **回落比时段**（变严不变松，绝不再"整天乱挂"） |
 */

/** 归属对象：班课给 `classId`，私教给 `studentId` */
export interface LessonIdentityOwner {
  classId?: string | null;
  studentId?: string | null;
}

/** 目标课节（页面当前处理的那一节） */
export interface LessonScopeTarget extends LessonIdentityOwner {
  lessonDate?: string | null;
  /** 排课编号；拿不到（如从班级列表入口且未选节次）就不区分 */
  scheduleId?: string | null;
  /** 本节显示时段 `HH:mm`；预约侧兜底比对用 */
  startTime?: string | null;
}

/** 记录形状（`LessonRecord` 的字段命名） */
export interface LessonRecordIdentityLike {
  class_id?: string | null;
  lesson_date?: string | null;
  schedule_id?: string | null;
  student_id?: string | null;
}

/** 预约形状（试听 `LeadBooking` / 补课 `MakeupBooking` 的字段命名） */
export interface LessonBookingIdentityLike {
  class_id?: string | null;
  student_id?: string | null;
  lesson_date?: string | null;
  /** 排课编号。试听 = `reference_schedule_id` / 补课 = `schedule_id` */
  schedule_id?: string | null;
  /** 预约当时记下的时段 `HH:mm` */
  startTime?: string | null;
  start_time?: string | null;
}

/** 日期归一：兼容 `2026-09-30` 与 `2026-09-30T00:00:00.000Z`，取前 10 位 */
export function normalizeLessonDate(value?: string | null): string {
  return (value ?? '').trim().slice(0, 10);
}

/** 时段归一：`09:00:00` / `09:00` → `09:00`；空值 → 空串 */
export function normalizeLessonStartTime(value?: string | null): string {
  return (value ?? '').trim().slice(0, 5);
}

/** 从 `09:00-10:30` 取出开始时段；无值返回空串 */
export function parseLessonStartTime(lessonTime?: string | null): string {
  return normalizeLessonStartTime((lessonTime ?? '').split('-')[0]);
}

/**
 * 归属对象是否一致（班课比班级、私教比学员）。
 * 两边都没有归属信息 ⇒ 视为**不属于**（不能让两条无关数据互相命中）。
 */
export function isSameLessonOwner(
  target: LessonIdentityOwner,
  item: { class_id?: string | null; student_id?: string | null },
): boolean {
  const targetClassId = (target.classId ?? '').trim();
  if (targetClassId) return item.class_id === targetClassId;
  const targetStudentId = (target.studentId ?? '').trim();
  if (targetStudentId) return item.student_id === targetStudentId;
  return false;
}

/**
 * 「哪一节」只比排课编号；**任一侧为空即不区分**（返回 true）：
 * - 目标为空：页面从班级列表等入口进来，压根不知道是哪一节；
 * - 记录为空：老数据 / 写入时没带。
 *
 * 两个方向都必须放行——该判定同时用于「显示」和「删除」，
 * **宁可多显示，也不能把记录藏起来或删错**。
 */
export function isSameLessonSchedule(
  itemScheduleId?: string | null,
  targetScheduleId?: string | null,
): boolean {
  const target = (targetScheduleId ?? '').trim();
  if (!target) return true;
  const actual = (itemScheduleId ?? '').trim();
  if (!actual) return true;
  return actual === target;
}

/** 记录是否属于目标这一节（归属 + 日期 + 编号优先；记录**没有时段列**，故无时段兜底） */
export function isRecordOfLesson(
  record: LessonRecordIdentityLike,
  target: LessonScopeTarget,
): boolean {
  if (!isSameLessonOwner(target, record)) return false;
  if (normalizeLessonDate(record.lesson_date) !== normalizeLessonDate(target.lessonDate)) {
    return false;
  }
  return isSameLessonSchedule(record.schedule_id, target.scheduleId);
}

/**
 * 预约是否属于目标这一节（归属 + 日期 + **编号优先、时段兜底**）。
 *
 * 与记录侧的差异是有意为之：预约**有时段列**，所以缺编号时能按 `HH:mm` 兜住，
 * 不必退化成"不区分"（那正是"整条规则都带试听"的老毛病）。
 *
 * 兜底细节（两侧都拿不到时段时才不区分，宁可多显示，不能吞学员）：
 * - 目标没有时段 ⇒ 不区分；
 * - 预约没有时段（老数据）⇒ 不区分。
 */
export function isBookingOfLesson(
  booking: LessonBookingIdentityLike,
  target: LessonScopeTarget,
): boolean {
  if (!isSameLessonOwner(target, booking)) return false;
  if (normalizeLessonDate(booking.lesson_date) !== normalizeLessonDate(target.lessonDate)) {
    return false;
  }

  const targetScheduleId = (target.scheduleId ?? '').trim();
  const bookingScheduleId = (booking.schedule_id ?? '').trim();
  if (targetScheduleId && bookingScheduleId) {
    return bookingScheduleId === targetScheduleId;
  }

  const targetStart = normalizeLessonStartTime(target.startTime);
  if (!targetStart) return true;
  const bookingStart = normalizeLessonStartTime(booking.startTime ?? booking.start_time);
  if (!bookingStart) return true;
  return bookingStart === targetStart;
}

/**
 * 预约的时段是否与目标这一节一致（**旧口径**，仅供迁移期保留）。
 *
 * ⚠️ 新代码请用 {@link isBookingOfLesson}：它优先比排课编号，本函数只比时段，
 * 一旦同日调课就会失配（这正是"调课后试听学员消失"的根因）。
 */
export function isSameLessonStartTime(
  bookingStartTime?: string | null,
  targetStartTime?: string | null,
): boolean {
  const target = normalizeLessonStartTime(targetStartTime);
  if (!target) return true;
  return normalizeLessonStartTime(bookingStartTime) === target;
}
