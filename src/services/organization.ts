/**
 * Service 层 — 机构绑定 / 分享归属 API
 *
 * 契约（baseURL 已含 /api/app/v1）：
 * - POST /organization/bind                    { inviteCode } → 绑定机构（自动创建子女 + 机构用户）
 * - POST /organization/bindings/:studentParentId/relation  { relation: self|father|mother }
 * - GET  /organization/me                      我的机构状态 + 待确认关系
 * - GET  /share/context?inviteCode=xxx         分享上下文（落地页展示邀请人）
 */
import Taro from '@tarojs/taro';
import { get, post, put } from '@/utils/request';

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

/** POST /organization/bind 响应 */
export interface BindOrganizationResult {
  studentId: string;
  studentName: string;
  organizationId: string;
  studentParentId: string;
}

/** GET /share/context 响应 */
export interface ShareContext {
  organizationId: string;
  organizationName: string;
  teacherId: string;
  teacherName: string;
}

export const organizationService = {
  /** 绑定机构（学员邀请码 → 自动创建子女 + 机构用户 MEMBER） */
  bind: async (inviteCode: string): Promise<BindOrganizationResult> => {
    return post<BindOrganizationResult>('/organization/bind', { inviteCode });
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
