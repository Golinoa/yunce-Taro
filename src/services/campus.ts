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
import { notWired } from '@/utils/not-wired';
import {
  API_PAGE_SIZE_BATCH,
  asPaginatedResponse,
  fetchAllPages,
  type PaginatedResponse,
} from '@/utils/pagination';
import { del, get, post, put } from '@/utils/request';

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
  businessHours?: string | null;
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
    hoursAlertThreshold: typeof raw.hoursAlertThreshold === 'number' ? raw.hoursAlertThreshold : 5,
    daysAlertThreshold: typeof raw.daysAlertThreshold === 'number' ? raw.daysAlertThreshold : 7,
    amountAlertThreshold:
      typeof raw.amountAlertThreshold === 'number' ? raw.amountAlertThreshold : 200,
    businessHours: raw.businessHours || undefined,
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
  delete: async (id: string): Promise<boolean> => {
    await del(`/campuses/${id}`);
    return true;
  },

  /** 设为主校区 */
  setMain: async (id: string): Promise<boolean> => {
    await put(`/campuses/${id}/set-main`);
    return true;
  },
};

// ============================================
// Salary / holidays / business hours
// ============================================
export const salaryModelCampusService = {
  getList: async (): Promise<SalaryModel[]> => {
    const list = await get<SalaryModel[]>('/teachers/salary-models');
    return Array.isArray(list) ? list : [];
  },

  create: async (model: Omit<SalaryModel, 'id' | 'teacherCount'>): Promise<SalaryModel> => {
    return post<SalaryModel>('/teachers/salary-models', {
      name: model.name,
      type: model.type,
      base: model.base,
      rate: model.rate,
      attend: model.attend,
      perf: model.perf,
      isDefault: model.isDefault ?? false,
    });
  },

  update: async (id: string, updates: Partial<SalaryModel>): Promise<SalaryModel | null> => {
    return put<SalaryModel>(`/teachers/salary-models/${id}`, updates);
  },

  delete: async (id: string): Promise<boolean> => {
    await del(`/teachers/salary-models/${id}`);
    return true;
  },
};

export const payDaySettingsService = {
  get: async (): Promise<PayDaySettings> => {
    const raw = await get<{ payDay?: number }>('/statistics/pay-day-settings');
    return {
      mode: 'fixed',
      fixedDay: Number(raw?.payDay ?? 15),
    };
  },

  update: async (updates: Partial<PayDaySettings>): Promise<PayDaySettings> => {
    const payDay = updates.fixedDay ?? 15;
    await put('/statistics/pay-day-settings', { payDay });
    return { mode: 'fixed', fixedDay: payDay };
  },
};

function mapHoliday(raw: Record<string, unknown>): Holiday {
  const statusRaw = String(raw.status ?? 'rest');
  return {
    id: String(raw.id),
    name: String(raw.name ?? ''),
    icon: String(raw.icon ?? '🎉'),
    startDate: String(raw.startDate ?? raw.start_date ?? ''),
    endDate: String(raw.endDate ?? raw.end_date ?? ''),
    status: statusRaw === 'work' || statusRaw === 'adjust' ? 'adjust' : 'rest',
  };
}

export const holidayService = {
  getList: async (): Promise<Holiday[]> => {
    const data = await get<unknown>('/holidays', { page: 1, pageSize: 100 });
    const page = asPaginatedResponse<Record<string, unknown>>(
      data as PaginatedResponse<Record<string, unknown>> | Record<string, unknown>[] | null,
      1,
      100,
    );
    if (page.list.length) return page.list.map(mapHoliday);
    if (Array.isArray(data)) return (data as Record<string, unknown>[]).map(mapHoliday);
    return [];
  },

  add: async (holiday: Omit<Holiday, 'id'>): Promise<Holiday> => {
    const raw = await post<Record<string, unknown>>('/holidays', {
      name: holiday.name,
      icon: holiday.icon || '🎉',
      startDate: holiday.startDate,
      endDate: holiday.endDate,
      type: 'custom',
      status: holiday.status === 'adjust' ? 'work' : 'rest',
    });
    return mapHoliday(raw);
  },

  update: async (id: string, updates: Partial<Holiday>): Promise<Holiday | null> => {
    const body: Record<string, unknown> = {};
    if (updates.name !== undefined) body.name = updates.name;
    if (updates.icon !== undefined) body.icon = updates.icon;
    if (updates.startDate !== undefined) body.startDate = updates.startDate;
    if (updates.endDate !== undefined) body.endDate = updates.endDate;
    if (updates.status !== undefined) body.status = updates.status === 'adjust' ? 'work' : 'rest';
    const raw = await put<Record<string, unknown>>(`/holidays/${id}`, body);
    return mapHoliday(raw);
  },

  delete: async (id: string): Promise<boolean> => {
    await del(`/holidays/${id}`);
    return true;
  },

  clearAll: async (): Promise<boolean> => {
    await del('/holidays');
    return true;
  },

  generateStatutory: async (year?: number): Promise<number> => {
    const raw = await post<{ created?: number }>('/holidays/generate-statutory', {
      ...(year != null ? { year } : {}),
    });
    return Number(raw?.created ?? 0);
  },
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
    const target = currentGroups.flatMap((group) => group.items).find((item) => item.id === itemId);
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
  getList: async (): Promise<Subject[]> => {
    const data = await get<unknown>('/subjects');
    if (Array.isArray(data)) return data as Subject[];
    const page = asPaginatedResponse<Subject>(
      data as PaginatedResponse<Subject> | Subject[] | null,
      1,
      100,
    );
    return page.list;
  },
  getById: async (id: string): Promise<Subject | null> => {
    try {
      return await get<Subject>(`/subjects/${id}`);
    } catch {
      return null;
    }
  },
  add: async (data: SubjectFormData): Promise<Subject> => post<Subject>('/subjects', { ...data }),
  update: async (id: string, data: Partial<SubjectFormData>): Promise<Subject | null> =>
    put<Subject>(`/subjects/${id}`, data as Record<string, unknown>),
  delete: async (id: string): Promise<boolean> => {
    await del(`/subjects/${id}`);
    return true;
  },
};

export const venueService = {
  getList: async (campusId?: string): Promise<Venue[]> => {
    const data = await get<unknown>('/venues', {
      page: 1,
      pageSize: 100,
      ...(campusId ? { campusId } : {}),
    });
    const page = asPaginatedResponse<Record<string, unknown>>(
      data as PaginatedResponse<Record<string, unknown>> | Record<string, unknown>[] | null,
      1,
      100,
    );
    const rows = page.list.length
      ? page.list
      : Array.isArray(data)
        ? (data as Record<string, unknown>[])
        : [];
    return rows.map((raw) => ({
      id: String(raw.id),
      campusId: String(raw.campusId ?? ''),
      name: String(raw.name ?? ''),
      address: raw.address ? String(raw.address) : undefined,
      status: String(raw.status ?? 'ACTIVE').toLowerCase() === 'inactive' ? 'inactive' : 'active',
      createdAt: String(raw.createdAt ?? ''),
      updatedAt: String(raw.updatedAt ?? ''),
    })) as Venue[];
  },
  getById: async (id: string): Promise<Venue | null> => {
    try {
      const raw = await get<Record<string, unknown>>(`/venues/${id}`);
      return {
        id: String(raw.id),
        campusId: String(raw.campusId ?? ''),
        name: String(raw.name ?? ''),
        address: raw.address ? String(raw.address) : undefined,
        status: String(raw.status ?? 'ACTIVE').toLowerCase() === 'inactive' ? 'inactive' : 'active',
        createdAt: String(raw.createdAt ?? ''),
        updatedAt: String(raw.updatedAt ?? ''),
      } as Venue;
    } catch {
      return null;
    }
  },
  add: async (data: VenueFormData): Promise<Venue> => {
    const raw = await post<Record<string, unknown>>('/venues', {
      campusId: data.campusId,
      name: data.name,
      address: data.address,
    });
    return {
      id: String(raw.id),
      campusId: String(raw.campusId ?? data.campusId),
      name: String(raw.name ?? data.name),
      address: raw.address ? String(raw.address) : data.address,
      status: 'active',
      createdAt: String(raw.createdAt ?? ''),
      updatedAt: String(raw.updatedAt ?? ''),
    } as Venue;
  },
  update: async (id: string, data: Partial<VenueFormData>): Promise<Venue | null> => {
    const body: Record<string, unknown> = {};
    if (data.name !== undefined) body.name = data.name;
    if (data.address !== undefined) body.address = data.address;
    if (data.status !== undefined) body.status = data.status === 'inactive' ? 'INACTIVE' : 'ACTIVE';
    await put(`/venues/${id}`, body);
    return venueService.getById(id);
  },
  delete: async (id: string): Promise<boolean> => {
    await del(`/venues/${id}`);
    return true;
  },
};

export const roomService = {
  getList: async (options?: { campusId?: string; venueId?: string }): Promise<Room[]> => {
    const data = await get<unknown>('/venues/rooms', {
      page: 1,
      pageSize: 100,
      ...(options?.venueId ? { venueId: options.venueId } : {}),
    });
    const page = asPaginatedResponse<Record<string, unknown>>(
      data as PaginatedResponse<Record<string, unknown>> | Record<string, unknown>[] | null,
      1,
      100,
    );
    const rows = page.list.length
      ? page.list
      : Array.isArray(data)
        ? (data as Record<string, unknown>[])
        : [];
    return rows.map((raw) => ({
      id: String(raw.id),
      venueId: String(raw.venueId ?? ''),
      campusId: String(raw.campusId ?? options?.campusId ?? ''),
      name: String(raw.name ?? ''),
      capacity: Number(raw.capacity ?? 0),
      status: String(raw.status ?? 'ACTIVE').toLowerCase() === 'inactive' ? 'inactive' : 'active',
      createdAt: String(raw.createdAt ?? ''),
      updatedAt: String(raw.updatedAt ?? ''),
    })) as Room[];
  },
  getById: async (id: string): Promise<Room | null> => {
    try {
      const raw = await get<Record<string, unknown>>(`/venues/rooms/${id}`);
      return {
        id: String(raw.id),
        venueId: String(raw.venueId ?? ''),
        campusId: String(raw.campusId ?? ''),
        name: String(raw.name ?? ''),
        capacity: Number(raw.capacity ?? 0),
        status: String(raw.status ?? 'ACTIVE').toLowerCase() === 'inactive' ? 'inactive' : 'active',
        createdAt: String(raw.createdAt ?? ''),
        updatedAt: String(raw.updatedAt ?? ''),
      } as Room;
    } catch {
      return null;
    }
  },
  add: async (data: RoomFormData): Promise<Room> => {
    const raw = await post<Record<string, unknown>>('/venues/rooms', {
      venueId: data.venueId,
      name: data.name,
      capacity: data.capacity ?? 20,
    });
    return {
      id: String(raw.id),
      venueId: String(raw.venueId ?? data.venueId),
      campusId: data.campusId,
      name: String(raw.name ?? data.name),
      capacity: Number(raw.capacity ?? data.capacity ?? 20),
      status: 'active',
      createdAt: String(raw.createdAt ?? ''),
      updatedAt: String(raw.updatedAt ?? ''),
    } as Room;
  },
  update: async (id: string, data: Partial<RoomFormData>): Promise<Room | null> => {
    const body: Record<string, unknown> = {};
    if (data.name !== undefined) body.name = data.name;
    if (data.capacity !== undefined) body.capacity = data.capacity;
    if (data.status !== undefined) body.status = data.status === 'inactive' ? 'INACTIVE' : 'ACTIVE';
    await put(`/venues/rooms/${id}`, body);
    return roomService.getById(id);
  },
  delete: async (id: string): Promise<boolean> => {
    await del(`/venues/rooms/${id}`);
    return true;
  },
};
