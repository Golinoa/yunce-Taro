/**
 * 用户角色枚举
 * - admin: 机构创建者（注册机构的人，兼具校长权限，最高权限）
 * - principal: 校长（机构下的校区管理者）
 * - teacher: 教师
 * - assistant: 助教（辅助老师，权限比老师略低）
 * - parent: 家长
 */
export type UserRole = 'admin' | 'principal' | 'teacher' | 'assistant' | 'parent';

/**
 * 身份关系（一个账号可在多个机构拥有多个身份）
 */
export interface Identity {
  /** 身份唯一标识 */
  id: string;
  /** 角色 */
  role: UserRole;
  /** 所属机构 ID */
  organizationId: string;
  /** 所属机构名称 */
  organizationName: string;
  /** 关联校区 ID 列表 */
  campusIds?: string[];
  /** 是否为登录后默认身份 */
  isDefault: boolean;
}

/**
 * 当前操作上下文
 * 每次操作都在某个身份上下文中进行，数据不串
 */
export interface CurrentContext {
  /** 当前身份 ID */
  identityId: string;
  /** 当前角色 */
  role: UserRole;
  /** 当前机构 ID */
  organizationId: string;
  /** 当前校区 ID（教师/校长视角） */
  campusId?: string;
}

/**
 * 用户资料 (profiles 表)
 */
export interface Profile {
  id: string;
  name: string;
  nickname?: string;
  phone?: string;
  email?: string;
  avatar_url?: string;
  teacher_profile?: {
    id: string;
    invite_code?: string;
    institution?: string;
    student_count?: number;
    class_count?: number;
  };
  parent_profile?: {
    id: string;
    student_id?: string;
    student_name?: string | null;
    relation?: string | null;
    bind_status?: string;
  };
  /** 所有身份列表 */
  identities: Identity[];
  /** 当前正在使用的身份上下文 */
  currentContext: CurrentContext;
  created_at: string;
  updated_at: string;
}

/**
 * 认证会话信息
 */
export interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: {
    id: string;
    email?: string;
    phone?: string;
  };
}

/**
 * 注册草稿（跨注册步骤共享）
 */
export interface RegisterDraft {
  /** 后端临时注册令牌 */
  tempToken: string;
  /** Step1: 用户名 */
  username: string;
  /** Step1: 密码 */
  password: string;
  /** Step1: 拉新邀请码 */
  inviteCode?: string;
  /** Step2: 选择的角色 */
  role?: UserRole;
  /** Step3: 角色-specific 信息 */
  roleInfo?: PrincipalRoleInfo | TeacherRoleInfo | ParentRoleInfo;
}

/** 校长注册信息 */
export interface PrincipalRoleInfo {
  organizationName: string;
  organizationAddress?: string;
  contactPhone: string;
}

/** 教师注册信息 */
export interface TeacherRoleInfo {
  campusCode?: string;
}

/** 家长注册信息 */
export interface ParentRoleInfo {
  studentCode?: string;
}
