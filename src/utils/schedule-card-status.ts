/**
 * 课表卡片状态解析纯函数（Q2-1）
 *
 * 从 pages/schedule/index.tsx 抽出：时长文案、倒计时、教师名、状态排序与 resolve。
 */
import type dayjs from 'dayjs';
import type { Class } from '@/types/class';
import type { LessonRecord } from '@/types/lesson-record';
import type { Schedule } from '@/types/schedule';
import type { TeacherUIModel } from '@/types/teacher';
import { parseTimeToMinutes } from '@/utils/schedule-guard';

export type ScheduleCardStatus = 'urgent' | 'upcoming' | 'active' | 'done' | 'ended' | 'cancelled';

const FULL_WEEKDAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'] as const;

export function getDurationText(startTime: string, endTime: string): string {
  const minutes = parseTimeToMinutes(endTime) - parseTimeToMinutes(startTime);
  if (minutes <= 0) return '';
  return `${minutes}'`;
}

export function getCountdownText(diffMinutes: number): string | undefined {
  if (diffMinutes <= 0 || diffMinutes > 30) {
    return undefined;
  }
  return diffMinutes <= 5 ? `还有${diffMinutes}分钟开课` : `${diffMinutes}分钟后开课`;
}

export function getTeacherNames(
  classInfo: Class | undefined,
  teacherById: Record<string, TeacherUIModel>,
  fallbackTeacherName: string,
  schedule?: Pick<Schedule, 'assistant_teacher_id' | 'assistant_teacher_name' | 'teacher_id'>,
) {
  const teacherIds = classInfo?.teachers?.length
    ? classInfo.teachers
    : classInfo?.teacher_id
      ? [classInfo.teacher_id]
      : [];
  const teachers = teacherIds
    .map((id) => teacherById[id])
    .filter((teacher): teacher is TeacherUIModel => Boolean(teacher));
  const leadTeacher =
    teachers.find((teacher) => teacher.role !== 'assist') ||
    teachers[0] ||
    (classInfo?.teacher_id ? teacherById[classInfo.teacher_id] : undefined) ||
    (schedule?.teacher_id ? teacherById[schedule.teacher_id] : undefined);
  const assistantFromClass =
    teachers.find((teacher) => teacher.role === 'assist' && teacher.id !== leadTeacher?.id) ||
    undefined;
  const assistantFromSchedule = schedule?.assistant_teacher_id
    ? teacherById[schedule.assistant_teacher_id]
    : undefined;
  const assistantTeacherName =
    assistantFromClass?.name ||
    assistantFromSchedule?.name ||
    schedule?.assistant_teacher_name ||
    undefined;

  return {
    leadTeacherName: leadTeacher?.name || fallbackTeacherName || '未分配主讲',
    assistantTeacherName:
      assistantTeacherName && assistantTeacherName !== leadTeacher?.name
        ? assistantTeacherName
        : undefined,
  };
}

/** 同一天：已开始（含上课中）在上，已下课在下；组内按开课时间 */
export function getClassCardStatusRank(status: ScheduleCardStatus): number {
  switch (status) {
    case 'active':
      return 0;
    case 'urgent':
      return 1;
    case 'upcoming':
      return 2;
    case 'done':
      return 3;
    case 'ended':
      return 4;
    case 'cancelled':
      return 5;
    default:
      return 6;
  }
}

export function resolveScheduleStatus(params: {
  selectedDate: dayjs.Dayjs;
  startTime: string;
  endTime: string;
  records: LessonRecord[];
  totalCount: number;
  now: dayjs.Dayjs;
}) {
  const { selectedDate, startTime, endTime, records, totalCount, now } = params;
  const selectedDateStr = selectedDate.format('YYYY-MM-DD');
  const todayStr = now.format('YYYY-MM-DD');
  const checkedCount = new Set(
    records
      .filter((record) => ['normal', 'makeup'].includes(record.status || 'normal'))
      .map((record) => record.student_id),
  ).size;
  const recordedCount = new Set(
    records.filter((record) => record.status !== 'cancelled').map((record) => record.student_id),
  ).size;
  const hasCancelled =
    records.length > 0 && records.every((record) => record.status === 'cancelled');
  const hasMakeup = records.some((record) => record.status === 'makeup');
  const attendanceCompleted = totalCount > 0 ? recordedCount >= totalCount : checkedCount > 0;

  if (hasCancelled) {
    return {
      status: 'cancelled' as const,
      checkedCount,
      hintText: '本次课程已取消，不扣减课时',
      countdownText: undefined,
      tags: ['取消'],
      hasMakeup,
    };
  }

  if (selectedDateStr < todayStr) {
    if (checkedCount > 0 || attendanceCompleted) {
      return {
        status: 'done' as const,
        checkedCount,
        hintText:
          totalCount > 0
            ? `已完成 ${checkedCount}/${totalCount} 人消课`
            : `已完成 ${checkedCount} 条消课记录`,
        countdownText: undefined,
        tags: [],
        hasMakeup,
      };
    }

    return {
      status: 'ended' as const,
      checkedCount,
      hintText: '已下课，尚未登记消课记录',
      countdownText: undefined,
      tags: [],
      hasMakeup,
    };
  }

  if (selectedDateStr > todayStr) {
    return {
      status: 'upcoming' as const,
      checkedCount,
      countdownText: undefined,
      hasMakeup,
    };
  }

  // 当天课程一旦生成消课记录，就视为老师已完成点名，立即切换到查看态。
  if (checkedCount > 0 || attendanceCompleted) {
    return {
      status: 'done' as const,
      checkedCount,
      countdownText: undefined,
      hasMakeup,
    };
  }

  const nowMinutes = now.hour() * 60 + now.minute();
  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);
  const diffMinutes = startMinutes - nowMinutes;

  if (nowMinutes < startMinutes) {
    const urgent = diffMinutes <= 30;
    return {
      status: urgent ? ('urgent' as const) : ('upcoming' as const),
      checkedCount,
      countdownText: getCountdownText(diffMinutes),
      hasMakeup,
    };
  }

  if (nowMinutes >= startMinutes && nowMinutes <= endMinutes) {
    return {
      status: 'active' as const,
      checkedCount,
      countdownText: undefined,
      hasMakeup,
    };
  }

  return {
    status: 'ended' as const,
    checkedCount,
    countdownText: undefined,
    hasMakeup,
  };
}

export function getWeekdayText(dayOfWeek: Schedule['day_of_week']): string {
  return FULL_WEEKDAY_LABELS[dayOfWeek - 1];
}

export function isBookingSchedule(schedule: Pick<Schedule, 'tag' | 'student_id'>): boolean {
  return Boolean(schedule.tag || schedule.student_id);
}
