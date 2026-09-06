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

interface RoleGlossaryState {
  titles: RoleTitles;
  loaded: boolean;
  loading: boolean;
  load: () => Promise<void>;
  setTitlesLocal: (titles: RoleTitles) => void;
  saveTitles: (titles: RoleTitles) => Promise<RoleTitles>;
}

export const useRoleGlossaryStore = create<RoleGlossaryState>((set, get) => ({
  titles: { ...DEFAULT_ROLE_TITLES },
  loaded: false,
  loading: false,

  load: async () => {
    if (get().loading) return;
    set({ loading: true });
    try {
      const settings = await organizationService.getSettings();
      const titles = normalizeRoleTitles(settings.roleTitles);
      set({ titles, loaded: true });
    } catch {
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
    set({ titles: resolved, loaded: true });
    return resolved;
  },
}));
