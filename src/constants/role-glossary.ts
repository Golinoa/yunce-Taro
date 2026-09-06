/**
 * 机构角色称呼词典（仅展示；权限身份不变）
 * - 管理员：固定
 * - 管理层 / 授课 / 学员侧：机构可配置
 */
import type { UserRole } from '@/types/profile';
import type { TeacherIdentity } from '@/types/teacher';

export type ManagerTitle = '校长' | '店长' | '馆长';
export type TeacherTitle = '老师' | '教练';
export type ParentTitle = '家长' | '会员';

export interface RoleTitles {
  manager: ManagerTitle;
  teacher: TeacherTitle;
  parent: ParentTitle;
}

export const DEFAULT_ROLE_TITLES: RoleTitles = {
  manager: '店长',
  teacher: '老师',
  parent: '家长',
};

export const MANAGER_TITLE_OPTIONS: ManagerTitle[] = ['校长', '店长', '馆长'];
export const TEACHER_TITLE_OPTIONS: TeacherTitle[] = ['老师', '教练'];
export const PARENT_TITLE_OPTIONS: ParentTitle[] = ['家长', '会员'];

/** 快速预设：点一下填齐三组称呼 */
export const ROLE_TITLE_PRESETS: Array<{
  id: string;
  label: string;
  titles: RoleTitles;
}> = [
  { id: 'general', label: '综合', titles: { manager: '店长', teacher: '老师', parent: '家长' } },
  { id: 'arts', label: '艺术', titles: { manager: '校长', teacher: '老师', parent: '家长' } },
  { id: 'martial', label: '武道', titles: { manager: '馆长', teacher: '教练', parent: '家长' } },
  { id: 'yoga', label: '瑜伽', titles: { manager: '店长', teacher: '教练', parent: '会员' } },
];

export type OrgRoleCode = 'OWNER' | 'ADMIN' | 'MEMBER' | string;

/** 员工身份 → 展示名（OWNER 永远「管理员」） */
export function displayStaffIdentityLabel(
  identity: TeacherIdentity | string | undefined,
  titles: RoleTitles = DEFAULT_ROLE_TITLES,
  orgRole?: OrgRoleCode | null,
): string {
  if (orgRole === 'OWNER') return '管理员';
  switch (identity) {
    case 'principal':
      return titles.manager;
    case 'teacher':
      return titles.teacher;
    case 'assistant':
      return '助教';
    case 'reception':
      return '前台';
    default:
      return titles.teacher;
  }
}

/** 会话 UserRole → 展示名 */
export function displayUserRoleLabel(
  role: UserRole | string | undefined,
  titles: RoleTitles = DEFAULT_ROLE_TITLES,
): string {
  switch (role) {
    case 'admin':
      return '管理员';
    case 'principal':
      return titles.manager;
    case 'teacher':
      return titles.teacher;
    case 'assistant':
      return '助教';
    case 'parent':
      return titles.parent;
    default:
      return role || '';
  }
}

/** 员工表单身份选项（随称呼包变化） */
export function buildTeacherIdentityOptions(titles: RoleTitles = DEFAULT_ROLE_TITLES) {
  return [
    { label: titles.manager, value: 'principal' as const },
    { label: titles.teacher, value: 'teacher' as const },
    { label: '助教', value: 'assistant' as const },
    { label: '前台', value: 'reception' as const },
  ];
}

export function normalizeRoleTitles(raw: unknown): RoleTitles {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_ROLE_TITLES };
  const obj = raw as Record<string, unknown>;
  return {
    manager: MANAGER_TITLE_OPTIONS.includes(obj.manager as ManagerTitle)
      ? (obj.manager as ManagerTitle)
      : DEFAULT_ROLE_TITLES.manager,
    teacher: TEACHER_TITLE_OPTIONS.includes(obj.teacher as TeacherTitle)
      ? (obj.teacher as TeacherTitle)
      : DEFAULT_ROLE_TITLES.teacher,
    parent: PARENT_TITLE_OPTIONS.includes(obj.parent as ParentTitle)
      ? (obj.parent as ParentTitle)
      : DEFAULT_ROLE_TITLES.parent,
  };
}

export function matchRoleTitlePresetId(titles: RoleTitles): string | null {
  const hit = ROLE_TITLE_PRESETS.find(
    (p) =>
      p.titles.manager === titles.manager &&
      p.titles.teacher === titles.teacher &&
      p.titles.parent === titles.parent,
  );
  return hit?.id ?? null;
}
