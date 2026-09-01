import Taro from '@tarojs/taro';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Profile } from '@/types/profile';
import {
  consumeLastLoginIsNewUser,
  hasSkippedOnboarding,
  IDENTITY_SELECT_PENDING_KEY,
  isIdentityOnboardingAllowlistedPath,
  markIdentitySelectionPending,
  markLastLoginAsNewUser,
  markOnboardingSkipped,
  needsOnboarding,
  needsProfileSetup,
  ONBOARDING_SKIPPED_KEY,
  shouldRedirectToIdentitySelect,
} from '@/utils/auth-onboarding';

vi.mock('@/utils/route-guard', () => ({
  navigateAfterLogin: vi.fn(),
}));

const ORG_UUID = '11111111-1111-4111-8111-111111111111';

const baseProfile = (patch: Partial<Profile> = {}): Profile => ({
  id: 'profile-1',
  name: '测试用户',
  identities: [
    {
      id: 'identity-1',
      role: 'principal',
      organizationId: 'org-yunce',
      organizationName: '松果排课',
      isDefault: true,
    },
  ],
  currentContext: {
    identityId: 'identity-1',
    role: 'principal',
    organizationId: 'org-yunce',
  },
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  ...patch,
});

describe('auth-onboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Taro.removeStorageSync(ONBOARDING_SKIPPED_KEY);
    Taro.removeStorageSync(IDENTITY_SELECT_PENDING_KEY);
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

  it('needsOnboarding 校长以真实机构 id 为准（UUID 或种子 org-yunce，不用机构名）', () => {
    expect(needsOnboarding(baseProfile())).toBe(false);
    expect(
      needsOnboarding(
        baseProfile({
          identities: [
            {
              id: 'identity-1',
              role: 'principal',
              organizationId: ORG_UUID,
              organizationName: '松果排课',
              isDefault: true,
            },
          ],
          currentContext: {
            identityId: 'identity-1',
            role: 'principal',
            organizationId: ORG_UUID,
          },
        }),
      ),
    ).toBe(false);
    expect(
      needsOnboarding(
        baseProfile({
          identities: [
            {
              id: 'identity-1',
              role: 'principal',
              organizationId: '',
              organizationName: '星火艺术',
              isDefault: true,
            },
          ],
          currentContext: {
            identityId: 'identity-1',
            role: 'principal',
            organizationId: '',
          },
        }),
      ),
    ).toBe(true);
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

  it('pending 身份：非白名单路径应 redirect，白名单（含 store-entry）不 redirect', () => {
    expect(isIdentityOnboardingAllowlistedPath('/package-auth/pages/identity-select/index')).toBe(
      true,
    );
    expect(isIdentityOnboardingAllowlistedPath('/package-settings/pages/store-entry/index')).toBe(
      true,
    );
    expect(
      isIdentityOnboardingAllowlistedPath('/package-settings/pages/store-entry/pending/index'),
    ).toBe(true);
    expect(
      isIdentityOnboardingAllowlistedPath('/package-auth/pages/login/forgot-password/index'),
    ).toBe(true);
    expect(isIdentityOnboardingAllowlistedPath('/pages/home/index')).toBe(false);

    markIdentitySelectionPending();
    expect(shouldRedirectToIdentitySelect('/pages/home/index')).toBe(true);
    expect(shouldRedirectToIdentitySelect('/package-settings/pages/store-entry/index')).toBe(false);
    expect(shouldRedirectToIdentitySelect('/package-auth/pages/identity-select/index')).toBe(false);
  });

  it('navigateAfterAuth 跳转带 fail 兜底', async () => {
    const redirectTo = vi.fn((opts: { url: string; fail?: () => void }) => {
      opts.fail?.();
    });
    const reLaunch = vi.fn();
    const showToast = vi.fn();
    (Taro as unknown as { redirectTo: typeof redirectTo }).redirectTo = redirectTo;
    (Taro as unknown as { reLaunch: typeof reLaunch }).reLaunch = reLaunch;
    (Taro as unknown as { showToast: typeof showToast }).showToast = showToast;

    const { navigateAfterAuth } = await import('@/utils/auth-onboarding');
    navigateAfterAuth(baseProfile({ name: '未命名用户', nickname: undefined }), {
      isNewUser: true,
    });

    expect(redirectTo).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/package-auth/pages/profile-setup/index' }),
    );
    expect(showToast).toHaveBeenCalled();
    expect(reLaunch).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/package-auth/pages/login/index' }),
    );
  });

  it('navigateAfterAuth：已有机构的种子账号即使残留 pending 也进首页', async () => {
    const routeGuard = await import('@/utils/route-guard');
    const redirectTo = vi.fn();
    (Taro as unknown as { redirectTo: typeof redirectTo }).redirectTo = redirectTo;
    markIdentitySelectionPending();

    const { navigateAfterAuth, hasIdentitySelectionPending } = await import(
      '@/utils/auth-onboarding'
    );
    const profile = baseProfile({ name: '万老师', nickname: '万老师' });
    expect(needsOnboarding(profile)).toBe(false);

    // 密码登录老用户：不传 isNewUser（与 password-login 响应一致）
    navigateAfterAuth(profile);

    expect(redirectTo).not.toHaveBeenCalled();
    expect(routeGuard.navigateAfterLogin).toHaveBeenCalledWith(profile);
    expect(hasIdentitySelectionPending()).toBe(false);
  });

  it('navigateAfterAuth：无机构 id 才进选择身份', async () => {
    const redirectTo = vi.fn();
    (Taro as unknown as { redirectTo: typeof redirectTo }).redirectTo = redirectTo;
    const { navigateAfterLogin } = await import('@/utils/route-guard');

    const { navigateAfterAuth } = await import('@/utils/auth-onboarding');
    navigateAfterAuth(
      baseProfile({
        name: '新用户',
        nickname: '新用户',
        identities: [
          {
            id: 'identity-1',
            role: 'principal',
            organizationId: '',
            organizationName: '',
            isDefault: true,
          },
        ],
        currentContext: { identityId: 'identity-1', role: 'principal', organizationId: '' },
      }),
    );

    expect(redirectTo).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/package-auth/pages/identity-select/index' }),
    );
    expect(navigateAfterLogin).not.toHaveBeenCalled();
  });
});
