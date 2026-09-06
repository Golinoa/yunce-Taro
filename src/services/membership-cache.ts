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
import { TTL } from '@/utils/data-freshness';

const QUOTA_STORAGE_KEY = 'yunce:membership:quota-v1';
const SKU_STORAGE_KEY = 'yunce:membership:sku-v1';

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

let quotaMem: CachedBox<OrganizationQuotaUsage> | null = null;
let skuMem: CachedBox<MembershipSkuCatalogCache> | null = null;
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
  } catch {
    /* 存储满/禁用时忽略，内存仍可用 */
  }
}

/** 同步读配额（首帧用，可过期） */
export function peekMembershipQuotaCache(): OrganizationQuotaUsage | null {
  if (quotaMem?.data) return quotaMem.data;
  const box = readStorage<OrganizationQuotaUsage>(QUOTA_STORAGE_KEY);
  if (box?.data) {
    quotaMem = box;
    return box.data;
  }
  return null;
}

export function peekMembershipSkuCache(): MembershipSkuCatalogCache | null {
  if (skuMem?.data) return skuMem.data;
  const box = readStorage<MembershipSkuCatalogCache>(SKU_STORAGE_KEY);
  if (box?.data) {
    skuMem = box;
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

export function isMembershipQuotaCacheFresh(now = Date.now()): boolean {
  const at = quotaMem?.at ?? readStorage<OrganizationQuotaUsage>(QUOTA_STORAGE_KEY)?.at;
  return typeof at === 'number' && now - at < TTL.quota;
}

export function writeMembershipQuotaCache(data: OrganizationQuotaUsage): void {
  const box = { at: Date.now(), data };
  quotaMem = box;
  writeStorage(QUOTA_STORAGE_KEY, box);
}

export function writeMembershipSkuCache(data: MembershipSkuCatalogCache): void {
  const box = { at: Date.now(), data };
  skuMem = box;
  writeStorage(SKU_STORAGE_KEY, box);
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
  try {
    Taro.removeStorageSync(QUOTA_STORAGE_KEY);
    Taro.removeStorageSync(SKU_STORAGE_KEY);
  } catch {
    /* ignore */
  }
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
