/**
 * 排课表单提交校验（Q2-3）
 */
import dayjs from 'dayjs';
import type { DayOfWeek } from '@/types/schedule';

export type ScheduleFormTimeSlot = { start: string; end: string };

export type ScheduleFormSubmitInput = {
  currentUserId?: string;
  mode: 'class' | 'student';
  classId?: string;
  selectedTeachingTeacherId?: string;
  isGroupMode: boolean;
  slotMaxCount: number;
  minOpenCount: number;
  timeSlots: ScheduleFormTimeSlot[];
  schedulingMode: 'rule' | 'free';
  startDate: string;
  repeatMode: string;
  selectedDays: DayOfWeek[];
  endMode: 'by_date' | 'by_count' | 'never';
  endDate: string;
  endCount: number;
  freeDates: string[];
  selectedClass?: {
    type?: string;
    total_lessons?: number;
    used_lessons?: number;
  } | null;
};

/** 预计规则排课在日期窗内命中次数（含起止日） */
export function countProjectedLessonsInRange(
  startDate: string,
  endDate: string,
  selectedDays: DayOfWeek[],
): number {
  let projected = 0;
  let cursor = dayjs(startDate);
  const end = dayjs(endDate);
  const daySet = new Set(selectedDays);
  while (cursor.isBefore(end) || cursor.isSame(end, 'day')) {
    const appDay = (cursor.day() || 7) as DayOfWeek;
    if (daySet.has(appDay)) projected += 1;
    cursor = cursor.add(1, 'day');
  }
  return projected;
}

export function getLimitedClassRemaining(selectedClass?: {
  total_lessons?: number;
  used_lessons?: number;
} | null): number {
  const total = selectedClass?.total_lessons ?? 0;
  const used = selectedClass?.used_lessons ?? 0;
  return Math.max(0, total - used);
}

/** 返回阻塞提交的原因；空串表示可提交 */
export function getScheduleFormSubmitBlockedReason(input: ScheduleFormSubmitInput): string {
  if (!input.currentUserId) return '未获取到登录信息';
  if (input.mode === 'student') return '真实联调仅支持班级排课';
  if (input.mode === 'class' && !input.classId) return '请选择班级';
  if (!input.selectedTeachingTeacherId) return '请选择主讲老师';

  if (input.isGroupMode) {
    if (!Number.isFinite(input.slotMaxCount) || input.slotMaxCount < 1) {
      return '请设置每时段可约人数';
    }
    if (!Number.isFinite(input.minOpenCount) || input.minOpenCount < 1) {
      return '请设置最少开班人数';
    }
    if (input.minOpenCount > input.slotMaxCount) {
      return '最少开班人数不能大于每时段可约人数';
    }
  }

  if (input.timeSlots.length === 0) return '请添加上课时间';
  if (input.timeSlots.some((ts) => !ts.start || !ts.end)) return '请填写完整的上课时间';
  if (input.timeSlots.some((ts) => ts.start >= ts.end)) return '结束时间需晚于开始时间';

  if (input.schedulingMode === 'rule') {
    if (!input.startDate) return '请选择开始日期';
    if (input.repeatMode !== 'alternate' && input.selectedDays.length === 0) {
      return '请至少选择一个上课周几';
    }
    if (input.repeatMode === 'alternate' && input.timeSlots.length !== 1) {
      return '隔天排课仅支持一组时间';
    }
    if (input.endMode === 'by_date' && !input.endDate) return '请选择结束日期';
    if (
      input.endMode === 'by_date' &&
      dayjs(input.endDate).isBefore(dayjs(input.startDate), 'day')
    ) {
      return '结束日期不能早于开始日期';
    }
    if (input.endMode === 'by_count' && input.endCount < 1) return '按次数至少为 1';

    if (input.selectedClass?.type === 'limited') {
      const remaining = getLimitedClassRemaining(input.selectedClass);
      if (remaining <= 0) return '该班级课时已用完，无法继续排课';
      if (input.endMode === 'never') {
        return '该班级已开启结束课时限制，请选择限日期或按次数';
      }
      if (input.endMode === 'by_count' && input.endCount > remaining) {
        return `按次数不能超过剩余课时（剩余 ${remaining}）`;
      }
      if (
        input.endMode === 'by_date' &&
        input.startDate &&
        input.endDate &&
        input.selectedDays.length > 0
      ) {
        const projected = countProjectedLessonsInRange(
          input.startDate,
          input.endDate,
          input.selectedDays,
        );
        if (projected > remaining) {
          return `日期范围内预计 ${projected} 次课，超过剩余课时 ${remaining}`;
        }
      }
    }
  } else if (input.freeDates.length === 0) {
    return '请选择上课日期';
  } else if (input.selectedClass?.type === 'limited') {
    const remaining = getLimitedClassRemaining(input.selectedClass);
    if (remaining <= 0) return '该班级课时已用完，无法继续排课';
    if (input.freeDates.length > remaining) {
      return `自由排课选了 ${input.freeDates.length} 天，超过剩余课时 ${remaining}`;
    }
  }

  return '';
}

export function validateRescheduleSaveInput(input: {
  originalSchedule?: { start_time: string; end_time: string } | null;
  sourceLessonDate?: string;
  targetDate: string;
  startTime: string;
  endTime: string;
}): string | null {
  if (!input.originalSchedule) return '未找到原课程信息';
  if (!input.sourceLessonDate || !dayjs(input.sourceLessonDate).isValid()) {
    return '原上课日期异常';
  }
  const noDate = input.targetDate === input.sourceLessonDate;
  const noTime =
    input.startTime === input.originalSchedule.start_time &&
    input.endTime === input.originalSchedule.end_time;
  if (noDate && noTime) return '请至少调整日期或时间';
  return null;
}

export function formatRescheduleTimeLabel(date: string, start: string, end: string): string {
  return `${dayjs(date).format('MM月DD日')} ${start}-${end}`;
}
