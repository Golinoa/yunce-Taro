/**
 * 小程序冷启动延后任务
 *
 * 微信官方建议：onLaunch / 启动阶段避免同步 Storage 与主动弹窗（隐私授权等），
 * 否则 Android 桌面快捷方式冷启动易闪退。
 * @see https://developers.weixin.qq.com/miniprogram/dev/framework/performance/tips/start_optimizeB.html
 *
 * 隐私授权不在冷启动弹窗：由登录页 useDidShow 调 requirePrivacyAuthorize 唤起微信官方图二。
 */
import Taro from '@tarojs/taro';
import { useThemeStore } from '@/stores/theme';
import { ADD_TO_DESKTOP_DISMISSED_KEY } from '@/utils/add-to-desktop';
import { COLD_START_GRACE_MS, isShortcutEntryLaunch } from '@/utils/launch-scene';
import { initPrivacy } from '@/utils/privacy';

let scheduled = false;

function deferDismissShortcutTip(): void {
  if (!isShortcutEntryLaunch()) {
    return;
  }
  void Taro.setStorage({ key: ADD_TO_DESKTOP_DISMISSED_KEY, data: true }).catch(() => {
    // 忽略
  });
}

function runDeferredStartup(): void {
  try {
    useThemeStore.getState().initTheme();
  } catch {
    // 首屏 page 可能尚未就绪
  }

  // 仅同步隐私状态，不主动弹窗（弹窗由登录按钮手势触发）
  initPrivacy({ shortcutColdStart: isShortcutEntryLaunch() });
  deferDismissShortcutTip();
}

/** App mount 后调用一次：延后主题 / 隐私状态查询等非关键初始化 */
export function scheduleDeferredAppStartup(): void {
  if (scheduled) {
    return;
  }
  scheduled = true;

  setTimeout(runDeferredStartup, COLD_START_GRACE_MS);
}
