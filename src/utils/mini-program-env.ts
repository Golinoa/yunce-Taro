/**
 * 微信小程序运行环境（正式版 / 体验版 / 开发版）与线上版本号
 */
import Taro from '@tarojs/taro';
import { APP_VERSION } from '@/constants/version';

export type MiniProgramEnvVersion = 'develop' | 'trial' | 'release' | 'unknown';

/** 读取当前小程序版本类型 */
export function getMiniProgramEnvVersion(): MiniProgramEnvVersion {
  try {
    const version = Taro.getAccountInfoSync().miniProgram.envVersion;
    if (version === 'develop' || version === 'trial' || version === 'release') {
      return version;
    }
  } catch {
    // 非微信环境或 API 不可用
  }
  return 'unknown';
}

/**
 * 微信公众平台上传/发布时填写的线上版本号。
 * 仅正式版（release）有值；开发版/体验版为空字符串。
 * @see https://developers.weixin.qq.com/miniprogram/dev/api/open-api/account-info/wx.getAccountInfoSync.html
 */
export function getMiniProgramReleaseVersion(): string {
  try {
    return String(Taro.getAccountInfoSync().miniProgram.version || '').trim();
  } catch {
    return '';
  }
}

/**
 * 设置页等「当前版本」展示：
 * - 正式版优先微信线上 version
 * - 开发/体验或读不到时回退构建注入的 APP_VERSION（package.json）
 */
export function getDisplayAppVersion(): string {
  const release = getMiniProgramReleaseVersion();
  if (release) return release;
  return APP_VERSION || '0.0.0';
}

/**
 * 桌面快捷方式仅官方支持正式版（体验版/开发版从桌面打开常会闪退）。
 * @see https://developers.weixin.qq.com/minigame/dev/guide/open-ability/add-desktop.html
 */
export function isDesktopShortcutEnvSupported(): boolean {
  return getMiniProgramEnvVersion() === 'release';
}
