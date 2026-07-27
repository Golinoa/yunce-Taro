import dayjs from 'dayjs';

/**
 * 调课默认目标日期统一规则：
 * - 默认取原上课日期后一天
 * - 如果该日期已经早于今天，则兜底到今天
 */
export function getDefaultRescheduleTargetDate(sourceDate: string): dayjs.Dayjs {
  const parsedDate = dayjs(sourceDate);
  if (!parsedDate.isValid()) {
    return dayjs();
  }

  const nextDate = parsedDate.add(1, 'day').startOf('day');
  return nextDate.isBefore(dayjs(), 'day') ? dayjs().startOf('day') : nextDate;
}
