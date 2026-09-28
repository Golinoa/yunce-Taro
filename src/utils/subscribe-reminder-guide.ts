/**
 * 首页「开启上课提醒」引导：权限读取 + 展示决策 + 节流
 *
 * 背景（2026-09-29 用户诉求）：打开小程序看到今天有课，希望检测到没授权时能引导开启提醒。
 *
 * 两条硬约束（微信官方，改动前务必重读）：
 * 1. `wx.getSetting({ withSubscriptions: true })` 的 `itemSettings` **只返回用户勾选过
 *    「总是保持以上选择，不再询问」的模板**。多数用户不会勾，所以查出来是「无记录」，
 *    不能据此断定"没授权" ⇒ 授权状态只是**辅助信号**。
 * 2. `wx.requestSubscribeMessage` **只能在用户点击行为（或支付回调）中调起**，
 *    在 onShow / 定时器 / 网络回调里调会被拦（`fail can only be invoked by user TAP`）
 *    ⇒ 打开小程序不能自动弹，只能「站内引导 → 用户点击 → 调面板」。
 *
 * 因此判断以**后端额度为准**（额度是确定的：同意一次 = 攒一次发送额度，用完就收不到），
 * 微信状态只用来识别「再也弹不出来」的情况（总开关关闭 / 用户永久拒绝 / 被封禁），
 * 避免对这类用户反复打扰。
 */
import Taro from '@tarojs/taro';
import { logError } from '@/utils/logger';

/** 微信订阅面板里用户对单个模板的选择；`unknown` = 无记录（未勾"总是保持"） */
export type SubscribeItemStatus = 'accept' | 'reject' | 'ban' | 'unknown';

export interface SubscribePermissionSnapshot {
  /**
   * 订阅消息总开关。`false` = 用户在小程序设置页全局关闭了订阅消息，
   * 此时 `requestSubscribeMessage` 调不起来（错误码 20004），引导也无意义。
   */
  mainSwitch: boolean;
  /** 每个模板 id 对应的状态；无记录为 `unknown` */
  statusByTmplId: Record<string, SubscribeItemStatus>;
  /** 读取是否成功。失败时按"未知"处理（不因此打扰用户） */
  ok: boolean;
}

const GUIDE_STORAGE_KEY = 'yunce-remind-guide-v1';

/** 关闭引导条后的冷却天数（期间不再显示任何引导） */
const BANNER_COOLDOWN_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

interface GuideStorage {
  /** 上次展示弹框的本地日期（YYYY-MM-DD），用于「一天最多一次」 */
  lastDialogDate?: string;
  /** 引导条被关闭的时间戳（ms） */
  bannerDismissedAt?: number;
}

function todayString(): string {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${m}-${d}`;
}

function readStorage(): GuideStorage {
  try {
    const raw = Taro.getStorageSync(GUIDE_STORAGE_KEY);
    return raw && typeof raw === 'object' ? (raw as GuideStorage) : {};
  } catch {
    return {};
  }
}

function writeStorage(next: GuideStorage): void {
  try {
    Taro.setStorageSync(GUIDE_STORAGE_KEY, next);
  } catch (err) {
    logError('subscribeGuide.writeStorage', err);
  }
}

/** 读取微信侧的订阅消息状态（静默，不打扰用户） */
export async function readSubscribePermission(
  tmplIds: string[],
): Promise<SubscribePermissionSnapshot> {
  const empty: Record<string, SubscribeItemStatus> = {};
  for (const id of tmplIds) {
    empty[id] = 'unknown';
  }
  const fallback: SubscribePermissionSnapshot = {
    mainSwitch: true,
    statusByTmplId: empty,
    ok: false,
  };
  if (tmplIds.length === 0) return fallback;

  try {
    const res = await Taro.getSetting({ withSubscriptions: true });
    const setting = res?.subscriptionsSetting;
    const statusByTmplId: Record<string, SubscribeItemStatus> = {};
    const rawItems = setting?.itemSettings ?? {};
    for (const id of tmplIds) {
      const raw = rawItems[id];
      statusByTmplId[id] = raw === 'accept' || raw === 'reject' || raw === 'ban' ? raw : 'unknown';
    }
    return {
      mainSwitch: setting?.mainSwitch !== false,
      statusByTmplId,
      ok: true,
    };
  } catch (err) {
    logError('subscribeGuide.readPermission', err);
    return fallback;
  }
}

export type ReminderGuideDecision =
  /** 不展示任何引导 */
  | 'none'
  /** 展示引导（弹框或嵌入引导条，由调用方按节流状态决定形态） */
  | 'guide'
  /** 已无可能引导成功（总开关关闭 / 永久拒绝 / 被封禁）：静默，不再打扰 */
  | 'blocked';

export interface ReminderGuideInput {
  /** 今天是否有课。没课就不打扰 */
  hasCourseToday: boolean;
  /** 后端剩余可发送额度 */
  quotaRemain: number;
  /** 后端标记「额度已用完，需重新激活」 */
  needsReactivate?: boolean;
  /** 应用内消息总开关（用户自己关了就不引导） */
  masterEnabled: boolean;
  /** 微信侧订阅状态 */
  permission: SubscribePermissionSnapshot;
  /** 目标模板 id */
  tmplId: string;
}

/**
 * 是否值得引导用户开启提醒。
 *
 * 口径（用户确认：额度为主 + 拒绝识别）：
 * 1. 额度还够 ⇒ 收得到，不打扰；
 * 2. 额度不够，但用户已永久拒绝 / 总开关关闭 / 被封禁 ⇒ 弹也弹不出来，静默；
 * 3. 其余（额度不够且弹得出来）⇒ 引导。
 */
export function decideReminderGuide(input: ReminderGuideInput): ReminderGuideDecision {
  if (!input.hasCourseToday) return 'none';
  if (!input.masterEnabled) return 'none';
  if (!input.tmplId) return 'none';

  // 额度为准：还能发就不打扰
  if (input.quotaRemain > 0 && input.needsReactivate !== true) return 'none';

  // 拒绝识别：这几种情况 requestSubscribeMessage 不会再弹窗，引导等于骚扰
  const status = input.permission.statusByTmplId[input.tmplId] ?? 'unknown';
  if (status === 'reject' || status === 'ban') return 'blocked';
  if (input.permission.ok && !input.permission.mainSwitch) return 'blocked';

  return 'guide';
}

/** 今天是否已经弹过框（一天最多一次） */
export function hasDialogShownToday(): boolean {
  return readStorage().lastDialogDate === todayString();
}

/** 标记弹框已展示（当天不再弹） */
export function markDialogShown(): void {
  writeStorage({ ...readStorage(), lastDialogDate: todayString() });
}

/** 引导条是否处于冷却期（用户关过，短期内不再出现） */
export function isBannerCooling(): boolean {
  const at = readStorage().bannerDismissedAt;
  if (typeof at !== 'number' || at <= 0) return false;
  return Date.now() - at < BANNER_COOLDOWN_DAYS * DAY_MS;
}

/**
 * 标记引导条被关闭：进入冷却，并记录当天已弹过框
 * （关掉弹框才轮到引导条，两者同一天只走一次流程）。
 */
export function markBannerDismissed(): void {
  writeStorage({
    lastDialogDate: todayString(),
    bannerDismissedAt: Date.now(),
  });
}

/** 授权成功后清理节流状态（额度已补，无需再引导） */
export function clearGuideThrottle(): void {
  try {
    Taro.removeStorageSync(GUIDE_STORAGE_KEY);
  } catch (err) {
    logError('subscribeGuide.clearThrottle', err);
  }
}

/** 单测用：重置本地存储 */
export function __resetGuideStorageForTest(): void {
  try {
    Taro.removeStorageSync(GUIDE_STORAGE_KEY);
  } catch {
    /* 静默 */
  }
}
