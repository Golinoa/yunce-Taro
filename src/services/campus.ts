/**
 * Service 层 — 校区相关 API
 */
import type {
  CampusUIModel,
  CampusFormData,
  SalaryModel,
  PayDaySettings,
  Holiday,
  BusinessHours,
  NotifyGroup,
  CampusOperationalData,
  Subject,
  SubjectFormData,
  Venue,
  VenueFormData,
  Room,
  RoomFormData,
  CampusType,
  PartnerMode,
} from '@/types/campus';
import { get, post, put } from '@/utils/request';
import { notWired } from '@/utils/not-wired';
import {
  API_PAGE_SIZE_BATCH,
  asPaginatedResponse,
  fetchAllPages,
  type PaginatedResponse,
} from '@/utils/pagination';

interface BackendNotifySettingItem {
  enabled: boolean;
  group: string;
  id: string;
  label: string;
  sub?: null | string;
}

const NOTIFY_GROUP_TITLE_MAP: Record<string, string> = {
  parent: '????',
  student: '????',
  student_parent: '????',
  teacher: '????',
  default: '????',
};

function mapNotifyGroupTitle(group: string): string {
  return NOTIFY_GROUP_TITLE_MAP[group] || group || '????';
}

function mapBackendNotifySettings(list: BackendNotifySettingItem[]): NotifyGroup[] {
  const grouped = new Map<string, NotifyGroup>();

  list.forEach((item) => {
    const key = item.group || 'default';
    const existing = grouped.get(key);
    const nextItem = {
      id: item.id,
      label: item.label,
      sub: item.sub || undefined,
      enabled: item.enabled,
    };

    if (existing) {
      existing.items.push(nextItem);
      return;
    }

    grouped.set(key, {
      title: mapNotifyGroupTitle(key),
      items: [nextItem],
    });
  });

  return Array.from(grouped.values());
}

interface BackendCampusItem {
  address?: null | string;
  icon?: string;
  iconGradient?: string;
  id: string;
  isMain?: boolean;
  monthlyRent?: number;
  name: string;
  partnerMode?: null | string;
  phone?: null | string;
  rentDueDay?: number;
  type?: string;
  hoursAlertThreshold?: number;
  daysAlertThreshold?: number;
  amountAlertThreshold?: number;
}

function mapBackendCampus(raw: BackendCampusItem): CampusUIModel {
  const campusType: CampusType =
    raw.type === 'main' || raw.type === 'self' || raw.type === 'partner' ? raw.type : 'self';

  return {
    id: raw.id,
    name: raw.name,
    type: campusType,
    phone: raw.phone || '',
    address: raw.address || '',
    icon: raw.icon || '🏫',
    iconGradient: raw.iconGradient || 'from-blue-400 to-blue-600',
    isMain: Boolean(raw.isMain),
    monthlyRent: raw.monthlyRent ?? 0,
    rentDueDay: raw.rentDueDay ?? 1,
    partnerMode: raw.partnerMode as PartnerMode | undefined,
    stats: { students: 0, teachers: 0, revenue: 0, revenueUnit: '' },
    businessCategories: [],
    tags: [],
    hoursAlertThreshold:
      typeof raw.hoursAlertThreshold === 'number' ? raw.hoursAlertThreshold : 5,
    daysAlertThreshold: typeof raw.daysAlertThreshold === 'number' ? raw.daysAlertThreshold : 7,
    amountAlertThreshold:
      typeof raw.amountAlertThreshold === 'number' ? raw.amountAlertThreshold : 200,
  };
}

// ============================================
// ?? Service
// ============================================
export const campusService = {
  /** 校区列表（分批拉全） */
  getList: async (): Promise<CampusUIModel[]> => {
    
    const list = await fetchAllPages(async (page, pageSize) => {
      const data = await get<PaginatedResponse<BackendCampusItem>>('/campuses', {
        page,
        pageSize,
      });
      return asPaginatedResponse(data, page, pageSize);
    }, API_PAGE_SIZE_BATCH);
    return list.map(mapBackendCampus);
  },

  /** 按 ID 获取校区 */
  getById: async (id: string): Promise<CampusUIModel | null> => {
        try {
      const raw = await get<BackendCampusItem>(`/campuses/${id}`);
      return mapBackendCampus(raw);
    } catch {
      return null;
    }
  },

  /** 新增校区 */
  add: async (data: CampusFormData): Promise<CampusUIModel> => {
    const raw = await post<BackendCampusItem>('/campuses', {
      ...data,
      hoursAlertThreshold: data.hoursAlertThreshold ?? 5,
      daysAlertThreshold: data.daysAlertThreshold ?? 7,
      amountAlertThreshold: data.amountAlertThreshold ?? 200,
    });
    return mapBackendCampus(raw);
  },

  /** 更新校区 */
  update: async (id: string, data: Partial<CampusFormData>): Promise<CampusUIModel | null> => {
        const raw = await put<BackendCampusItem>(`/campuses/${id}`, data);
    return mapBackendCampus(raw);
  },

  /** 删除校区 */
  delete: async (_id: string): Promise<boolean> => notWired('DELETE /campuses/:id'),

  /** 设为主校区 */
  setMain: async (_id: string): Promise<boolean> => notWired('POST /campuses/:id/set-main'),
};

// ============================================
// ???? Service
// ============================================
export const salaryModelCampusService = {
  getList: async (): Promise<SalaryModel[]> => [],

  create: async (_model: Omit<SalaryModel, 'id' | 'teacherCount'>): Promise<SalaryModel> =>
    notWired('POST /salary-models'),

  update: async (_id: string, _updates: Partial<SalaryModel>): Promise<SalaryModel | null> =>
    notWired('PUT /salary-models/:id'),

  delete: async (_id: string): Promise<boolean> => notWired('DELETE /salary-models/:id'),
};

export const payDaySettingsService = {
  get: async (): Promise<PayDaySettings> => notWired('GET /pay-day-settings'),

  update: async (_updates: Partial<PayDaySettings>): Promise<PayDaySettings> =>
    notWired('PUT /pay-day-settings'),
};

export const holidayService = {
  getList: async (): Promise<Holiday[]> => [],

  add: async (_holiday: Omit<Holiday, 'id'>): Promise<Holiday> => notWired('POST /holidays'),

  update: async (_id: string, _updates: Partial<Holiday>): Promise<Holiday | null> =>
    notWired('PUT /holidays/:id'),

  delete: async (_id: string): Promise<boolean> => notWired('DELETE /holidays/:id'),

  clearAll: async (): Promise<boolean> => notWired('DELETE /holidays'),

  generateStatutory: async (_year?: number): Promise<number> => notWired('POST /holidays/generate-statutory'),
};

export const businessHoursService = {
  get: async (): Promise<BusinessHours> => notWired('GET /business-hours'),

  update: async (_updates: Partial<BusinessHours>): Promise<BusinessHours> =>
    notWired('PUT /business-hours'),
};

// ============================================
// ???? Service
// ============================================
export const notifyService = {
  /** ?????? */
  getList: async (): Promise<NotifyGroup[]> => {
    
      const list = await get<BackendNotifySettingItem[]>('/notify-settings');
      return mapBackendNotifySettings(list);
      },

  /** ??????? */
  toggle: async (itemId: string): Promise<NotifyGroup[]> => {
    
      const currentGroups = await notifyService.getList();
      const target = currentGroups
        .flatMap((group) => group.items)
        .find((item) => item.id === itemId);
      if (!target) {
        throw new Error('???????');
      }

      await put(`/notify-settings/${itemId}`, {
        enabled: !target.enabled,
      });

      return notifyService.getList();
      },
};

// ============================================
// ???? Service
// ============================================
export const campusDataService = {
  get: async (_campusId: string): Promise<CampusOperationalData | null> => null,
};

export const subjectService = {
  getList: async (): Promise<Subject[]> => [],
  getById: async (_id: string): Promise<Subject | null> => null,
  add: async (_data: SubjectFormData): Promise<Subject> => notWired('POST /subjects'),
  update: async (_id: string, _data: Partial<SubjectFormData>): Promise<Subject | null> =>
    notWired('PUT /subjects/:id'),
  delete: async (_id: string): Promise<boolean> => notWired('DELETE /subjects/:id'),
};

export const venueService = {
  getList: async (_campusId?: string): Promise<Venue[]> => [],
  getById: async (_id: string): Promise<Venue | null> => null,
  add: async (_data: VenueFormData): Promise<Venue> => notWired('POST /venues'),
  update: async (_id: string, _data: Partial<VenueFormData>): Promise<Venue | null> =>
    notWired('PUT /venues/:id'),
  delete: async (_id: string): Promise<boolean> => notWired('DELETE /venues/:id'),
};

export const roomService = {
  getList: async (_options?: { campusId?: string; venueId?: string }): Promise<Room[]> => [],
  getById: async (_id: string): Promise<Room | null> => null,
  add: async (_data: RoomFormData): Promise<Room> => notWired('POST /rooms'),
  update: async (_id: string, _data: Partial<RoomFormData>): Promise<Room | null> =>
    notWired('PUT /rooms/:id'),
  delete: async (_id: string): Promise<boolean> => notWired('DELETE /rooms/:id'),
};

