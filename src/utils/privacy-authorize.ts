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
import { privacyTrace } from '@/utils/privacy-debug';

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
  privacyTrace('promptPrivacyIfNeeded.check');
  const ok = await isPrivacyAuthorized();
  privacyTrace('promptPrivacyIfNeeded.done', { ok });
  return ok;
}

export async function ensurePrivacyAuthorized(): Promise<void> {
  if (process.env.TARO_ENV !== 'weapp') return;

  privacyTrace('ensurePrivacyAuthorized.start');
  const ok = await isPrivacyAuthorized();
  if (!ok) {
    privacyTrace('ensurePrivacyAuthorized.throw');
    throw new Error('需要同意隐私保护指引后才能使用本小程序');
  }
  privacyTrace('ensurePrivacyAuthorized.ok');
}

export async function ensurePrivacyBeforeAuth(): Promise<boolean> {
  privacyTrace('ensurePrivacyBeforeAuth.start');
  const ok = await promptPrivacyIfNeeded();
  if (!ok) {
    privacyTrace('ensurePrivacyBeforeAuth.denied');
    Taro.showToast({
      title: '请先同意隐私保护指引后才能继续',
      icon: 'none',
      duration: 2800,
    });
  } else {
    privacyTrace('ensurePrivacyBeforeAuth.ok');
  }
  return ok;
}
