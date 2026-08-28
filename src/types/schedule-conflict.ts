/** 排课冲突检测类型（与后端 /schedules/check-conflict 对齐） */

export type ScheduleConflictType = 'time' | 'teacher' | 'room' | 'class';

export interface ScheduleConflictItem {
  id: string;
  classId?: string | null;
  className?: string | null;
  teacherId?: string;
  teacherName?: string | null;
  dayOfWeek: number;
  dayOfWeekText?: string;
  startTime: string;
  endTime: string;
  room?: string | null;
  conflictTypes: ScheduleConflictType[];
  /** 前端拼装的展示时间，如 2026-08-05 08:30-09:30 */
  displayTime?: string;
}

export interface ScheduleConflictResult {
  hasConflict: boolean;
  conflictSummary: string;
  conflicts: ScheduleConflictItem[];
}
