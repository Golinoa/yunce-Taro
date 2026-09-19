/**
 * 会员页秒开缓存：配额卡面 + SKU 货架
 * - 内存优先，落盘便于冷启动
 * - 个人中心预取后，进会员页首帧即可画卡
 */
import Taro from '@tarojs/taro';
import { organizationService, type OrganizationQuotaUsage } from '@/services/organization';
import {
  invalidateMembershipSkuCache,
  paymentService,
  seedMembershipSkuCache,
  type MembershipCatalogPlan,
  type MembershipSku,
} from '@/services/payment';
import { getCacheScope } from '@/utils/cache-scope';
import { TTL } from '@/utils/data-freshness';
import { logError } from '@/utils/logger';
import { serverNow } from '@/utils/server-clock';

const QUOTA_KEY_PREFIX = 'yunce:membership:quota-v1';
const SKU_KEY_PREFIX = 'yunce:membership:sku-v1';

/**
 * 租户维度后缀（计划 §2 G1 / §8 Q2）。
 *
 * 会员配额与 SKU 是**机构级**数据，但缓存键必须按「机构 + 用户 + 角色」隔离：
 * 同一微信用户在家长 ↔ 教师之间切换、或同一设备换号登录时，首帧不得读到上一身份的数据。
 * 键内隔离后，即使某条切换路径漏了 `resetDomainCaches`，最坏也只是 miss 回源、不会串数据
 * （"宁 miss 不串"，与 `utils/cache-scope.ts` 同口径）。
 *
 * 不含 campusId —— 配额与 SKU 与校区无关，带上只会白丢命中率。
 */
function scopeSuffix(): string {
  const s = getCacheScope();
  return `${s.orgId ?? '-'}:${s.userId ?? '-'}:${s.role ?? '-'}`;
}

const quotaKey = (): string => `${QUOTA_KEY_PREFIX}:${scopeSuffix()}`;
const skuKey = (): string => `${SKU_KEY_PREFIX}:${scopeSuffix()}`;

export type MembershipSkuCatalogCache = {
  enabled: boolean;
  showTestSkus?: boolean;
  plans?: MembershipCatalogPlan[];
  skus: MembershipSku[];
};

type CachedBox<T> = {
  at: number;
  data: T;
};

/** 内存盒子额外记住写入时的作用域：作用域变了即视为未命中（防漏清时串数据） */
type ScopedMemBox<T> = CachedBox<T> & { scope: string };

let quotaMem: ScopedMemBox<OrganizationQuotaUsage> | null = null;
let skuMem: ScopedMemBox<MembershipSkuCatalogCache> | null = null;
let prefetchInflight: Promise<void> | null = null;

function readStorage<T>(key: string): CachedBox<T> | null {
  try {
    const raw = Taro.getStorageSync(key);
    if (!raw || typeof raw !== 'object') return null;
    const box = raw as CachedBox<T>;
    if (!box.at || box.data == null) return null;
    return box;
  } catch {
    return null;
  }
}

function writeStorage<T>(key: string, box: CachedBox<T>): void {
  try {
    Taro.setStorageSync(key, box);
  } catch (err) {
    // G5（缓存层计划 §2）：存储满/禁用不再静默 —— 内存缓存仍可用，行为不变，仅补可观测
    logError('membershipCache.writeStorage', err);
  }
}

/**
 * 按前缀清 storage。
 * 键已含租户维度 → 无法只删"某一个 key"，切换身份时必须清掉**所有历史作用域**的键。
 */
function clearByPrefix(prefix: string): void {
  try {
    const info = Taro.getStorageInfoSync();
    (info?.keys ?? []).forEach((key) => {
      if (typeof key === 'string' && key.startsWith(prefix)) {
        Taro.removeStorageSync(key);
      }
    });
  } catch (err) {
    logError('membershipCache.clearByPrefix', err);
  }
}

/**
 * 同步读配额（首帧展示用，**不作任何决策依据**）。
 * 权威判定以后端为准：超配额时后端返回 422 `QUOTA_EXCEEDED`，前端仅据此引导升级。
 * 作用域不匹配即视为未命中（换身份后即使漏清也不会串数据）。
 */
export function peekMembershipQuotaCache(): OrganizationQuotaUsage | null {
  const suffix = scopeSuffix();
  if (quotaMem?.data && quotaMem.scope === suffix) return quotaMem.data;
  const box = readStorage<OrganizationQuotaUsage>(quotaKey());
  if (box?.data) {
    quotaMem = { ...box, scope: suffix };
    return box.data;
  }
  return null;
}

export function peekMembershipSkuCache(): MembershipSkuCatalogCache | null {
  const suffix = scopeSuffix();
  if (skuMem?.data && skuMem.scope === suffix) return skuMem.data;
  const box = readStorage<MembershipSkuCatalogCache>(skuKey());
  if (box?.data) {
    skuMem = { ...box, scope: suffix };
    seedMembershipSkuCache(
      {
        enabled: box.data.enabled,
        showTestSkus: box.data.showTestSkus,
        plans: box.data.plans,
        skus: box.data.skus,
      },
      box.at,
    );
    return box.data;
  }
  return null;
}

export function isMembershipQuotaCacheFresh(now = serverNow()): boolean {
  const suffix = scopeSuffix();
  const memAt = quotaMem?.scope === suffix ? quotaMem.at : undefined;
  const at = memAt ?? readStorage<OrganizationQuotaUsage>(quotaKey())?.at;
  return typeof at === 'number' && now - at < TTL.quota;
}

export function writeMembershipQuotaCache(data: OrganizationQuotaUsage): void {
  const box: CachedBox<OrganizationQuotaUsage> = { at: serverNow(), data };
  quotaMem = { ...box, scope: scopeSuffix() };
  writeStorage(quotaKey(), box);
}

export function writeMembershipSkuCache(data: MembershipSkuCatalogCache): void {
  const box: CachedBox<MembershipSkuCatalogCache> = { at: serverNow(), data };
  skuMem = { ...box, scope: scopeSuffix() };
  writeStorage(skuKey(), box);
  seedMembershipSkuCache(
    {
      enabled: data.enabled,
      showTestSkus: data.showTestSkus,
      plans: data.plans,
      skus: data.skus,
    },
    box.at,
  );
}

export function invalidateMembershipBootstrapCache(): void {
  quotaMem = null;
  skuMem = null;
  prefetchInflight = null;
  invalidateMembershipSkuCache();
  // 键含租户维度 → 不能只删当前 scope 那一个：按前缀清掉所有历史作用域的键
  clearByPrefix(QUOTA_KEY_PREFIX);
  clearByPrefix(SKU_KEY_PREFIX);
}

/**
 * 预热会员页：个人中心展示时 / 点击「立即开通」时调用。
 * 不阻塞导航；已有新鲜缓存则跳过。
 */
export function prefetchMembershipBootstrap(options?: { force?: boolean }): Promise<void> {
  const force = Boolean(options?.force);
  if (!force && isMembershipQuotaCacheFresh() && peekMembershipSkuCache()) {
    return Promise.resolve();
  }
  if (prefetchInflight && !force) return prefetchInflight;

  prefetchInflight = (async () => {
    try {
      const [quota, catalog] = await Promise.all([
        organizationService.getQuotaUsage().catch(() => null),
        paymentService.listSkus(force).catch(() => null),
      ]);
      if (quota) writeMembershipQuotaCache(quota);
      if (catalog && catalog.skus) {
        writeMembershipSkuCache({
          enabled: catalog.enabled,
          showTestSkus: catalog.showTestSkus,
          plans: catalog.plans,
          skus: catalog.skus,
        });
      }
    } finally {
      prefetchInflight = null;
    }
  })();

  return prefetchInflight;
}
