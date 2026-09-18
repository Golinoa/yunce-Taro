/**
 * 员工招生码（固定家长邀请码）Service
 *
 * - GET /teachers/me/share-invite  教师固定招生码 + 统计
 * - GET /teachers/me/wxacode?inviteCode=  小程序码（传固定码）
 *
 * 注：旧临时码字段（latestPendingInvite/landingPath/inviteCode/wxacodeScene）与
 *     创建接口已按已决 #2/#3 移除；固定码长期有效、可多人复用。
 */
import { get } from '@/utils/request';

export interface MyShareInviteResult {
  teacherId: string;
  teacherName: string;
  organizationId: string;
  organizationName: string;
  campusId: string | null;
  campusName: string | null;
  /** 教师固定招生码（③ 类，永久有效、可多人复用） */
  parentInviteCode: string;
  parentInviteLandingPath: string;
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
  getMyShareInvite: async (): Promise<MyShareInviteResult> => {
    return get<MyShareInviteResult>('/teachers/me/share-invite');
  },

  getWxacode: async (inviteCode?: string): Promise<WxacodeResult> => {
    return get<WxacodeResult>('/teachers/me/wxacode', inviteCode ? { inviteCode } : undefined);
  },
};
