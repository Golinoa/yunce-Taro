/**
 * 会员卡记录 Service 层
 */
import { invalidatePackagesCache } from '@/services/student';
import type { CardType } from '@/types/card-type';
import { loadMemberCardMock } from '@/utils/mock-loaders';
import { isUseMock } from '@/utils/build-env';
import type { CardTypeStatKey, MemberCard, MemberCardDetail } from '@/types/member-card';

export const memberCardService = {
  /** 根据卡种 ID 与统计维度获取会员卡列表 */
  getListByCardType: async (
    cardTypeId: string,
    stat: CardTypeStatKey,
  ): Promise<MemberCardDetail[]> => {
        if (!isUseMock()) {
      // TODO: real API
    }
    const { mockGetMemberCardsByCardType } = await loadMemberCardMock();
    return mockGetMemberCardsByCardType(cardTypeId, stat);
  },

  /** 根据学员 ID 获取会员卡列表 */
  getByStudent: async (studentId: string): Promise<MemberCardDetail[]> => {
        if (!isUseMock()) {
      return [];
    }
    const { mockGetMemberCardsByStudent } = await loadMemberCardMock();
    return mockGetMemberCardsByStudent(studentId);
  },

  /** 根据会员卡 ID 获取详情 */
  getById: async (id: string): Promise<MemberCardDetail | null> => {
        if (!isUseMock()) {
      return null;
    }
    const { mockGetMemberCardById } = await loadMemberCardMock();
    return mockGetMemberCardById(id);
  },

  /** 更新会员卡信息（编辑/停卡/退卡/转卡等状态变更） */
  update: async (id: string, data: Partial<MemberCardDetail>): Promise<MemberCardDetail | null> => {
    if (!isUseMock()) {
      // TODO: 联调时替换为真实 API
      // return await put<MemberCardDetail | null>(`/member-cards/${id}`, data);
    }
    const { mockUpdateMemberCard } = await loadMemberCardMock();
    const updated = await mockUpdateMemberCard(id, data);
    // 次卡剩余次数调整会联动学员课包课时，失效该学员缓存
    if (updated) invalidatePackagesCache(updated.studentId);
    return updated;
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
    if (!isUseMock()) {
      // TODO: 联调时替换为真实 API
      // return await post<MemberCardDetail>('/member-cards', data);
    }
    const { mockIssueMemberCard } = await loadMemberCardMock();
    const created = await mockIssueMemberCard(data);
    // 发卡可能同步创建学员课包，失效该学员缓存
    invalidatePackagesCache(data.studentId);
    return created;
  },

  /** 划扣欠课（P1，2026-08-22）：从该卡关联课包剩余课时抵扣欠课，返回未抵完课时 */
  deductDebt: async (cardId: string, hours: number): Promise<number> => {
    if (!isUseMock()) {
      // TODO: 联调时替换为真实 API
      // return await post<number>(`/member-cards/${cardId}/deduct-debt`, { hours });
    }
    const { deductCardDebtHours } = await loadMemberCardMock();
    return deductCardDebtHours(cardId, hours);
  },
};
