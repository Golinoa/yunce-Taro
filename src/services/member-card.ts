/**
 * 会员卡记录 Service 层
 */
import { invalidatePackagesCache } from '@/services/student';
import type { CardType } from '@/types/card-type';
import type { CardTypeStatKey, MemberCard, MemberCardDetail } from '@/types/member-card';

export const memberCardService = {
  /** 根据卡种 ID 与统计维度获取会员卡列表 */
  getListByCardType: async (
    _cardTypeId: string,
    _stat: CardTypeStatKey,
  ): Promise<MemberCardDetail[]> => {
    // TODO: real API
    return [];
  },

  /** 根据学员 ID 获取会员卡列表 */
  getByStudent: async (_studentId: string): Promise<MemberCardDetail[]> => {
    return [];
  },

  /** 根据会员卡 ID 获取详情 */
  getById: async (_id: string): Promise<MemberCardDetail | null> => {
    return null;
  },

  /** 更新会员卡信息（编辑/停卡/退卡/转卡等状态变更） */
  update: async (
    _id: string,
    _data: Partial<MemberCardDetail>,
  ): Promise<MemberCardDetail | null> => {
    // TODO: 联调时替换为真实 API
    return null;
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
    // TODO: 联调时替换为真实 API
    invalidatePackagesCache(data.studentId);
    throw new Error('[接口未接通] member-card.issue 待后端契约后接入');
  },

  /** 划扣欠课（P1，2026-08-22）：从该卡关联课包剩余课时抵扣欠课，返回未抵完课时 */
  deductDebt: async (_cardId: string, _hours: number): Promise<number> => {
    // TODO: 联调时替换为真实 API
    return 0;
  },
};
