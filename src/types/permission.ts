/**
 * 权限体系模型（2026-08-22 用户口径确认，规划基座）
 *
 * 角色与权限（用户确认）：
 * - 管理员(admin)：机构创建者，拥有校区全部数据查看权限，可进行权限分配（分配 UI 暂未实现，规划中）
 * - 校长(principal)：由管理员任命，拥有校区全部数据查看权限；部分数据模块可被管理员开关授权/关闭
 * - 老师(teacher)：默认仅查看本人名下学员数据（own 范围），可由管理员/校长开关授权扩大
 * - 前台(assistant)：同老师，默认仅本人名下数据
 * - 家长(parent)：仅查看「所绑定机构下绑定孩子」的数据；未绑定任何孩子则无任何数据可见
 *
 * 落地说明：当前页面访问由 route-guard 的 PAGE_ROLE_REQUIREMENTS 控制（见 utils/route-guard.tsx）；
 * 本模型为权限体系的类型基座与规划记录，待"权限分配 UI"实现后，将按
 * ROLE_PERMISSION_MAP + 每角色 grantedModules 开关动态推导页面/接口权限。
 */
import type { Profile, UserRole } from '@/types/profile';

/** 数据可见范围 */
export type DataScope = 'own' | 'campus' | 'all';

/** 数据模块（管理员/校长可开关授权的粒度） */
export type DataModule =
  | 'salary' // 薪资
  | 'students' // 学员
  | 'classes' // 班级/课程/排课/考勤
  | 'leads' // 线索/试听
  | 'finance' // 财务/经营数据看板
  | 'staff' // 教师/员工管理
  | 'settings'; // 系统/校区设置

/** 全部数据模块 */
export const ALL_DATA_MODULES: DataModule[] = [
  'salary',
  'students',
  'classes',
  'leads',
  'finance',
  'staff',
  'settings',
];

/** 角色默认权限配置 */
export interface RolePermissionConfig {
  role: UserRole;
  /** 默认数据范围：own=本人名下 / campus=所属校区 / all=机构全部 */
  defaultScope: DataScope;
  /** 默认可见模块 */
  defaultModules: DataModule[];
  /** 是否可被管理员/校长开关授权调整 */
  toggleable: boolean;
}

/** 角色 → 默认权限配置（管理员分配 UI 落地前按此执行） */
export const ROLE_PERMISSION_MAP: Record<UserRole, RolePermissionConfig> = {
  admin: {
    role: 'admin',
    defaultScope: 'all',
    defaultModules: ALL_DATA_MODULES,
    toggleable: true,
  },
  principal: {
    role: 'principal',
    defaultScope: 'all',
    // 校长可看全部经营数据；系统设置(settings)默认仅管理员
    defaultModules: ALL_DATA_MODULES.filter((m) => m !== 'settings'),
    toggleable: true,
  },
  teacher: {
    role: 'teacher',
    defaultScope: 'own',
    // 默认：自己的学员/所教班级/线索/本人薪资
    defaultModules: ['students', 'classes', 'leads', 'salary'],
    toggleable: true,
  },
  assistant: {
    role: 'assistant',
    defaultScope: 'own',
    defaultModules: ['students', 'classes', 'leads'],
    toggleable: true,
  },
  parent: {
    role: 'parent',
    defaultScope: 'own',
    // 家长仅看绑定孩子数据；无绑定孩子则数据层过滤为空
    defaultModules: ['students'],
    toggleable: false,
  },
};

/** 解析用户当前数据范围 */
export function resolveDataScope(profile?: Profile | null): DataScope {
  if (!profile) return 'own';
  const role = profile.currentContext?.role;
  return ROLE_PERMISSION_MAP[role]?.defaultScope ?? 'own';
}

/** 角色是否可访问某数据模块（开关 UI 未实现前按默认配置判定） */
export function canAccessModule(profile: Profile | null | undefined, module: DataModule): boolean {
  if (!profile) return false;
  const role = profile.currentContext?.role;
  return ROLE_PERMISSION_MAP[role]?.defaultModules.includes(module) ?? false;
}

/** 家长是否已绑定孩子（未绑定则无任何数据可见） */
export function hasBoundChild(profile?: Profile | null): boolean {
  const studentId = profile?.parent_profile?.student_id;
  const bindStatus = profile?.parent_profile?.bind_status;
  return Boolean(studentId) && bindStatus !== 'unbound';
}

// ============================================
// 授权配置（admin 可编辑 + 自定义角色）
// ============================================

/** 自定义角色（管理员创建的角色模板，可分配数据模块与范围） */
export interface CustomRole {
  id: string;
  /** 角色名称（如「教学主管」「财务」） */
  name: string;
  /** 基准系统角色（创建时继承其默认模块） */
  baseRole: Exclude<UserRole, 'parent'>;
  /** 数据范围 */
  scope: DataScope;
  /** 可见模块 */
  modules: DataModule[];
  /** 备注 */
  note?: string;
  createdAt: string;
}

/** 单个角色的授权（系统角色覆盖 or 自定义角色） */
export interface RoleGrant {
  scope: DataScope;
  modules: DataModule[];
}

/** 权限配置（持久化结构：系统角色覆盖 + 自定义角色） */
export interface PermissionConfig {
  version: number;
  /** key：系统角色名（admin/principal/teacher/assistant）或自定义角色 id */
  grants: Record<string, RoleGrant>;
  customRoles: CustomRole[];
}

/** 授权配置存储 key */
export const PERMISSION_CONFIG_KEY = 'yunce-permission-config';

/** 取角色默认授权（未覆盖时回退） */
export function defaultRoleGrant(role: UserRole): RoleGrant {
  const cfg = ROLE_PERMISSION_MAP[role];
  return {
    scope: cfg?.defaultScope ?? 'own',
    modules: cfg ? [...cfg.defaultModules] : [],
  };
}
