/**
 * Member card records — real API under /card-types/member-cards*
 */
import { invalidatePackagesCache } from '@/services/student';
import type { CardType } from '@/types/card-type';
import type { CardTypeStatKey, MemberCard, MemberCardDetail } from '@/types/member-card';
import { asPaginatedResponse, type PaginatedResponse } from '@/utils/pagination';
import { del, get, post, put } from '@/utils/request';

type BackendMemberCard = MemberCardDetail & Record<string, unknown>;

function mapCard(raw: BackendMemberCard): MemberCardDetail {
  return {
    id: String(raw.id),
    cardTypeId: String(raw.cardTypeId),
    cardTypeName: String(raw.cardTypeName ?? ''),
    studentId: String(raw.studentId),
    studentName: String(raw.studentName ?? ''),
    studentAvatar: raw.studentAvatar ? String(raw.studentAvatar) : undefined,
    studentPhone: raw.studentPhone ? String(raw.studentPhone) : undefined,
    status: (raw.status as MemberCardDetail['status']) || 'active',
    remainingCount: raw.remainingCount != null ? Number(raw.remainingCount) : undefined,
    remainingDays: raw.remainingDays != null ? Number(raw.remainingDays) : undefined,
    remainingAmount: raw.remainingAmount != null ? Number(raw.remainingAmount) : undefined,
    purchaseAt: String(raw.purchaseAt ?? ''),
    activatedAt: raw.activatedAt ? String(raw.activatedAt) : undefined,
    expiredAt: raw.expiredAt ? String(raw.expiredAt) : undefined,
    frozenCount: Number(raw.frozenCount ?? 0),
    frozenDays: Number(raw.frozenDays ?? 0),
    purchasePrice: Number(raw.purchasePrice ?? 0),
    source: raw.source ? String(raw.source) : undefined,
    operatorId: raw.operatorId ? String(raw.operatorId) : undefined,
    operatorName: raw.operatorName ? String(raw.operatorName) : undefined,
    operatorAvatar: raw.operatorAvatar ? String(raw.operatorAvatar) : undefined,
    cardNo: raw.cardNo ? String(raw.cardNo) : undefined,
    remark: raw.remark ? String(raw.remark) : undefined,
    cardTypeKind: (raw.cardTypeKind as MemberCardDetail['cardTypeKind']) || 'count',
    cardTypeCount: raw.cardTypeCount != null ? Number(raw.cardTypeCount) : undefined,
    cardTypeValidDays: Number(raw.cardTypeValidDays ?? 0),
    cardTypeFreezeCount: Number(raw.cardTypeFreezeCount ?? 0),
    cardTypeFreezeDays: Number(raw.cardTypeFreezeDays ?? 0),
    cardPermission: raw.cardPermission ? String(raw.cardPermission) : undefined,
    campusName: raw.campusName ? String(raw.campusName) : undefined,
    totalGiftCount: raw.totalGiftCount != null ? Number(raw.totalGiftCount) : undefined,
    remainingGiftCount: raw.remainingGiftCount != null ? Number(raw.remainingGiftCount) : undefined,
    consumedValue: raw.consumedValue != null ? Number(raw.consumedValue) : undefined,
  };
}

export const memberCardService = {
  getListByCardType: async (
    cardTypeId: string,
    stat: CardTypeStatKey,
  ): Promise<MemberCardDetail[]> => {
    const list = await get<BackendMemberCard[]>(`/card-types/${cardTypeId}/member-cards`, {
      cardTypeId,
      stat,
    });
    return (Array.isArray(list) ? list : []).map(mapCard);
  },

  getByStudent: async (studentId: string): Promise<MemberCardDetail[]> => {
    const list = await get<BackendMemberCard[]>(`/students/${studentId}/member-cards`);
    return (Array.isArray(list) ? list : []).map(mapCard);
  },

  getById: async (id: string): Promise<MemberCardDetail | null> => {
    try {
      const raw = await get<BackendMemberCard>(`/card-types/member-cards/${id}`);
      return mapCard(raw);
    } catch {
      return null;
    }
  },

  list: async (params?: {
    page?: number;
    pageSize?: number;
    cardTypeId?: string;
    studentId?: string;
    status?: string;
  }): Promise<{ list: MemberCardDetail[]; total: number }> => {
    const data = await get<unknown>('/card-types/member-cards/list', {
      page: params?.page ?? 1,
      pageSize: params?.pageSize ?? 50,
      ...(params?.cardTypeId ? { cardTypeId: params.cardTypeId } : {}),
      ...(params?.studentId ? { studentId: params.studentId } : {}),
      ...(params?.status ? { status: params.status } : {}),
    });
    const page = asPaginatedResponse<BackendMemberCard>(
      data as PaginatedResponse<BackendMemberCard> | BackendMemberCard[] | null,
      params?.page ?? 1,
      params?.pageSize ?? 50,
    );
    return { list: page.list.map(mapCard), total: page.pagination?.total ?? page.list.length };
  },

  update: async (id: string, data: Partial<MemberCardDetail>): Promise<MemberCardDetail | null> => {
    const body: Record<string, unknown> = {};
    if (data.status !== undefined) body.status = data.status;
    if (data.frozenCount !== undefined) body.frozenCount = data.frozenCount;
    if (data.frozenDays !== undefined) body.frozenDays = data.frozenDays;
    if (data.remark !== undefined) body.remark = data.remark;
    await put(`/card-types/member-cards/${id}`, body);
    return memberCardService.getById(id);
  },

  issue: async (
    data: Omit<
      MemberCard,
      'id' | 'status' | 'purchaseAt' | 'activatedAt' | 'expiredAt' | 'frozenCount' | 'frozenDays'
    > & {
      cardType: CardType;
    },
  ): Promise<MemberCardDetail> => {
    const created = await post<BackendMemberCard>('/card-types/member-cards', {
      cardTypeId: data.cardTypeId || data.cardType.id,
      studentId: data.studentId,
      purchasePrice: data.purchasePrice ?? 0,
      source: data.source,
      remark: data.remark,
      cardNo: data.cardNo,
      totalGiftCount: (data as { totalGiftCount?: number }).totalGiftCount ?? 0,
    });
    invalidatePackagesCache(data.studentId);
    // Issue returns raw row; refetch detail for FE shape
    const detail = await memberCardService.getById(String(created.id));
    if (detail) return detail;
    return mapCard({
      ...created,
      cardTypeName: data.cardType.name,
      studentName: data.studentName || '',
      cardTypeKind: data.cardType.kind,
      cardTypeValidDays: data.cardType.validDays ?? 0,
      cardTypeFreezeCount: data.cardType.freezeCount ?? 0,
      cardTypeFreezeDays: data.cardType.freezeDays ?? 0,
      frozenCount: 0,
      frozenDays: 0,
      purchaseAt: String(created.purchaseAt ?? new Date().toISOString()),
    } as BackendMemberCard);
  },

  freeze: async (id: string): Promise<MemberCardDetail | null> => {
    await post(`/card-types/member-cards/${id}/freeze`);
    return memberCardService.getById(id);
  },

  unfreeze: async (id: string): Promise<MemberCardDetail | null> => {
    await post(`/card-types/member-cards/${id}/unfreeze`);
    return memberCardService.getById(id);
  },

  remove: async (id: string): Promise<boolean> => {
    await del(`/card-types/member-cards/${id}`);
    return true;
  },
};
