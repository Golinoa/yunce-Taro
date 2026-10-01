/**
 * 「哪一节」的选节次判定（纯函数，便于单测）
 *
 * 与 `use-class-day-lessons` 的分工：这里只做**决定**，那边负责取数与 React 状态。
 *
 * 优先级：**URL 参数 > 老师手选 > 当天只有 1 节时自动带**。
 * 当天该班 0 节（不是本人排的课 / 跨校区）时返回空编号 ⇒ 退回「按班级+日期+时段兜底」的老行为，
 * 宁可多显示，不能吞学员。
 */
import type { ScheduleDayLesson } from '@/services/schedule';

export interface LessonSelection {
  /** 用于「哪一节」判定的排课编号；空串＝拿不到（退回不区分） */
  effectiveScheduleId: string;
  /** 已定位那一节的展示时段 `09:00-10:00`；未定位＝空串（由调用方沿用 URL 的 lessonTime） */
  effectiveLessonTime: string;
  /** 该班当天 ≥2 节且老师尚未选 ⇒ 必须拦提交 */
  needsPick: boolean;
}

export function resolveLessonSelection(params: {
  /** URL 带的排课编号（课表卡片入口必有） */
  scheduleIdParam: string;
  /** 老师手选的排课编号 */
  pickedScheduleId: string;
  /** 该班当天的课次（已按时段升序） */
  classLessons: ScheduleDayLesson[];
  /** 是否处于「需要补出节次」的场景：班级模式 + 无 URL 编号 + 有班级和日期 */
  needLookup: boolean;
}): LessonSelection {
  const { scheduleIdParam, pickedScheduleId, classLessons, needLookup } = params;

  // 卡片入口：编号已知，时段由 URL 的 lessonTime 提供，不需要选
  if (scheduleIdParam) {
    return { effectiveScheduleId: scheduleIdParam, effectiveLessonTime: '', needsPick: false };
  }

  const picked = classLessons.find((item) => item.scheduleId === pickedScheduleId) || null;
  const auto = classLessons.length === 1 ? classLessons[0] : null;
  const resolved = picked || auto;

  return {
    effectiveScheduleId: resolved?.scheduleId || '',
    effectiveLessonTime: resolved ? `${resolved.startTime}-${resolved.endTime}` : '',
    needsPick: needLookup && classLessons.length >= 2 && !pickedScheduleId,
  };
}
