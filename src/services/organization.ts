/**
 * Service 层 — 机构绑定 / 分享归属 API
 *
 * 契约（baseURL 已含 /api/app/v1）：
 * - POST /organization/bind-code             { inviteCode } → 统一绑定（S 学员 / E 员工 / 无前缀兼容）
 * - POST /organization/bind                 { inviteCode } → 仅学员绑定（兼容旧路径）
 * - POST /organization/bindings/:studentParentId/relation  { relation: self|father|mother }
 * - GET  /organization/me                      我的机构状态 + 待确认关系
 * - GET  /share/context?inviteCode=xxx         分享上下文（落地页展示邀请人）
 */
import Taro from '@tarojs/taro';
import { get, post, put } from '@/utils/request';

const AUTH_TOKEN_KEY = 'yunce-edu-auth-token';

/** 与学员的关系（后端 Zod 常量校验，不建枚举列） */
export type StudentParentRelation = 'self' | 'father' | 'mother';

/** 我的机构信息 */
export interface OrganizationInfo {
  id: string;
  name: string;
  status: string;
  versionCode?: string;
}

/** 待确认关系（绑定/归属完成后首页弹窗触发） */
export interface PendingRelation {
  studentId: string;
  studentName: string;
  studentParentId: string;
}

/** 已绑定成员关系 */
export interface Membership {
  studentId: string;
  studentName: string;
  relation?: StudentParentRelation | null;
}

/** GET /organization/me 响应 */
export interface MyOrganizationResult {
  organization?: OrganizationInfo | null;
  pendingRelation?: PendingRelation | null;
  memberships: Membership[];
}

/** POST /organization/bind 响应（学员专属旧路径） */
export interface BindOrganizationResult {
  studentId: string;
  studentName: string;
  organizationId: string;
  studentParentId: string;
}

/** POST /organization/bind-code 统一绑定响应（与 BE discriminated union 对齐） */
export type BindByCodeKind = 'student' | 'staff';

export interface BindByCodeResult {
  kind: BindByCodeKind;
  organizationId: string;
  organizationName?: string;
  /** 学员路径 */
  studentId?: string;
  studentName?: string;
  studentParentId?: string;
  /** 员工路径 */
  campusId?: string;
  campusName?: string | null;
  roleCode?: string;
  campusRole?: string;
  alreadyJoined?: boolean;
  profileRole?: string;
  acceptedAt?: string | null;
  /** 员工加入后可能下发新租户会话（与 campus-invite accept 同形） */
  token?: string;
  refreshToken?: string;
  expiresIn?: number;
}

/** GET /share/context 响应 */
export type ShareInviteViewStatus = 'pending' | 'expired' | 'used' | 'invalid';

export interface ShareContext {
  inviteStatus: ShareInviteViewStatus;
  organizationId: string;
  organizationName: string;
  teacherId: string;
  teacherName: string;
  inviteCode: string;
  expireAt: string;
  usedByUserId?: string | null;
}

function persistAuthTokens(token: string, refreshToken: string, expiresIn: number): void {
  try {
    const raw = Taro.getStorageSync(AUTH_TOKEN_KEY);
    const session = raw ? JSON.parse(raw) : {};
    Taro.setStorageSync(
      AUTH_TOKEN_KEY,
      JSON.stringify({
        ...session,
        access_token: token,
        refresh_token: refreshToken,
        expires_at: Math.floor(Date.now() / 1000) + expiresIn,
      }),
    );
  } catch {
    /* ignore */
  }
}

export const organizationService = {
  /**
   * 统一绑定机构（选择身份「绑定机构」主路径）
   * POST /organization/bind-code { inviteCode }
   * - S* → 学员绑定；E* → 员工校区邀请；无前缀 → 后端兼容分流
   */
  bindByCode: async (inviteCode: string): Promise<BindByCodeResult> => {
    const data = await post<BindByCodeResult>('/organization/bind-code', {
      inviteCode: inviteCode.trim().toUpperCase(),
    });
    if (data.token && data.refreshToken && typeof data.expiresIn === 'number') {
      persistAuthTokens(data.token, data.refreshToken, data.expiresIn);
    }
    return data;
  },

  /** 绑定机构（学员邀请码 → 自动创建子女 + 机构用户 MEMBER）；兼容旧入口 */
  bind: async (inviteCode: string): Promise<BindOrganizationResult> => {
    return post<BindOrganizationResult>('/organization/bind', { inviteCode });
  },

  /** 家长邀请链接绑定（服务端 token，48h / 一次性） */
  bindByParentLink: async (token: string): Promise<BindOrganizationResult> => {
    return post<BindOrganizationResult>('/organization/bind-parent-link', { token });
  },

  /** 保存关系确认（self / father / mother） */
  saveRelation: async (
    studentParentId: string,
    relation: StudentParentRelation,
  ): Promise<{ studentParentId: string; relation: StudentParentRelation }> => {
    return post(`/organization/bindings/${encodeURIComponent(studentParentId)}/relation`, {
      relation,
    });
  },

  /** 我的机构状态 + 待确认关系（首页 useDidShow 调用） */
  getMyOrganization: async (): Promise<MyOrganizationResult> => {
    return get<MyOrganizationResult>('/organization/me');
  },

  /** 分享上下文（分享落地页展示「xx 邀请你」） */
  getShareContext: async (inviteCode: string): Promise<ShareContext> => {
    return get<ShareContext>('/share/context', { inviteCode });
  },

  /** 读取机构设置（校长/管理员，请假自动审批开关等） */
  getSettings: async (): Promise<OrganizationSettings> => {
    return get<OrganizationSettings>('/organization/settings');
  },

  /** 更新机构设置（校长/管理员） */
  updateSettings: async (input: { leaveAutoApprove?: boolean }): Promise<OrganizationSettings> => {
    return put<OrganizationSettings>('/organization/settings', input);
  },

  /** 机构配额使用率（校长/管理员，P1） */
  getQuotaUsage: async (): Promise<OrganizationQuotaUsage> => {
    return get<OrganizationQuotaUsage>('/organization/quota-usage');
  },

  /**
   * 机构权益快照（配额 + features），供客户端按模块藏入口
   * 生产：GET /organization/entitlements
   */
  getEntitlements: async (): Promise<OrganizationQuotaUsage> => {
    const data = await get<
      OrganizationQuotaUsage & { entitlements?: { features?: Record<string, boolean> } }
    >('/organization/entitlements');
    const features = {
      ...(data.features || {}),
      ...(data.entitlements?.features || {}),
    };
    return { ...data, features };
  },

  /**
   * 会员页营销话术（运营可覆盖）
   * 生产：GET /organization/membership-tips
   * mock / 失败：返回 null，页面用本地 DEFAULT_MEMBERSHIP_TIPS
   */
  getMembershipTips: async (): Promise<
    import('@/constants/membership-tips').MembershipTipDef[] | null
  > => {
    try {
      const data = await get<{ tips?: import('@/constants/membership-tips').MembershipTipDef[] }>(
        '/organization/membership-tips',
      );
      return Array.isArray(data?.tips) && data.tips.length > 0 ? data.tips : null;
    } catch {
      return null;
    }
  },

  /**
   * 兑换运营端激活码（开通/续费机构会员）
   * 生产：POST /organization/redeem-activation-code
   * mock：演示码 HXK-DEMO-STANDARD / HXK-DEMO-FLAGSHIP / HXK-DEMO-RENEW
   */
  redeemActivationCode: async (code: string): Promise<RedeemActivationResult> => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      return { error: { message: '请输入激活码' } };
    }
    if (trimmed.length < 8) {
      return { error: { message: '激活码格式不正确' } };
    }

    try {
      const data = await post<{
        expireAt?: string | null;
        versionCode?: string;
        versionName?: string;
        planName?: string;
        durationDays?: number;
        versionUpgraded?: boolean;
        message?: string;
      }>('/organization/redeem-activation-code', { code: trimmed });
      return {
        expireAt: data.expireAt ?? undefined,
        versionCode: data.versionCode,
        versionName: data.versionName,
        planName: data.planName,
        durationDays: data.durationDays,
        versionUpgraded: data.versionUpgraded,
        message: data.message || '兑换成功',
        error: null,
      };
    } catch (error) {
      const message =
        error instanceof Error && error.message ? error.message : '兑换失败，请稍后重试';
      return { error: { message } };
    }
  },
};

/** 机构设置（与后端 OrgSettings 对齐） */
export interface OrganizationSettings {
  /** 家长请假自动审批，默认 true */
  leaveAutoApprove: boolean;
}

/** 机构配额使用率（P1） */
export interface OrganizationQuotaUsage {
  organizationId: string;
  organizationName: string;
  versionCode: 'FREE' | 'TRIAL' | 'BASIC' | 'STANDARD' | 'FLAGSHIP';
  versionName: string;
  /** 会员到期时间；空表示未开通付费期 */
  expireAt?: string | null;
  members: { current: number; max: number };
  employees: { current: number; max: number };
  campuses: { current: number; max: number };
  features: {
    leadTrace: boolean;
    batchImportExport: boolean;
    marketing?: boolean;
    [key: string]: boolean | undefined;
  };
}

export interface RedeemActivationResult {
  expireAt?: string;
  versionCode?: string;
  versionName?: string;
  planName?: string;
  durationDays?: number;
  versionUpgraded?: boolean;
  message?: string;
  error: { message: string } | null;
}

/** 是否视为「已开通有效会员」（非免费档且未过期） */
export function isOrgMembershipActive(quota: OrganizationQuotaUsage | null | undefined): boolean {
  if (!quota) return false;
  if (quota.expireAt) {
    const t = new Date(quota.expireAt).getTime();
    if (Number.isFinite(t) && t < Date.now()) return false;
  }
  // 众创 / 试用视为未开通付费会员，引导兑换激活码
  if (quota.versionCode === 'FREE' || quota.versionCode === 'TRIAL') return false;
  // 付费档：有到期日则需未过期；无到期日视为长期有效
  return true;
}

// ==================== 待确认关系本地存储（首页关系弹窗触发源） ====================

/** 待确认关系本地 key：绑定/归属完成后写入，首页消费 */
const PENDING_RELATION_KEY = 'yunce:pending-relation';

/** 保存待确认关系（绑定机构成功后写入） */
export function savePendingRelation(relation: PendingRelation): void {
  try {
    Taro.setStorageSync(PENDING_RELATION_KEY, JSON.stringify(relation));
  } catch {
    /* ignore */
  }
}

/** 读取待确认关系（不消费；首页 useDidShow 据此决定是否弹窗） */
export function getPendingRelation(): PendingRelation | null {
  try {
    const raw = Taro.getStorageSync(PENDING_RELATION_KEY);
    return raw ? (JSON.parse(raw) as PendingRelation) : null;
  } catch {
    return null;
  }
}

/** 消费待确认关系（弹窗完成/用户暂不选择后清除） */
export function consumePendingRelation(): PendingRelation | null {
  const pending = getPendingRelation();
  if (pending) {
    try {
      Taro.removeStorageSync(PENDING_RELATION_KEY);
    } catch {
      /* ignore */
    }
  }
  return pending;
}
