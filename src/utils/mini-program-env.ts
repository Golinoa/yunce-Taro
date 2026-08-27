/**
 * 微信小程序运行环境（正式版 / 体验版 / 开发版）
 */
import Taro from '@tarojs/taro';

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
 * 桌面快捷方式仅官方支持正式版（体验版/开发版从桌面打开常会闪退）。
 * @see https://developers.weixin.qq.com/minigame/dev/guide/open-ability/add-desktop.html
 */
export function isDesktopShortcutEnvSupported(): boolean {
  return getMiniProgramEnvVersion() === 'release';
}
