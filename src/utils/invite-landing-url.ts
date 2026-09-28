/**
 * 邀约落地页「网址」构造
 *
 * 背景（2026-09-29）：复制链接原来给的是 `/package-auth/pages/invite-register/index?code=P…`，
 * 那是**小程序内部路径**，粘到浏览器/短信/微信外打不开。现改为指向后端 H5 落地页的
 * 普通网址（`GET /invite/:code`，需 nginx 同步放行 /invite/）。
 *
 * ⚠️ 与微信分享用的 `path` 区分开：`shareAppMessage.path` **必须**是小程序页面路径，
 * 传网址会导致分享打开失败。本函数只用于「复制链接」与页面展示。
 */
import { getLandingBaseUrl } from '@/utils/build-env';

/**
 * `<落地页前缀>/invite/<固定招生码>`；码为空时返回空串（调用方按"链接未就绪"处理）。
 * 前缀来自构建期变量 `TARO_H5_LANDING_BASE_URL`（换域名只改该变量）。
 */
export function buildInviteLandingUrl(inviteCode: string): string {
  const code = (inviteCode || '').trim();
  if (!code) return '';
  return `${getLandingBaseUrl()}/invite/${encodeURIComponent(code)}`;
}
