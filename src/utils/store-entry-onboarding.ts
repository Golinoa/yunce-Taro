/**
 * 门店入驻漏斗：queryLatest 真源、409 幂等、latest 轻量缓存（TTL 60s）
 *
 * 产品：已申请未批 → pending 中间页；禁止仅用 JWT/demo organizationId 判断。
 */
import Taro from '@tarojs/taro';
import { storeEntryService } from '@/services/store-entry';
import type { Profile } from '@/types/profile';
import type { StoreEntryLatestResult } from '@/types/store-entry';
import { ApiError } from '@/utils/request';
import {
  isStoreEntryApproved,
  isStoreEntryPending,
  isStoreEntryRejected,
  normalizeStoreEntryStatus,
  type StoreEntryUiStatus,
} from '@/utils/store-entry-status';
import { isUuidOrganizationId } from '@/utils/tenant-id';

export const STORE_ENTRY_PENDING_PATH = '/package-settings/pages/store-entry/pending/index';
export const STORE_ENTRY_FORM_PATH = '/package-settings/pages/store-entry/index';

const LATEST_CACHE_KEY = 'yunce:store-entry-latest-cache';
const LATEST_CACHE_TTL_MS = 60_000;

export type StoreEntryAuthFunnelDestination = 'pending' | 'identity-select' | 'home';

export type StoreEntryFormGate =
  | { kind: 'loading' }
  | { kind: 'show_form' }
  | { kind: 'redirect_pending'; status: StoreEntryUiStatus };

export type StoreEntrySubmitErrorAction =
  | { kind: 'redirect_pending'; message: string }
  | { kind: 'toast'; message: string };

type LatestCachePayload = {
  cachedAt: number;
  result: StoreEntryLatestResult | null;
};

export function isStoreEntryManagerRole(profile: Profile | null | undefined): boolean {
  const role = profile?.currentContext?.role;
  return role === 'principal' || role === 'admin';
}

/** 是否已有自有 ACTIVE 机构上下文（非 demo 误判：以 JWT 真实 orgId 为准） */
export function hasOwnOrganizationContext(profile: Profile | null | undefined): boolean {
  if (!profile) return false;
  return isUuidOrganizationId(profile.currentContext?.organizationId);
}

export function getLatestApplicationStatus(
  latest: StoreEntryLatestResult | null | undefined,
): StoreEntryUiStatus | null {
  const raw = latest?.application?.status;
  if (!raw) return null;
  return normalizeStoreEntryStatus(raw);
}

export function resolveStoreEntryFunnelDestination(input: {
  profile: Profile | null | undefined;
  latest: StoreEntryLatestResult | null;
}): StoreEntryAuthFunnelDestination {
  const { profile, latest } = input;
  if (!profile || !isStoreEntryManagerRole(profile)) {
    return 'identity-select';
  }

  const status = getLatestApplicationStatus(latest);
  if (!status) {
    return 'identity-select';
  }

  if (isStoreEntryPending(status)) {
    return 'pending';
  }

  if (isStoreEntryRejected(status)) {
    return 'pending';
  }

  if (isStoreEntryApproved(status)) {
    return hasOwnOrganizationContext(profile) ? 'home' : 'pending';
  }

  return 'identity-select';
}

export function resolveStoreEntryFormGate(input: {
  isLoggedIn: boolean;
  latest: StoreEntryLatestResult | null;
  loading: boolean;
}): StoreEntryFormGate {
  if (input.loading) {
    return { kind: 'loading' };
  }
  if (!input.isLoggedIn) {
    return { kind: 'show_form' };
  }

  const status = getLatestApplicationStatus(input.latest);
  if (!status) {
    return { kind: 'show_form' };
  }
  if (isStoreEntryPending(status) || isStoreEntryApproved(status)) {
    return { kind: 'redirect_pending', status };
  }
  return { kind: 'show_form' };
}

export function resolveStoreEntrySubmitError(err: unknown): StoreEntrySubmitErrorAction {
  const raw = err instanceof ApiError ? err.message : err instanceof Error ? err.message : '';
  if (raw.includes('PENDING_EXISTS')) {
    const friendly =
      raw.replace(/^PENDING_EXISTS:\s*/, '').trim() || '您已有待审核的门店入驻申请，请勿重复提交';
    return { kind: 'redirect_pending', message: friendly };
  }
  if (raw && raw.length > 0 && raw.length <= 48) {
    return { kind: 'toast', message: raw };
  }
  return { kind: 'toast', message: '提交失败，请稍后重试' };
}

export function readStoreEntryLatestCache(): StoreEntryLatestResult | null | undefined {
  try {
    const raw = Taro.getStorageSync(LATEST_CACHE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as LatestCachePayload;
    if (!parsed || typeof parsed.cachedAt !== 'number') return undefined;
    if (Date.now() - parsed.cachedAt > LATEST_CACHE_TTL_MS) return undefined;
    return parsed.result ?? null;
  } catch {
    return undefined;
  }
}

export function writeStoreEntryLatestCache(result: StoreEntryLatestResult | null): void {
  try {
    const payload: LatestCachePayload = { cachedAt: Date.now(), result };
    Taro.setStorageSync(LATEST_CACHE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export function invalidateStoreEntryLatestCache(): void {
  try {
    Taro.removeStorageSync(LATEST_CACHE_KEY);
  } catch {
    /* ignore */
  }
}

export function shouldRunStoreEntryColdStartCheck(path: string): boolean {
  const norm = String(path || '')
    .replace(/^\//, '')
    .toLowerCase();
  if (!norm) return false;
  return (
    norm.includes('pages/home/index') ||
    norm.includes('package-auth/pages/identity-select/index') ||
    norm.includes('pages/profile/index')
  );
}

export function shouldRedirectToStoreEntryPending(input: {
  profile: Profile | null | undefined;
  latest: StoreEntryLatestResult | null;
}): boolean {
  const status = getLatestApplicationStatus(input.latest);
  if (!input.profile || !isStoreEntryManagerRole(input.profile)) {
    return false;
  }
  if (isStoreEntryPending(status) || isStoreEntryRejected(status)) {
    return true;
  }
  if (isStoreEntryApproved(status) && !hasOwnOrganizationContext(input.profile)) {
    return true;
  }
  return false;
}

export async function fetchStoreEntryLatestCached(): Promise<StoreEntryLatestResult | null> {
  const cached = readStoreEntryLatestCache();
  if (cached !== undefined) {
    return cached;
  }
  const result = await storeEntryService.queryLatestSafe();
  writeStoreEntryLatestCache(result);
  return result;
}

/** 登录/冷启动：有待审核或待进机构时 redirect pending 页 */
export async function maybeRedirectStoreEntryPendingHub(
  profile: Profile | null | undefined,
): Promise<boolean> {
  if (!profile || !isStoreEntryManagerRole(profile)) {
    return false;
  }
  try {
    const latest = await fetchStoreEntryLatestCached();
    if (!shouldRedirectToStoreEntryPending({ profile, latest })) {
      return false;
    }
    await Taro.redirectTo({ url: STORE_ENTRY_PENDING_PATH });
    return true;
  } catch {
    return false;
  }
}
