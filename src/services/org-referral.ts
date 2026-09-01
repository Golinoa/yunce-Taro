/**
 * L4 门店互邀 API
 */
import { get } from '@/utils/request';

export interface OrgReferralPreview {
  inviteCode: string;
  organizationId: string;
  organizationName: string;
  organizationLogo: string | null;
  landingPath: string;
  inviteStatus: 'valid';
}

export interface MyOrgReferral {
  inviteCode: string;
  organizationId: string;
  organizationName: string;
  landingPath: string;
}

export const orgReferralService = {
  preview: (inviteCode: string) =>
    get<OrgReferralPreview>(`/org-referrals/code/${encodeURIComponent(inviteCode.trim().toUpperCase())}`),

  getMine: () => get<MyOrgReferral>('/org-referrals/me'),
};
