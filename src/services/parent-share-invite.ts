/**
 * 员工拉家长临时邀请 Service
 *
 * - POST /teachers/me/parent-share-invites  创建 24h 临时码
 * - GET  /teachers/me/share-invite          最近待使用码 + 统计
 * - GET  /teachers/me/wxacode?inviteCode=   小程序码（可选先 create）
 */
import { get, post } from '@/utils/request';

export type ShareInviteViewStatus = 'pending' | 'expired' | 'used' | 'invalid';

export interface ParentShareInviteItem {
  id: string;
  inviteCode: string;
  status: string;
  expireAt: string;
  usedAt?: string | null;
  usedByUserId?: string | null;
  createdAt?: string;
  landingPath: string;
}

export interface CreateParentShareInviteResult {
  id: string;
  inviteCode: string;
  expireAt: string;
  status: string;
  landingPath: string;
  organizationId: string;
  organizationName: string;
  campusId: string | null;
  campusName: string | null;
  teacherId: string;
  teacherName: string;
}

export interface MyShareInviteResult {
  teacherId: string;
  teacherName: string;
  organizationId: string;
  organizationName: string;
  campusId: string | null;
  campusName: string | null;
  latestPendingInvite: ParentShareInviteItem | null;
  landingPath: string | null;
  inviteCode: string | null;
  wxacodeScene: string | null;
  stats: { total: number; lead: number; member: number };
}

export interface WxacodeResult {
  scene: string;
  page: string;
  inviteCode: string;
  imageBase64: string;
  landingPath: string;
}

export const parentShareInviteService = {
  create: async (): Promise<CreateParentShareInviteResult> => {
    return post<CreateParentShareInviteResult>('/teachers/me/parent-share-invites', {});
  },

  getMyShareInvite: async (): Promise<MyShareInviteResult> => {
    return get<MyShareInviteResult>('/teachers/me/share-invite');
  },

  getWxacode: async (inviteCode?: string): Promise<WxacodeResult> => {
    return get<WxacodeResult>('/teachers/me/wxacode', inviteCode ? { inviteCode } : undefined);
  },
};
