import Taro from '@tarojs/taro';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Profile } from '@/types/profile';
import {
  clearProfileSetupDone,
  consumeLastLoginIsNewUser,
  hasSkippedOnboarding,
  IDENTITY_SELECT_PENDING_KEY,
  isIdentityOnboardingAllowlistedPath,
  markIdentitySelectionPending,
  markLastLoginAsNewUser,
  markOnboardingSkipped,
  markProfileSetupDone,
  needsOnboarding,
  needsProfileSetup,
  isSubscribeContextReady,
  ONBOARDING_SKIPPED_KEY,
  PROFILE_SETUP_DONE_KEY,
  shouldRedirectToIdentitySelect,
} from '@/utils/auth-onboarding';
import { invalidateStoreEntryLatestCache } from '@/utils/store-entry-onboarding';

const { fetchStoreEntryLatestCachedMock, shouldRedirectToStoreEntryPendingMock } = vi.hoisted(
  () => ({
    fetchStoreEntryLatestCachedMock: vi.fn(
      async () => null as import('@/types/store-entry').StoreEntryLatestResult | null,
    ),
    shouldRedirectToStoreEntryPendingMock: vi.fn(() => false),
  }),
);

vi.mock('@/utils/route-guard', () => ({
  navigateAfterLogin: vi.fn(),
  LOGIN_REDIRECT_KEY: 'loginRedirectPath',
}));

vi.mock('@/services/store-entry', () => ({
  storeEntryService: {
    queryLatestSafe: vi.fn(async () => null),
  },
}));

vi.mock('@/utils/store-entry-onboarding', async () => {
  const actual = await vi.importActual<typeof import('@/utils/store-entry-onboarding')>(
    '@/utils/store-entry-onboarding',
  );
  return {
    ...actual,
    fetchStoreEntryLatestCached: fetchStoreEntryLatestCachedMock,
    shouldRedirectToStoreEntryPending: shouldRedirectToStoreEntryPendingMock,
  };
});

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
    fetchStoreEntryLatestCachedMock.mockResolvedValue(null);
    shouldRedirectToStoreEntryPendingMock.mockReturnValue(false);
    Taro.removeStorageSync(ONBOARDING_SKIPPED_KEY);
    Taro.removeStorageSync(IDENTITY_SELECT_PENDING_KEY);
    Taro.removeStorageSync(PROFILE_SETUP_DONE_KEY);
    clearProfileSetupDone();
    invalidateStoreEntryLatestCache();
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

  it('needsProfileSetup：完善资料页完成后允许保留默认昵称', () => {
    const profile = baseProfile({ name: '未命名用户', nickname: '未命名用户' });
    expect(needsProfileSetup(profile)).toBe(true);
    markProfileSetupDone(profile.id);
    expect(needsProfileSetup(profile)).toBe(false);
    expect(needsProfileSetup(profile, true)).toBe(false);
  });

  it('navigateAfterProfileSetup：保留默认昵称仍进入身份选择', async () => {
    const redirectTo = vi.fn();
    (Taro as unknown as { redirectTo: typeof redirectTo }).redirectTo = redirectTo;

    const { navigateAfterProfileSetup } = await import('@/utils/auth-onboarding');
    const profile = baseProfile({
      name: '未命名用户',
      nickname: '未命名用户',
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
    });

    navigateAfterProfileSetup(profile);
    await Promise.resolve();
    await Promise.resolve();

    expect(redirectTo).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/package-auth/pages/identity-select/index' }),
    );
    expect(redirectTo).not.toHaveBeenCalledWith(
      expect.objectContaining({ url: '/package-auth/pages/profile-setup/index' }),
    );
  });

  it('isSubscribeContextReady 无机构或未完善资料时不请求 bootstrap', () => {
    expect(isSubscribeContextReady(null)).toBe(false);
    expect(isSubscribeContextReady(baseProfile({ name: '未命名用户', nickname: undefined }))).toBe(
      false,
    );
    expect(isSubscribeContextReady(baseProfile({ name: '万老师', nickname: '万老师' }))).toBe(true);
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

  it('needsOnboarding 教师无真实机构 id 需引导；已有机构则否（不看 institution 文案）', () => {
    expect(
      needsOnboarding(
        baseProfile({
          currentContext: { identityId: 'identity-1', role: 'teacher', organizationId: '' },
          teacher_profile: { id: 't1' } as Profile['teacher_profile'],
        }),
      ),
    ).toBe(true);
    expect(
      needsOnboarding(
        baseProfile({
          currentContext: {
            identityId: 'identity-1',
            role: 'teacher',
            organizationId: 'org-yunce',
          },
          teacher_profile: { id: 't1' } as Profile['teacher_profile'],
        }),
      ),
    ).toBe(false);
    expect(
      needsOnboarding(
        baseProfile({
          currentContext: { identityId: 'identity-1', role: 'teacher', organizationId: 'org-1' },
          teacher_profile: { id: 't1', institution: '星火' } as Profile['teacher_profile'],
        }),
      ),
    ).toBe(false);
  });

  it('needsWechatPhoneBind：仅新用户且无手机号时需要', async () => {
    const { needsWechatPhoneBind } = await import('@/utils/auth-onboarding');
    expect(needsWechatPhoneBind(baseProfile({ phone: '13800000000' }), false)).toBe(false);
    expect(needsWechatPhoneBind(baseProfile({ phone: '13800000000' }), true)).toBe(false);
    expect(needsWechatPhoneBind(baseProfile({ phone: '' }), true)).toBe(true);
    expect(needsWechatPhoneBind(null, true)).toBe(true);
  });

  it('isOnboardingFunnelActive：完善资料 / pending 身份 / 未入驻任一为真', async () => {
    const { isOnboardingFunnelActive } = await import('@/utils/auth-onboarding');
    expect(isOnboardingFunnelActive(null)).toBe(false);
    expect(
      isOnboardingFunnelActive(baseProfile({ name: '万老师', nickname: '万老师' }), {
        isNewUser: true,
      }),
    ).toBe(true);
    markIdentitySelectionPending();
    expect(isOnboardingFunnelActive(baseProfile({ name: '万老师', nickname: '万老师' }))).toBe(
      true,
    );
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
    await navigateAfterAuth(baseProfile({ name: '未命名用户', nickname: undefined }), {
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
    vi.resetModules();
    fetchStoreEntryLatestCachedMock.mockResolvedValue(null);
    const routeGuard = await import('@/utils/route-guard');
    const redirectTo = vi.fn();
    (Taro as unknown as { redirectTo: typeof redirectTo }).redirectTo = redirectTo;
    markIdentitySelectionPending();

    const { navigateAfterAuth, hasIdentitySelectionPending } =
      await import('@/utils/auth-onboarding');
    const profile = baseProfile({ name: '万老师', nickname: '万老师' });
    expect(needsOnboarding(profile)).toBe(false);

    // 密码登录老用户：不传 isNewUser（与 password-login 响应一致）
    await navigateAfterAuth(profile);

    expect(redirectTo).not.toHaveBeenCalled();
    expect(routeGuard.navigateAfterLogin).toHaveBeenCalledWith(profile);
    expect(hasIdentitySelectionPending()).toBe(false);
  });

  it('navigateAfterAuth：shareAttached 时跳过 identity-select 进首页', async () => {
    const routeGuard = await import('@/utils/route-guard');
    const redirectTo = vi.fn();
    (Taro as unknown as { redirectTo: typeof redirectTo }).redirectTo = redirectTo;

    const { navigateAfterAuth } = await import('@/utils/auth-onboarding');
    await navigateAfterAuth(
      baseProfile({
        name: '新家长',
        nickname: '新家长',
        currentContext: { identityId: 'identity-1', role: 'parent', organizationId: '' },
        parent_profile: { id: 'parent-1', bind_status: 'unbound' },
      }),
      { shareAttached: true },
    );

    expect(redirectTo).not.toHaveBeenCalled();
    expect(routeGuard.navigateAfterLogin).toHaveBeenCalled();
  });

  it('navigateAfterAuth：无机构 id 才进选择身份', async () => {
    vi.resetModules();
    fetchStoreEntryLatestCachedMock.mockResolvedValue(null);
    const redirectTo = vi.fn();
    (Taro as unknown as { redirectTo: typeof redirectTo }).redirectTo = redirectTo;
    const { navigateAfterLogin } = await import('@/utils/route-guard');

    const { navigateAfterAuth } = await import('@/utils/auth-onboarding');
    await navigateAfterAuth(
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

  it('navigateAfterAuth：B0-2 有 pending campus 邀请码时优先回落地页（不进选身份）', async () => {
    vi.resetModules();
    fetchStoreEntryLatestCachedMock.mockResolvedValue(null);
    shouldRedirectToStoreEntryPendingMock.mockReturnValue(false);
    const redirectTo = vi.fn();
    (Taro as unknown as { redirectTo: typeof redirectTo }).redirectTo = redirectTo;

    const { storePendingCampusInviteCode, PENDING_CAMPUS_INVITE_CODE_KEY } =
      await import('@/utils/invite-staff-link');
    const { LOGIN_REDIRECT_KEY } = await import('@/utils/route-guard');
    Taro.removeStorageSync(PENDING_CAMPUS_INVITE_CODE_KEY);
    storePendingCampusInviteCode('EABC12345');
    Taro.setStorageSync(
      LOGIN_REDIRECT_KEY,
      '/package-auth/pages/campus-invite-landing/index?code=EABC12345',
    );

    const { navigateAfterAuth } = await import('@/utils/auth-onboarding');
    const { navigateAfterLogin } = await import('@/utils/route-guard');
    await navigateAfterAuth(
      baseProfile({
        name: '新员工',
        nickname: '新员工',
        identities: [
          {
            id: 'identity-1',
            role: 'teacher',
            organizationId: '',
            organizationName: '',
            isDefault: true,
          },
        ],
        currentContext: { identityId: 'identity-1', role: 'teacher', organizationId: '' },
      }),
    );

    expect(redirectTo).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/package-auth/pages/campus-invite-landing/index?code=EABC12345',
      }),
    );
    expect(navigateAfterLogin).not.toHaveBeenCalled();
    // 须清 loginRedirect，否则 accept 后再 navigateAfterLogin 会打回落地页
    expect(Taro.getStorageSync(LOGIN_REDIRECT_KEY) || '').toBe('');
    Taro.removeStorageSync(PENDING_CAMPUS_INVITE_CODE_KEY);
  });

  it('navigateAfterAuth：有待审核入驻申请 → pending 页', async () => {
    vi.resetModules();
    shouldRedirectToStoreEntryPendingMock.mockReturnValue(true);
    fetchStoreEntryLatestCachedMock.mockResolvedValue({
      application: { id: 'app-1', status: 'PENDING' },
    });
    const redirectTo = vi.fn();
    (Taro as unknown as { redirectTo: typeof redirectTo }).redirectTo = redirectTo;

    const { navigateAfterAuth } = await import('@/utils/auth-onboarding');
    await navigateAfterAuth(
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
      expect.objectContaining({ url: '/package-settings/pages/store-entry/pending/index' }),
    );
  });
});
