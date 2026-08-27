/**
 * 订阅消息频控（本地）
 */
import Taro from '@tarojs/taro';
import type { SubscribeTemplateGroup } from '@/types/subscribe-message';

const STORAGE_KEY = 'yunce:subscribe-freq';

interface FreqRecord {
  depletedPromptAt?: Record<string, number>;
  lowQuotaBannerAt?: Record<string, number>;
  reactivatePromptAt?: Record<string, number>;
}

function readFreq(): FreqRecord {
  try {
    const raw = Taro.getStorageSync(STORAGE_KEY);
    if (raw && typeof raw === 'object') return raw as FreqRecord;
  } catch {
    // ignore
  }
  return {};
}

function writeFreq(record: FreqRecord): void {
  Taro.setStorageSync(STORAGE_KEY, record);
}

function groupKey(userId: string, group: SubscribeTemplateGroup): string {
  return `${userId}:${group}`;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

export function canShowDepletedPrompt(userId: string, group: SubscribeTemplateGroup): boolean {
  const record = readFreq();
  const at = record.depletedPromptAt?.[groupKey(userId, group)];
  if (!at) return true;
  return Date.now() - at >= SEVEN_DAYS_MS;
}

export function markDepletedPromptShown(userId: string, group: SubscribeTemplateGroup): void {
  const record = readFreq();
  if (!record.depletedPromptAt) record.depletedPromptAt = {};
  record.depletedPromptAt[groupKey(userId, group)] = Date.now();
  writeFreq(record);
}

export function canShowLowQuotaBanner(userId: string, group: SubscribeTemplateGroup): boolean {
  const record = readFreq();
  const at = record.lowQuotaBannerAt?.[groupKey(userId, group)];
  if (!at) return true;
  return Date.now() - at >= ONE_DAY_MS;
}

export function markLowQuotaBannerShown(userId: string, group: SubscribeTemplateGroup): void {
  const record = readFreq();
  if (!record.lowQuotaBannerAt) record.lowQuotaBannerAt = {};
  record.lowQuotaBannerAt[groupKey(userId, group)] = Date.now();
  writeFreq(record);
}

export function canShowReactivatePrompt(userId: string, group: SubscribeTemplateGroup): boolean {
  const record = readFreq();
  const at = record.reactivatePromptAt?.[groupKey(userId, group)];
  if (!at) return true;
  return Date.now() - at >= FOURTEEN_DAYS_MS;
}

export function markReactivatePromptShown(userId: string, group: SubscribeTemplateGroup): void {
  const record = readFreq();
  if (!record.reactivatePromptAt) record.reactivatePromptAt = {};
  record.reactivatePromptAt[groupKey(userId, group)] = Date.now();
  writeFreq(record);
}
