/**
 * 课表同步手机日历 — 用户级开关与弹窗状态
 */
import Taro from '@tarojs/taro';
import type { UserRole } from '@/types/profile';
import { isTeachingRole } from '@/utils/auth';

export interface CalendarSyncSettings {
  /** 是否开启同步 */
  enabled: boolean;
  /** 用户曾在弹窗点「暂不」，不再主动弹窗 */
  promptDismissed: boolean;
  /** 上次弹窗日期 YYYY-MM-DD */
  lastPromptDate?: string;
  /** 上次同步覆盖的最后一天（含）YYYY-MM-DD */
  lastSyncedUntil?: string;
  /** 上次成功同步时间 ISO */
  lastSyncedAt?: string;
  /** 是否已完成 E19 订阅授权 */
  authCompleted?: boolean;
}

export const CALENDAR_SYNC_MAX_DAYS = 7;

/** 可使用课表同步的角色：任课老师、助教、校长（兼课场景） */
export function canUseCalendarSync(role: UserRole | null | undefined): boolean {
  return isTeachingRole(role) || role === 'principal';
}

const DEFAULT_SETTINGS: CalendarSyncSettings = {
  enabled: false,
  promptDismissed: false,
};

function storageKey(userId: string): string {
  return `yunce:calendar-sync:${userId}`;
}

export function getCalendarSyncSettings(userId: string): CalendarSyncSettings {
  if (!userId) {
    return { ...DEFAULT_SETTINGS };
  }
  try {
    const stored = Taro.getStorageSync(storageKey(userId)) as Partial<CalendarSyncSettings> | undefined;
    if (!stored || typeof stored !== 'object') {
      return { ...DEFAULT_SETTINGS };
    }
    return { ...DEFAULT_SETTINGS, ...stored };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveCalendarSyncSettings(
  userId: string,
  partial: Partial<CalendarSyncSettings>,
): CalendarSyncSettings {
  const next = { ...getCalendarSyncSettings(userId), ...partial };
  if (!userId) {
    return next;
  }
  try {
    Taro.setStorageSync(storageKey(userId), next);
  } catch {
    /* 静默 */
  }
  return next;
}

export function isCalendarSyncEnabled(userId: string): boolean {
  return getCalendarSyncSettings(userId).enabled === true;
}

export function setCalendarSyncEnabled(userId: string, enabled: boolean): CalendarSyncSettings {
  return saveCalendarSyncSettings(userId, { enabled });
}

export function markCalendarSyncPromptDismissed(userId: string): CalendarSyncSettings {
  return saveCalendarSyncSettings(userId, { promptDismissed: true });
}

export function markCalendarSyncPromptShown(userId: string, date: string): CalendarSyncSettings {
  return saveCalendarSyncSettings(userId, { lastPromptDate: date });
}

export function markCalendarSyncAuthCompleted(userId: string): CalendarSyncSettings {
  return saveCalendarSyncSettings(userId, { authCompleted: true });
}

export function markCalendarSyncCompleted(
  userId: string,
  lastSyncedUntil: string,
): CalendarSyncSettings {
  return saveCalendarSyncSettings(userId, {
    lastSyncedUntil,
    lastSyncedAt: new Date().toISOString(),
  });
}

export function shouldShowCalendarSyncPrompt(userId: string, today: string): boolean {
  const settings = getCalendarSyncSettings(userId);
  if (settings.enabled || settings.promptDismissed) {
    return false;
  }
  return settings.lastPromptDate !== today;
}

export function needsCalendarResync(userId: string, windowEndDate: string): boolean {
  const settings = getCalendarSyncSettings(userId);
  if (!settings.enabled) {
    return false;
  }
  if (!settings.lastSyncedUntil) {
    return true;
  }
  return settings.lastSyncedUntil < windowEndDate;
}

/** 测试重置 */
export function __resetCalendarSyncSettingsForTest(userId?: string): void {
  try {
    if (userId) {
      Taro.removeStorageSync(storageKey(userId));
      return;
    }
    const info = Taro.getStorageInfoSync();
    info.keys
      .filter((key) => key.startsWith('yunce:calendar-sync:'))
      .forEach((key) => Taro.removeStorageSync(key));
  } catch {
    /* 静默 */
  }
}
