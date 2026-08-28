/**
 * 卡种（会员卡模板）Service 层
 *
 * 定义接口契约，当前由 mock 实现，联调时替换为真实 request 调用。
 */

import type { CardType, CardTypeFormData, CardTypeStatus } from '@/types/card-type';
import { loadCardTypeMock } from '@/utils/mock-loaders';
import { isUseMock } from '@/utils/build-env';

export const cardTypeService = {
  /** 获取卡种列表 */
  getList: async (): Promise<CardType[]> => {
        if (!isUseMock()) {
      return [];
    }
    const { mockGetCardTypes } = await loadCardTypeMock();
    return mockGetCardTypes();
  },

  /** 获取卡种详情 */
  getById: async (id: string): Promise<CardType | null> => {
        if (!isUseMock()) {
      return null;
    }
    const { mockGetCardTypeById } = await loadCardTypeMock();
    return mockGetCardTypeById(id);
  },

  /** 创建卡种 */
  create: async (data: CardTypeFormData): Promise<CardType> => {
        if (!isUseMock()) {
      throw new Error('卡种 API 暂未接通');
    }
    const { mockCreateCardType } = await loadCardTypeMock();
    return mockCreateCardType(data);
  },

  /** 更新卡种 */
  update: async (id: string, data: Partial<CardTypeFormData>): Promise<CardType> => {
        if (!isUseMock()) {
      throw new Error('卡种 API 暂未接通');
    }
    const { mockUpdateCardType } = await loadCardTypeMock();
    return mockUpdateCardType(id, data);
  },

  /** 切换卡种状态（在售/停售） */
  toggleStatus: async (id: string, status: CardTypeStatus): Promise<CardType> => {
        if (!isUseMock()) {
      throw new Error('卡种 API 暂未接通');
    }
    const { mockToggleCardTypeStatus } = await loadCardTypeMock();
    return mockToggleCardTypeStatus(id, status);
  },

  /** 删除卡种 */
  remove: async (id: string): Promise<void> => {
        if (!isUseMock()) {
      throw new Error('卡种 API 暂未接通');
    }
    const { mockRemoveCardType } = await loadCardTypeMock();
    return mockRemoveCardType(id);
  },
};
