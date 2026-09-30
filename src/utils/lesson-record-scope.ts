/**
 * 消课/点名记录的「哪一节」判定口径 —— **兼容层**
 *
 * ⚠️ 实现已收敛到 `@/utils/lesson-identity`（唯一真源）。本文件只做再导出，
 * 保证既有调用方与单测不受影响；**新代码请直接 import `lesson-identity`**。
 *
 * 背景：`LessonRecord` 只有 `classId` + `lessonDate` + `scheduleId`，**没有时段列**。
 * 一个班可以在同一天排多节课（例如 09:00 与 14:00 各一条规则），只按「班级 + 日期」
 * 匹配会让两节课的考勤互相污染：
 * - 给 09:00 点完名，14:00 那节进去变成「已点名」只读，且学员状态取自 09:00 的记录；
 * - 重复点名保护失效（同班同一天重复提交会重复消课）；
 * - 补录占位、已落库补录学员、试听签到状态串到另一节。
 *
 * 判定规则（刻意「宁可多显示」）：
 * 1. 班级/日期必须一致；
 * 2. 目标没有 scheduleId（页面从班级列表等入口进来，不知道是哪一节）⇒ **不区分**；
 * 3. 记录没有 scheduleId（老数据 / 写入时没带）⇒ **不区分**（不能把它藏起来）；
 * 4. 两边都有才做相等比较。
 */

import {
  isRecordOfLesson,
  isSameLessonSchedule,
  type LessonRecordIdentityLike,
  type LessonScopeTarget,
} from '@/utils/lesson-identity';

/** @deprecated 用 `LessonRecordIdentityLike`（`@/utils/lesson-identity`） */
export type LessonRecordScopeLike = LessonRecordIdentityLike;

export type { LessonScopeTarget };

export { isRecordOfLesson, isSameLessonSchedule };
