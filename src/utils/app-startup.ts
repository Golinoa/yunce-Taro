/**
 * 小程序冷启动延后任务
 *
 * 微信官方建议：onLaunch / 启动阶段避免同步 Storage 与主动弹窗（隐私授权等），
 * 否则 Android 桌面快捷方式冷启动易闪退。
 * @see https://developers.weixin.qq.com/miniprogram/dev/framework/performance/tips/start_optimizeB.html
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

  // 隐私：只注册监听，不在启动时主动 requirePrivacyAuthorize（避免桌面/冷启动叠加弹窗）
  initPrivacy({ shortcutColdStart: true });
  deferDismissShortcutTip();
}

/**
 * 将主题初始化、隐私探测、桌面引导标记等延后到首屏稳定后执行。
 * 应在 App 组件 mount 后调用一次。
 */
export function scheduleDeferredAppStartup(): void {
  if (scheduled) {
    return;
  }
  scheduled = true;

  // 统一等冷启动保护窗口结束后再做非关键初始化
  setTimeout(runDeferredStartup, COLD_START_GRACE_MS);
}
