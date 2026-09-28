/**
 * 课表页假期标识：日历日期右上角标「休」。
 *
 * 数据走 `GET /holidays/calendar`（所有角色可读，**家长端**也能看到）。
 * 一次拉取覆盖较长区间（含过去与未来），避免随日历滑动反复请求。
 * 拉取失败只记日志：假期标识是增强信息，不能影响课表主功能。
 */
import dayjs from 'dayjs';
import { useCallback, useEffect, useState } from 'react';
import { holidayService } from '@/services/campus';
import { logError } from '@/utils/logger';

/** 覆盖区间：过去 90 天 ~ 未来 365 天 */
const RANGE_PAST_DAYS = 90;
const RANGE_FUTURE_DAYS = 365;

type HolidayRange = { startDate: string; endDate: string };

export function useScheduleHolidayCheck(): (date: dayjs.Dayjs) => boolean {
  const [ranges, setRanges] = useState<HolidayRange[]>([]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const list = await holidayService.getCalendar({
          startDate: dayjs().subtract(RANGE_PAST_DAYS, 'day').format('YYYY-MM-DD'),
          endDate: dayjs().add(RANGE_FUTURE_DAYS, 'day').format('YYYY-MM-DD'),
        });
        if (!alive) return;
        setRanges(list.map((item) => ({ startDate: item.startDate, endDate: item.endDate })));
      } catch (error) {
        logError('schedule.holidayCheck.load', error);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return useCallback(
    (date: dayjs.Dayjs) => {
      if (ranges.length === 0) return false;
      const key = date.format('YYYY-MM-DD');
      return ranges.some((range) => key >= range.startDate && key <= range.endDate);
    },
    [ranges],
  );
}
