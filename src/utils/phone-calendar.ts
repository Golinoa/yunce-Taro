/**
 * 手机系统日历写入封装（Taro.addPhoneCalendar）
 */
import Taro from '@tarojs/taro';
import { logError } from '@/utils/logger';

export interface PhoneCalendarEventInput {
  title: string;
  /** Unix 秒级时间戳 */
  startTime: number;
  endTime: number;
  location?: string;
  description?: string;
  /** 提前提醒秒数，默认 15 分钟 */
  alarmOffset?: number;
}

export function isAddPhoneCalendarSupported(): boolean {
  return typeof Taro.addPhoneCalendar === 'function';
}

export async function addPhoneCalendarEvent(input: PhoneCalendarEventInput): Promise<boolean> {
  if (!isAddPhoneCalendarSupported()) {
    return false;
  }

  try {
    await Taro.addPhoneCalendar({
      title: input.title,
      startTime: input.startTime,
      endTime: String(input.endTime),
      location: input.location || '',
      description: input.description || '',
      alarm: true,
      alarmOffset: input.alarmOffset ?? 900,
    });
    return true;
  } catch (error) {
    logError('phoneCalendar.add', error);
    return false;
  }
}
