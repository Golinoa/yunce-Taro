/**
 * 微信绑手机号：轻量提醒节奏（不挡登录、不发短信）
 */
import Taro from '@tarojs/taro';
import type { Profile } from '@/types/profile';

const SNOOZE_UNTIL_KEY = 'yunce:wechat-bind-snooze-until';
/** 点「稍后」后静默天数 */
export const WECHAT_BIND_SNOOZE_DAYS = 7;

export function needsPhoneBind(profile: Profile | null | undefined): boolean {
  if (!profile) return false;
  return !profile.phone?.trim();
}

export function isWechatBindSnoozed(): boolean {
  try {
    const raw = Taro.getStorageSync(SNOOZE_UNTIL_KEY);
    const until = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(until) || until <= 0) return false;
    return Date.now() < until;
  } catch {
    return false;
  }
}

export function snoozeWechatBindReminder(days = WECHAT_BIND_SNOOZE_DAYS): void {
  try {
    const until = Date.now() + days * 24 * 60 * 60 * 1000;
    Taro.setStorageSync(SNOOZE_UNTIL_KEY, until);
  } catch {
    /* 静默 */
  }
}

export function clearWechatBindSnooze(): void {
  try {
    Taro.removeStorageSync(SNOOZE_UNTIL_KEY);
  } catch {
    /* 静默 */
  }
}

/** 首页/我的：是否展示轻量提醒条 */
export function shouldShowWechatBindReminder(profile: Profile | null | undefined): boolean {
  return needsPhoneBind(profile) && !isWechatBindSnoozed();
}
