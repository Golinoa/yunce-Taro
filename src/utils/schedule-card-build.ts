/**
 * 课表日卡片构建（Q2-1）：从 pages/schedule 抽出可测纯函数
 */
import type dayjs from 'dayjs';
import type { Class } from '@/types/class';
import type { LessonRecord } from '@/types/lesson-record';
import type { Schedule } from '@/types/schedule';
import type { TeacherUIModel } from '@/types/teacher';
import type { TemporaryReschedule } from '@/types/temporary-reschedule';
import { parseTimeToMinutes } from '@/utils/schedule-guard';
import {
  getClassCardStatusRank,
  getTeacherNames,
  isBookingSchedule,
  resolveScheduleStatus,
  type ScheduleCardStatus,
} from '@/utils/schedule-card-status';

export type ScheduleCardStudentAvatar = {
  id: string;
  name: string;
  avatar?: string;
};

export type ScheduleCardItem = {
  id: string;
  classId?: string;
  campusId?: string;
  detailRecordId?: string;
  className: string;
  startTime: string;
  endTime: string;
  leadTeacherName: string;
  assistantTeacherName?: string;
  note?: string;
  room?: string;
  checkedCount: number;
  totalCount: number;
  status: ScheduleCardStatus;
  countdownText?: string;
  bookingTag?: string;
  hasTrialStudent?: boolean;
  canCancelLesson: boolean;
  isTemporaryAdjusted?: boolean;
  students?: ScheduleCardStudentAvatar[];
};

type ScheduleWithTempFlag = Schedule & { __temporaryAdjusted?: boolean };

export function buildScheduleCardsForDate(input: {
  date: dayjs.Dayjs;
  now: dayjs.Dayjs;
  filteredSchedules: Schedule[];
  scheduleById: Record<string, Schedule>;
  temporaryReschedules: TemporaryReschedule[];
  lessonRecords: LessonRecord[];
  selectedClassId: string;
  classById: Record<string, Class>;
  teacherById: Record<string, TeacherUIModel>;
  classStudentAvatars: Record<string, ScheduleCardStudentAvatar[]>;
  trialBookingKeys: Set<string>;
  currentTeacherName: string;
}): ScheduleCardItem[] {
  const dateStr = input.date.format('YYYY-MM-DD');
  const weekday = (input.date.day() || 7) as Schedule['day_of_week'];
  const dayRecords = input.lessonRecords.filter((record) => record.lesson_date === dateStr);
  const movedOutScheduleIdSet = new Set(
    input.temporaryReschedules
      .filter((item) => item.source_date === dateStr)
      .map((item) => item.schedule_id),
  );
  const movedInSchedules = input.temporaryReschedules
    .filter((item) => item.target_date === dateStr)
    .reduce<ScheduleWithTempFlag[]>((acc, item) => {
      const originalSchedule = input.scheduleById[item.schedule_id];
      if (!originalSchedule) {
        return acc;
      }

      acc.push({
        ...originalSchedule,
        start_time: item.start_time,
        end_time: item.end_time,
        class_id: item.class_id,
        day_of_week: weekday,
        updated_at: item.updated_at,
        note: originalSchedule.note,
        __temporaryAdjusted: true,
      });
      return acc;
    }, []);

  const visibleSchedules: ScheduleWithTempFlag[] = [
    ...input.filteredSchedules
      .filter((schedule) => schedule.day_of_week === weekday)
      .filter((schedule) => !movedOutScheduleIdSet.has(schedule.id)),
    ...movedInSchedules,
  ];

  return visibleSchedules
    .filter((schedule) => !input.selectedClassId || schedule.class_id === input.selectedClassId)
    .map((schedule) => {
      const classInfo =
        (schedule.class_id ? input.classById[schedule.class_id] : undefined) ||
        (schedule.class_id
          ? {
              id: schedule.class_id,
              name: schedule.class_info?.name || schedule.note || '未命名班级',
              teacher_id: '',
              created_at: '',
              updated_at: '',
              type: 'limited' as const,
              status: 'active' as const,
              used_lessons: 0,
              color: 'primary' as const,
              student_count: schedule.total_count || 0,
            }
          : undefined);
      const recordList = dayRecords.filter((record) =>
        schedule.class_id
          ? record.class_id === schedule.class_id
          : record.student_id === schedule.student_id,
      );
      const totalCount =
        classInfo?.student_count || schedule.total_count || (schedule.student_id ? 1 : 0);
      const { leadTeacherName, assistantTeacherName } = getTeacherNames(
        classInfo,
        input.teacherById,
        schedule.teacher_name || input.currentTeacherName,
        schedule,
      );
      const statusResult = resolveScheduleStatus({
        selectedDate: input.date,
        startTime: schedule.start_time,
        endTime: schedule.end_time,
        records: recordList,
        totalCount,
        now: input.now,
      });

      return {
        id: schedule.id,
        classId: schedule.class_id,
        campusId: classInfo?.campus_id,
        detailRecordId: recordList[0]?.id,
        className: classInfo?.name || schedule.class_info?.name || schedule.note || '未命名班级',
        startTime: schedule.start_time,
        endTime: schedule.end_time,
        leadTeacherName,
        assistantTeacherName,
        note: schedule.note || '',
        room: schedule.room || undefined,
        checkedCount: statusResult.checkedCount,
        totalCount,
        status: statusResult.status,
        countdownText: statusResult.countdownText,
        bookingTag: isBookingSchedule(schedule) ? '约' : undefined,
        hasTrialStudent: Boolean(
          schedule.class_id &&
            input.trialBookingKeys.has(`${schedule.class_id}|${input.date.format('YYYY-MM-DD')}`),
        ),
        canCancelLesson: statusResult.status !== 'cancelled',
        isTemporaryAdjusted: Boolean(schedule.__temporaryAdjusted),
        students: schedule.class_id ? input.classStudentAvatars[schedule.class_id] || [] : [],
      };
    })
    .sort((left, right) => {
      const rank = getClassCardStatusRank(left.status) - getClassCardStatusRank(right.status);
      if (rank !== 0) return rank;
      return parseTimeToMinutes(left.startTime) - parseTimeToMinutes(right.startTime);
    });
}

export function summarizeScheduleCards(cards: ScheduleCardItem[]): {
  total: number;
  checked: number;
  unchecked: number;
} {
  const checked = cards.filter((item) => item.checkedCount > 0).length;
  return {
    total: cards.length,
    checked,
    unchecked: Math.max(cards.length - checked, 0),
  };
}
