import dayjs from 'dayjs';

/** 校区营业状态：有可解析营业时间才判断开/闭，否则未设置 */
export type CampusOpenStatus = 'open' | 'closed' | 'unset';

/** 解析营业时间，返回 HH:mm 格式起止时间 */
export function parseBusinessHours(hours?: string | null): { start: string; end: string } | null {
  if (!hours) return null;
  const match = hours.match(/(\d{2}:\d{2}):\d{2}至(\d{2}:\d{2}):\d{2}/);
  if (!match) return null;
  return { start: match[1], end: match[2] };
}

/** 营业状态三态：未设置 / 营业中 / 休息中 */
export function getCampusOpenStatus(
  hours?: string | null,
  now: dayjs.Dayjs = dayjs(),
): CampusOpenStatus {
  const parsed = parseBusinessHours(hours);
  if (!parsed) return 'unset';
  const start = dayjs(`${now.format('YYYY-MM-DD')} ${parsed.start}`);
  const end = dayjs(`${now.format('YYYY-MM-DD')} ${parsed.end}`);
  return now.isAfter(start) && now.isBefore(end) ? 'open' : 'closed';
}

/** 根据当前时间判断校区是否营业中（未设置营业时间视为未营业） */
export function isCampusOpen(hours?: string | null, now?: dayjs.Dayjs): boolean {
  return getCampusOpenStatus(hours, now) === 'open';
}

/** 状态文案 */
export function campusOpenStatusLabel(status: CampusOpenStatus): string {
  if (status === 'open') return '营业中';
  if (status === 'closed') return '休息中';
  return '未设置';
}
