/**
 * Service 层 — 权限配置 API（授权开关 + 自定义角色）
 *
 * 服务端为真相源：`GET/PUT /org-permissions`；本地仅做同步缓存（route-guard 需同步读）。
 */
import Taro from '@tarojs/taro';
import {
  defaultRoleGrant,
  PERMISSION_CONFIG_KEY,
  type CustomRole,
  type DataModule,
  type DataScope,
  type PermissionConfig,
  type RoleGrant,
} from '@/types/permission';
import { get, put } from '@/utils/request';

/** 默认配置：系统角色按 ROLE_PERMISSION_MAP 默认值，无自定义角色 */
export function createDefaultConfig(): PermissionConfig {
  return {
    version: 1,
    grants: {
      admin: defaultRoleGrant('admin'),
      principal: defaultRoleGrant('principal'),
      teacher: defaultRoleGrant('teacher'),
      assistant: defaultRoleGrant('assistant'),
    },
    customRoles: [],
  };
}

/** 写入本地缓存并返回 */
function cacheConfig(config: PermissionConfig): PermissionConfig {
  try {
    Taro.setStorageSync(PERMISSION_CONFIG_KEY, config);
  } catch {
    // ignore storage errors
  }
  return config;
}

/** 读取权限配置（同步，供路由守卫/数据层直接消费） */
export function getPermissionConfig(): PermissionConfig {
  try {
    const raw = Taro.getStorageSync(PERMISSION_CONFIG_KEY);
    if (raw && typeof raw === 'object') {
      return raw as PermissionConfig;
    }
  } catch {
    // ignore
  }
  return createDefaultConfig();
}

/** 清空本地权限缓存（切机构 / 登出） */
export function clearPermissionCache(): void {
  try {
    Taro.removeStorageSync(PERMISSION_CONFIG_KEY);
  } catch {
    // ignore
  }
}

/** 从服务端拉取并写入本地缓存 */
export async function fetchPermissionConfig(): Promise<PermissionConfig> {
  const data = await get<PermissionConfig>('/org-permissions');
  const cfg: PermissionConfig = {
    version: Number(data?.version ?? 1),
    grants: (data?.grants as PermissionConfig['grants']) || createDefaultConfig().grants,
    customRoles: Array.isArray(data?.customRoles) ? data.customRoles : [],
  };
  return cacheConfig(cfg);
}

/** 保存到服务端并更新本地缓存 */
export async function savePermissionConfigAsync(
  config: PermissionConfig,
): Promise<PermissionConfig> {
  const data = await put<PermissionConfig>('/org-permissions', {
    version: config.version,
    grants: config.grants,
    customRoles: config.customRoles,
  });
  const cfg: PermissionConfig = {
    version: Number(data?.version ?? (config.version || 1) + 1),
    grants: (data?.grants as PermissionConfig['grants']) || config.grants,
    customRoles: Array.isArray(data?.customRoles) ? data.customRoles : config.customRoles,
  };
  return cacheConfig(cfg);
}

/**
 * 保存权限配置（设置页使用）：异步写服务端再缓存。
 * 保留函数名；调用方须 await。
 */
export async function savePermissionConfig(config: PermissionConfig): Promise<PermissionConfig> {
  return savePermissionConfigAsync(config);
}

/** 读取某角色的实际授权（含系统角色覆盖 + 自定义角色） */
export function getRoleGrant(
  key: string,
  fallbackRole?: 'admin' | 'principal' | 'teacher' | 'assistant',
): RoleGrant {
  const config = getPermissionConfig();
  return config.grants[key] ?? defaultRoleGrant(fallbackRole || 'teacher');
}

/** 生成自定义角色 id */
export function nextCustomRoleId(config: PermissionConfig): string {
  const max = config.customRoles.reduce((m, r) => {
    const n = Number(String(r.id).replace(/\D/g, ''));
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, 0);
  return `custom-role-${max + 1}`;
}

export type { CustomRole, DataModule, DataScope, PermissionConfig, RoleGrant };
