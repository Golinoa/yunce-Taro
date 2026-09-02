/**
 * 排课保存：规则备注 / 目标时段 / 冲突摘要（Q2-3）
 */
import dayjs from 'dayjs';
import type { DayOfWeek } from '@/types/schedule';
import type { ScheduleConflictResult } from '@/types/schedule-conflict';
import type { ScheduleFormTimeSlot } from './schedule-form-validate';

export type ScheduleSaveTarget = {
  dayOfWeek: DayOfWeek;
  start: string;
  end: string;
  dateHint?: string;
};

export function buildScheduleSaveTargets(input: {
  schedulingMode: 'rule' | 'free';
  repeatMode: string;
  startDate: string;
  selectedDays: DayOfWeek[];
  freeDates: string[];
  timeSlots: ScheduleFormTimeSlot[];
}): ScheduleSaveTarget[] {
  const targets: ScheduleSaveTarget[] = [];
  if (input.schedulingMode === 'rule') {
    const days =
      input.repeatMode === 'alternate'
        ? [(dayjs(input.startDate).day() || 7) as DayOfWeek]
        : input.selectedDays;
    for (const dow of days) {
      for (const ts of input.timeSlots) {
        targets.push({ dayOfWeek: dow, start: ts.start, end: ts.end });
      }
    }
  } else {
    for (const d of input.freeDates) {
      const dow = (dayjs(d).day() || 7) as DayOfWeek;
      for (const ts of input.timeSlots) {
        targets.push({ dayOfWeek: dow, start: ts.start, end: ts.end, dateHint: d });
      }
    }
  }
  return targets;
}

export function buildScheduleRuleNote(input: {
  note: string;
  isGroupMode: boolean;
  autoOpenType: string;
  slotMaxCount: number;
  minOpenCount: number;
  schedulingMode: 'rule' | 'free';
  repeatMode: string;
  startDate: string;
  endMode: 'by_date' | 'by_count' | 'never';
  endDate: string;
  endCount: number;
  scheduleOnHoliday: boolean;
  consumedHours: number;
}): string {
  const userNote = input.note.trim();
  const needFull = input.autoOpenType === 'full' || input.autoOpenType === 'full_or_time';
  const meta = [
    input.isGroupMode ? '类型:团课' : '类型:班课',
    input.isGroupMode
      ? [
          `自动开班:${input.autoOpenType}`,
          `每时段可约:${input.slotMaxCount}`,
          `最少开班:${Math.max(1, input.minOpenCount)}`,
          needFull
            ? `满人开课:是 | 满人开课人数:${Math.max(1, input.minOpenCount)}`
            : '满人开课:否',
        ].join(' | ')
      : null,
    input.schedulingMode === 'rule' ? `规则:${input.repeatMode}` : null,
    input.schedulingMode === 'rule' ? `开始:${input.startDate}` : null,
    input.schedulingMode === 'rule' && input.endMode === 'by_date'
      ? `结束日期:${input.endDate}`
      : null,
    input.schedulingMode === 'rule' && input.endMode === 'by_count'
      ? `次数:${input.endCount}`
      : null,
    input.schedulingMode === 'rule' && input.endMode === 'never' ? '结束:不结束' : null,
    input.schedulingMode === 'rule' ? `节假日排课:${input.scheduleOnHoliday ? '是' : '否'}` : null,
    `消耗课时:${input.consumedHours}`,
  ]
    .filter(Boolean)
    .join(' | ');
  return userNote ? `${userNote}\n${meta}` : meta;
}

const CONFLICT_LABEL_MAP = {
  time: '时间冲突',
  teacher: '老师冲突',
  room: '教室冲突',
  class: '班级冲突',
} as const;

export function mergeScheduleConflictResults(
  results: ScheduleConflictResult[],
): ScheduleConflictResult {
  const merged: ScheduleConflictResult = {
    hasConflict: false,
    conflictSummary: '',
    conflicts: [],
  };
  const seen = new Set<string>();
  for (const result of results) {
    if (!result.hasConflict) continue;
    merged.hasConflict = true;
    for (const c of result.conflicts) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      merged.conflicts.push(c);
    }
    if (!merged.conflictSummary && result.conflictSummary) {
      merged.conflictSummary = result.conflictSummary;
    }
  }
  if (merged.hasConflict) {
    const typeSet = new Set(merged.conflicts.flatMap((c) => c.conflictTypes));
    merged.conflictSummary = (['time', 'teacher', 'room', 'class'] as const)
      .filter((k) => typeSet.has(k))
      .map((k) => CONFLICT_LABEL_MAP[k])
      .join('、');
  }
  return merged;
}

export function buildScheduleSaveSuccessTitle(input: {
  isEdit: boolean;
  targetCount: number;
}): string {
  if (input.isEdit) return '保存成功';
  if (input.targetCount > 1) return `已添加 ${input.targetCount} 条排课`;
  return '保存成功';
}
