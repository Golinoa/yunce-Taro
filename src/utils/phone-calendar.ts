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

export type PhoneCalendarAddResult = 'success' | 'auth_denied' | 'failed';

/** errMsg 是否像系统日历权限被拒（避免裸 :fail 误判） */
export function isPhoneCalendarAuthError(error: unknown): boolean {
  const errMsg =
    (error as { errMsg?: string })?.errMsg ||
    (error instanceof Error ? error.message : String(error));
  if (/拒绝|未授权|未开启|permission\s*denied|no permission|auth\s*deny|denied/i.test(errMsg)) {
    return true;
  }
  return /:fail\s+(auth|permission)/i.test(errMsg);
}

export function isAddPhoneCalendarSupported(): boolean {
  return typeof Taro.addPhoneCalendar === 'function';
}

/** 日历权限被拒后引导用户打开设置（参考 location-authorize） */
export async function promptPhoneCalendarPermissionSetting(): Promise<boolean> {
  if (process.env.TARO_ENV !== 'weapp') {
    return false;
  }

  const modal = await Taro.showModal({
    title: '需要日历权限',
    content: '同步课表到手机日历需要写入日历权限，请在设置中开启日历访问。',
    confirmText: '去设置',
    cancelText: '取消',
  });
  if (!modal.confirm) {
    return false;
  }

  try {
    await Taro.openSetting();
    return true;
  } catch {
    return false;
  }
}

export async function addPhoneCalendarEvent(
  input: PhoneCalendarEventInput,
): Promise<PhoneCalendarAddResult> {
  if (!isAddPhoneCalendarSupported()) {
    return 'failed';
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
    return 'success';
  } catch (error) {
    logError('phoneCalendar.add', error);
    if (isPhoneCalendarAuthError(error)) {
      return 'auth_denied';
    }
    return 'failed';
  }
}
