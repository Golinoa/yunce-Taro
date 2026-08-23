/**
 * 未点名提醒订阅消息（用户口径 2026-08-23）
 *
 * 流程：当天 20:00 后，今日课表中「下课未点名」的课程 → 微信订阅消息提醒老师补点名。
 *
 * 重要约束（微信官方）：
 * - 订阅消息的「发送」必须由【服务端】调用 subscribeMessage.send 完成，小程序端只能
 *   requestSubscribeMessage 申请一次性授权（用户同意一次，服务端可发一条）。
 * - 需要在小程序后台申请「未点名提醒」类模板，将模板 ID 填入 UNATTENDED_REMIND_TEMPLATE_ID。
 * - mock 阶段：前端模拟推送（本地记录已推送，避免重复），不真实发送；
 *   联调时由后端消费推送任务（每日 20:00 定时任务扫未点名课程 → send）。
 */
import Taro from '@tarojs/taro';

/** 未点名提醒订阅模板 ID（小程序后台「订阅消息」申请后替换） */
export const UNATTENDED_REMIND_TEMPLATE_ID = '';

const PUSH_STORAGE_KEY = 'yunce-unattended-push';

/** 查询某天是否已推送过未点名提醒 */
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
