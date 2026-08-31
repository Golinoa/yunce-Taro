/**
 * 卡种（会员卡模板）Service 层
 */
import type { CardType, CardTypeFormData, CardTypeStatus } from '@/types/card-type';

export const cardTypeService = {
  getList: async (): Promise<CardType[]> => [],

  getById: async (_id: string): Promise<CardType | null> => null,

  create: async (_data: CardTypeFormData): Promise<CardType> => {
    throw new Error('卡种 API 暂未接通');
  },

  update: async (_id: string, _data: Partial<CardTypeFormData>): Promise<CardType> => {
    throw new Error('卡种 API 暂未接通');
  },

  toggleStatus: async (_id: string, _status: CardTypeStatus): Promise<CardType> => {
    throw new Error('卡种 API 暂未接通');
  },

  remove: async (_id: string): Promise<void> => {
    throw new Error('卡种 API 暂未接通');
  },
};
