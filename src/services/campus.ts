/**
 * Service 层 — 校区设置 API
 * 定义接口契约，当前由 mock 实现，联调时替换为 request 调用
 * 所有方法统一返回 Promise<T>，保证联调切换后类型一致
 */
import {
  mockGetCampuses,
  mockGetCampusById,
  mockAddCampus,
  mockUpdateCampus,
  mockDeleteCampus,
  mockSetMainCampus,
  mockGetSalaryModels,
  mockCreateSalaryModel,
  mockUpdateSalaryModel,
  mockDeleteSalaryModel,
  mockGetPayDaySettings,
  mockUpdatePayDaySettings,
  mockGetHolidays,
  mockAddHoliday,
  mockUpdateHoliday,
  mockDeleteHoliday,
  mockGetBusinessHours,
  mockUpdateBusinessHours,
  mockGetNotifySettings,
  mockToggleNotify,
  mockGetCampusData,
  mockGetSubjects,
  mockGetSubjectById,
  mockAddSubject,
  mockDeleteSubject,
  mockGetVenues,
  mockGetVenueById,
  mockAddVenue,
  mockUpdateVenue,
  mockDeleteVenue,
  mockGetRooms,
  mockGetRoomById,
  mockAddRoom,
  mockUpdateRoom,
  mockDeleteRoom,
} from '@/data/campus';
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
} from '@/types/campus';
import { get, put } from '@/utils/request';

const USE_MOCK =
  typeof process !== 'undefined' && typeof process.env !== 'undefined'
    ? process.env.VITE_USE_MOCK !== 'false'
    : true;

interface BackendNotifySettingItem {
  enabled: boolean;
  group: string;
  id: string;
  label: string;
  sub?: null | string;
}

const NOTIFY_GROUP_TITLE_MAP: Record<string, string> = {
  parent: '通知学员',
  student: '通知学员',
  student_parent: '通知学员',
  teacher: '通知老师',
  default: '通知设置',
};

function mapNotifyGroupTitle(group: string): string {
  return NOTIFY_GROUP_TITLE_MAP[group] || group || '通知设置';
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

// ============================================
// 校区 Service
// ============================================
export const campusService = {
  /** 获取校区列表 */
  getList: (): Promise<CampusUIModel[]> => mockGetCampuses(),
  // 联调时替换为:
  // getList: () => get<CampusUIModel[]>('/api/campuses'),

  /** 获取校区详情 */
  getById: async (id: string): Promise<CampusUIModel | null> =>
    (await mockGetCampusById(id)) ?? null,

  /** 添加校区 */
  add: (data: CampusFormData): Promise<CampusUIModel> => mockAddCampus(data),

  /** 更新校区 */
  update: async (id: string, data: Partial<CampusFormData>): Promise<CampusUIModel | null> =>
    (await mockUpdateCampus(id, data)) ?? null,

  /** 删除校区 */
  delete: (id: string): Promise<boolean> => mockDeleteCampus(id),

  /** 设为主校区 */
  setMain: (id: string): Promise<boolean> => mockSetMainCampus(id),
};

// ============================================
// 薪资模板 Service
// ============================================
export const salaryModelCampusService = {
  /** 获取薪资模板列表 */
  getList: (): Promise<SalaryModel[]> => mockGetSalaryModels(),

  /** 创建薪资模板 */
  create: (model: Omit<SalaryModel, 'id' | 'teacherCount'>): Promise<SalaryModel> =>
    mockCreateSalaryModel(model),

  /** 更新薪资模板 */
  update: async (id: string, updates: Partial<SalaryModel>): Promise<SalaryModel | null> =>
    (await mockUpdateSalaryModel(id, updates)) ?? null,

  /** 删除薪资模板 */
  delete: (id: string): Promise<boolean> => mockDeleteSalaryModel(id),
};

// ============================================
// 发薪日设置 Service
// ============================================
export const payDaySettingsService = {
  /** 获取发薪日设置 */
  get: (): Promise<PayDaySettings> => mockGetPayDaySettings(),

  /** 更新发薪日设置 */
  update: (updates: Partial<PayDaySettings>): Promise<PayDaySettings> =>
    mockUpdatePayDaySettings(updates),
};

// ============================================
// 节假日 Service
// ============================================
export const holidayService = {
  /** 获取节假日列表 */
  getList: (): Promise<Holiday[]> => mockGetHolidays(),

  /** 添加节假日 */
  add: (holiday: Omit<Holiday, 'id'>): Promise<Holiday> => mockAddHoliday(holiday),

  /** 更新节假日 */
  update: async (id: string, updates: Partial<Holiday>): Promise<Holiday | null> =>
    (await mockUpdateHoliday(id, updates)) ?? null,

  /** 删除节假日 */
  delete: (id: string): Promise<boolean> => mockDeleteHoliday(id),
};

// ============================================
// 营业时间 Service
// ============================================
export const businessHoursService = {
  /** 获取营业时间 */
  get: (): Promise<BusinessHours> => mockGetBusinessHours(),

  /** 更新营业时间 */
  update: (updates: Partial<BusinessHours>): Promise<BusinessHours> =>
    mockUpdateBusinessHours(updates),
};

// ============================================
// 通知设置 Service
// ============================================
export const notifyService = {
  /** 获取通知设置 */
  getList: async (): Promise<NotifyGroup[]> => {
    if (!USE_MOCK) {
      const list = await get<BackendNotifySettingItem[]>('/notify-settings');
      return mapBackendNotifySettings(list);
    }

    return mockGetNotifySettings();
  },

  /** 切换通知项开关 */
  toggle: async (itemId: string): Promise<NotifyGroup[]> => {
    if (!USE_MOCK) {
      const currentGroups = await notifyService.getList();
      const target = currentGroups
        .flatMap((group) => group.items)
        .find((item) => item.id === itemId);
      if (!target) {
        throw new Error('通知设置不存在');
      }

      await put(`/notify-settings/${itemId}`, {
        enabled: !target.enabled,
      });

      return notifyService.getList();
    }

    return mockToggleNotify(itemId);
  },
};

// ============================================
// 运营数据 Service
// ============================================
export const campusDataService = {
  /** 获取校区运营数据 */
  get: (campusId: string): Promise<CampusOperationalData | null> => mockGetCampusData(campusId),
  // 联调时替换为:
  // get: (campusId: string) => get<CampusOperationalData>(`/api/campus-data/${campusId}`),
};

// ============================================
// 科目 Service
// ============================================
export const subjectService = {
  /** 获取科目列表 */
  getList: (): Promise<Subject[]> => mockGetSubjects(),

  /** 获取科目详情 */
  getById: async (id: string): Promise<Subject | null> => (await mockGetSubjectById(id)) ?? null,

  /** 添加科目 */
  add: (data: SubjectFormData): Promise<Subject> => mockAddSubject(data),

  /** 删除科目 */
  delete: (id: string): Promise<boolean> => mockDeleteSubject(id),
};

// ============================================
// 场地 Service
// ============================================
export const venueService = {
  /** 获取场地列表（可按校区过滤） */
  getList: (campusId?: string): Promise<Venue[]> => mockGetVenues(campusId),

  /** 获取场地详情 */
  getById: async (id: string): Promise<Venue | null> => (await mockGetVenueById(id)) ?? null,

  /** 添加场地 */
  add: (data: VenueFormData): Promise<Venue> => mockAddVenue(data),

  /** 更新场地 */
  update: async (id: string, data: Partial<VenueFormData>): Promise<Venue | null> =>
    (await mockUpdateVenue(id, data)) ?? null,

  /** 删除场地（有关联教室时不可删除） */
  delete: (id: string): Promise<boolean> => mockDeleteVenue(id),
};

// ============================================
// 教室 Service
// ============================================
export const roomService = {
  /** 获取教室列表（可按校区/场地过滤） */
  getList: (options?: { campusId?: string; venueId?: string }): Promise<Room[]> =>
    mockGetRooms(options),

  /** 获取教室详情 */
  getById: async (id: string): Promise<Room | null> => (await mockGetRoomById(id)) ?? null,

  /** 添加教室 */
  add: (data: RoomFormData): Promise<Room> => mockAddRoom(data),

  /** 更新教室 */
  update: async (id: string, data: Partial<RoomFormData>): Promise<Room | null> =>
    (await mockUpdateRoom(id, data)) ?? null,

  /** 删除教室 */
  delete: (id: string): Promise<boolean> => mockDeleteRoom(id),
};
