/** 卡种 Service：对接后端 /card-types 契约。 */
import type { CardType, CardTypeFormData, CardTypeStatus } from '@/types/card-type';
import { asPaginatedResponse, formatApiDateTime, type PaginatedResponse } from '@/utils/pagination';
import { del, get, patch, post, put } from '@/utils/request';

type BackendCardType = Record<string, unknown>;

function mapCardType(raw: BackendCardType): CardType {
  const stats = (raw.stats && typeof raw.stats === 'object' ? raw.stats : {}) as Record<
    string,
    unknown
  >;
  return {
    id: String(raw.id ?? ''),
    name: String(raw.name ?? ''),
    kind: (raw.kind as CardType['kind']) ?? 'count',
    status: (raw.status as CardTypeStatus) ?? 'active',
    scopes: Array.isArray(raw.scopes) ? (raw.scopes as CardType['scopes']) : ['course'],
    bookingMethod: (raw.bookingMethod as CardType['bookingMethod']) ?? 'course',
    categoryIds: Array.isArray(raw.categoryIds) ? raw.categoryIds.map(String) : [],
    count: raw.count == null ? undefined : Number(raw.count),
    validDays: Number(raw.validDays ?? 0),
    price: Number(raw.price ?? 0),
    freezeCount: Number(raw.freezeCount ?? 0),
    freezeDays: Number(raw.freezeDays ?? 0),
    benefits: raw.benefits ? String(raw.benefits) : undefined,
    cardCategory: (raw.cardCategory as CardType['cardCategory']) ?? 'formal',
    renewalPrice: raw.renewalPrice == null ? undefined : Number(raw.renewalPrice),
    dailyMaxBookings: Number(raw.dailyMaxBookings ?? 0),
    weeklyMaxBookings: Number(raw.weeklyMaxBookings ?? 0),
    monthlyMaxBookings: Number(raw.monthlyMaxBookings ?? 0),
    freeCancelCount: Number(raw.freeCancelCount ?? 0),
    advanceBookingMinutes: Number(raw.advanceBookingMinutes ?? 0),
    availableWeekdays: Array.isArray(raw.availableWeekdays)
      ? raw.availableWeekdays.map(Number)
      : [],
    isGiftCard: Boolean(raw.isGiftCard),
    allowTransfer: Boolean(raw.allowTransfer),
    usageLimit: Number(raw.usageLimit ?? 0),
    commissionCalc: String(raw.commissionCalc ?? ''),
    backgroundImage: raw.backgroundImage ? String(raw.backgroundImage) : undefined,
    stats: {
      sold: Number(stats.sold ?? 0),
      inUse: Number(stats.inUse ?? 0),
      usedUp: Number(stats.usedUp ?? 0),
      notActivated: Number(stats.notActivated ?? 0),
      frozen: Number(stats.frozen ?? 0),
      activeMembers: Number(stats.activeMembers ?? 0),
    },
    campusCount: raw.campusCount == null ? undefined : Number(raw.campusCount),
    createdAt: formatApiDateTime(raw.createdAt),
    updatedAt: formatApiDateTime(raw.updatedAt),
  };
}

function toBackendCardType(
  data: CardTypeFormData | Partial<CardTypeFormData>,
): Record<string, unknown> {
  const fields = [
    'name',
    'kind',
    'status',
    'scopes',
    'bookingMethod',
    'categoryIds',
    'count',
    'validDays',
    'price',
    'freezeCount',
    'freezeDays',
    'benefits',
    'cardCategory',
    'renewalPrice',
    'dailyMaxBookings',
    'weeklyMaxBookings',
    'monthlyMaxBookings',
    'freeCancelCount',
    'advanceBookingMinutes',
    'availableWeekdays',
    'isGiftCard',
    'allowTransfer',
    'usageLimit',
    'commissionCalc',
    'backgroundImage',
  ] as const;
  const body: Record<string, unknown> = {};
  for (const field of fields) {
    if (data[field] !== undefined) body[field] = data[field];
  }
  return body;
}

export const cardTypeService = {
  getList: async (): Promise<CardType[]> => {
    const data = await get<PaginatedResponse<BackendCardType> | BackendCardType[]>('/card-types', {
      page: 1,
      pageSize: 100,
    });
    return asPaginatedResponse(data, 1, 100).list.map(mapCardType);
  },

  getById: async (id: string): Promise<CardType | null> => {
    return mapCardType(await get<BackendCardType>(`/card-types/${id}`));
  },

  create: async (data: CardTypeFormData): Promise<CardType> =>
    mapCardType(await post<BackendCardType>('/card-types', toBackendCardType(data))),

  update: async (id: string, data: Partial<CardTypeFormData>): Promise<CardType> =>
    mapCardType(await put<BackendCardType>(`/card-types/${id}`, toBackendCardType(data))),

  toggleStatus: async (id: string, status: CardTypeStatus): Promise<CardType> =>
    mapCardType(await patch<BackendCardType>(`/card-types/${id}/status`, { status })),

  remove: async (id: string): Promise<void> => {
    await del(`/card-types/${id}`);
  },
};
