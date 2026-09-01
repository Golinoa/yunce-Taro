import { describe, expect, it } from 'vitest';
import {
  buildWxacodeImageSrc,
  parseInviteCodeFromWxacodeScene,
  resolveInviteCodeFromPageEntry,
} from './wxacode-scene';

describe('wxacode-scene', () => {
  it('解析 c= 前缀 scene（社区 key=value 格式）', () => {
    expect(parseInviteCodeFromWxacodeScene('c=PABC12345')).toBe('PABC12345');
    expect(parseInviteCodeFromWxacodeScene(encodeURIComponent('c=PABC12345'))).toBe('PABC12345');
  });

  it('解析 legacy 裸 P 码 scene', () => {
    expect(parseInviteCodeFromWxacodeScene('PABC12345')).toBe('PABC12345');
    expect(parseInviteCodeFromWxacodeScene(encodeURIComponent('PABC12345'))).toBe('PABC12345');
  });

  it('解析 legacy UUID compact scene', () => {
    const scene = 'A1B2C3D4E5F67890ABCDEF1234567890';
    expect(parseInviteCodeFromWxacodeScene(scene)).toBe(
      'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    );
  });

  it('resolveInviteCodeFromPageEntry：code 优先于 scene', () => {
    expect(
      resolveInviteCodeFromPageEntry({ code: 'PAAA11111', scene: 'c=PBBB22222' }),
    ).toBe('PAAA11111');
  });

  it('resolveInviteCodeFromPageEntry：无 code 时读 scene', () => {
    expect(resolveInviteCodeFromPageEntry({ scene: 'c=PABC12345' })).toBe('PABC12345');
    expect(resolveInviteCodeFromPageEntry({ scene: encodeURIComponent('c=PABC12345') })).toBe(
      'PABC12345',
    );
  });

  it('buildWxacodeImageSrc 补全 data url 前缀', () => {
    expect(buildWxacodeImageSrc('abc123')).toBe('data:image/png;base64,abc123');
    expect(buildWxacodeImageSrc('data:image/png;base64,abc')).toBe('data:image/png;base64,abc');
  });
});
