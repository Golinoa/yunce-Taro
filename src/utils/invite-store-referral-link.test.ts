import { describe, expect, it } from 'vitest';
import {
  buildStoreReferralLandingPath,
  buildStoreReferralSharePath,
  normalizeOrgReferralCode,
} from './invite-store-referral-link';

describe('invite-store-referral-link', () => {
  it('normalizeOrgReferralCode 大写 trim', () => {
    expect(normalizeOrgReferralCode(' oabc12345 ')).toBe('OABC12345');
  });

  it('buildStoreReferralLandingPath 含 code 参数', () => {
    expect(buildStoreReferralLandingPath('OABC12345')).toContain('code=OABC12345');
  });

  it('buildStoreReferralSharePath 无 leading slash', () => {
    expect(buildStoreReferralSharePath('OABC12345')).toBe(
      'package-settings/pages/store-referral-landing/index?code=OABC12345',
    );
  });
});
