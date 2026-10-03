/**
 * 假期日期判断：给日历在放假日期的数字右上角标「休」。
 *
 * 数据走 `GET /holidays/calendar`（所有角色可读，家长端也能看到）。
 * 一次拉取覆盖较长区间（含过去与未来），避免随日历滑动反复请求。
 * 拉取失败只记日志：假期标识是增强信息，不能影响主功能。
 *
 * 课表页（含私教视图）与各处的「选择日期」弹层共用本 hook，保证口径一致。
 */
import dayjs from 'dayjs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { holidayService } from '@/services/campus';
import { logError } from '@/utils/logger';

/** 覆盖区间：过去 90 天 ~ 未来 365 天 */
const RANGE_PAST_DAYS = 90;
const RANGE_FUTURE_DAYS = 365;

type HolidayRange = { startDate: string; endDate: string };

/**
 * @param options.enabled 身份就绪开关（默认 true）。
 *   未就绪时**不发请求**：否则页面挂载瞬间可能因 token/机构尚未解析拿到 401，
 *   而本 hook 不会自动重试 ⇒ 整个会话都拿不到假期、日历不显示「休」。
 *   身份就绪后 enabled 变 true 会自动触发拉取。
 *
 * @returns `isHoliday(date)` 判断函数，挂了 `reload(): Promise<void>`：
 *   重新拉一次假期，数据落地后 resolve（供下拉刷新 await）。
 */
export function useHolidayCheck(options?: { enabled?: boolean }): ((
  date: dayjs.Dayjs,
) => boolean) & {
  reload: () => Promise<void>;
} {
  const enabled = options?.enabled ?? true;
  const [ranges, setRanges] = useState<HolidayRange[]>([]);
  /**
   * 请求代次。只有最后一次发起的请求允许写 state ——
   * 连续拉两次时先发的后到，会把新结果覆盖成旧值。
   */
  const seqRef = useRef(0);

  /** 实际发起一次拉取，返回本次请求的 Promise */
  const fetchRanges = useCallback(async (): Promise<void> => {
    const seq = ++seqRef.current;
    try {
      const list = await holidayService.getCalendar({
        startDate: dayjs().subtract(RANGE_PAST_DAYS, 'day').format('YYYY-MM-DD'),
        endDate: dayjs().add(RANGE_FUTURE_DAYS, 'day').format('YYYY-MM-DD'),
      });
      // 已被更新的请求取代：丢弃这次结果
      if (seq !== seqRef.current) return;
      setRanges(list.map((item) => ({ startDate: item.startDate, endDate: item.endDate })));
    } catch (error) {
      logError('holidayCheck.load', error);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void fetchRanges();
    // fetchRanges 是稳定引用，这里只在身份就绪那一刻拉一次；
    // 后续重拉一律走 reload()（能拿到 Promise 供调用方 await）
  }, [enabled, fetchRanges]);

  /**
   * 重拉一次假期，**返回本次请求的 Promise**（数据落地后 resolve）。
   *
   * 直接调 `fetchRanges` 而不是自增令牌走effect ——
   * 后者拿不到「这一次请求」的 Promise，调用方 await 不到真实完成时点，
   * 指示器会先收起、UI 隔一拍才变。
   */
  const reload = useCallback(async () => {
    if (!enabled) return;
    await fetchRanges();
  }, [enabled, fetchRanges]);

  const isHoliday = useCallback(
    (date: dayjs.Dayjs) => {
      if (ranges.length === 0) return false;
      const key = date.format('YYYY-MM-DD');
      return ranges.some((range) => key >= range.startDate && key <= range.endDate);
    },
    [ranges],
  );

  // 返回值上挂 reload，调用方既能直接判断、也能触发重拉（并 await 其完成）
  return useMemo(() => Object.assign(isHoliday, { reload }), [isHoliday, reload]);
}
