/**
 * Service ? ? ???? API
 * ?????????? mock ????????? request ??
 * ???????? Promise<T>????????????
 */
import { loadCampusMock } from '@/utils/mock-loaders';
import { isUseMock } from '@/utils/build-env';
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
import { get, put } from '@/utils/request';
import { type PaginatedResponse, unwrapPaginatedList } from '@/utils/pagination';

let campusMockMod: Awaited<ReturnType<typeof loadCampusMock>> | undefined;
async function cm() {
  campusMockMod ??= await loadCampusMock();
  return campusMockMod;
}

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
    icon: raw.icon || '??',
    iconGradient: raw.iconGradient || 'from-blue-400 to-blue-600',
    isMain: Boolean(raw.isMain),
    monthlyRent: raw.monthlyRent ?? 0,
    rentDueDay: raw.rentDueDay ?? 1,
    partnerMode: raw.partnerMode as PartnerMode | undefined,
    stats: { students: 0, teachers: 0, revenue: 0, revenueUnit: '' },
    businessCategories: [],
    tags: [],
  };
}

// ============================================
// ?? Service
// ============================================
export const campusService = {
  /** ?????? */
  getList: async (): Promise<CampusUIModel[]> => {
    if (isUseMock()) {
      return (await cm()).mockGetCampuses();
    }

    const data = await get<PaginatedResponse<BackendCampusItem>>('/campuses', {
      page: 1,
      pageSize: 100,
    });
    return unwrapPaginatedList(data).map(mapBackendCampus);
  },

  /** ?????? */
  getById: async (id: string): Promise<CampusUIModel | null> =>
    (await (await cm()).mockGetCampusById(id)) ?? null,

  /** ???? */
  add: async (data: CampusFormData): Promise<CampusUIModel> => (await cm()).mockAddCampus(data),

  /** ???? */
  update: async (id: string, data: Partial<CampusFormData>): Promise<CampusUIModel | null> =>
    (await (await cm()).mockUpdateCampus(id, data)) ?? null,

  /** ???? */
  delete: async (id: string): Promise<boolean> => (await cm()).mockDeleteCampus(id),

  /** ????? */
  setMain: async (id: string): Promise<boolean> => (await cm()).mockSetMainCampus(id),
};

// ============================================
// ???? Service
// ============================================
export const salaryModelCampusService = {
  /** ???????? */
  getList: async (): Promise<SalaryModel[]> => (await cm()).mockGetSalaryModels(),

  /** ?????? */
  create: async (model: Omit<SalaryModel, 'id' | 'teacherCount'>): Promise<SalaryModel> =>
    (await cm()).mockCreateSalaryModel(model),

  /** ?????? */
  update: async (id: string, updates: Partial<SalaryModel>): Promise<SalaryModel | null> =>
    (await (await cm()).mockUpdateSalaryModel(id, updates)) ?? null,

  /** ?????? */
  delete: async (id: string): Promise<boolean> => (await cm()).mockDeleteSalaryModel(id),
};

// ============================================
// ????? Service
// ============================================
export const payDaySettingsService = {
  /** ??????? */
  get: async (): Promise<PayDaySettings> => (await cm()).mockGetPayDaySettings(),

  /** ??????? */
  update: async (updates: Partial<PayDaySettings>): Promise<PayDaySettings> =>
    (await cm()).mockUpdatePayDaySettings(updates),
};

// ============================================
// ??? Service
// ============================================
export const holidayService = {
  /** ??????? */
  getList: async (): Promise<Holiday[]> => (await cm()).mockGetHolidays(),

  /** ????? */
  add: async (holiday: Omit<Holiday, 'id'>): Promise<Holiday> => (await cm()).mockAddHoliday(holiday),

  /** ????? */
  update: async (id: string, updates: Partial<Holiday>): Promise<Holiday | null> =>
    (await (await cm()).mockUpdateHoliday(id, updates)) ?? null,

  /** ????? */
  delete: async (id: string): Promise<boolean> => (await cm()).mockDeleteHoliday(id),
};

// ============================================
// ???? Service
// ============================================
export const businessHoursService = {
  /** ?????? */
  get: async (): Promise<BusinessHours> => (await cm()).mockGetBusinessHours(),

  /** ?????? */
  update: async (updates: Partial<BusinessHours>): Promise<BusinessHours> =>
    (await cm()).mockUpdateBusinessHours(updates),
};

// ============================================
// ???? Service
// ============================================
export const notifyService = {
  /** ?????? */
  getList: async (): Promise<NotifyGroup[]> => {
    if (!isUseMock()) {
      const list = await get<BackendNotifySettingItem[]>('/notify-settings');
      return mapBackendNotifySettings(list);
    }

    return (await cm()).mockGetNotifySettings();
  },

  /** ??????? */
  toggle: async (itemId: string): Promise<NotifyGroup[]> => {
    if (!isUseMock()) {
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
    }

    return (await cm()).mockToggleNotify(itemId);
  },
};

// ============================================
// ???? Service
// ============================================
export const campusDataService = {
  /** ???????? */
  get: async (campusId: string): Promise<CampusOperationalData | null> => (await cm()).mockGetCampusData(campusId),
  // ??????:
  // get: (campusId: string) => get<CampusOperationalData>(`/api/campus-data/${campusId}`),
};

// ============================================
// ?? Service
// ============================================
export const subjectService = {
  /** ?????? */
  getList: async (): Promise<Subject[]> => (await cm()).mockGetSubjects(),

  /** ?????? */
  getById: async (id: string): Promise<Subject | null> => (await (await cm()).mockGetSubjectById(id)) ?? null,

  /** ???? */
  add: async (data: SubjectFormData): Promise<Subject> => (await cm()).mockAddSubject(data),

  /** ???? */
  update: async (id: string, data: Partial<SubjectFormData>): Promise<Subject | null> =>
    (await (await cm()).mockUpdateSubject(id, data)) ?? null,

  /** ???? */
  delete: async (id: string): Promise<boolean> => (await cm()).mockDeleteSubject(id),
};

// ============================================
// ?? Service
// ============================================
export const venueService = {
  /** ?????????????? */
  getList: async (campusId?: string): Promise<Venue[]> => (await cm()).mockGetVenues(campusId),

  /** ?????? */
  getById: async (id: string): Promise<Venue | null> => (await (await cm()).mockGetVenueById(id)) ?? null,

  /** ???? */
  add: async (data: VenueFormData): Promise<Venue> => (await cm()).mockAddVenue(data),

  /** ???? */
  update: async (id: string, data: Partial<VenueFormData>): Promise<Venue | null> =>
    (await (await cm()).mockUpdateVenue(id, data)) ?? null,

  /** ???????????????? */
  delete: async (id: string): Promise<boolean> => (await cm()).mockDeleteVenue(id),
};

// ============================================
// ?? Service
// ============================================
export const roomService = {
  /** ???????????/????? */
  getList: async (options?: { campusId?: string; venueId?: string }): Promise<Room[]> =>
    (await cm()).mockGetRooms(options),

  /** ?????? */
  getById: async (id: string): Promise<Room | null> => (await (await cm()).mockGetRoomById(id)) ?? null,

  /** ???? */
  add: async (data: RoomFormData): Promise<Room> => (await cm()).mockAddRoom(data),

  /** ???? */
  update: async (id: string, data: Partial<RoomFormData>): Promise<Room | null> =>
    (await (await cm()).mockUpdateRoom(id, data)) ?? null,

  /** ???? */
  delete: async (id: string): Promise<boolean> => (await cm()).mockDeleteRoom(id),
};
