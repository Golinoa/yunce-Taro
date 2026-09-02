/**
 * 认证邮箱纯函数（Q2-4，从 auth.ts 抽出）
 */
import { resolveDevLoginEmail } from '@/constants/dev-switch-accounts';
import { EMAIL_PATTERN } from '@/constants/email-auth';
import { isDevApiEnv } from '@/utils/build-env';

/** 登录/找回密码：解析邮箱输入（生产走邮箱；dev 保留短用户名与误输入 alias） */
export function resolveLoginEmailInput(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (isDevApiEnv()) {
    const devEmail = resolveDevLoginEmail(trimmed);
    if (devEmail) {
      const lower = trimmed.toLowerCase();
      if (devEmail !== lower || !EMAIL_PATTERN.test(trimmed)) {
        return devEmail;
      }
    }
  }
  if (EMAIL_PATTERN.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  return isDevApiEnv() ? resolveDevLoginEmail(trimmed) : null;
}

/** 掩码展示用邮箱 */
export function maskEmailAddress(email: string): string {
  const [localPart = '', domain = ''] = email.split('@');
  if (!localPart || !domain) return email;
  if (localPart.length <= 2) return `${localPart[0] || '*'}***@${domain}`;
  return `${localPart.slice(0, 2)}***@${domain}`;
}
