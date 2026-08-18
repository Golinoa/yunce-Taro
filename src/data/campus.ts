/**
 * 校区设置模块 — Mock 数据适配层
 * 统一把 mock-database 映射成 types/campus.ts 约定的正式类型
 */
import type {
  BusinessHours,
  CampusFormData,
  CampusOperationalData,
  CampusType,
  CampusUIModel,
  Holiday,
  NotifyGroup,
  PartnerMode,
  PayDaySettings,
  Room,
  RoomFormData,
  SalaryModel,
  Subject,
  SubjectFormData,
  Venue,
  VenueFormData,
} from '@/types/campus';
import { isTempImagePath, uploadImage } from '@/utils/image-upload';
import {
  CAMPUSES,
  CAMPUS_STATS,
  CLASSES,
  ROOMS,
  STUDENTS,
  SUBJECTS,
  TEACHERS,
  VENUES,
} from './mock-database';

function delay(ms = 80): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const SUBJECT_ICON_FALLBACK = '📚';
const DEFAULT_ICON_GRADIENT = 'linear-gradient(135deg, #5EC8A8, #4AB893)';

export const CAMPUS_ICONS = [
  { icon: '🏢', gradient: 'linear-gradient(135deg, hsl(168 55% 58%), hsl(168 55% 75%))' },
  { icon: '🏫', gradient: 'linear-gradient(135deg, hsl(200 55% 65%), hsl(200 55% 80%))' },
  { icon: '🎓', gradient: 'linear-gradient(135deg, hsl(340 60% 78%), hsl(340 60% 88%))' },
  { icon: '🎨', gradient: 'linear-gradient(135deg, hsl(27 87% 67%), hsl(27 87% 82%))' },
] as const;

export const CAMPUS_TYPE_MAP: Record<
  CampusType,
  { label: string; tagBg: string; tagText: string; dotColor: string }
> = {
  self: {
    label: '自营校区',
    tagBg: 'bg-primary-bg',
    tagText: 'text-primary',
    dotColor: 'bg-primary',
  },
  partner: { label: '合作校区', tagBg: 'bg-info-bg', tagText: 'text-info', dotColor: 'bg-info' },
};

export const PARTNER_MODE_MAP: Record<PartnerMode, string> = {
  hourly_share: '课时分成',
  venue_rental: '场地租赁',
};

export const HOLIDAY_STATUS_MAP = {
  rest: { label: '休息', bg: 'bg-destructive/10', text: 'text-destructive' },
  adjust: { label: '调课', bg: 'bg-primary-bg', text: 'text-primary' },
} as const;

export const SUBJECT_ICONS = [
  { icon: '🎹', color: '#5EC8A8', gradient: 'linear-gradient(135deg, #5EC8A8, #4AB893)' },
  { icon: '🎤', color: '#9B7ED8', gradient: 'linear-gradient(135deg, #9B7ED8, #7E63C9)' },
  { icon: '📘', color: '#6BA3D6', gradient: 'linear-gradient(135deg, #6BA3D6, #4B85BB)' },
  { icon: '💃', color: '#E89BB8', gradient: 'linear-gradient(135deg, #E89BB8, #D97CA2)' },
  { icon: '✍️', color: '#D4A24E', gradient: 'linear-gradient(135deg, #D4A24E, #B9852F)' },
  { icon: '🎨', color: '#E8864A', gradient: 'linear-gradient(135deg, #E8864A, #D66D2B)' },
  { icon: '🎸', color: '#6BA3D6', gradient: 'linear-gradient(135deg, #6BA3D6, #4D86BD)' },
  { icon: '🥁', color: '#F08A5D', gradient: 'linear-gradient(135deg, #F08A5D, #D96A38)' },
];

let mockCampusOverrides: CampusUIModel[] = [];
let mockSalaryModels: SalaryModel[] = [
  {
    id: 'salary-1',
    name: '标准主讲',
    type: 'standard',
    base: 3000,
    rate: 100,
    attend: 500,
    perf: 700,
    isDefault: true,
    teacherCount: 4,
  },
  {
    id: 'salary-2',
    name: '纯课时',
    type: 'hourly',
    base: 0,
    rate: 90,
    attend: 0,
    perf: 0,
    isDefault: false,
    teacherCount: 3,
  },
  {
    id: 'salary-3',
    name: '自定义模板',
    type: 'custom',
    base: 2000,
    rate: 80,
    attend: 300,
    perf: 500,
    isDefault: false,
    teacherCount: 1,
  },
];
let mockPayDaySettings: PayDaySettings = { mode: 'fixed', fixedDay: 15 };
let mockHolidays: Holiday[] = [
  {
    id: 'holiday-1',
    name: '元旦',
    icon: '🎉',
    startDate: '2026-01-01',
    endDate: '2026-01-01',
    status: 'rest',
  },
  {
    id: 'holiday-2',
    name: '春节假期',
    icon: '🧧',
    startDate: '2026-01-28',
    endDate: '2026-02-03',
    status: 'rest',
  },
  {
    id: 'holiday-3',
    name: '机构活动补课',
    icon: '📚',
    startDate: '2026-03-15',
    endDate: '2026-03-15',
    status: 'adjust',
  },
];
let mockBusinessHours: BusinessHours = {
  weekdayStart: '09:00',
  weekdayEnd: '21:00',
  weekendStart: '08:30',
  weekendEnd: '21:30',
  specialDates: [],
};
let mockNotifyGroups: NotifyGroup[] = [
  {
    title: '通知学员',
    items: [
      { id: 'leave-remind', label: '请假提醒', sub: '学员请假后通知家长', enabled: true },
      { id: 'payment-remind', label: '续费提醒', sub: '课时不足时自动提醒', enabled: true },
    ],
  },
  {
    title: '通知老师',
    items: [
      { id: 'class-remind', label: '上课提醒', sub: '开课前推送当日课程', enabled: true },
      { id: 'salary-remind', label: '薪资提醒', sub: '发薪日前推送课时报表', enabled: false },
    ],
  },
];
let mockSubjects: Subject[] | null = null;
let mockVenues: Venue[] = [...VENUES];
let mockRooms: Room[] = [...ROOMS];

function getCampusIcon(index: number) {
  return CAMPUS_ICONS[index % CAMPUS_ICONS.length];
}

function getPartnerMode(campusId: string): PartnerMode {
  return campusId === 'campus-east' ? 'hourly_share' : 'venue_rental';
}

function getPartnerTags(mode: PartnerMode): string[] {
  return mode === 'hourly_share' ? ['课时分成 30%', '师资共建'] : ['场地租赁', '独立核算'];
}

function normalizeCampusType(type: 'main' | 'self' | 'partner'): CampusType {
  return type === 'partner' ? 'partner' : 'self';
}

function mapCampusToUI(index: number, campus = CAMPUSES[index]): CampusUIModel {
  const stats = CAMPUS_STATS.find((item) => item.campusId === campus.id);
  const iconMeta = getCampusIcon(index);
  const isMain = campus.type === 'main';
  const type = normalizeCampusType(campus.type);
  const partnerMode = type === 'partner' ? getPartnerMode(campus.id) : undefined;

  return {
    id: campus.id,
    name: campus.name,
    logo: campus.logo,
    licenseName: campus.licenseName,
    contactName: campus.contactName,
    type,
    partnerMode,
    partnerTags: partnerMode ? getPartnerTags(partnerMode) : undefined,
    phone: campus.phone,
    region: campus.region,
    address: campus.address,
    businessHours: campus.businessHours,
    icon: iconMeta.icon,
    iconGradient: iconMeta.gradient,
    isMain,
    monthlyRent: isMain ? 12000 : type === 'partner' ? 0 : 8000,
    rentDueDay: isMain ? 28 : 15 + (index % 10),
    intro: campus.intro,
    venueImages: campus.venueImages,
    locationName: campus.locationName,
    latitude: campus.latitude,
    longitude: campus.longitude,
    stats: {
      students: stats?.studentCount || 0,
      teachers: stats?.teacherCount || 0,
      revenue: stats?.monthAmount || 0,
      revenueUnit: stats && stats.monthAmount >= 10000 ? '万' : '',
    },
    businessCategories: campus.businessCategories || [],
  };
}

function getCampusList(): CampusUIModel[] {
  if (mockCampusOverrides.length > 0) {
    return mockCampusOverrides;
  }
  return CAMPUSES.map((campus, index) => mapCampusToUI(index, campus));
}

function buildPeriodData(campusId: string, scale: number) {
  const students = STUDENTS.filter((item) => campusId === 'all' || item.campusId === campusId);
  const classes = CLASSES.filter((item) => campusId === 'all' || item.campusId === campusId);
  const teachers = TEACHERS.filter((item) =>
    campusId === 'all' ? true : item.campusIds.includes(campusId),
  );

  const totalRevenue = students.reduce(
    (sum, student) => sum + (student.totalHours - student.remainingHours) * 120,
    0,
  );
  const totalExpense = teachers.reduce((sum, teacher) => sum + teacher.pendingSalary, 0);
  const totalHours = classes.reduce((sum, item) => sum + item.usedLessons, 0);

  return {
    students: {
      total: Math.round(students.length * scale),
      newThis: Math.max(1, Math.round(students.length * 0.08 * scale)),
      leftThis: Math.max(0, Math.round(students.length * 0.02 * scale)),
      renewalRate: Math.min(98, Math.round(78 + scale * 12)),
    },
    teachers: {
      total: teachers.length,
      fullTime: teachers.filter((item) => item.role !== 'parttime').length,
      partTime: teachers.filter((item) => item.role === 'parttime').length,
      avgHours: teachers.length
        ? Math.round(teachers.reduce((sum, item) => sum + item.monthHours, 0) / teachers.length)
        : 0,
    },
    finance: {
      revenue: Math.round(totalRevenue * scale),
      courseFee: Math.round(totalRevenue * 0.82 * scale),
      materialFee: Math.round(totalRevenue * 0.1 * scale),
      otherFee: Math.round(totalRevenue * 0.08 * scale),
      expense: Math.round(totalExpense * scale),
      netIncome: Math.round((totalRevenue - totalExpense) * scale),
    },
    courses: {
      totalHours: Math.round(totalHours * scale),
      attendanceRate: Math.min(99, Math.round(84 + scale * 8)),
      makeupRate: Math.max(1, Math.round(4 + scale * 2)),
      avgClassSize: classes.length ? Math.round(students.length / classes.length) : 0,
    },
    rooms: {
      total: campusId === 'all' ? 8 : 3,
      utilization: Math.min(95, Math.round(68 + scale * 14)),
    },
  };
}

function ensureSubjects(): Subject[] {
  if (mockSubjects) {
    return mockSubjects;
  }
  mockSubjects = SUBJECTS.map((subject, index) => {
    const classes = CLASSES.filter((item) => item.subjectId === subject.id);
    const teacherIds = new Set(classes.map((item) => item.teacherId));
    const studentIds = new Set(
      STUDENTS.filter((student) =>
        student.classIds.some((classId) => classes.some((cls) => cls.id === classId)),
      ).map((student) => student.id),
    );
    const iconMeta = SUBJECT_ICONS[index % SUBJECT_ICONS.length];

    return {
      id: subject.id,
      name: subject.name,
      icon: iconMeta.icon,
      color: subject.color,
      iconGradient: iconMeta.gradient,
      studentCount: studentIds.size,
      teacherCount: teacherIds.size,
      courseCount: classes.length,
    };
  });
  return mockSubjects;
}

export async function mockGetCampuses(): Promise<CampusUIModel[]> {
  await delay();
  return getCampusList();
}

export async function mockGetCampusById(id: string): Promise<CampusUIModel | undefined> {
  await delay();
  return getCampusList().find((item) => item.id === id);
}

export async function mockAddCampus(data: CampusFormData): Promise<CampusUIModel> {
  await delay();
  const campus: CampusUIModel = {
    id: `campus-${Date.now()}`,
    name: data.name,
    logo: data.logo,
    licenseName: data.licenseName,
    contactName: data.contactName,
    type: data.type,
    partnerMode: data.partnerMode,
    partnerTags: data.partnerMode ? getPartnerTags(data.partnerMode) : undefined,
    phone: data.phone,
    region: data.region,
    address: data.address,
    businessHours: data.businessHours,
    icon: data.icon,
    iconGradient: data.iconGradient,
    isMain: data.isMain ?? false,
    monthlyRent: data.monthlyRent ?? 0,
    rentDueDay: data.rentDueDay ?? 15,
    intro: data.intro,
    venueImages: data.venueImages,
    locationName: data.locationName,
    latitude: data.latitude,
    longitude: data.longitude,
    stats: { students: 0, teachers: 0, revenue: 0, revenueUnit: '' },
    businessCategories: data.businessCategories || [],
  };
  mockCampusOverrides = [...getCampusList(), campus];
  return campus;
}

export async function mockUpdateCampus(
  id: string,
  data: Partial<CampusFormData>,
): Promise<CampusUIModel | undefined> {
  await delay();
  const campuses = getCampusList();
  const current = campuses.find((item) => item.id === id);
  if (!current) return undefined;

  // mock 后端接收临时路径后执行上传，转换为可持久化的 base64 URL
  const logo =
    data.logo !== undefined
      ? isTempImagePath(data.logo)
        ? await uploadImage(data.logo)
        : data.logo || undefined
      : current.logo;

  const venueImages =
    data.venueImages !== undefined
      ? await Promise.all(
          data.venueImages.map((url) => (isTempImagePath(url) ? uploadImage(url) : url)),
        )
      : current.venueImages;

  const updated: CampusUIModel = {
    ...current,
    ...data,
    partnerMode: data.type === 'partner' ? data.partnerMode || current.partnerMode : undefined,
    partnerTags:
      data.type === 'partner'
        ? getPartnerTags(data.partnerMode || current.partnerMode || 'hourly_share')
        : undefined,
    monthlyRent: data.monthlyRent ?? current.monthlyRent,
    rentDueDay: data.rentDueDay ?? current.rentDueDay,
    logo,
    intro: data.intro ?? current.intro,
    venueImages,
    businessCategories: data.businessCategories ?? current.businessCategories,
  };

  mockCampusOverrides = campuses.map((item) => (item.id === id ? updated : item));
  return updated;
}

export async function mockDeleteCampus(id: string): Promise<boolean> {
  await delay();
  const campuses = getCampusList();
  const target = campuses.find((item) => item.id === id);
  if (!target || target.isMain) return false;
  mockCampusOverrides = campuses.filter((item) => item.id !== id);
  return true;
}

export async function mockSetMainCampus(id: string): Promise<boolean> {
  await delay();
  const campuses = getCampusList();
  if (!campuses.some((item) => item.id === id)) return false;
  mockCampusOverrides = campuses.map((item) => ({ ...item, isMain: item.id === id }));
  return true;
}

export async function mockGetCampusData(id: string): Promise<CampusOperationalData | null> {
  await delay();
  const campusId = id === 'all' ? 'all' : getCampusList().find((item) => item.id === id)?.id;
  if (!campusId) return null;

  const scopedClasses = CLASSES.filter((item) => campusId === 'all' || item.campusId === campusId);
  const subjectRank = ensureSubjects()
    .map((subject) => ({
      name: subject.name,
      icon: subject.icon,
      students: scopedClasses.some((cls) => cls.subjectId === subject.id)
        ? subject.studentCount
        : 0,
      revenue: scopedClasses
        .filter((cls) => cls.subjectId === subject.id)
        .reduce((sum, cls) => sum + cls.usedLessons * cls.pricePerLesson, 0),
    }))
    .filter((item) => item.students > 0)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const monthlyRevenue = Array.from({ length: 12 }, (_, index) => {
    const base = CAMPUS_STATS.filter(
      (item) => campusId === 'all' || item.campusId === campusId,
    ).reduce((sum, item) => sum + item.monthAmount, 0);
    return Math.round(base * (0.72 + index * 0.03));
  });

  return {
    campusId,
    month: buildPeriodData(campusId, 0.35),
    quarter: buildPeriodData(campusId, 0.85),
    year: buildPeriodData(campusId, 1.8),
    all: buildPeriodData(campusId, 2.4),
    monthlyRevenue,
    subjectRank,
  };
}

export async function mockGetSalaryModels(): Promise<SalaryModel[]> {
  await delay();
  return mockSalaryModels;
}

export async function mockCreateSalaryModel(
  data: Omit<SalaryModel, 'id' | 'teacherCount'>,
): Promise<SalaryModel> {
  await delay();
  const created: SalaryModel = {
    id: `salary-${Date.now()}`,
    teacherCount: 0,
    ...data,
  };
  mockSalaryModels = [...mockSalaryModels, created];
  return created;
}

export async function mockUpdateSalaryModel(
  id: string,
  data: Partial<SalaryModel>,
): Promise<SalaryModel | undefined> {
  await delay();
  const current = mockSalaryModels.find((item) => item.id === id);
  if (!current) return undefined;
  const updated = { ...current, ...data };
  mockSalaryModels = mockSalaryModels.map((item) => (item.id === id ? updated : item));
  return updated;
}

export async function mockDeleteSalaryModel(id: string): Promise<boolean> {
  await delay();
  const current = mockSalaryModels.find((item) => item.id === id);
  if (!current || current.isDefault) return false;
  mockSalaryModels = mockSalaryModels.filter((item) => item.id !== id);
  return true;
}

export async function mockGetPayDaySettings(): Promise<PayDaySettings> {
  await delay();
  return mockPayDaySettings;
}

export async function mockUpdatePayDaySettings(
  data: Partial<PayDaySettings>,
): Promise<PayDaySettings> {
  await delay();
  mockPayDaySettings = { ...mockPayDaySettings, ...data };
  return mockPayDaySettings;
}

export async function mockGetHolidays(): Promise<Holiday[]> {
  await delay();
  return mockHolidays;
}

export async function mockAddHoliday(data: Omit<Holiday, 'id'>): Promise<Holiday> {
  await delay();
  const created = { id: `holiday-${Date.now()}`, ...data };
  mockHolidays = [...mockHolidays, created];
  return created;
}

export async function mockUpdateHoliday(
  id: string,
  data: Partial<Holiday>,
): Promise<Holiday | undefined> {
  await delay();
  const current = mockHolidays.find((item) => item.id === id);
  if (!current) return undefined;
  const updated = { ...current, ...data };
  mockHolidays = mockHolidays.map((item) => (item.id === id ? updated : item));
  return updated;
}

export async function mockDeleteHoliday(id: string): Promise<boolean> {
  await delay();
  mockHolidays = mockHolidays.filter((item) => item.id !== id);
  return true;
}

export async function mockGetBusinessHours(): Promise<BusinessHours> {
  await delay();
  return mockBusinessHours;
}

export async function mockUpdateBusinessHours(
  data: Partial<BusinessHours>,
): Promise<BusinessHours> {
  await delay();
  mockBusinessHours = { ...mockBusinessHours, ...data };
  return mockBusinessHours;
}

export async function mockGetNotifySettings(): Promise<NotifyGroup[]> {
  await delay();
  return mockNotifyGroups;
}

export async function mockToggleNotify(itemId: string): Promise<NotifyGroup[]> {
  await delay();
  mockNotifyGroups = mockNotifyGroups.map((group) => ({
    ...group,
    items: group.items.map((item) =>
      item.id === itemId ? { ...item, enabled: !item.enabled } : item,
    ),
  }));
  return mockNotifyGroups;
}

export async function mockGetSubjects(): Promise<Subject[]> {
  await delay();
  return ensureSubjects();
}

export async function mockGetSubjectById(id: string): Promise<Subject | undefined> {
  await delay();
  return ensureSubjects().find((item) => item.id === id);
}

export async function mockAddSubject(data: SubjectFormData): Promise<Subject> {
  await delay();
  const created: Subject = {
    id: `sub-${Date.now()}`,
    name: data.name,
    icon: data.icon || SUBJECT_ICON_FALLBACK,
    color: data.color,
    iconGradient: data.iconGradient || DEFAULT_ICON_GRADIENT,
    studentCount: 0,
    teacherCount: 0,
    courseCount: 0,
  };
  mockSubjects = [...ensureSubjects(), created];
  return created;
}

export async function mockDeleteSubject(id: string): Promise<boolean> {
  await delay();
  mockSubjects = ensureSubjects().filter((item) => item.id !== id);
  return true;
}

// ============================================
// 场地 / 教室
// ============================================

export async function mockGetVenues(campusId?: string): Promise<Venue[]> {
  await delay();
  let venues = [...mockVenues];
  if (campusId) {
    venues = venues.filter((item) => item.campusId === campusId);
  }
  return venues;
}

export async function mockGetVenueById(id: string): Promise<Venue | undefined> {
  await delay();
  return mockVenues.find((item) => item.id === id);
}

export async function mockAddVenue(data: VenueFormData): Promise<Venue> {
  await delay();
  const now = new Date().toISOString();
  const venue: Venue = {
    id: `venue-${Date.now()}`,
    ...data,
    createdAt: now,
    updatedAt: now,
  };
  mockVenues = [...mockVenues, venue];
  return venue;
}

export async function mockUpdateVenue(
  id: string,
  data: Partial<VenueFormData>,
): Promise<Venue | undefined> {
  await delay();
  const current = mockVenues.find((item) => item.id === id);
  if (!current) return undefined;
  const updated: Venue = {
    ...current,
    ...data,
    updatedAt: new Date().toISOString(),
  };
  mockVenues = mockVenues.map((item) => (item.id === id ? updated : item));
  return updated;
}

export async function mockDeleteVenue(id: string): Promise<boolean> {
  await delay();
  const hasRooms = mockRooms.some((item) => item.venueId === id);
  if (hasRooms) return false;
  mockVenues = mockVenues.filter((item) => item.id !== id);
  return true;
}

export async function mockGetRooms(options?: {
  campusId?: string;
  venueId?: string;
}): Promise<Room[]> {
  await delay();
  let rooms = [...mockRooms];
  if (options?.campusId) {
    rooms = rooms.filter((item) => item.campusId === options.campusId);
  }
  if (options?.venueId) {
    rooms = rooms.filter((item) => item.venueId === options.venueId);
  }
  return rooms;
}

export async function mockGetRoomById(id: string): Promise<Room | undefined> {
  await delay();
  return mockRooms.find((item) => item.id === id);
}

export async function mockAddRoom(data: RoomFormData): Promise<Room> {
  await delay();
  const now = new Date().toISOString();
  const room: Room = {
    id: `room-${Date.now()}`,
    ...data,
    bookingEnabled: data.bookingEnabled ?? false,
    photos: data.photos ?? [],
    openTimeStart: data.openTimeStart ?? '09:00',
    openTimeEnd: data.openTimeEnd ?? '22:00',
    pricePerSession: data.pricePerSession ?? 0,
    timeBasedPricing: data.timeBasedPricing ?? false,
    createdAt: now,
    updatedAt: now,
  };
  mockRooms = [...mockRooms, room];
  return room;
}

export async function mockUpdateRoom(
  id: string,
  data: Partial<RoomFormData>,
): Promise<Room | undefined> {
  await delay();
  const current = mockRooms.find((item) => item.id === id);
  if (!current) return undefined;

  const photos =
    data.photos !== undefined
      ? await Promise.all(data.photos.map((url) => (isTempImagePath(url) ? uploadImage(url) : url)))
      : current.photos;

  const updated: Room = {
    ...current,
    ...data,
    photos,
    updatedAt: new Date().toISOString(),
  };
  mockRooms = mockRooms.map((item) => (item.id === id ? updated : item));
  return updated;
}

export async function mockDeleteRoom(id: string): Promise<boolean> {
  await delay();
  mockRooms = mockRooms.filter((item) => item.id !== id);
  return true;
}
