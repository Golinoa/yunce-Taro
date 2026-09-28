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
  /** 场地/教室列表（venue-form 写后通知 venue-list） */
  venues: 'yunce:venues:refresh',
} as const;

export type RefreshSignalKey = (typeof REFRESH_SIGNAL)[keyof typeof REFRESH_SIGNAL] | string;

export function setRefreshSignal(key: RefreshSignalKey): void {
  try {
    Taro.setStorageSync(key, String(Date.now()));
  } catch (err) {
    logError('setRefreshSignal', err);
  }
}

/**
 * 只读探测信号时间戳（**不消费**）。
 *
 * 与 `consumeRefreshSignal` 的区别：后者会删除信号——那是信号"归属页"（如课表页）的权利，
 * 别处抢着 consume 会让归属页丢掉这次刷新机会。本函数只读取 `setRefreshSignal` 写入的时间戳，
 * 由调用方拿它跟**自己手上快照的写入时间**比较，判断"快照是否早于某次写操作"。
 *
 * 典型用途：点名页名单内存快照——信号晚于快照即视为过期，直接回源。
 * 返回 null 表示无信号 / 值非法 / 读取出错。
 */
export function peekRefreshSignal(key: RefreshSignalKey): number | null {
  try {
    const raw = Taro.getStorageSync(key);
    const at = Number(raw);
    return Number.isFinite(at) && at > 0 ? at : null;
  } catch (err) {
    logError('peekRefreshSignal', err);
    return null;
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
