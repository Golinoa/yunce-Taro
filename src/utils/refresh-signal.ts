/**
 * 跨页刷新信号（storage）：写成功后 set，目标页 useDidShow 时 consume 并强制重拉
 */
import Taro from '@tarojs/taro';
import { logError } from '@/utils/logger';

/** 约定 key，避免各页私有字符串漂移 */
export const REFRESH_SIGNAL = {
  schedule: 'yunce:schedule:refresh',
  home: 'yunce:home:refresh',
  /** 课程管理「排课中班级」辅数据 */
  classes: 'yunce:classes:refresh',
  membership: 'yunce:membership:refresh',
  profileQuota: 'yunce:profile-quota:refresh',
  students: 'yunce:students:refresh',
} as const;

export type RefreshSignalKey = (typeof REFRESH_SIGNAL)[keyof typeof REFRESH_SIGNAL] | string;

export function setRefreshSignal(key: RefreshSignalKey): void {
  try {
    Taro.setStorageSync(key, String(Date.now()));
  } catch (err) {
    logError('setRefreshSignal', err);
  }
}

/** 若存在信号则清除并返回 true */
export function consumeRefreshSignal(key: RefreshSignalKey): boolean {
  try {
    const hit = Boolean(Taro.getStorageSync(key));
    if (hit) {
      Taro.removeStorageSync(key);
    }
    return hit;
  } catch (err) {
    logError('consumeRefreshSignal', err);
    return false;
  }
}

/** 排课/点名/补录等写后：课表 + 首页 + 课程管理班级辅数据 */
export function emitScheduleRelatedRefresh(): void {
  setRefreshSignal(REFRESH_SIGNAL.schedule);
  setRefreshSignal(REFRESH_SIGNAL.home);
  setRefreshSignal(REFRESH_SIGNAL.classes);
}
