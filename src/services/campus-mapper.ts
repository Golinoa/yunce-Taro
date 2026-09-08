/**
 * Campus API → UI 映射（纯函数，便于单测）
 */
import type { SelectedBusinessCategory } from '@/constants/business-categories';
import type { CampusType, CampusUIModel, PartnerMode } from '@/types/campus';

export interface BackendCampusItem {
  address?: null | string;
  amountAlertThreshold?: number;
  businessCategories?: SelectedBusinessCategory[] | null;
  businessHours?: string | null;
  contactName?: null | string;
  daysAlertThreshold?: number;
  environmentImages?: string[] | null;
  hoursAlertThreshold?: number;
  icon?: string;
  iconGradient?: string;
  id: string;
  intro?: null | string;
  isMain?: boolean;
  latitude?: null | number;
  licenseName?: null | string;
  locationName?: null | string;
  logo?: null | string;
  longitude?: null | number;
  monthlyRent?: number;
  name: string;
  partnerMode?: null | string;
  phone?: null | string;
  region?: null | string;
  rentDueDay?: number;
  tags?: string[] | null;
  type?: string;
}

export function mapCampusTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((t): t is string => typeof t === 'string')
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .slice(0, 4)
    .map((t) => t.slice(0, 5));
}

export function mapBusinessCategories(raw: unknown): SelectedBusinessCategory[] {
  if (!Array.isArray(raw)) return [];
  const result: SelectedBusinessCategory[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    const categoryId = typeof row.categoryId === 'string' ? row.categoryId.trim() : '';
    if (!categoryId) continue;
    const subIds = Array.isArray(row.subIds)
      ? row.subIds
          .filter((id): id is string => typeof id === 'string')
          .map((id) => id.trim())
          .filter(Boolean)
          .slice(0, 20)
      : [];
    result.push({ categoryId, subIds });
    if (result.length >= 20) break;
  }
  return result;
}

export function mapBackendCampus(raw: BackendCampusItem): CampusUIModel {
  const campusType: CampusType =
    raw.type === 'main' || raw.type === 'self' || raw.type === 'partner' ? raw.type : 'self';

  const environmentImages = Array.isArray(raw.environmentImages)
    ? raw.environmentImages.filter((u): u is string => typeof u === 'string' && u.length > 0)
    : [];

  return {
    id: raw.id,
    name: raw.name,
    logo: raw.logo || undefined,
    licenseName: raw.licenseName || undefined,
    contactName: raw.contactName || undefined,
    region: raw.region || undefined,
    intro: raw.intro || undefined,
    type: campusType,
    phone: raw.phone || '',
    address: raw.address || '',
    locationName: raw.locationName || undefined,
    latitude: typeof raw.latitude === 'number' ? raw.latitude : undefined,
    longitude: typeof raw.longitude === 'number' ? raw.longitude : undefined,
    icon: raw.icon || '🏫',
    iconGradient: raw.iconGradient || 'from-blue-400 to-blue-600',
    isMain: Boolean(raw.isMain),
    monthlyRent: raw.monthlyRent ?? 0,
    rentDueDay: raw.rentDueDay ?? 1,
    partnerMode: raw.partnerMode as PartnerMode | undefined,
    stats: { students: 0, teachers: 0, revenue: 0, revenueUnit: '' },
    businessCategories: mapBusinessCategories(raw.businessCategories),
    tags: mapCampusTags(raw.tags),
    /** 前端沿用 venueImages；后端字段为 environmentImages */
    venueImages: environmentImages,
    hoursAlertThreshold: typeof raw.hoursAlertThreshold === 'number' ? raw.hoursAlertThreshold : 5,
    daysAlertThreshold: typeof raw.daysAlertThreshold === 'number' ? raw.daysAlertThreshold : 7,
    amountAlertThreshold:
      typeof raw.amountAlertThreshold === 'number' ? raw.amountAlertThreshold : 200,
    businessHours: raw.businessHours || undefined,
  };
}
