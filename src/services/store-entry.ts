/**
 * Service 层 — 门店入驻申请 API
 *
 * 契约（baseURL 已含 /api/app/v1）：
 * - POST /store-entry/applications        提交申请
 * - GET  /store-entry/applications/latest 查询最新申请状态
 * - POST /store-entry/applications/re-submit 被拒绝后重新提交
 *
 * 产品：申请人获批后 = 机构管理员（OrganizationUser.OWNER）；UI 称「管理员」，
 * 库 Profile.role 仍为 PRINCIPAL。同机构可有多校区（批准时仅建默认主校区）。
 */
import Taro from '@tarojs/taro';
import type {
  StoreEntryFormData,
  StoreEntryLatestResult,
  StoreEntryResult,
} from '@/types/store-entry';
import { getPendingStoreReferralCode } from '@/utils/invite-store-referral-link';
import { get, post, ApiError } from '@/utils/request';

/** 门店入驻表单草稿 key：未登录提交前 / 驳回重提均可恢复 */
export const STORE_ENTRY_DRAFT_KEY = 'yunce:store-entry-draft';

/** 保存门店入驻表单草稿（提交成功或登录前回跳前写入） */
export function saveStoreEntryDraft(data: StoreEntryFormData): void {
  try {
    Taro.setStorageSync(STORE_ENTRY_DRAFT_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

/** 读取门店入驻表单草稿 */
export function readStoreEntryDraft(): StoreEntryFormData | null {
  try {
    const raw = Taro.getStorageSync(STORE_ENTRY_DRAFT_KEY);
    return raw ? (JSON.parse(raw) as StoreEntryFormData) : null;
  } catch {
    return null;
  }
}

/** 清空草稿 */
export function clearStoreEntryDraft(): void {
  try {
    Taro.removeStorageSync(STORE_ENTRY_DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

export const storeEntryService = {
  /** 提交门店入驻申请 */
  submit: async (data: StoreEntryFormData): Promise<StoreEntryResult> => {
    const referralCode = getPendingStoreReferralCode() || undefined;
    return post<StoreEntryResult>('/store-entry/applications', {
      name: data.name,
      type: data.type,
      region: data.region,
      address: data.address,
      locationName: data.locationName,
      latitude: data.latitude,
      longitude: data.longitude,
      contactName: data.contactName,
      contactPhone: data.contactPhone,
      referralCode,
    });
  },

  /** 查询最新申请状态（PENDING / APPROVED / REJECTED + 拒绝原因） */
  queryLatest: async (): Promise<StoreEntryLatestResult> => {
    return get<StoreEntryLatestResult>('/store-entry/applications/latest');
  },

  /** 无申请记录时返回 null（404），其它错误继续抛出 */
  queryLatestSafe: async (): Promise<StoreEntryLatestResult | null> => {
    try {
      return await get<StoreEntryLatestResult>('/store-entry/applications/latest');
    } catch (err) {
      if (err instanceof ApiError && (err.code === 404 || err.message.includes('暂无入驻申请'))) {
        return null;
      }
      throw err;
    }
  },

  /** 被拒绝后重新提交（复用原机构，原地 UPDATE 申请单） */
  resubmit: async (data: StoreEntryFormData): Promise<StoreEntryResult> => {
    const referralCode = getPendingStoreReferralCode() || undefined;
    return post<StoreEntryResult>('/store-entry/applications/re-submit', {
      name: data.name,
      type: data.type,
      region: data.region,
      address: data.address,
      locationName: data.locationName,
      latitude: data.latitude,
      longitude: data.longitude,
      contactName: data.contactName,
      contactPhone: data.contactPhone,
      referralCode,
    });
  },
};
