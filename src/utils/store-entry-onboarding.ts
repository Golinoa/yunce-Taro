/**
 * 门店入驻漏斗：queryLatest 真源、409 幂等、latest 轻量缓存（按账号隔离，TTL 60s）
 *
 * 产品：已申请未批 → pending 中间页；禁止仅用 JWT/demo organizationId 判断。
 * 例外：已有可用机构上下文（含「先体验演示门店」）时允许进首页，勿再踢回 pending。
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

type LatestCacheEntry = {
  cachedAt: number;
  result: StoreEntryLatestResult | null;
};

/** 单 key 多账号：避免全局串缓存，也便于一次清空 */
type LatestCacheStore = Record<string, LatestCacheEntry>;

const UNSCOPED = '__unscoped__';

function readCacheStore(): LatestCacheStore {
  try {
    const raw = Taro.getStorageSync(LATEST_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as LatestCacheStore | LatestCacheEntry;
    // 兼容旧格式 { cachedAt, result }
    if (parsed && typeof parsed === 'object' && 'cachedAt' in parsed && 'result' in parsed) {
      return { [UNSCOPED]: parsed as LatestCacheEntry };
    }
    return (parsed as LatestCacheStore) || {};
  } catch {
    return {};
  }
}

function writeCacheStore(store: LatestCacheStore): void {
  try {
    Taro.setStorageSync(LATEST_CACHE_KEY, JSON.stringify(store));
  } catch {
    /* ignore */
  }
}

function scopeKey(scopeId?: string | null): string {
  const id = String(scopeId || '').trim();
  return id || UNSCOPED;
}

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

  // 已有机构上下文（含演示门店）：进首页，避免与「先体验演示」打架被踢回 pending
  if (hasOwnOrganizationContext(profile)) {
    return 'home';
  }

  if (isStoreEntryPending(status) || isStoreEntryRejected(status)) {
    return 'pending';
  }

  if (isStoreEntryApproved(status)) {
    return 'pending';
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

export function readStoreEntryLatestCache(
  scopeId?: string | null,
): StoreEntryLatestResult | null | undefined {
  try {
    const store = readCacheStore();
    const entry = store[scopeKey(scopeId)];
    if (!entry || typeof entry.cachedAt !== 'number') return undefined;
    if (Date.now() - entry.cachedAt > LATEST_CACHE_TTL_MS) return undefined;
    return entry.result ?? null;
  } catch {
    return undefined;
  }
}

export function writeStoreEntryLatestCache(
  result: StoreEntryLatestResult | null,
  scopeId?: string | null,
): void {
  try {
    const store = readCacheStore();
    store[scopeKey(scopeId)] = { cachedAt: Date.now(), result };
    writeCacheStore(store);
  } catch {
    /* ignore */
  }
}

/** 清除入驻 latest 缓存；传 scopeId 只清该账号，否则全清（含旧格式） */
export function invalidateStoreEntryLatestCache(scopeId?: string | null): void {
  try {
    if (!scopeId) {
      Taro.removeStorageSync(LATEST_CACHE_KEY);
      return;
    }
    const store = readCacheStore();
    delete store[scopeKey(scopeId)];
    delete store[UNSCOPED];
    if (Object.keys(store).length === 0) {
      Taro.removeStorageSync(LATEST_CACHE_KEY);
    } else {
      writeCacheStore(store);
    }
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
  if (!input.profile || !isStoreEntryManagerRole(input.profile)) {
    return false;
  }
  // 已有机构（种子校长 / 演示门店 / 已批自有店）：禁止再踢回 pending，否则首页会秒退
  if (hasOwnOrganizationContext(input.profile)) {
    return false;
  }
  const status = getLatestApplicationStatus(input.latest);
  if (isStoreEntryPending(status) || isStoreEntryRejected(status)) {
    return true;
  }
  if (isStoreEntryApproved(status)) {
    return true;
  }
  return false;
}

export async function fetchStoreEntryLatestCached(
  scopeId?: string | null,
): Promise<StoreEntryLatestResult | null> {
  const cached = readStoreEntryLatestCache(scopeId);
  if (cached !== undefined) {
    return cached;
  }
  const result = await storeEntryService.queryLatestSafe();
  writeStoreEntryLatestCache(result, scopeId);
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
    const latest = await fetchStoreEntryLatestCached(profile.id);
    if (!shouldRedirectToStoreEntryPending({ profile, latest })) {
      return false;
    }
    await Taro.redirectTo({ url: STORE_ENTRY_PENDING_PATH });
    return true;
  } catch {
    return false;
  }
}
