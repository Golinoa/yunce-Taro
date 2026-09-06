/**
 * 微信官方隐私授权（图二：系统「用户隐私保护提示」绿按钮）
 *
 * 不注册 onNeedPrivacyAuthorization，requirePrivacyAuthorize 由微信弹出系统原生框。
 */
import Taro from '@tarojs/taro';
import {
  getPrivacyNeedAuthorization,
  promptOfficialPrivacyOnUserAction,
  promptWechatOfficialPrivacyOnPageEnter,
} from '@/utils/privacy';

export { promptOfficialPrivacyOnUserAction, promptWechatOfficialPrivacyOnPageEnter };

/** @deprecated 使用 promptOfficialPrivacyOnUserAction */
export function promptPrivacySyncInHandler(onAuthorized: () => void, onDenied?: () => void): void {
  promptOfficialPrivacyOnUserAction('legacy.syncHandler', onAuthorized, onDenied);
}

async function isPrivacyAuthorized(): Promise<boolean> {
  const stillNeed = await getPrivacyNeedAuthorization();
  return !stillNeed;
}

export async function promptPrivacyIfNeeded(): Promise<boolean> {
  if (process.env.TARO_ENV !== 'weapp') return true;
  return isPrivacyAuthorized();
}

export async function ensurePrivacyAuthorized(): Promise<void> {
  if (process.env.TARO_ENV !== 'weapp') return;

  const ok = await isPrivacyAuthorized();
  if (!ok) {
    throw new Error('需要同意隐私保护指引后才能使用本小程序');
  }
}

export async function ensurePrivacyBeforeAuth(): Promise<boolean> {
  const ok = await promptPrivacyIfNeeded();
  if (!ok) {
    Taro.showToast({
      title: '请先同意隐私保护指引后才能继续',
      icon: 'none',
      duration: 2800,
    });
  }
  return ok;
}
