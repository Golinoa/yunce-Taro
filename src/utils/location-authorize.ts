/**
 * 微信位置权限：chooseLocation / getLocation 前确保已授权。
 * 未授权时走 authorize → 拒绝则引导 openSetting。
 */
import Taro from '@tarojs/taro';

const LOCATION_SCOPE = 'scope.userLocation';

function readLocationAuth(setting: Taro.getSetting.SuccessCallbackResult): boolean | undefined {
  const auth = setting.authSetting as Record<string, boolean | undefined>;
  return auth[LOCATION_SCOPE];
}

/** @returns true 已授权可用位置；false 用户拒绝且未打开设置 */
export async function ensureUserLocationAuthorized(): Promise<boolean> {
  if (process.env.TARO_ENV !== 'weapp') {
    return true;
  }

  try {
    const setting = await Taro.getSetting();
    if (readLocationAuth(setting) === true) {
      return true;
    }
  } catch {
    /* 继续尝试 authorize */
  }

  try {
    await Taro.authorize({ scope: LOCATION_SCOPE });
    return true;
  } catch {
    const modal = await Taro.showModal({
      title: '需要位置权限',
      content: '选择门店地址需要使用你的地理位置，请在设置中开启位置信息。',
      confirmText: '去设置',
      cancelText: '取消',
    });
    if (!modal.confirm) {
      return false;
    }
    try {
      await Taro.openSetting();
      const after = await Taro.getSetting();
      return readLocationAuth(after) === true;
    } catch {
      return false;
    }
  }
}
