/**
 * 课表日卡片构建（Q2-1）：从 pages/schedule 抽出可测纯函数
 */
import type { Class } from '@/types/class';
import type { LessonRecord } from '@/types/lesson-record';
import type { Schedule } from '@/types/schedule';
import type { TeacherUIModel } from '@/types/teacher';
import type { TemporaryReschedule } from '@/types/temporary-reschedule';
// 时段归一化的实现已收敛到 lesson-identity（唯一真源）。本文件**内部**也要调用它，
// 所以这里必须 import —— 下面那句 `export ... from` 只是对外继续暴露名字，
// **再导出不会把标识符带进本模块作用域**（踩过：`normalizeLessonStartTime is not defined`）。
import { normalizeLessonStartTime } from '@/utils/lesson-identity';
import {
  getClassCardStatusRank,
  getTeacherNames,
  isBookingSchedule,
  resolveScheduleStatus,
  type ScheduleCardStatus,
} from '@/utils/schedule-card-status';
import { parseTimeToMinutes } from '@/utils/schedule-guard';
import { stripScheduleNoteMeta } from '@/utils/schedule-note-display';
import type dayjs from 'dayjs';

export type ScheduleCardStudentAvatar = {
  id: string;
  name: string;
  avatar?: string;
};

/**
 * 试听预约与本节日课的匹配口径（课表角标与点名名单共用）。
 *
 * ⚠️ 必须带时段：一个班可能在同一天排多节课（例如 09:00 与 14:00，各自一条排课规则）。
 * 只按「班级 + 日期」匹配会把当天的每一节课都标成试听——用户视角就是
 * 「我只给一节课加了试听，结果整条排课规则/整天的课都带试听」。
 *
 * 口径与 `MakeupBooking` 的唯一键一致（student + class + date + startTime + status），
 * 即：**一条预约只作用于它当时那一节课**。
 *
 * ⚠️ 时段归一化 / 时段比对已收敛到 `@/utils/lesson-identity`（唯一真源），
 * 本文件改为再导出，保持既有调用方与单测不变。
 * 「编号优先、时段兜底」的新口径见 `lesson-identity.isBookingOfLesson`，
 * 本文件的 `buildTrialLessonKey` / `hasTrialBookingForLesson` 仍是旧口径（只比时段），
 * 迁移见 `changes/lesson-identity-feature`。
 */
export {
  normalizeLessonStartTime,
  parseLessonStartTime,
  isSameLessonStartTime,
} from '@/utils/lesson-identity';

/** 试听预约匹配键（按时段）：`classId|lessonDate|startTime` */
export function buildTrialLessonKey(
  classId?: string | null,
  lessonDate?: string | null,
  startTime?: string | null,
): string {
  return `${classId ?? ''}|${lessonDate ?? ''}|${normalizeLessonStartTime(startTime)}`;
}

/**
 * 试听预约匹配键（按**排课编号**）：`#scheduleId|classId|lessonDate`
 *
 * 为什么还要这一个键：时段是**可变属性** —— 临时调课只写 `TemporaryReschedule`、
 * 从不改 `Schedule` 行，所以这节课改到 11:00 后，预约里存的 09:00 就永远对不上了。
 * 排课编号不变 ⇒ 用它就能认回同一节课（这正是「同日调课后试听学员消失」的修法）。
 */
export function buildTrialLessonScheduleKey(
  classId?: string | null,
  lessonDate?: string | null,
  scheduleId?: string | null,
): string {
  return `#${(scheduleId ?? '').trim()}|${classId ?? ''}|${lessonDate ?? ''}`;
}

/**
 * 本节课是否有试听预约。
 *
 * 判定顺序：**编号优先 → 时段兜底**。
 * - 命中编号键 ⇒ 属于这一节（哪怕时段已经因调课而变了）；
 * - 否则按时段兜底（老预约没存编号；或页面压根不知道是哪一节）；
 * - 时段缺失的历史预约（键尾为空串）按「整日」兜底命中，避免老数据静默丢角标。
 *
 * ⚠️ 已知边界（刻意保留，遵循「宁可多显示，不能吞学员」）：
 * 若同一班同一天有两条规则撞到**同一时段**（同日调课目前不校验冲突，才可能发生），
 * 编号不同的预约也可能因时段相同而被算进来。相比"把该出现的学员吞掉"，这是更可接受的一侧。
 */
export function hasTrialBookingForLesson(
  keys: Set<string>,
  classId?: string | null,
  lessonDate?: string | null,
  startTime?: string | null,
  scheduleId?: string | null,
): boolean {
  if (!classId || !lessonDate) return false;
  const scheduleKey = buildTrialLessonScheduleKey(classId, lessonDate, scheduleId);
  if (scheduleId && keys.has(scheduleKey)) return true;
  return (
    keys.has(buildTrialLessonKey(classId, lessonDate, startTime)) ||
    keys.has(buildTrialLessonKey(classId, lessonDate, null))
  );
}

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
  /**
   * 该节课因机构放假而停课。
   * 判定：该日期是机构放假日，且排课规则的 `skip_holiday` 不为 false（即"节假日不排课"）。
   * **按日期直接判，不依赖停课记录是否已写入**——加了放假当场就能看到，
   * 不必等老师重新保存假期去触发自动停课。
   */
  holidaySuspended?: boolean;
  ruleStatus?: Schedule['rule_status'];
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
  /** 该日期是否为机构放假（课表页由 useHolidayCheck 提供；不传视为不放假） */
  isHolidayDate?: boolean;
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
              // 兜底用 note 时必须先剥掉排课规则元信息（"类型:班课 | 规则:weekly | 开始:…"）
              name:
                schedule.class_info?.name || stripScheduleNoteMeta(schedule.note) || '未命名班级',
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
        className:
          classInfo?.name ||
          schedule.class_info?.name ||
          stripScheduleNoteMeta(schedule.note) ||
          '未命名班级',
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
        hasTrialStudent: hasTrialBookingForLesson(
          input.trialBookingKeys,
          schedule.class_id,
          dateStr,
          schedule.start_time,
          // 本节所属排课编号：卡片 id 就是它（调课叠加时 id 仍是原规则的，见上方 movedInSchedules）
          schedule.id,
        ),
        canCancelLesson: statusResult.status !== 'cancelled',
        isTemporaryAdjusted: Boolean(schedule.__temporaryAdjusted),
        holidaySuspended: Boolean(input.isHolidayDate) && schedule.skip_holiday !== false,
        ruleStatus: schedule.rule_status,
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
