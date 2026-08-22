/**
 * 权限配置 Store（授权开关 + 自定义角色）
 *
 * 使用场景：系统设置 → 角色权限页；admin 编辑 principal/teacher/assistant 的
 * 数据模块开关与范围，管理自定义角色，保存后持久化（mock 走本地 storage）。
 */
import { create } from 'zustand';
import { getPermissionConfig, nextCustomRoleId, savePermissionConfig } from '@/services/permission';
import {
  defaultRoleGrant,
  type CustomRole,
  type DataModule,
  type DataScope,
  type PermissionConfig,
} from '@/types/permission';
import { logError } from '@/utils/logger';

/** 可被管理员编辑的系统角色（admin 自身为全量，parent 为只读绑定） */
export const EDITABLE_SYSTEM_ROLES = ['principal', 'teacher', 'assistant'] as const;
export type EditableSystemRole = (typeof EDITABLE_SYSTEM_ROLES)[number];

interface PermissionState {
  config: PermissionConfig;
  loaded: boolean;
  /** 从 storage 加载配置 */
  load: () => void;
  /** 更新某角色（系统角色或自定义角色）的授权 */
  updateGrant: (key: string, grant: { scope: DataScope; modules: DataModule[] }) => void;
  /** 新建自定义角色 */
  addCustomRole: (
    name: string,
    baseRole: Exclude<PermissionConfig['customRoles'][number]['baseRole'], never>,
  ) => CustomRole;
  /** 更新自定义角色 */
  updateCustomRole: (
    id: string,
    patch: Partial<Pick<CustomRole, 'name' | 'scope' | 'modules' | 'note'>>,
  ) => void;
  /** 删除自定义角色 */
  removeCustomRole: (id: string) => void;
  /** 保存并持久化 */
  save: () => void;
}

export const usePermissionStore = create<PermissionState>((set, get) => ({
  config: getPermissionConfig(),
  loaded: false,

  load: () => {
    try {
      set({ config: getPermissionConfig(), loaded: true });
    } catch (err) {
      logError('permissionStore.load', err);
    }
  },

  updateGrant: (key, grant) => {
    const config = get().config;
    set({
      config: {
        ...config,
        grants: { ...config.grants, [key]: { ...grant } },
      },
    });
  },

  addCustomRole: (name, baseRole) => {
    const config = get().config;
    const base = defaultRoleGrant(baseRole);
    const role: CustomRole = {
      id: nextCustomRoleId(config),
      name: name.trim() || '未命名角色',
      baseRole,
      scope: base.scope,
      modules: [...base.modules],
      createdAt: new Date().toISOString(),
    };
    set({
      config: {
        ...config,
        customRoles: [...config.customRoles, role],
        grants: { ...config.grants, [role.id]: { scope: role.scope, modules: [...role.modules] } },
      },
    });
    return role;
  },

  updateCustomRole: (id, patch) => {
    const config = get().config;
    set({
      config: {
        ...config,
        customRoles: config.customRoles.map((r) => (r.id === id ? { ...r, ...patch } : r)),
        grants: {
          ...config.grants,
          [id]: {
            scope: patch.scope ?? config.grants[id]?.scope ?? 'own',
            modules: patch.modules ?? config.grants[id]?.modules ?? [],
          },
        },
      },
    });
  },

  removeCustomRole: (id) => {
    const config = get().config;
    const grants = { ...config.grants };
    delete grants[id];
    set({
      config: {
        ...config,
        customRoles: config.customRoles.filter((r) => r.id !== id),
        grants,
      },
    });
  },

  save: () => {
    try {
      savePermissionConfig(get().config);
    } catch (err) {
      logError('permissionStore.save', err);
      throw err;
    }
  },
}));
