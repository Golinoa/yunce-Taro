/**
 * 续费提醒「不再提醒」名单（本地 + 后端同步预留）
 */
import Taro from '@tarojs/taro';

const STORAGE_KEY = 'yunce-renewal-mute-ids';

export function readRenewalMuteIds(): string[] {
  try {
    const raw = Taro.getStorageSync(STORAGE_KEY);
    return Array.isArray(raw) ? (raw as string[]).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function writeRenewalMuteIds(ids: string[]): void {
  try {
    Taro.setStorageSync(STORAGE_KEY, [...new Set(ids)]);
  } catch {
    // ignore
  }
}

export function isRenewalMuted(studentId: string): boolean {
  return readRenewalMuteIds().includes(studentId);
}

export function muteRenewalStudent(studentId: string): void {
  writeRenewalMuteIds([...readRenewalMuteIds(), studentId]);
}

export function unmuteRenewalStudent(studentId: string): void {
  writeRenewalMuteIds(readRenewalMuteIds().filter((id) => id !== studentId));
}
