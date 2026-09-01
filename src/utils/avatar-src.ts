/**
 * 头像 URL 解析：未上传 / 空串 / 非法值 → 品牌 Logo（sgpk.png）
 */
import { BRAND_LOGO } from '@/constants/brand';

const INVALID = new Set(['', 'null', 'undefined', 'none', 'nil']);

/** 是否可作为远程/本地头像地址展示 */
export function hasUploadedAvatar(src?: string | null): boolean {
  const value = String(src || '').trim();
  if (!value) return false;
  if (INVALID.has(value.toLowerCase())) return false;
  return true;
}

/** 业务头像展示地址：有上传用上传的，否则统一 sgpk */
export function resolveAvatarSrc(src?: string | null): string {
  return hasUploadedAvatar(src) ? String(src).trim() : BRAND_LOGO;
}
