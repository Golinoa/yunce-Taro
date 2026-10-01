import dayjs from 'dayjs';
import type { Schedule, TemporaryReschedule } from '@/types';
import { isScheduleRuleEffectiveOnDate } from '@/utils/schedule-rule-effective';

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
 * 3. **去掉本日已经不再成立的规则**（已删除/停止的规则只在 stop 日及更早出课）
 *
 * 第 3 条与课表卡片同口径（`isScheduleRuleEffectiveOnDate`）：删除排课 = 自今日起停止排课、历史保留。
 * 少了这一步，调课/选课次界面会继续把"已删除的课"当成真实存在的课次列出来。
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
      .filter((item) => !movedOutScheduleIdSet.has(item.id))
      .filter((item) => isScheduleRuleEffectiveOnDate(item, dateStr)),
    ...movedInSchedules.filter((item) => isScheduleRuleEffectiveOnDate(item, dateStr)),
  ].sort((left, right) => left.start_time.localeCompare(right.start_time));
}
