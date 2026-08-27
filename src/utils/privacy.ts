/**
 * 隐私合规初始化
 *
 * 微信自 2023-09-15 起强制启用《个人信息保护指引》合规：
 * 调用隐私受限接口（如 getLocation / chooseLocation / chooseAddress / getClipboardData 等）
 * 或后台数据预拉取前，必须让用户先同意隐私协议，否则接口失败（即真机日志里的
 * "backgroundfetch privacy fail" 之类）。
 *
 * 本模块在 App 启动时执行一次：
 *  1. 注册 wx.onNeedPrivacyAuthorization 监听 —— 任意隐私接口触发时展示我们的弹窗。
 *  2. wx.getPrivacySetting 查询授权状态并拿到协议名称。
 *  3. 若仍需要授权，主动 wx.requirePrivacyAuthorize 提前弹出（桌面冷启动时跳过，避免闪退）。
 *
 * 仅微信小程序环境生效（H5 等不支持隐私接口，直接跳过）。
 */
import Taro from '@tarojs/taro';
import { usePrivacyStore } from '@/stores/privacy';

let inited = false;

export interface InitPrivacyOptions {
  /** 从桌面 / 最近使用等快捷入口冷启动：不主动 requirePrivacyAuthorize */
  shortcutColdStart?: boolean;
}

export function initPrivacy(options?: InitPrivacyOptions): void {
  if (inited) return;
  // 仅微信小程序需要隐私授权流程；其他端（H5）无此 API，跳过
  if (process.env.TARO_ENV !== 'weapp') return;
  inited = true;

  const shortcutColdStart = options?.shortcutColdStart === true;

  // 1) 必须先注册监听，再触发任何隐私接口
  Taro.onNeedPrivacyAuthorization((resolve) => {
    usePrivacyStore.getState().enqueue(resolve);
  });

  // 2) 查询授权状态 + 协议名称（异步，不阻塞启动）
  Taro.getPrivacySetting({
    success: (res) => {
      const store = usePrivacyStore.getState();
      store.setContractName(res.privacyContractName);
      store.setNeedAuthorization(res.needAuthorization);

      // 3) 快捷入口冷启动不主动弹隐私窗（官方启动优化 + 避免闪退）
      if (shortcutColdStart || !res.needAuthorization) {
        return;
      }

      Taro.requirePrivacyAuthorize({
        success: () => {
          // 用户已在弹窗中同意，无需额外处理
        },
        fail: () => {
          // 用户拒绝，已通过弹窗 disagree 处理，忽略
        },
      });
    },
    fail: () => {
      // 查询失败（多因后台未配置隐私协议）—— 不弹窗，静默降级
    },
  });
}
