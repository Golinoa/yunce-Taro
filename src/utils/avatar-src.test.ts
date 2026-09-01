import { describe, expect, it } from 'vitest';
import { BRAND_LOGO } from '@/constants/brand';
import { hasUploadedAvatar, resolveAvatarSrc } from './avatar-src';

describe('avatar-src', () => {
  it('无上传时回落到 sgpk 品牌图', () => {
    expect(resolveAvatarSrc(undefined)).toBe(BRAND_LOGO);
    expect(resolveAvatarSrc(null)).toBe(BRAND_LOGO);
    expect(resolveAvatarSrc('')).toBe(BRAND_LOGO);
    expect(resolveAvatarSrc('  ')).toBe(BRAND_LOGO);
    expect(resolveAvatarSrc('null')).toBe(BRAND_LOGO);
    expect(hasUploadedAvatar('')).toBe(false);
  });

  it('有真实地址时原样返回', () => {
    expect(resolveAvatarSrc('https://cdn.example.com/a.png')).toBe('https://cdn.example.com/a.png');
    expect(hasUploadedAvatar('https://cdn.example.com/a.png')).toBe(true);
  });
});
