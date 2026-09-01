import { describe, expect, it } from 'vitest';
import { isLocalWechatFilePath, isRemotePublicUrl, isTempImagePath } from './image-upload';

describe('image-upload path detection', () => {
  it('treats wechat sandbox paths as local (must upload)', () => {
    expect(isLocalWechatFilePath('wxfile://tmp_abc.jpg')).toBe(true);
    expect(isLocalWechatFilePath('http://tmp/xyz.jpg')).toBe(true);
    expect(isLocalWechatFilePath('http://usr/uploads/a.jpg')).toBe(true);
    expect(isLocalWechatFilePath('https://usr/uploads/a.jpg')).toBe(true);
    expect(isTempImagePath('http://usr/uploads/a.jpg')).toBe(true);
  });

  it('treats CDN urls as remote public', () => {
    expect(isRemotePublicUrl('https://cdn.example.com/avatar/a.jpg')).toBe(true);
    expect(isLocalWechatFilePath('https://cdn.example.com/avatar/a.jpg')).toBe(false);
    expect(isRemotePublicUrl('http://usr/uploads/a.jpg')).toBe(false);
  });
});
