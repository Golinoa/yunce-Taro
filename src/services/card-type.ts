/**
 * 卡种（会员卡模板）Service 层
 *
 * 定义接口契约，当前由 mock 实现，联调时替换为真实 request 调用。
 */

import {
  mockCreateCardType,
  mockGetCardTypeById,
  mockGetCardTypes,
  mockRemoveCardType,
  mockToggleCardTypeStatus,
  mockUpdateCardType,
} from '@/data/card-type';
import type { CardType, CardTypeFormData, CardTypeStatus } from '@/types/card-type';

const USE_MOCK =
  typeof process !== 'undefined' && typeof process.env !== 'undefined'
    ? process.env.VITE_USE_MOCK !== 'false'
    : true;

export const cardTypeService = {
  /** 获取卡种列表 */
  getList: async (): Promise<CardType[]> => {
    if (!USE_MOCK) {
      // TODO: 联调时替换为真实 API
      // return await get<CardType[]>('/card-types');
    }
    return mockGetCardTypes();
  },

  /** 获取卡种详情 */
  getById: async (id: string): Promise<CardType | null> => {
    if (!USE_MOCK) {
      // TODO: 联调时替换为真实 API
      // return await get<CardType>(`/card-types/${id}`);
    }
    return mockGetCardTypeById(id);
  },

  /** 创建卡种 */
  create: async (data: CardTypeFormData): Promise<CardType> => {
    if (!USE_MOCK) {
      // TODO: 联调时替换为真实 API
      // return await post<CardType>('/card-types', data);
    }
    return mockCreateCardType(data);
  },

  /** 更新卡种 */
  update: async (id: string, data: Partial<CardTypeFormData>): Promise<CardType> => {
    if (!USE_MOCK) {
      // TODO: 联调时替换为真实 API
      // return await put<CardType>(`/card-types/${id}`, data);
    }
    return mockUpdateCardType(id, data);
  },

  /** 切换卡种状态（在售/停售） */
  toggleStatus: async (id: string, status: CardTypeStatus): Promise<CardType> => {
    if (!USE_MOCK) {
      // TODO: 联调时替换为真实 API
      // return await patch<CardType>(`/card-types/${id}/status`, { status });
    }
    return mockToggleCardTypeStatus(id, status);
  },

  /** 删除卡种 */
  remove: async (id: string): Promise<void> => {
    if (!USE_MOCK) {
      // TODO: 联调时替换为真实 API
      // await del(`/card-types/${id}`);
      // return;
    }
    return mockRemoveCardType(id);
  },
};
