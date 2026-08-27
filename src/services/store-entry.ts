/**
 * Service 层 — 门店入驻申请 API
 */
import { mockSubmitStoreEntry } from '@/data/store-entry';
import type { StoreEntryFormData, StoreEntryResult } from '@/types/store-entry';
import { post } from '@/utils/request';

const USE_MOCK =
  typeof process !== 'undefined' && typeof process.env !== 'undefined'
    ? process.env.VITE_USE_MOCK !== 'false'
    : true;

export const storeEntryService = {
  submit: async (data: StoreEntryFormData): Promise<StoreEntryResult> => {
    if (USE_MOCK) return mockSubmitStoreEntry(data);

    await post('/feedback', {
      type: 'OTHER',
      content: [
        `门店入驻申请：${data.name}`,
        `类型：${data.type}`,
        `地区：${data.region.join(' ')}`,
        data.locationName ? `定位：${data.locationName}` : '',
        `地址：${data.address}`,
        `联系人：${data.contactName}`,
        `电话：${data.contactPhone}`,
      ]
        .filter(Boolean)
        .join('\n'),
      images: [],
      contact: data.contactPhone,
    });

    return {
      id: `store-entry-${Date.now()}`,
      status: 'pending',
    };
  },
};
