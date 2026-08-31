/**
 * 邮箱绑定：首页/我的轻量提醒（已绑孩子或员工且无邮箱；稍后静默 7 天）
 */
import Taro from '@tarojs/taro';
import type { Profile } from '@/types/profile';

const SNOOZE_UNTIL_KEY = 'yunce:email-bind-snooze-until';
export const EMAIL_BIND_SNOOZE_DAYS = 7;

export function needsEmailBind(profile: Profile | null | undefined): boolean {
  if (!profile) return false;
  if (profile.email?.trim()) return false;
  const role = profile.currentContext?.role;
  // 已入驻员工或家长（绑孩子后）才提醒；纯游客不烦
  return role === 'parent' || role === 'teacher' || role === 'principal' || role === 'admin';
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
