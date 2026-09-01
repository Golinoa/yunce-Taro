import { describe, expect, it } from 'vitest';
import {
  decodeAccessTokenClaims,
  isTenantUuid,
  isUuidOrganizationId,
  pickRealTenantId,
} from './tenant-id';

describe('tenant-id', () => {
  it('isTenantUuid / isUuidOrganizationId 识别标准 UUID', () => {
    expect(isTenantUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(isUuidOrganizationId('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(isTenantUuid('星火艺术中心')).toBe(false);
    expect(isUuidOrganizationId('松果排课')).toBe(false);
    expect(isTenantUuid('profile-user-1')).toBe(false);
  });

  it('isUuidOrganizationId 接受种子 opaque id，拒绝 profile/user 前缀与店名', () => {
    expect(isUuidOrganizationId('org-yunce')).toBe(true);
    expect(isUuidOrganizationId('campus-main-001')).toBe(true);
    expect(isUuidOrganizationId('profile-user-principal-001')).toBe(false);
    expect(isUuidOrganizationId('user-principal-001')).toBe(false);
    expect(isUuidOrganizationId('万老师的店')).toBe(false);
  });

  it('pickRealTenantId 拒绝名称与 profileId 冒充，接受 org-yunce', () => {
    const orgUuid = '11111111-1111-4111-8111-111111111111';
    expect(
      pickRealTenantId(['星火艺术中心', 'profile-1', orgUuid], ['星火艺术中心', 'profile-1']),
    ).toBe(orgUuid);
    expect(pickRealTenantId(['星火艺术中心', 'profile-1'], ['星火艺术中心', 'profile-1'])).toBe('');
    expect(pickRealTenantId(['org-yunce'], ['万老师', 'profile-user-principal-001'])).toBe(
      'org-yunce',
    );
  });

  it('decodeAccessTokenClaims 只读 payload 中的 organizationId/campusId', () => {
    const payload = Buffer.from(
      JSON.stringify({
        organizationId: '22222222-2222-4222-8222-222222222222',
        campusId: '33333333-3333-4333-8333-333333333333',
        nickname: '不应作 id',
      }),
      'utf8',
    )
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    const token = `hdr.${payload}.sig`;
    expect(decodeAccessTokenClaims(token)).toEqual({
      organizationId: '22222222-2222-4222-8222-222222222222',
      campusId: '33333333-3333-4333-8333-333333333333',
    });
  });
});
