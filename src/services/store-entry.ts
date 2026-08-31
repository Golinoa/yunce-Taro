/**
 * Service 层 — 门店入驻申请 API
 *
 * 契约（baseURL 已含 /api/app/v1）：
 * - POST /store-entry/applications        提交申请（替代旧 POST /feedback workaround）
 * - GET  /store-entry/applications/latest 查询最新申请状态
 * - POST /store-entry/applications/re-submit 被拒绝后重新提交
 */
import Taro from '@tarojs/taro';
import type {
  StoreEntryFormData,
  StoreEntryLatestResult,
  StoreEntryResult,
} from '@/types/store-entry';
import { get, post } from '@/utils/request';

/** 门店入驻表单草稿 key：提交后保存，pending 页被拒时可原样重新提交 */
export const STORE_ENTRY_DRAFT_KEY = 'yunce:store-entry-draft';

/** 保存门店入驻表单草稿（提交成功后写入，供 pending 页 re-submit） */
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

export const storeEntryService = {
  /** 提交门店入驻申请（真实模式不再 POST /feedback） */
  submit: async (data: StoreEntryFormData): Promise<StoreEntryResult> => {
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
    });
  },

  /** 查询最新申请状态（pending / approved / rejected + 拒绝原因） */
  queryLatest: async (): Promise<StoreEntryLatestResult> => {
    return get<StoreEntryLatestResult>('/store-entry/applications/latest');
  },

  /** 被拒绝后重新提交（复用原机构，生成新申请单） */
  resubmit: async (data: StoreEntryFormData): Promise<StoreEntryResult> => {
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
    });
  },
};
