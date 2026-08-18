/**
 * Service 层 — 门店入驻申请 API
 * 定义接口契约，当前由 mock 实现，联调时替换为 request 调用
 */
import { mockSubmitStoreEntry } from '@/data/store-entry';
import type { StoreEntryFormData, StoreEntryResult } from '@/types/store-entry';
// import { post } from '@/utils/request';

export const storeEntryService = {
  /** 提交门店入驻申请 */
  submit: (data: StoreEntryFormData): Promise<StoreEntryResult> => mockSubmitStoreEntry(data),
  // 联调时替换为:
  // submit: (data: StoreEntryFormData) => post<StoreEntryResult>('/api/store-entries', data),
};
