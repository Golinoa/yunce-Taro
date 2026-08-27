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
import {
  mockBindOrganization,
  mockGetMyOrganization,
  mockGetShareContext,
  mockSaveRelation,
} from '@/data/organization';
import { get, post } from '@/utils/request';

const USE_MOCK =
  typeof process !== 'undefined' && typeof process.env !== 'undefined'
    ? process.env.VITE_USE_MOCK !== 'false'
    : true;

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
    if (USE_MOCK) return mockBindOrganization(inviteCode);

    return post<BindOrganizationResult>('/organization/bind', { inviteCode });
  },

  /** 保存关系确认（self / father / mother） */
  saveRelation: async (
    studentParentId: string,
    relation: StudentParentRelation,
  ): Promise<{ studentParentId: string; relation: StudentParentRelation }> => {
    if (USE_MOCK) return mockSaveRelation(studentParentId, relation);

    return post(`/organization/bindings/${encodeURIComponent(studentParentId)}/relation`, {
      relation,
    });
  },

  /** 我的机构状态 + 待确认关系（首页 useDidShow 调用） */
  getMyOrganization: async (): Promise<MyOrganizationResult> => {
    if (USE_MOCK) return mockGetMyOrganization();

    return get<MyOrganizationResult>('/organization/me');
  },

  /** 分享上下文（分享落地页展示「xx 邀请你」） */
  getShareContext: async (inviteCode: string): Promise<ShareContext> => {
    if (USE_MOCK) return mockGetShareContext(inviteCode);

    return get<ShareContext>('/share/context', { inviteCode });
  },
};

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
