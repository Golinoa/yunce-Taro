import dayjs from 'dayjs';
import type { Schedule, TemporaryReschedule } from '@/types';

export interface VisibleScheduleInstance extends Schedule {
  __temporaryAdjusted?: boolean;
}

interface BuildVisibleSchedulesParams {
  date: dayjs.Dayjs;
  schedules: Schedule[];
  temporaryReschedules: TemporaryReschedule[];
}

/**
 * 按具体日期组装“实际会显示在当天”的课程实例：
 * 1. 去掉被临时调走的固定排课
 * 2. 补上从其他日期临时调入的课程
 */
export function buildVisibleSchedulesForDate({
  date,
  schedules,
  temporaryReschedules,
}: BuildVisibleSchedulesParams): VisibleScheduleInstance[] {
  const dateStr = date.format('YYYY-MM-DD');
  const weekday = (date.day() || 7) as Schedule['day_of_week'];
  const scheduleById = schedules.reduce<Record<string, Schedule>>((acc, item) => {
    acc[item.id] = item;
    return acc;
  }, {});

  const movedOutScheduleIdSet = new Set(
    temporaryReschedules
      .filter((item) => item.source_date === dateStr)
      .map((item) => item.schedule_id),
  );

  const movedInSchedules = temporaryReschedules
    .filter((item) => item.target_date === dateStr)
    .reduce<VisibleScheduleInstance[]>((acc, item) => {
      const originalSchedule = scheduleById[item.schedule_id];
      if (!originalSchedule) {
        return acc;
      }

      acc.push({
        ...originalSchedule,
        class_id: item.class_id,
        start_time: item.start_time,
        end_time: item.end_time,
        day_of_week: weekday,
        updated_at: item.updated_at,
        __temporaryAdjusted: true,
      });
      return acc;
    }, []);

  return [
    ...schedules
      .filter((item) => item.day_of_week === weekday)
      .filter((item) => !movedOutScheduleIdSet.has(item.id)),
    ...movedInSchedules,
  ].sort((left, right) => left.start_time.localeCompare(right.start_time));
}
