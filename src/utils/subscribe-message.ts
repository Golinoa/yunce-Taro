import Taro from '@tarojs/taro';
import type { SubscribeAuthStatus, SubscribeTemplateGroup } from '@/types/subscribe-message';
import { isDevApiEnv } from '@/utils/build-env';

/**
 * Unattended check-in reminder subscribe message helpers.
 * Client only requests one-time auth; server sends via subscribeMessage.send.
 */
/** Template id from MP admin (replace when configured). */
export const UNATTENDED_REMIND_TEMPLATE_ID = '';

const PUSH_STORAGE_KEY = 'yunce-unattended-push';

/** Whether an unattended reminder was already recorded for the date (local dedupe). */
export function hasPushedUnattended(dateStr: string): boolean {
  try {
    const raw = Taro.getStorageSync(PUSH_STORAGE_KEY);
    const map = raw && typeof raw === 'object' ? (raw as Record<string, string>) : {};
    return !!map[dateStr];
  } catch {
    return false;
  }
}

/** 标记某天未点名提醒已推送 */
export function markUnattendedPushed(dateStr: string): void {
  try {
    const raw = Taro.getStorageSync(PUSH_STORAGE_KEY);
    const map = raw && typeof raw === 'object' ? (raw as Record<string, string>) : {};
    map[dateStr] = new Date().toISOString();
    Taro.setStorageSync(PUSH_STORAGE_KEY, map);
  } catch {
    /* 静默 */
  }
}

/** 申请未点名提醒订阅授权（一次性授权，服务端发一条） */
export async function requestUnattendedReminderAuth(): Promise<boolean> {
  if (!UNATTENDED_REMIND_TEMPLATE_ID) return false;
  try {
    const tmplIds: string[] = [UNATTENDED_REMIND_TEMPLATE_ID];
    const option = { tmplIds } as Taro.requestSubscribeMessage.Option;
    const res = await Taro.requestSubscribeMessage(option);
    const status = res?.[UNATTENDED_REMIND_TEMPLATE_ID];
    return status === 'accept';
  } catch {
    return false;
  }
}

/**
 * 推送未点名提醒（当天 20:00 后调用）。
 * mock：本地记录已推送（不真实发送）；真实：调后端 /subscribe-message/send
 */
export async function pushUnattendedReminder(
  payload: { className: string; startTime: string; scheduleId: string },
  dateStr: string,
): Promise<boolean> {
  if (hasPushedUnattended(dateStr)) return true;
  // payload 供真实后端接入使用（mock 阶段不发送）
  void payload;
  if (!UNATTENDED_REMIND_TEMPLATE_ID) {
    // 未配置模板 ID：mock 阶段仅记录，避免每天重复触发
    markUnattendedPushed(dateStr);
    return false;
  }
  try {
    // 真实后端（联调时接线）：
    // await post('/subscribe-message/send', {
    //   templateId: UNATTENDED_REMIND_TEMPLATE_ID,
    //   page: `/pages/home/index`,
    //   data: { thing1: payload.className, time2: payload.startTime },
    // });
    markUnattendedPushed(dateStr);
    return true;
  } catch {
    return false;
  }
}

export interface SubscribeAuthRequestItem {
  tmplId: string;
  group: SubscribeTemplateGroup;
  status: SubscribeAuthStatus;
}

export function createClientRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface SubscribeAuthEntry {
  group: SubscribeTemplateGroup;
  tmplId: string;
}

/** 调起微信订阅面板并解析各模板授权结果 */
export async function requestSubscribeMessageAuth(
  entries: SubscribeAuthEntry[],
): Promise<SubscribeAuthRequestItem[]> {
  const seen = new Set<SubscribeTemplateGroup>();
  const uniqueEntries = entries
    .filter((entry) => {
      if (!entry.tmplId || seen.has(entry.group)) return false;
      seen.add(entry.group);
      return true;
    })
    .slice(0, 5);

  const tmplIds = uniqueEntries.map((entry) => entry.tmplId);

  if (tmplIds.length === 0) {
    return [];
  }

  // Dev-only: mock tmpl ids skip WeChat API. Never auto-accept in prod builds.
  if (isDevApiEnv() && tmplIds.every((id) => id.startsWith('mock-'))) {
    return uniqueEntries.map((entry) => ({
      tmplId: entry.tmplId,
      group: entry.group,
      status: 'accept' as const,
    }));
  }

  try {
    const option = { tmplIds } as Taro.requestSubscribeMessage.Option;
    const res = await Taro.requestSubscribeMessage(option);

    return uniqueEntries.map((entry) => {
      const raw = res?.[entry.tmplId];
      const status: SubscribeAuthStatus =
        raw === 'accept' || raw === 'reject' || raw === 'ban' || raw === 'filter' ? raw : 'reject';
      return { tmplId: entry.tmplId, group: entry.group, status };
    });
  } catch {
    return uniqueEntries.map((entry) => ({
      tmplId: entry.tmplId,
      group: entry.group,
      status: 'reject' as const,
    }));
  }
}
