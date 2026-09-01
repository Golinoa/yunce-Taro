/** 邮箱认证 — 统一文案与校验（登录 / 找回密码 / 注册） */

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const EMAIL_OTP_COOLDOWN_SEC = 60;

export const EMAIL_NOT_REGISTERED = '该邮箱尚未注册';

export const EMAIL_CODE_SENT_TOAST = '验证码已发送，请查收邮箱（含垃圾箱）';

export const EMAIL_SEND_FAILED = '验证码发送失败，请稍后重试';

export const EMAIL_TOO_FREQUENT = '验证码发送过于频繁，请稍后再试';

export const PASSWORD_RESET_SUCCESS = '密码已重置，请使用新密码登录';

export function isEmailTooFrequentMessage(message: string): boolean {
  return /过于频繁|稍后再试|429/.test(message);
}

export function formatEmailCodeSentToast(maskedEmail?: string): string {
  if (maskedEmail) {
    return `验证码已发送，请查收 ${maskedEmail}（含垃圾箱）`;
  }
  return EMAIL_CODE_SENT_TOAST;
}
