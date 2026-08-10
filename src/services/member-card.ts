/**
 * 会员卡记录 Service 层
 */
import {
  mockGetMemberCardById,
  mockGetMemberCardsByCardType,
  mockGetMemberCardsByStudent,
  mockIssueMemberCard,
  mockUpdateMemberCard,
} from '@/data/member-card';
import type { CardType } from '@/types/card-type';
import type { CardTypeStatKey, MemberCard, MemberCardDetail } from '@/types/member-card';

const USE_MOCK =
  typeof process !== 'undefined' && typeof process.env !== 'undefined'
    ? process.env.VITE_USE_MOCK !== 'false'
    : true;

export const memberCardService = {
  /** 根据卡种 ID 与统计维度获取会员卡列表 */
  getListByCardType: async (
    cardTypeId: string,
    stat: CardTypeStatKey,
  ): Promise<MemberCardDetail[]> => {
    if (!USE_MOCK) {
      // TODO: 联调时替换为真实 API
      // return await get<MemberCard[]>(`/card-types/${cardTypeId}/member-cards`, { stat });
    }
    return mockGetMemberCardsByCardType(cardTypeId, stat);
  },

  /** 根据学员 ID 获取会员卡列表 */
  getByStudent: async (studentId: string): Promise<MemberCardDetail[]> => {
    if (!USE_MOCK) {
      // TODO: 联调时替换为真实 API
      // return await get<MemberCardDetail[]>(`/students/${studentId}/member-cards`);
    }
    return mockGetMemberCardsByStudent(studentId);
  },

  /** 根据会员卡 ID 获取详情 */
  getById: async (id: string): Promise<MemberCardDetail | null> => {
    if (!USE_MOCK) {
      // TODO: 联调时替换为真实 API
      // return await get<MemberCardDetail | null>(`/member-cards/${id}`);
    }
    return mockGetMemberCardById(id);
  },

  /** 更新会员卡信息（编辑/停卡/退卡/转卡等状态变更） */
  update: async (id: string, data: Partial<MemberCardDetail>): Promise<MemberCardDetail | null> => {
    if (!USE_MOCK) {
      // TODO: 联调时替换为真实 API
      // return await put<MemberCardDetail | null>(`/member-cards/${id}`, data);
    }
    return mockUpdateMemberCard(id, data);
  },

  /** 为学员发放会员卡 */
  issue: async (
    data: Omit<
      MemberCard,
      'id' | 'status' | 'purchaseAt' | 'activatedAt' | 'expiredAt' | 'frozenCount' | 'frozenDays'
    > & {
      cardType: CardType;
    },
  ): Promise<MemberCardDetail> => {
    if (!USE_MOCK) {
      // TODO: 联调时替换为真实 API
      // return await post<MemberCardDetail>('/member-cards', data);
    }
    return mockIssueMemberCard(data);
  },
};
