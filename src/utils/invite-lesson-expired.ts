import dayjs from 'dayjs';

/**
 * 分享场次是否已过结束时间。
 * 无日期/结束时刻时不判定为过期（通用邀约码落地）。
 */
export function isInviteLessonExpired(date?: string, end?: string, now = dayjs()): boolean {
  if (!date || !end) return false;
  const endAt = dayjs(`${date} ${end.length === 5 ? `${end}:00` : end}`);
  if (!endAt.isValid()) return false;
  return now.isAfter(endAt);
}
