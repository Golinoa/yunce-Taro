/**
 * 点名页操作窗口 / 记录优先级（Q2-2，从 lesson-form 抽出）
 */
import type { LessonRecord } from '@/types/lesson-record';
import { LESSON_OPERATE_WINDOW_DAYS } from '@/utils/schedule-guard';

export { LESSON_OPERATE_WINDOW_DAYS };

/** 上课日起窗口内可补录/修改；超时仅查看 */
export function isWithinLessonOperateWindow(lessonDateStr: string, now = new Date()): boolean {
  if (!lessonDateStr) return true;
  const lesson = new Date(`${lessonDateStr}T00:00:00`);
  if (Number.isNaN(lesson.getTime())) return true;
  const earliest = new Date(now);
  earliest.setHours(0, 0, 0, 0);
  earliest.setDate(earliest.getDate() - LESSON_OPERATE_WINDOW_DAYS);
  return lesson.getTime() >= earliest.getTime();
}

export function getLessonRecordPriority(record?: LessonRecord): number {
  if (!record) {
    return 0;
  }
  switch (record.status) {
    case 'normal':
    case 'makeup':
      return 4;
    case 'leave':
    case 'absent':
      return 3;
    case 'cancelled':
      return 2;
    default:
      return 1;
  }
}
