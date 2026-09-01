/**
 * 校区员工邀请 Service
 *
 * 契约（baseURL 已含 /api/app/v1）：
 * - GET  /campus-invites/code/:inviteCode   预览（无需登录）
 * - GET  /campus-invites                    列表
 * - POST /campus-invites                    生成邀请（可带 targetTeacherId 点对点绑微信）
 * - POST /campus-invites/:inviteCode/accept 接受邀请（返回新 token）
 * - POST /campus-invites/:id/cancel         取消邀请
 */
import Taro from '@tarojs/taro';
import { type PaginatedResponse, unwrapPaginatedList } from '@/utils/pagination';
import { get, post } from '@/utils/request';

const AUTH_TOKEN_KEY = 'yunce-edu-auth-token';

export type CampusInviteRoleCode = 'campus_teacher' | 'campus_principal' | 'campus_reception';

export type CampusInviteStatus = 'PENDING' | 'USED' | 'EXPIRED' | 'CANCELLED';

export interface CampusInvitePreview {
  id: string;
  inviteCode: string;
  campusId: string;
  campusName: string;
  organizationId: string;
  organizationName: string;
  roleCode: CampusInviteRoleCode;
  campusRole: 'TEACHER' | 'PRINCIPAL' | 'RECEPTION';
  status: CampusInviteStatus;
  expireAt: string;
  roleLabel?: string;
  usedByUserId?: string | null;
}

export interface CampusInviteItem {
  id: string;
  inviteCode: string;
  campusId: string;
  campusName: string;
  roleCode: CampusInviteRoleCode;
  campusRole: 'TEACHER' | 'PRINCIPAL' | 'RECEPTION';
  status: CampusInviteStatus;
  expireAt: string;
  usedAt?: string | null;
  createdAt: string;
  targetTeacherId?: string | null;
  roleLabel?: string;
}

export interface CreateCampusInviteInput {
  campusId: string;
  roleCode: CampusInviteRoleCode;
  /** 点对点：绑定到已创建的员工 */
  targetTeacherId?: string;
  expireMinutes?: number;
  expireDays?: number;
}

export type CreateCampusInviteResult = CampusInviteItem;

export interface ListCampusInvitesQuery {
  page?: number;
  pageSize?: number;
  status?: CampusInviteStatus;
  campusId?: string;
  roleCode?: CampusInviteRoleCode;
}

export interface AcceptCampusInviteResult {
  alreadyJoined: boolean;
  organizationId: string;
  campusId: string;
  campusName: string | null;
  roleCode: CampusInviteRoleCode;
  campusRole: 'TEACHER' | 'PRINCIPAL' | 'RECEPTION';
  profileRole?: 'TEACHER' | 'PRINCIPAL' | 'PARENT';
  acceptedAt?: string | null;
  token?: string;
  refreshToken?: string;
  expiresIn?: number;
}

const ROLE_LABEL: Record<CampusInviteRoleCode, string> = {
  campus_teacher: '授课教师',
  campus_principal: '校区校长',
  campus_reception: '前台',
};

function enrichInviteItem(item: CampusInviteItem): CampusInviteItem {
  return {
    ...item,
    roleLabel: ROLE_LABEL[item.roleCode] ?? item.roleCode,
  };
}

function persistTokens(token: string, refreshToken: string, expiresIn: number): void {
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

/** 组装点对点邀请请求体（供单测断言） */
export function buildPointToPointInvitePayload(input: {
  campusId: string;
  teacherId: string;
  roleCode?: CampusInviteRoleCode;
  expireMinutes?: number;
}): CreateCampusInviteInput {
  return {
    campusId: input.campusId,
    targetTeacherId: input.teacherId,
    roleCode: input.roleCode ?? 'campus_teacher',
    expireMinutes: input.expireMinutes ?? 24 * 60,
  };
}

export const campusInviteService = {
  preview: async (inviteCode: string): Promise<CampusInvitePreview> => {
    const data = await get<CampusInvitePreview>(
      `/campus-invites/code/${encodeURIComponent(inviteCode.trim().toUpperCase())}`,
      undefined,
      { skipAuth: true },
    );
    return {
      ...data,
      roleLabel: ROLE_LABEL[data.roleCode] ?? data.roleCode,
    };
  },

  create: async (input: CreateCampusInviteInput): Promise<CreateCampusInviteResult> => {
    const data = await post<CampusInviteItem>('/campus-invites', { ...input });
    return enrichInviteItem(data);
  },

  list: async (query?: ListCampusInvitesQuery): Promise<CampusInviteItem[]> => {
    const data = await get<PaginatedResponse<CampusInviteItem>>('/campus-invites', {
      page: query?.page ?? 1,
      pageSize: query?.pageSize ?? 20,
      status: query?.status,
      campusId: query?.campusId,
      roleCode: query?.roleCode,
    });
    return unwrapPaginatedList(data).map(enrichInviteItem);
  },

  accept: async (inviteCode: string): Promise<AcceptCampusInviteResult> => {
    const data = await post<AcceptCampusInviteResult>(
      `/campus-invites/${encodeURIComponent(inviteCode.trim().toUpperCase())}/accept`,
    );
    if (data.token && data.refreshToken && data.expiresIn) {
      persistTokens(data.token, data.refreshToken, data.expiresIn);
    }
    return data;
  },

  cancel: async (id: string, reason?: string): Promise<void> => {
    await post(`/campus-invites/${encodeURIComponent(id)}/cancel`, reason ? { reason } : undefined);
  },
};
