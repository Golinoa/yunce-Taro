/**
 * 最小可用持久化缓存基座（B1 · docs/diagnostics/2026-09-19-frontend-cache-layer-plan.md）
 *
 * 交付形态：**休眠**。所有读写在 `cacheEnabled=false`（默认）时空转：
 * get() 一律早返回 null、set()/invalidate() 直接跳过 —— prod 行为与直连完全一致，
 * 灰度开启后按下列护栏运行。
 *
 * 护栏对照（计划 §2）：
 * - G1 命名空间：`yunce:cc:v{schema}:{domain}:{orgId}:{userId}:{role}:{campusId}:{key}`
 *   （org/user/role/campus 四维隔离，防串租户与家长↔教师串缓存）
 * - G2 版本护栏：`clearIfVersionMismatch` 于 app 启动调用（app.tsx useLaunch），版本不符即整体清空
 * - G3 失效入口：切机构/切校区/登出/切换身份 由 `utils/reset-domain-caches.ts` 统一清空
 *   （auth.tsx switchIdentity/applyAuthPayload/signOut + campus.ts 已覆盖，复测确认）
 * - G4 并发去重：自建 inflight（membership-cache 的 prefetchInflight 为模块私有，不可复用）
 * - G5 容量上限：单 key ≤1MB、总量 ≤2MB；存储异常 logError 埋点，不静默
 * - G6 回退开关：constants/cache-flags.ts，关即直连，不靠 revert
 * - G7 时间源：前端响应暂无 serverTime，暂用 Date.now() 降级（待后端支持后替换）
 */
import Taro from '@tarojs/taro';
import { isCacheEnabledForOrg } from '@/constants/cache-flags';
import { logError } from '@/utils/logger';

/** 缓存结构版本：改动 Box 结构/键公式时 +1，旧数据自动清空（G2 兜底） */
export const CACHE_SCHEMA_VERSION = 1;
const KEY_PREFIX = `yunce:cc:v${CACHE_SCHEMA_VERSION}:`;
const VERSION_KEY = 'yunce:cc:app-version';

/** 单 key 上限 1MB（计划 G5） */
const MAX_VALUE_BYTES = 1024 * 1024;
/** 总量上限 2MB（计划 G5） */
const MAX_TOTAL_BYTES = 2 * 1024 * 1024;

export type CacheScope = {
  orgId?: string | null;
  userId?: string | null;
  /** 角色/端维度：teacher|parent|principal|admin（防家长↔教师双角色串缓存，G1） */
  role?: string | null;
  campusId?: string | null;
};

type CacheBox<T> = { at: number; data: T };

// ---- G4：inflight 去重（自建） ----
const inflight = new Map<string, Promise<unknown>>();

/** 同 key 并发任务去重：进行中则复用同一 Promise */
export function runWithInflight<T>(key: string, task: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;
  const p = task().finally(() => {
    inflight.delete(key);
  });
  inflight.set(key, p);
  return p;
}

// ---- 键公式（G1） ----
export function buildCacheKey(domain: string, key: string, scope: CacheScope): string {
  return `${KEY_PREFIX}${domain}:${scope.orgId ?? '-'}:${scope.userId ?? '-'}:${
    scope.role ?? '-'
  }:${scope.campusId ?? '-'}:${key}`;
}

/** 粗略 UTF-8 字节数（小程序无 Buffer；CJK 约 3 字节，估算偏保守） */
function estimateBytes(value: unknown): number {
  let serialized: string;
  try {
    serialized = JSON.stringify(value) ?? '';
  } catch {
    return MAX_VALUE_BYTES + 1; // 序列化失败视为超限，拒绝写入
  }
  let bytes = 0;
  for (let i = 0; i < serialized.length; i += 1) {
    const code = serialized.charCodeAt(i);
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : 3;
  }
  return bytes;
}

/** 当前缓存总占用（字节）。读不到时返回 0（宁可放行，单 key 上限仍兜底）。 */
function totalCacheBytes(): number {
  try {
    const info = Taro.getStorageInfoSync();
    if (info && typeof info.currentSize === 'number') {
      return info.currentSize * 1024;
    }
    return 0;
  } catch (err) {
    logError('cacheStore.totalBytes', err);
    return 0;
  }
}

/**
 * 读缓存（G6：开关关闭 → 一律早返回 null，绝不静默读缓存）。
 * 结构校验失败 / 过期（G7 降级时间源）→ 返回 null 并由调用方回源。
 */
export function getCache<T>(
  domain: string,
  key: string,
  scope: CacheScope,
  ttlMs: number,
): T | null {
  if (!isCacheEnabledForOrg(scope.orgId)) return null;
  if (ttlMs <= 0) return null;
  try {
    const raw = Taro.getStorageSync(buildCacheKey(domain, key, scope)) as CacheBox<T> | string;
    if (!raw || typeof raw !== 'object') return null;
    const box = raw as CacheBox<T>;
    if (box.data == null || typeof box.at !== 'number') return null;
    if (Date.now() - box.at >= ttlMs) return null;
    return box.data;
  } catch (err) {
    logError('cacheStore.get', err);
    return null;
  }
}

/**
 * 写缓存（G6：开关关闭 → 跳过；G5：单 key/总量超限拒绝并埋点，异常 logError 不静默）。
 */
export function setCache<T>(domain: string, key: string, data: T, scope: CacheScope): void {
  if (!isCacheEnabledForOrg(scope.orgId)) return;
  try {
    const box: CacheBox<T> = { at: Date.now(), data };
    const bytes = estimateBytes(box);
    if (bytes > MAX_VALUE_BYTES) {
      logError('cacheStore.set.oversize', new Error(`key too large: ${domain}/${key}`));
      return;
    }
    if (totalCacheBytes() + bytes > MAX_TOTAL_BYTES) {
      logError('cacheStore.set.capacity', new Error(`cache capacity exceeded: ${domain}/${key}`));
      return;
    }
    Taro.setStorageSync(buildCacheKey(domain, key, scope), box);
  } catch (err) {
    logError('cacheStore.set', err);
  }
}

/**
 * 失效：指定 key 或整个 domain（G3；scope 维度不一致的旧 key 由 clearAllCache/版本清空兜底）。
 */
export function invalidateCache(domain: string, scope: CacheScope, key?: string): void {
  if (!isCacheEnabledForOrg(scope.orgId)) return;
  try {
    const info = Taro.getStorageInfoSync();
    const keys = (info && info.keys) || [];
    const domainPrefix = `${KEY_PREFIX}${domain}:`;
    keys.forEach((k) => {
      if (key) {
        if (k === buildCacheKey(domain, key, scope)) Taro.removeStorageSync(k);
      } else if (k.startsWith(domainPrefix)) {
        Taro.removeStorageSync(k);
      }
    });
  } catch (err) {
    logError('cacheStore.invalidate', err);
  }
}

/** 清空本应用全部持久缓存（G3「all」/ 版本清空共用） */
export function clearAllCache(): void {
  try {
    const info = Taro.getStorageInfoSync();
    const keys = (info && info.keys) || [];
    keys.forEach((k) => {
      if (typeof k === 'string' && k.startsWith(KEY_PREFIX)) {
        Taro.removeStorageSync(k);
      }
    });
  } catch (err) {
    logError('cacheStore.clearAll', err);
  }
}

/**
 * G2：版本护栏。app 启动时传入当前 APP_VERSION：
 * 与上次记录不一致（升级/降级/换包）→ 整体清空持久缓存，避免旧结构污染新版本。
 */
export function clearIfVersionMismatch(currentVersion: string): void {
  try {
    const stored = Taro.getStorageSync(VERSION_KEY);
    if (typeof stored === 'string' && stored !== currentVersion) {
      clearAllCache();
    }
    Taro.setStorageSync(VERSION_KEY, currentVersion);
  } catch (err) {
    logError('cacheStore.version', err);
  }
}
