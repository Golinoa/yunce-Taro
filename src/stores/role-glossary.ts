/**
 * 机构角色称呼 Store：系统设置写入 Organization.settings.roleTitles，全端展示共用。
 */
import { create } from 'zustand';
import {
  DEFAULT_ROLE_TITLES,
  normalizeRoleTitles,
  type RoleTitles,
} from '@/constants/role-glossary';
import { organizationService } from '@/services/organization';
import { TTL } from '@/utils/data-freshness';

interface RoleGlossaryState {
  titles: RoleTitles;
  loaded: boolean;
  loading: boolean;
  /** 上次成功拉取时间戳（TTL 节流用） */
  lastLoadAt: number;
  /** 拉取角色称呼（force 跳过 TTL 节流） */
  load: (force?: boolean) => Promise<void>;
  setTitlesLocal: (titles: RoleTitles) => void;
  saveTitles: (titles: RoleTitles) => Promise<RoleTitles>;
}

export const useRoleGlossaryStore = create<RoleGlossaryState>((set, get) => ({
  titles: { ...DEFAULT_ROLE_TITLES },
  loaded: false,
  loading: false,
  lastLoadAt: 0,

  load: async (force = false) => {
    if (get().loading) return;
    // TTL 守卫：本 store 被首页/我的/员工列表/员工邀请/角色称呼等多页 useDidShow 调用，
    // 窗口内不重复打库；写入口 saveTitles 已就地更新 store，不依赖本页重拉兜底。
    const { lastLoadAt } = get();
    const now = Date.now();
    if (!force && lastLoadAt > 0 && now - lastLoadAt < TTL.list) {
      return;
    }
    set({ loading: true });
    try {
      const settings = await organizationService.getSettings();
      const titles = normalizeRoleTitles(settings.roleTitles);
      set({ titles, loaded: true, lastLoadAt: Date.now() });
    } catch {
      // 失败时不打点，下次进页重试
      set({ titles: { ...DEFAULT_ROLE_TITLES }, loaded: true });
    } finally {
      set({ loading: false });
    }
  },

  setTitlesLocal: (titles) => set({ titles: normalizeRoleTitles(titles) }),

  saveTitles: async (titles) => {
    const next = normalizeRoleTitles(titles);
    const saved = await organizationService.updateSettings({ roleTitles: next });
    const resolved = normalizeRoleTitles(saved.roleTitles ?? next);
    set({ titles: resolved, loaded: true, lastLoadAt: Date.now() });
    return resolved;
  },
}));
