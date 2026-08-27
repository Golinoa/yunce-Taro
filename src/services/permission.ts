/**
 * Service 层 — 权限配置 API（授权开关 + 自定义角色）
 *
 * mock 实现：本地 storage 持久化（联调前 admin 的授权在本地即可生效并保存）。
 * 真实实现：待后端 OpenAPI 契约（机构-角色-权限表），届时替换为 request 调用。
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

/** 默认配置：系统角色按 ROLE_PERMISSION_MAP 默认值，无自定义角色 */
function createDefaultConfig(): PermissionConfig {
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

/** 保存权限配置 */
export function savePermissionConfig(config: PermissionConfig): void {
  Taro.setStorageSync(PERMISSION_CONFIG_KEY, {
    ...config,
    version: (config.version || 1) + 1,
  });
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
