import Taro from '@tarojs/taro';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Profile } from '@/types/profile';
import { ApiError } from '@/utils/request';
import {
  getLatestApplicationStatus,
  hasOwnOrganizationContext,
  invalidateStoreEntryLatestCache,
  readStoreEntryLatestCache,
  resolveStoreEntryFormGate,
  resolveStoreEntryFunnelDestination,
  resolveStoreEntrySubmitError,
  shouldRedirectToStoreEntryPending,
  writeStoreEntryLatestCache,
} from './store-entry-onboarding';

vi.mock('@/services/store-entry', () => ({
  storeEntryService: {
    queryLatestSafe: vi.fn(async () => null),
  },
}));

const ORG_UUID = '11111111-1111-4111-8111-111111111111';

const managerNoOrg = (): Profile =>
  ({
    id: 'p1',
    name: '申请人',
    identities: [
      {
        id: 'i1',
        role: 'principal',
        organizationId: '',
        organizationName: '',
        isDefault: true,
      },
    ],
    currentContext: { identityId: 'i1', role: 'principal', organizationId: '' },
  }) as Profile;

const managerWithOrg = (): Profile =>
  ({
    ...managerNoOrg(),
    identities: [
      {
        id: 'i1',
        role: 'principal',
        organizationId: ORG_UUID,
        organizationName: '自有店',
        isDefault: true,
      },
    ],
    currentContext: { identityId: 'i1', role: 'principal', organizationId: ORG_UUID },
  }) as Profile;

describe('store-entry-onboarding', () => {
  beforeEach(() => {
    invalidateStoreEntryLatestCache();
  });

  it('resolveStoreEntrySubmitError：PENDING_EXISTS → redirect_pending', () => {
    const action = resolveStoreEntrySubmitError(
      new ApiError(409, 'PENDING_EXISTS:您已有待审核的门店入驻申请，请勿重复提交'),
    );
    expect(action).toEqual({
      kind: 'redirect_pending',
      message: '您已有待审核的门店入驻申请，请勿重复提交',
    });
  });

  it('resolveStoreEntrySubmitError：未知错误 → toast fallback', () => {
    expect(resolveStoreEntrySubmitError(new Error('network'))).toEqual({
      kind: 'toast',
      message: 'network',
    });
    expect(resolveStoreEntrySubmitError(new Error('x'.repeat(60)))).toEqual({
      kind: 'toast',
      message: '提交失败，请稍后重试',
    });
  });

  it('resolveStoreEntryFunnelDestination：无申请 → identity-select', () => {
    expect(resolveStoreEntryFunnelDestination({ profile: managerNoOrg(), latest: null })).toBe(
      'identity-select',
    );
  });

  it('resolveStoreEntryFunnelDestination：PENDING → pending', () => {
    expect(
      resolveStoreEntryFunnelDestination({
        profile: managerNoOrg(),
        latest: { application: { id: 'a1', status: 'PENDING' } },
      }),
    ).toBe('pending');
  });

  it('resolveStoreEntryFunnelDestination：APPROVED 无 org JWT → pending', () => {
    expect(
      resolveStoreEntryFunnelDestination({
        profile: managerNoOrg(),
        latest: { application: { id: 'a1', status: 'APPROVED' } },
      }),
    ).toBe('pending');
  });

  it('resolveStoreEntryFunnelDestination：APPROVED 有 org → home', () => {
    expect(
      resolveStoreEntryFunnelDestination({
        profile: managerWithOrg(),
        latest: { application: { id: 'a1', status: 'APPROVED' } },
      }),
    ).toBe('home');
  });

  it('resolveStoreEntryFormGate：PENDING 已登录 → redirect_pending', () => {
    expect(
      resolveStoreEntryFormGate({
        isLoggedIn: true,
        latest: { application: { id: 'a1', status: 'PENDING' } },
        loading: false,
      }),
    ).toEqual({ kind: 'redirect_pending', status: 'pending' });
  });

  it('resolveStoreEntryFormGate：REJECTED → show_form', () => {
    expect(
      resolveStoreEntryFormGate({
        isLoggedIn: true,
        latest: { application: { id: 'a1', status: 'REJECTED' } },
        loading: false,
      }),
    ).toEqual({ kind: 'show_form' });
  });

  it('shouldRedirectToStoreEntryPending：PENDING 管理员 → true', () => {
    expect(
      shouldRedirectToStoreEntryPending({
        profile: managerNoOrg(),
        latest: { application: { id: 'a1', status: 'PENDING' } },
      }),
    ).toBe(true);
  });

  it('hasOwnOrganizationContext 识别 UUID', () => {
    expect(hasOwnOrganizationContext(managerWithOrg())).toBe(true);
    expect(hasOwnOrganizationContext(managerNoOrg())).toBe(false);
  });

  it('getLatestApplicationStatus 兼容大小写', () => {
    expect(getLatestApplicationStatus({ application: { id: 'a', status: 'PENDING' } })).toBe(
      'pending',
    );
  });

  it('latest 缓存 TTL 内可读', () => {
    writeStoreEntryLatestCache({ application: { id: 'a1', status: 'PENDING' } });
    expect(readStoreEntryLatestCache()?.application?.id).toBe('a1');
    invalidateStoreEntryLatestCache();
    expect(readStoreEntryLatestCache()).toBeUndefined();
  });

  it('maybeRedirectStoreEntryPendingHub：PENDING 时 redirect', async () => {
    const { storeEntryService } = await import('@/services/store-entry');
    vi.mocked(storeEntryService.queryLatestSafe).mockResolvedValueOnce({
      application: { id: 'a1', status: 'PENDING' },
    });
    const redirectTo = vi.fn();
    (Taro as unknown as { redirectTo: typeof redirectTo }).redirectTo = redirectTo;

    const { maybeRedirectStoreEntryPendingHub } = await import('./store-entry-onboarding');
    const redirected = await maybeRedirectStoreEntryPendingHub(managerNoOrg());
    expect(redirected).toBe(true);
    expect(redirectTo).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/package-settings/pages/store-entry/pending/index' }),
    );
  });

  it('fetchStoreEntryLatestCached：命中缓存不再打 API', async () => {
    invalidateStoreEntryLatestCache();
    writeStoreEntryLatestCache({ application: { id: 'cached', status: 'PENDING' } });
    const { storeEntryService } = await import('@/services/store-entry');
    vi.mocked(storeEntryService.queryLatestSafe).mockClear();
    const { fetchStoreEntryLatestCached } = await import('./store-entry-onboarding');
    const result = await fetchStoreEntryLatestCached();
    expect(result?.application?.id).toBe('cached');
    expect(vi.mocked(storeEntryService.queryLatestSafe)).not.toHaveBeenCalled();
  });

  it('maybeRedirectStoreEntryPendingHub：非管理员不 redirect', async () => {
    const { maybeRedirectStoreEntryPendingHub } = await import('./store-entry-onboarding');
    const redirected = await maybeRedirectStoreEntryPendingHub({
      ...managerNoOrg(),
      currentContext: { identityId: 'i1', role: 'parent', organizationId: '' },
    } as Profile);
    expect(redirected).toBe(false);
  });

  it('maybeRedirectStoreEntryPendingHub：查询失败返回 false', async () => {
    invalidateStoreEntryLatestCache();
    const { storeEntryService } = await import('@/services/store-entry');
    vi.mocked(storeEntryService.queryLatestSafe).mockRejectedValueOnce(new Error('network'));
    const { maybeRedirectStoreEntryPendingHub } = await import('./store-entry-onboarding');
    await expect(maybeRedirectStoreEntryPendingHub(managerNoOrg())).resolves.toBe(false);
  });

  it('resolveStoreEntryFunnelDestination：REJECTED → pending', () => {
    expect(
      resolveStoreEntryFunnelDestination({
        profile: managerNoOrg(),
        latest: { application: { id: 'a1', status: 'REJECTED' } },
      }),
    ).toBe('pending');
  });

  it('shouldRunStoreEntryColdStartCheck 识别 home / identity-select', async () => {
    const { shouldRunStoreEntryColdStartCheck } = await import('./store-entry-onboarding');
    expect(shouldRunStoreEntryColdStartCheck('/pages/home/index')).toBe(true);
    expect(shouldRunStoreEntryColdStartCheck('/package-auth/pages/identity-select/index')).toBe(
      true,
    );
    expect(shouldRunStoreEntryColdStartCheck('/package-settings/pages/store-entry/index')).toBe(
      false,
    );
  });
});
