/**
 * 邮箱绑定：首页/我的轻量提醒
 * 仅根据「是否已绑邮箱」决定是否提醒；点「稍后」静默 7 天。
 */
import Taro from '@tarojs/taro';
import type { Profile } from '@/types/profile';

const SNOOZE_UNTIL_KEY = 'yunce:email-bind-snooze-until';
export const EMAIL_BIND_SNOOZE_DAYS = 7;

/** 已登录且未绑邮箱 → 需要提醒（与手机号 needsPhoneBind 同构） */
export function needsEmailBind(profile: Profile | null | undefined): boolean {
  if (!profile) return false;
  return !profile.email?.trim();
}

export function isEmailBindSnoozed(): boolean {
  try {
    const raw = Taro.getStorageSync(SNOOZE_UNTIL_KEY);
    const until = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(until) || until <= 0) return false;
    return Date.now() < until;
  } catch {
    return false;
  }
}

export function snoozeEmailBindReminder(days = EMAIL_BIND_SNOOZE_DAYS): void {
  try {
    const until = Date.now() + days * 24 * 60 * 60 * 1000;
    Taro.setStorageSync(SNOOZE_UNTIL_KEY, until);
  } catch {
    /* 静默 */
  }
}

export function clearEmailBindSnooze(): void {
  try {
    Taro.removeStorageSync(SNOOZE_UNTIL_KEY);
  } catch {
    /* 静默 */
  }
}

export function shouldShowEmailBindReminder(profile: Profile | null | undefined): boolean {
  return needsEmailBind(profile) && !isEmailBindSnoozed();
}
