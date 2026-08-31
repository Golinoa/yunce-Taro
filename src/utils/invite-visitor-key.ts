/**
 * 邀约落地页访客键（本地持久，用于匿名访问归属线索）
 */
import Taro from '@tarojs/taro';

const STORAGE_KEY = 'yunce_invite_visitor_key';

function randomKey(): string {
  return `vk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function getOrCreateInviteVisitorKey(): string {
  try {
    const existing = Taro.getStorageSync(STORAGE_KEY);
    if (typeof existing === 'string' && existing.trim()) return existing.trim();
  } catch {
    // ignore
  }
  const next = randomKey();
  try {
    Taro.setStorageSync(STORAGE_KEY, next);
  } catch {
    // ignore
  }
  return next;
}
