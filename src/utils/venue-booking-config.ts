/**
 * 场地预约功能开关配置
 *
 * 通过本地存储控制场地预约模块的显隐，默认开启。
 */
import Taro from '@tarojs/taro';

/** 场地预约开关 storage key */
export const VENUE_BOOKING_ENABLED_KEY = 'yunce:venue_booking_enabled';

/**
 * 获取场地预约功能是否开启
 * @returns 开启返回 true，默认开启
 */
export function getVenueBookingEnabled(): boolean {
  try {
    const value = Taro.getStorageSync(VENUE_BOOKING_ENABLED_KEY);
    return value !== false;
  } catch {
    return true;
  }
}

/**
 * 设置场地预约功能开关
 * @param enabled 是否开启
 */
export function setVenueBookingEnabled(enabled: boolean): void {
  try {
    Taro.setStorageSync(VENUE_BOOKING_ENABLED_KEY, enabled);
  } catch {
    // 忽略写入失败
  }
}
