/**
 * 家长请假/调课：从固定班课排课表展开即将上课的课次
 * 团课/私教不走请假调课，应直接取消预约。
 */
import dayjs from 'dayjs';
import type { Class } from '@/types/class';
import type { Schedule } from '@/types/schedule';

export interface UpcomingClassLesson {
  /** scheduleId:date */
  key: string;
  scheduleId: string;
  classId: string;
  className: string;
  teacherId: string;
  teacherName: string;
  date: string;
  startTime: string;
  endTime: string;
  room?: string;
  dayOfWeek: number;
  subjectId?: string;
}

function isFixedClass(cls: Class | undefined): boolean {
  if (!cls) return false;
  if (cls.status === 'paused' || cls.status === 'ended') return false;
  // 无 schedule_mode 视为固定班课（兼容旧数据）
  return !cls.schedule_mode || cls.schedule_mode === 'fixed';
}

function toWeekday(date: dayjs.Dayjs): number {
  return date.day() === 0 ? 7 : date.day();
}

/**
 * 根据学员班课排课规则，展开未来若干周可请假/调课的课次
 */
export function buildUpcomingFixedLessons(params: {
  schedules: Schedule[];
  classes: Class[];
  weeksAhead?: number;
  now?: dayjs.Dayjs;
}): UpcomingClassLesson[] {
  const now = params.now || dayjs();
  const weeksAhead = params.weeksAhead ?? 4;
  const classMap = new Map(params.classes.map((c) => [c.id, c]));
  const fixedSchedules = params.schedules.filter((s) => {
    if (!s.class_id) return false;
    return isFixedClass(classMap.get(s.class_id));
  });

  if (fixedSchedules.length === 0) return [];

  const results: UpcomingClassLesson[] = [];
  const end = now.add(weeksAhead, 'week').endOf('day');

  for (
    let cursor = now.startOf('day');
    cursor.isBefore(end) || cursor.isSame(end, 'day');
    cursor = cursor.add(1, 'day')
  ) {
    const weekday = toWeekday(cursor);
    const dateStr = cursor.format('YYYY-MM-DD');

    fixedSchedules.forEach((schedule) => {
      if (schedule.day_of_week !== weekday) return;
      // 已下课的课次不可请假/调课；未开始或上课中可申请
      if (dayjs(`${dateStr} ${schedule.end_time}`).isBefore(now)) return;

      const cls = classMap.get(schedule.class_id || '');
      results.push({
        key: `${schedule.id}:${dateStr}`,
        scheduleId: schedule.id,
        classId: schedule.class_id || '',
        className: cls?.name || schedule.class_info?.name || schedule.note || '班课',
        teacherId: schedule.teacher_id,
        teacherName: schedule.teacher_name || '授课老师',
        date: dateStr,
        startTime: schedule.start_time,
        endTime: schedule.end_time,
        room: schedule.room,
        dayOfWeek: schedule.day_of_week,
        subjectId: cls?.subject_id,
      });
    });
  }

  return results.sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));
}

/**
 * 调课「调整至」：原课程同科目下、学员未加入班级的未来一周排课
 */
export function buildMakeupTargetLessons(params: {
  schedules: Schedule[];
  classes: Class[];
  /** 原课程（学员所在班） */
  originalClass: Class;
  /** 学员已加入的班级，这些班不出现在补课目标里 */
  excludeClassIds: string[];
  weeksAhead?: number;
  now?: dayjs.Dayjs;
}): UpcomingClassLesson[] {
  const subjectId = params.originalClass.subject_id;
  const campusId = params.originalClass.campus_id;
  const exclude = new Set(params.excludeClassIds);

  const peerClasses = params.classes.filter((cls) => {
    if (exclude.has(cls.id)) return false;
    if (!isFixedClass(cls)) return false;
    if (campusId && cls.campus_id && cls.campus_id !== campusId) return false;
    // 有科目时按同科目；无科目时同校区其他班
    if (subjectId) return cls.subject_id === subjectId;
    return true;
  });

  return buildUpcomingFixedLessons({
    schedules: params.schedules,
    classes: peerClasses,
    weeksAhead: params.weeksAhead ?? 1,
    now: params.now,
  });
}

const WEEKDAY_CN = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];

export function formatLessonOptionLabel(lesson: UpcomingClassLesson): string {
  const week = WEEKDAY_CN[lesson.dayOfWeek] || '';
  return `${lesson.className} · ${lesson.date.slice(5)} ${week} ${lesson.startTime}-${lesson.endTime}`;
}
