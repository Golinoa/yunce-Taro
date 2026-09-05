/**
 * 卡种（会员卡模板）Store
 *
 * 管理卡种列表的加载、创建、更新、状态切换、删除。
 */

import { create } from 'zustand';
import { cardTypeService } from '@/services/card-type';
import type { CardType, CardTypeFormData, CardTypeStatus } from '@/types/card-type';
import { TTL } from '@/utils/data-freshness';
import { logError } from '@/utils/logger';

interface CardTypeState {
  /** 卡种列表 */
  cards: CardType[];
  /** 是否加载中 */
  loading: boolean;
  /** 错误信息 */
  error: string;
  lastFetchAt: number;

  /** 获取卡种列表 */
  fetchList: (force?: boolean) => Promise<void>;
  invalidateCache: () => void;
  /** 创建卡种 */
  create: (data: CardTypeFormData) => Promise<CardType>;
  /** 更新卡种 */
  update: (id: string, data: Partial<CardTypeFormData>) => Promise<CardType>;
  /** 切换卡种状态 */
  toggleStatus: (id: string, status: CardTypeStatus) => Promise<CardType>;
  /** 删除卡种 */
  remove: (id: string) => Promise<void>;
  /** 清空错误 */
  clearError: () => void;
}

export const useCardTypeStore = create<CardTypeState>((set, get) => ({
  cards: [],
  loading: false,
  error: '',
  lastFetchAt: 0,

  fetchList: async (force = false) => {
    const { cards, lastFetchAt } = get();
    const now = Date.now();
    if (!force && cards.length > 0 && lastFetchAt > 0 && now - lastFetchAt < TTL.list) {
      return;
    }
    set({ loading: true, error: '' });
    try {
      const list = await cardTypeService.getList();
      set({ cards: list, loading: false, lastFetchAt: now });
    } catch (err) {
      logError('cardType fetchList', err);
      set({ error: '卡种加载失败，请重试', loading: false });
    }
  },

  invalidateCache: () => {
    set({ lastFetchAt: 0, cards: [] });
  },

  create: async (data) => {
    const created = await cardTypeService.create(data);
    set((state) => ({
      cards: [created, ...state.cards],
      lastFetchAt: Date.now(),
    }));
    return created;
  },

  update: async (id, data) => {
    const updated = await cardTypeService.update(id, data);
    set((state) => ({
      cards: state.cards.map((item) => (item.id === id ? updated : item)),
    }));
    return updated;
  },

  toggleStatus: async (id, status) => {
    const updated = await cardTypeService.toggleStatus(id, status);
    set((state) => ({
      cards: state.cards.map((item) => (item.id === id ? updated : item)),
    }));
    return updated;
  },

  remove: async (id) => {
    await cardTypeService.remove(id);
    set((state) => ({
      cards: state.cards.filter((item) => item.id !== id),
    }));
  },

  clearError: () => set({ error: '' }),
}));
