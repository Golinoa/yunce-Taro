/**
 * 消息通知总开关（同意小程序使用订阅消息推送）
 * 默认开启；关闭后即使有额度也不发微信服务通知。
 */
import Taro from '@tarojs/taro';

const MASTER_KEY = 'yunce:notify-master-enabled';
const LOGIN_OPT_IN_PENDING_KEY = 'yunce:subscribe-login-opt-in-pending';
const LOGIN_OPT_IN_DONE_PREFIX = 'yunce:subscribe-login-opt-in-done:';

export function getNotifyMasterEnabled(): boolean {
  try {
    const raw = Taro.getStorageSync(MASTER_KEY);
    if (raw === '' || raw === undefined || raw === null) return true;
    return raw === true || raw === '1' || raw === 1;
  } catch {
    return true;
  }
}

export function setNotifyMasterEnabled(enabled: boolean): void {
  try {
    Taro.setStorageSync(MASTER_KEY, enabled ? '1' : '0');
  } catch {
    /* 静默 */
  }
}

/** 新用户注册/首次登录后标记：进站后弹一次开启通知 */
export function markLoginOptInPending(): void {
  try {
    Taro.setStorageSync(LOGIN_OPT_IN_PENDING_KEY, '1');
  } catch {
    /* 静默 */
  }
}

export function hasLoginOptInPending(): boolean {
  try {
    return Taro.getStorageSync(LOGIN_OPT_IN_PENDING_KEY) === '1';
  } catch {
    return false;
  }
}

export function clearLoginOptInPending(): void {
  try {
    Taro.removeStorageSync(LOGIN_OPT_IN_PENDING_KEY);
  } catch {
    /* 静默 */
  }
}

export function hasLoginOptInDone(userId: string): boolean {
  if (!userId) return true;
  try {
    return Taro.getStorageSync(`${LOGIN_OPT_IN_DONE_PREFIX}${userId}`) === '1';
  } catch {
    return false;
  }
}

export function markLoginOptInDone(userId: string): void {
  if (!userId) return;
  try {
    Taro.setStorageSync(`${LOGIN_OPT_IN_DONE_PREFIX}${userId}`, '1');
    clearLoginOptInPending();
  } catch {
    /* 静默 */
  }
}
