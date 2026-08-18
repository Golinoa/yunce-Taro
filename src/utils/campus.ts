import dayjs from 'dayjs';

/** 解析营业时间，返回 HH:mm 格式起止时间 */
export function parseBusinessHours(hours?: string): { start: string; end: string } | null {
  if (!hours) return null;
  const match = hours.match(/(\d{2}:\d{2}):\d{2}至(\d{2}:\d{2}):\d{2}/);
  if (!match) return null;
  return { start: match[1], end: match[2] };
}

/** 根据当前时间判断校区是否营业中 */
export function isCampusOpen(hours?: string): boolean {
  const parsed = parseBusinessHours(hours);
  if (!parsed) return true;
  const now = dayjs();
  const start = dayjs(`${now.format('YYYY-MM-DD')} ${parsed.start}`);
  const end = dayjs(`${now.format('YYYY-MM-DD')} ${parsed.end}`);
  return now.isAfter(start) && now.isBefore(end);
}
