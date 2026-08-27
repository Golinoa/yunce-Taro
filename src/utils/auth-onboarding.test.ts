import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/route-guard', () => ({
  navigateAfterLogin: vi.fn(),
}));

import Taro from '@tarojs/taro';
import type { Profile } from '@/types/profile';
import {
  consumeLastLoginIsNewUser,
  hasSkippedOnboarding,
  markLastLoginAsNewUser,
  markOnboardingSkipped,
  needsOnboarding,
  needsProfileSetup,
  ONBOARDING_SKIPPED_KEY,
} from '@/utils/auth-onboarding';

const baseProfile = (patch: Partial<Profile> = {}): Profile => ({
  id: 'profile-1',
  name: '测试用户',
  identities: [
    {
      id: 'identity-1',
      role: 'principal',
      organizationId: 'org-1',
      organizationName: '松果排课',
      isDefault: true,
    },
  ],
  currentContext: {
    identityId: 'identity-1',
    role: 'principal',
    organizationId: 'org-1',
  },
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  ...patch,
});

describe('auth-onboarding', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Taro.removeStorageSync(ONBOARDING_SKIPPED_KEY);
  });

  it('needsProfileSetup 新用户强制完善资料', () => {
    const profile = baseProfile({ name: '已有昵称', nickname: '已有昵称' });
    expect(needsProfileSetup(profile, true)).toBe(true);
  });

  it('needsProfileSetup 缺昵称或默认名需完善', () => {
    expect(needsProfileSetup(baseProfile({ name: '未命名用户', nickname: undefined }))).toBe(true);
    expect(needsProfileSetup(baseProfile({ name: '', nickname: undefined }))).toBe(true);
    expect(needsProfileSetup(baseProfile({ name: '张老师', nickname: '张老师' }))).toBe(false);
  });

  it('needsOnboarding 校长默认机构需入驻', () => {
    expect(needsOnboarding(baseProfile())).toBe(true);
    expect(
      needsOnboarding(
        baseProfile({
          identities: [
            {
              id: 'identity-1',
              role: 'principal',
              organizationId: 'org-1',
              organizationName: '松果艺术',
              isDefault: true,
            },
          ],
        }),
      ),
    ).toBe(false);
  });

  it('needsOnboarding 家长未绑定需引导', () => {
    expect(
      needsOnboarding(
        baseProfile({
          currentContext: { identityId: 'identity-1', role: 'parent', organizationId: 'org-1' },
          parent_profile: { id: 'parent-1', bind_status: 'unbound' },
        }),
      ),
    ).toBe(true);
  });

  it('跳过引导后不再提示', () => {
    markOnboardingSkipped();
    expect(hasSkippedOnboarding()).toBe(true);
    expect(needsOnboarding(baseProfile())).toBe(false);
  });

  it('consumeLastLoginIsNewUser 只消费一次', () => {
    markLastLoginAsNewUser();
    expect(consumeLastLoginIsNewUser()).toBe(true);
    expect(consumeLastLoginIsNewUser()).toBe(false);
  });
});
