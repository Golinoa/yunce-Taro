import Taro from '@tarojs/taro';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/request', () => ({
  post: vi.fn(),
  get: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
}));

vi.mock('@/services/campus-invite', () => ({
  campusInviteService: {
    preview: vi.fn(),
  },
}));

vi.mock('@/utils/build-env', () => ({
  isUseMock: () => false,
  isDevApiEnv: () => true,
  getApiBaseUrl: () => 'https://dev.chancore.cn/api/app/v1',
  PROD_API_BASE_URL: 'https://api.chancore.cn/api/app/v1',
  API_BASE_URL: 'https://dev.chancore.cn/api/app/v1',
}));

describe('auth service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    Taro.setStorageSync('yunce-edu-register-draft-local', '');
  });

  it('测环境支持账号密码与邮箱验证码登录能力', async () => {
    const { authCapabilities } = await import('@/services/auth');
    expect(authCapabilities.supportsEmailCodeLogin).toBe(true);
    expect(authCapabilities.supportsAccountPasswordLogin).toBe(true);
    expect(authCapabilities.usesMockRegister).toBe(false);
  });

  it('registerStep1ByEmail 校验邮箱格式', async () => {
    const { registerStep1ByEmail } = await import('@/services/auth');
    const invalid = await registerStep1ByEmail('not-an-email', '123456');
    expect(invalid.tempToken).toBeNull();
    expect(invalid.error?.message).toContain('邮箱');
  });

  it('registerStep1ByPhone 校验手机号格式', async () => {
    const { registerStep1ByPhone } = await import('@/services/auth');
    const invalid = await registerStep1ByPhone('12345', '123456');
    expect(invalid.tempToken).toBeNull();
    expect(invalid.error?.message).toContain('手机号');
  });

  it('login 走 /auth/password-login（短用户名映射邮箱）', async () => {
    const { post } = await import('@/utils/request');
    vi.mocked(post).mockResolvedValueOnce({
      token: 'tok',
      refreshToken: 'rt',
      expiresIn: 3600,
      user: {
        id: 'user-principal-001',
        profileId: 'profile-user-principal-001',
        nickname: '万老师',
        role: 'PRINCIPAL',
        avatar: null,
        phone: '13800000001',
      },
    });

    const { login } = await import('@/services/auth');
    const result = await login('principal1', '123456');

    expect(post).toHaveBeenCalledWith(
      '/auth/password-login',
      { email: 'principal1@yunce.com', password: '123456' },
      { skipAuth: true },
    );
    expect(result.error).toBeNull();
    expect(result.session?.access_token).toBe('tok');
  });

  it('login 误输入 principal@yunce.com 映射到 principal1 种子邮箱', async () => {
    const { post } = await import('@/utils/request');
    vi.mocked(post).mockResolvedValueOnce({
      token: 'tok',
      refreshToken: 'rt',
      expiresIn: 3600,
      user: {
        id: 'user-principal-001',
        profileId: 'profile-user-principal-001',
        nickname: '万老师',
        role: 'PRINCIPAL',
        avatar: null,
        phone: '13800000001',
      },
    });

    const { login } = await import('@/services/auth');
    await login('principal@yunce.com', '123456');
    expect(post).toHaveBeenCalledWith(
      '/auth/password-login',
      { email: 'principal1@yunce.com', password: '123456' },
      { skipAuth: true },
    );
  });

  it('getTestAccounts 在真链路返回空数组', async () => {
    const { getTestAccounts, getTestPassword } = await import('@/services/auth');
    await expect(getTestAccounts()).resolves.toEqual([]);
    await expect(getTestPassword()).resolves.toBe('');
  });

  it('prepareEmailRegister 走 REGISTER purpose', async () => {
    const { post } = await import('@/utils/request');
    vi.mocked(post).mockResolvedValueOnce({ sent: true });
    const { prepareEmailRegister } = await import('@/services/auth');
    const result = await prepareEmailRegister('new@example.com');
    expect(post).toHaveBeenCalledWith(
      '/auth/email-code',
      { email: 'new@example.com', purpose: 'REGISTER' },
      expect.objectContaining({ skipAuth: true }),
    );
    expect(result.status).toBe('ready');
  });

  it('registerWithEmailPassword 两次密码由页面校验；服务提交 code+password', async () => {
    const { post } = await import('@/utils/request');
    vi.mocked(post).mockResolvedValueOnce({
      token: 'tok',
      refreshToken: 'rt',
      expiresIn: 3600,
      isNewUser: true,
      user: {
        id: 'u1',
        profileId: 'p1',
        nickname: null,
        role: 'PRINCIPAL',
        avatar: null,
        phone: null,
        email: 'new@example.com',
      },
    });
    const { registerWithEmailPassword } = await import('@/services/auth');
    const result = await registerWithEmailPassword({
      email: 'new@example.com',
      code: '123456',
      password: '123456',
    });
    expect(post).toHaveBeenCalledWith(
      '/auth/register',
      {
        email: 'new@example.com',
        code: '123456',
        password: '123456',
        role: 'PRINCIPAL',
      },
      { skipAuth: true },
    );
    expect(result.error).toBeNull();
    expect(result.isNewUser).toBe(true);
  });

  it('mapBackendProfile：有 institution 名称时 organizationId ≠ 名称且 ≠ profileId', async () => {
    const { mapBackendProfile } = await import('@/services/auth');
    const orgUuid = '11111111-1111-4111-8111-111111111111';
    const profile = mapBackendProfile({
      id: 'biz-1',
      profileId: 'profile-user-1',
      nickname: '星火艺术中心',
      role: 'PRINCIPAL',
      avatar: null,
      phone: null,
      organizationId: orgUuid,
      campusId: '22222222-2222-4222-8222-222222222222',
      organizationName: '星火艺术中心',
      principal: { id: 'profile-user-1', institution: '星火艺术中心' },
    });
    expect(profile.currentContext.organizationId).toBe(orgUuid);
    expect(profile.currentContext.organizationId).not.toBe('星火艺术中心');
    expect(profile.currentContext.organizationId).not.toBe('profile-user-1');
    expect(profile.identities[0]?.organizationName).toBe('星火艺术中心');
  });

  it('mapBackendProfile：无 org 字段时 organizationId 为空（不用 profileId 冒充）', async () => {
    const { mapBackendProfile } = await import('@/services/auth');
    const profile = mapBackendProfile({
      id: 'biz-1',
      profileId: 'profile-new-1',
      nickname: '新用户',
      role: 'PRINCIPAL',
      avatar: null,
      phone: null,
      principal: { id: 'profile-new-1', institution: null },
    });
    expect(profile.currentContext.organizationId).toBe('');
    expect(profile.currentContext.organizationId).not.toBe('profile-new-1');
    expect(profile.currentContext.organizationId).not.toBe('新用户');
  });

  it('mapBackendProfile：仅 JWT 有 organizationId 时写入 Profile', async () => {
    const { mapBackendProfile } = await import('@/services/auth');
    const orgUuid = '33333333-3333-4333-8333-333333333333';
    const payload = Buffer.from(
      JSON.stringify({ organizationId: orgUuid, campusId: '44444444-4444-4444-8444-444444444444' }),
      'utf8',
    )
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    const token = `hdr.${payload}.sig`;
    const profile = mapBackendProfile(
      {
        id: 'biz-1',
        profileId: 'profile-1',
        nickname: '管理员',
        role: 'PRINCIPAL',
        avatar: null,
        phone: null,
      },
      token,
    );
    expect(profile.currentContext.organizationId).toBe(orgUuid);
  });

  it('mergeBackendProfileDetail：优先 detail.organizationId；非 UUID 的旧值丢弃', async () => {
    const { mapBackendProfile, mergeBackendProfileDetail } = await import('@/services/auth');
    const orgUuid = '66666666-6666-4666-8666-666666666666';
    const base = mapBackendProfile({
      id: 'biz-1',
      profileId: 'profile-1',
      nickname: '管理员',
      role: 'PRINCIPAL',
      avatar: null,
      phone: null,
      principal: { id: 'p1', institution: '星火艺术中心' },
    });
    expect(base.currentContext.organizationId).toBe('');

    const withFake = {
      ...base,
      currentContext: { ...base.currentContext, organizationId: '星火艺术中心' },
      identities: base.identities.map((i) => ({ ...i, organizationId: '星火艺术中心' })),
    };
    const cleared = mergeBackendProfileDetail(withFake, {
      id: 'biz-1',
      profileId: 'profile-1',
      nickname: '管理员',
      phone: null,
      email: null,
      avatar: null,
      role: 'PRINCIPAL',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    expect(cleared.currentContext.organizationId).toBe('');

    const merged = mergeBackendProfileDetail(withFake, {
      id: 'biz-1',
      profileId: 'profile-1',
      nickname: '管理员',
      phone: null,
      email: null,
      avatar: null,
      role: 'PRINCIPAL',
      createdAt: '2026-01-01T00:00:00.000Z',
      organizationId: orgUuid,
      organizationName: '星火艺术中心',
    });
    expect(merged.currentContext.organizationId).toBe(orgUuid);
    expect(merged.identities[0]?.organizationName).toBe('星火艺术中心');
  });

  it('refreshSessionForTenant：换 token 后 Profile.organizationId 与 JWT 对齐', async () => {
    const { post, get } = await import('@/utils/request');
    const orgUuid = '55555555-5555-4555-8555-555555555555';
    const payload = Buffer.from(JSON.stringify({ organizationId: orgUuid }), 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    const newToken = `hdr.${payload}.sig`;

    Taro.setStorageSync(
      'yunce-edu-auth-token',
      JSON.stringify({
        access_token: 'old',
        refresh_token: 'rt-old',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      }),
    );
    Taro.setStorageSync(
      'yunce-edu-user-profile',
      JSON.stringify({
        id: 'profile-1',
        name: '管理员',
        identities: [
          {
            id: 'profile-1',
            role: 'principal',
            organizationId: '星火艺术中心',
            organizationName: '星火艺术中心',
            isDefault: true,
          },
        ],
        currentContext: {
          identityId: 'profile-1',
          role: 'principal',
          organizationId: '星火艺术中心',
        },
        created_at: '',
        updated_at: '',
      }),
    );

    vi.mocked(post).mockResolvedValueOnce({
      token: newToken,
      refreshToken: 'rt-new',
      expiresIn: 7200,
    });
    vi.mocked(get).mockResolvedValueOnce({
      id: 'profile-1',
      profileId: 'profile-1',
      nickname: '管理员',
      role: 'PRINCIPAL',
      avatar: null,
      phone: null,
      organizationId: orgUuid,
      organizationName: '星火艺术中心',
    });

    const { refreshSessionForTenant } = await import('@/services/auth');
    const result = await refreshSessionForTenant();
    expect(result.ok).toBe(true);
    expect(result.profile?.currentContext.organizationId).toBe(orgUuid);
    expect(result.profile?.currentContext.organizationId).not.toBe('星火艺术中心');
  });

  it('listParentStorefronts：GET /auth/parent-storefronts', async () => {
    const { get } = await import('@/utils/request');
    vi.mocked(get).mockResolvedValueOnce({
      list: [
        {
          organizationId: 'org-a',
          organizationName: '云策',
          organizationStatus: 'ACTIVE',
          campusId: 'campus-1',
          campusName: '总校',
          isMain: true,
          students: [{ id: 's1', name: '小明' }],
        },
      ],
      current: { organizationId: 'org-a', campusId: 'campus-1' },
    });

    const { listParentStorefronts, AUTH_ENDPOINTS } = await import('@/services/auth');
    const result = await listParentStorefronts();
    expect(get).toHaveBeenCalledWith(AUTH_ENDPOINTS.parentStorefronts);
    expect(result.error).toBeNull();
    expect(result.list).toHaveLength(1);
    expect(result.current?.campusId).toBe('campus-1');
  });

  it('switchAuthContext：POST /auth/switch-context 映射 AuthPayload', async () => {
    const { post } = await import('@/utils/request');
    const orgUuid = '66666666-6666-4666-8666-666666666666';
    vi.mocked(post).mockResolvedValueOnce({
      token: 'tok-sw',
      refreshToken: 'rt-sw',
      expiresIn: 3600,
      user: {
        id: 'biz-parent',
        profileId: 'profile-parent',
        nickname: '家长',
        role: 'PARENT',
        avatar: null,
        phone: null,
        organizationId: orgUuid,
        campusId: 'campus-b',
        organizationName: '星河',
      },
    });

    const { switchAuthContext, AUTH_ENDPOINTS } = await import('@/services/auth');
    const result = await switchAuthContext({
      organizationId: orgUuid,
      campusId: 'campus-b',
    });
    expect(post).toHaveBeenCalledWith(AUTH_ENDPOINTS.switchContext, {
      organizationId: orgUuid,
      campusId: 'campus-b',
    });
    expect(result.error).toBeNull();
    expect(result.session?.access_token).toBe('tok-sw');
    expect(result.profile?.currentContext.organizationId).toBe(orgUuid);
  });

  it('switchAuthContext：缺 campusId 不发请求', async () => {
    const { post } = await import('@/utils/request');
    const { switchAuthContext } = await import('@/services/auth');
    const result = await switchAuthContext({ organizationId: 'org-a', campusId: '' });
    expect(post).not.toHaveBeenCalled();
    expect(result.error?.message).toContain('门店');
  });
});
