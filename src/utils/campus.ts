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

/**
 * 首页校区卡：按剩余宽度估算店名最大字数（与状态标签、「切换门店」同排）
 * 超出则截断并加省略号，避免挤换行。
 */
export function clampCampusDisplayName(
  name: string,
  openStatus: CampusOpenStatus,
  screenWidthRpx = 750,
): string {
  const trimmed = name.trim() || '未设置校区';
  const label = campusOpenStatusLabel(openStatus);
  // 布局常量（rpx）：卡片垫 / Logo / 间距 / 切换门店区 / 标签内边距
  const CARD_PAD_X = 48;
  const LOGO_AND_GAP = 96 + 20;
  const SWITCH_BLOCK = 140; // 「切换门店」+ 箭头
  const ROW_GAPS = 12 + 12;
  const BADGE_PAD = 24 + 18; // 标签左右 pad + 圆点与字距
  const BADGE_RPX = label.length * 22 + BADGE_PAD;
  const NAME_CHAR_RPX = 34;
  const available =
    screenWidthRpx - CARD_PAD_X - LOGO_AND_GAP - SWITCH_BLOCK - ROW_GAPS - BADGE_RPX;
  const maxChars = Math.max(4, Math.floor(available / NAME_CHAR_RPX));
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, Math.max(1, maxChars - 1))}…`;
}

/** 单行文案截断（地址等），超出加省略号 */
export function clampCampusSingleLine(text: string, maxChars: number): string {
  const trimmed = text.trim();
  if (!trimmed || maxChars <= 0) return trimmed;
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, Math.max(1, maxChars - 1))}…`;
}

/** 校区卡信息列可用宽度内，地址大约可放多少字（24rpx） */
export function estimateCampusAddressMaxChars(screenWidthRpx = 750): number {
  const CARD_PAD_X = 48;
  const LOGO_AND_GAP = 96 + 20;
  const available = screenWidthRpx - CARD_PAD_X - LOGO_AND_GAP;
  return Math.max(6, Math.floor(available / 24));
}
