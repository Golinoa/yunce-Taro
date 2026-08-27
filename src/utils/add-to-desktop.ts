/**
 * 添加到桌面 / 我的小程序引导 — 本地状态与平台检测
 */
import Taro from '@tarojs/taro';
import {
  isColdStartGracePeriod,
  isShortcutEntryLaunch,
  readRuntimeScene,
  isShortcutEntryScene,
} from '@/utils/launch-scene';

/** 永久关闭（已添加 / 从快捷入口进入） */
export const ADD_TO_DESKTOP_DISMISSED_KEY = 'yunce:add-to-desktop-dismissed';

/** 上次展示或 snooze 的时间戳（ms） */
export const ADD_TO_DESKTOP_LAST_SHOWN_KEY = 'yunce:add-to-desktop-last-shown';

/** 未添加时的提醒间隔：3 天 */
export const ADD_TO_DESKTOP_SHOW_INTERVAL_MS = 3 * 24 * 60 * 60 * 1000;

/** 用户是否已永久关闭引导 */
export function isAddToDesktopTipDismissed(): boolean {
  try {
    return Boolean(Taro.getStorageSync(ADD_TO_DESKTOP_DISMISSED_KEY));
  } catch {
    return false;
  }
}

/** 永久关闭（已添加到我的小程序 / 桌面快捷入口） */
export function dismissAddToDesktopTip(): void {
  void Taro.setStorage({ key: ADD_TO_DESKTOP_DISMISSED_KEY, data: true }).catch(() => {
    // 忽略
  });
}

/** 记录本次展示 / 「我知道了」，几天内不再弹出 */
export function snoozeAddToDesktopTip(): void {
  const now = Date.now();
  void Taro.setStorage({ key: ADD_TO_DESKTOP_LAST_SHOWN_KEY, data: now }).catch(() => {
    // 忽略
  });
}

function getLastShownAt(): number {
  try {
    const value = Taro.getStorageSync(ADD_TO_DESKTOP_LAST_SHOWN_KEY);
    const ts = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(ts) && ts > 0 ? ts : 0;
  } catch {
    return 0;
  }
}

/** 距上次展示是否已满间隔 */
export function isAddToDesktopTipIntervalElapsed(): boolean {
  const lastShown = getLastShownAt();
  if (lastShown <= 0) {
    return true;
  }
  return Date.now() - lastShown >= ADD_TO_DESKTOP_SHOW_INTERVAL_MS;
}

/** 当前是否为 Android 端（用于区分引导文案） */
export function isAndroidPlatform(): boolean {
  try {
    if (typeof Taro.getDeviceInfo === 'function') {
      return Taro.getDeviceInfo().platform === 'android';
    }
    return Taro.getSystemInfoSync().platform === 'android';
  } catch {
    return false;
  }
}

/** 查询用户是否已将小程序添加到「我的小程序」 */
export async function checkIsAddedToMyMiniProgram(): Promise<boolean> {
  if (!Taro.canIUse('checkIsAddedToMyMiniProgram')) {
    return false;
  }
  return new Promise((resolve) => {
    Taro.checkIsAddedToMyMiniProgram({
      success: (res) => resolve(Boolean(res.added)),
      fail: () => resolve(false),
    });
  });
}

/**
 * 是否应展示添加桌面引导
 * - 已添加 / 快捷入口 / 永久关闭 → 不展示
 * - 未添加 → 间隔几天展示一次
 */
export async function shouldShowAddToDesktopTip(): Promise<boolean> {
  if (isColdStartGracePeriod() || isShortcutEntryLaunch()) {
    return false;
  }

  const runtimeScene = readRuntimeScene();
  if (runtimeScene !== undefined && isShortcutEntryScene(runtimeScene)) {
    return false;
  }

  if (isAddToDesktopTipDismissed()) {
    return false;
  }

  const added = await checkIsAddedToMyMiniProgram();
  if (added) {
    dismissAddToDesktopTip();
    return false;
  }

  if (!isAddToDesktopTipIntervalElapsed()) {
    return false;
  }

  return true;
}
