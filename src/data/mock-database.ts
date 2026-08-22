/**
 * Mock 数据库 - 统一数据源
 *
 * 所有 Mock 数据的单一数据源，保证数据一致性和关联性
 * 数据时间跨度：2025年7月 - 2026年6月（共12个月）
 */
import { getManagedTeachers } from '@/data/teacher';
import type { Venue, Room } from '@/types/campus';
import type { ClassColor, ClassIcon, ClassLevel } from '@/types/class';
import type { UserRole } from '@/types/profile';
import type { DayOfWeek } from '@/types/schedule';
import type { TeacherUIModel } from '@/types/teacher';

// ============================================
// 常量
// ============================================

/** 当前时间基准（统一以真实设备时钟为准，禁止硬编码历史月份，消除 L-04 时间基准分裂） */
export const NOW = new Date();
export const CUR_YEAR = NOW.getFullYear();
export const CUR_MONTH = NOW.getMonth() + 1;
export const CUR_DAY = NOW.getDate();
export const CUR_WEEKDAY = ((NOW.getDay() + 6) % 7) + 1; // 周一=1 … 周日=7

/** 测试账号列表（登录页提示用） */
export interface TestAccount {
  username: string;
  label: string;
}
export const TEST_ACCOUNTS: TestAccount[] = [
  { username: 'principal1', label: '校长' },
  { username: 'teacher1', label: '教师' },
  { username: 'parent1', label: '家长' },
];
export const TEST_PASSWORD = '123456';

// ============================================
// 1. 机构与校区
// ============================================

export interface Organization {
  id: string;
  name: string;
  ownerUserId: string;
  contactPhone: string;
  address: string;
  createdAt: string;
}

export interface Campus {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  type: 'main' | 'self' | 'partner';
  /** 校区 Logo URL */
  logo?: string;
  /** 营业执照名称 */
  licenseName?: string;
  /** 联系人 */
  contactName?: string;
  /** 所在地区 */
  region?: string;
  address: string;
  /** 营业时间 */
  businessHours?: string;
  /** 校区联系电话（Mock 使用固定测试号码） */
  phone: string;
  /** 门店介绍 */
  intro?: string;
  /** 场馆图片 URL 列表 */
  venueImages?: string[];
  /** 地图定位名称 */
  locationName?: string;
  /** 纬度 */
  latitude?: number;
  /** 经度 */
  longitude?: number;
  createdAt: string;
  /** 主营业态 */
  businessCategories?: { categoryId: string; subIds: string[] }[];
  /** 门店标签（首页校区卡片展示，最多 4 个，每标签最多 5 字） */
  tags?: string[];
}

export const ORGANIZATIONS: Organization[] = [
  {
    id: 'org-yunce',
    name: '松果排课',
    ownerUserId: 'user-principal-001',
    contactPhone: '0571-88886666',
    address: '杭州市西湖区文三路168号云策大厦',
    createdAt: '2024-01-15T08:00:00Z',
  },
];

export const CAMPUSES: Campus[] = [
  {
    id: 'campus-center',
    organizationId: 'org-yunce',
    name: '曦绘艺术',
    code: 'XC0001',
    type: 'main',
    logo: '/assets/images/sgpk.png',
    licenseName: '杭州云策教育科技有限公司',
    contactName: '万老师',
    region: '浙江省-杭州市-西湖区',
    address: '杭州市西湖区文三路168号云策大厦1-3层',
    businessHours: '08:00:00至22:00:00',
    phone: '13800138000',
    intro: '云策教育曦绘艺术，专注艺术、体能、科创培训。',
    venueImages: [],
    locationName: '云策大厦',
    latitude: 30.2741,
    longitude: 120.1551,
    createdAt: '2024-01-15T08:00:00Z',
    tags: ['免费试听', '暑期特惠'],
  },
  {
    id: 'campus-east',
    organizationId: 'org-yunce',
    name: '城东校区',
    code: 'XC0002',
    type: 'self',
    logo: '/assets/images/sgpk.png',
    licenseName: '杭州云策教育科技有限公司城东分公司',
    contactName: '李老师',
    region: '浙江省-杭州市-上城区',
    address: '杭州市上城区钱江新城丹桂街88号',
    businessHours: '08:00:00至22:00:00',
    phone: '13800138001',
    intro: '',
    venueImages: [],
    locationName: '钱江新城',
    latitude: 30.251,
    longitude: 120.212,
    createdAt: '2024-06-01T08:00:00Z',
  },
  {
    id: 'campus-west',
    organizationId: 'org-yunce',
    name: '城西校区',
    code: 'XC0003',
    type: 'self',
    logo: '/assets/images/sgpk.png',
    licenseName: '杭州云策教育科技有限公司城西分公司',
    contactName: '王老师',
    region: '浙江省-杭州市-余杭区',
    address: '杭州市余杭区未来科技城EFC欧美金融城',
    businessHours: '08:00:00至22:00:00',
    phone: '13800138002',
    intro: '',
    venueImages: [],
    locationName: 'EFC欧美金融城',
    latitude: 30.28,
    longitude: 119.997,
    createdAt: '2024-09-01T08:00:00Z',
  },
];

// ============================================
// 1.1 场地 / 教室
// ============================================

export const VENUES: Venue[] = [
  {
    id: 'venue-center-001',
    campusId: 'campus-center',
    name: '云策大厦主馆',
    address: '杭州市西湖区文三路168号云策大厦1-3层',
    status: 'active',
    createdAt: '2024-01-15T08:00:00Z',
    updatedAt: '2024-01-15T08:00:00Z',
  },
  {
    id: 'venue-east-001',
    campusId: 'campus-east',
    name: '城东艺术馆',
    address: '杭州市上城区钱江新城丹桂街88号',
    status: 'active',
    createdAt: '2024-06-01T08:00:00Z',
    updatedAt: '2024-06-01T08:00:00Z',
  },
  {
    id: 'venue-west-001',
    campusId: 'campus-west',
    name: '城西文创中心',
    address: '杭州市余杭区未来科技城EFC欧美金融城',
    status: 'active',
    createdAt: '2024-09-01T08:00:00Z',
    updatedAt: '2024-09-01T08:00:00Z',
  },
];

export const ROOMS: Room[] = [
  // 曦绘艺术 - 云策大厦主馆
  {
    id: 'room-center-101',
    venueId: 'venue-center-001',
    campusId: 'campus-center',
    name: '钢琴教室101',
    capacity: 8,
    status: 'active',
    bookingEnabled: true,
    photos: ['/assets/images/2.jpg'],
    openTimeStart: '09:00',
    openTimeEnd: '22:00',
    pricePerSession: 120,
    timeBasedPricing: false,
    createdAt: '2024-01-15T08:00:00Z',
    updatedAt: '2024-01-15T08:00:00Z',
  },
  {
    id: 'room-center-102',
    venueId: 'venue-center-001',
    campusId: 'campus-center',
    name: '钢琴教室102',
    capacity: 6,
    status: 'active',
    bookingEnabled: false,
    openTimeStart: '09:00',
    openTimeEnd: '22:00',
    pricePerSession: 0,
    timeBasedPricing: false,
    createdAt: '2024-01-15T08:00:00Z',
    updatedAt: '2024-01-15T08:00:00Z',
  },
  {
    id: 'room-center-201',
    venueId: 'venue-center-001',
    campusId: 'campus-center',
    name: '乐理教室201',
    capacity: 12,
    status: 'active',
    bookingEnabled: true,
    photos: [],
    openTimeStart: '09:00',
    openTimeEnd: '22:00',
    pricePerSession: 80,
    timeBasedPricing: false,
    createdAt: '2024-01-15T08:00:00Z',
    updatedAt: '2024-01-15T08:00:00Z',
  },
  {
    id: 'room-center-301',
    venueId: 'venue-center-001',
    campusId: 'campus-center',
    name: '声乐教室301',
    capacity: 15,
    status: 'active',
    bookingEnabled: false,
    openTimeStart: '09:00',
    openTimeEnd: '22:00',
    pricePerSession: 0,
    timeBasedPricing: false,
    createdAt: '2024-01-15T08:00:00Z',
    updatedAt: '2024-01-15T08:00:00Z',
  },
  {
    id: 'room-center-302',
    venueId: 'venue-center-001',
    campusId: 'campus-center',
    name: '合唱教室302',
    capacity: 20,
    status: 'active',
    bookingEnabled: false,
    openTimeStart: '09:00',
    openTimeEnd: '22:00',
    pricePerSession: 0,
    timeBasedPricing: false,
    createdAt: '2024-01-15T08:00:00Z',
    updatedAt: '2024-01-15T08:00:00Z',
  },
  // 城东校区 - 城东艺术馆
  {
    id: 'room-east-dance1',
    venueId: 'venue-east-001',
    campusId: 'campus-east',
    name: '舞蹈教室1',
    capacity: 18,
    status: 'active',
    bookingEnabled: true,
    photos: ['/assets/images/2.jpg', '/assets/images/3.jpg'],
    openTimeStart: '10:00',
    openTimeEnd: '21:00',
    pricePerSession: 100,
    timeBasedPricing: false,
    createdAt: '2024-06-01T08:00:00Z',
    updatedAt: '2024-06-01T08:00:00Z',
  },
  {
    id: 'room-east-dance2',
    venueId: 'venue-east-001',
    campusId: 'campus-east',
    name: '舞蹈教室2',
    capacity: 15,
    status: 'active',
    bookingEnabled: false,
    openTimeStart: '09:00',
    openTimeEnd: '22:00',
    pricePerSession: 0,
    timeBasedPricing: false,
    createdAt: '2024-06-01T08:00:00Z',
    updatedAt: '2024-06-01T08:00:00Z',
  },
  {
    id: 'room-east-vocal',
    venueId: 'venue-east-001',
    campusId: 'campus-east',
    name: '声乐教室1',
    capacity: 12,
    status: 'active',
    bookingEnabled: false,
    openTimeStart: '09:00',
    openTimeEnd: '22:00',
    pricePerSession: 0,
    timeBasedPricing: false,
    createdAt: '2024-06-01T08:00:00Z',
    updatedAt: '2024-06-01T08:00:00Z',
  },
  // 城西校区 - 城西文创中心
  {
    id: 'room-west-calligraphy',
    venueId: 'venue-west-001',
    campusId: 'campus-west',
    name: '书法教室',
    capacity: 14,
    status: 'active',
    bookingEnabled: true,
    photos: ['/assets/images/3.jpg'],
    openTimeStart: '09:00',
    openTimeEnd: '22:00',
    pricePerSession: 20,
    timeBasedPricing: false,
    createdAt: '2024-09-01T08:00:00Z',
    updatedAt: '2024-09-01T08:00:00Z',
  },
  {
    id: 'room-west-art',
    venueId: 'venue-west-001',
    campusId: 'campus-west',
    name: '美术教室1',
    capacity: 16,
    status: 'active',
    bookingEnabled: false,
    openTimeStart: '09:00',
    openTimeEnd: '22:00',
    pricePerSession: 0,
    timeBasedPricing: false,
    createdAt: '2024-09-01T08:00:00Z',
    updatedAt: '2024-09-01T08:00:00Z',
  },
];

// ============================================
// 2. 用户与身份
// ============================================

export interface User {
  id: string;
  username: string;
  password: string;
  email?: string;
  name: string;
  phone: string;
  avatar?: string;
  createdAt: string;
}

export interface Identity {
  id: string;
  userId: string;
  role: UserRole;
  organizationId: string;
  campusIds: string[];
  isDefault: boolean;
}

export const USERS: User[] = [
  // 管理员（注册机构的人）
  {
    id: 'user-principal-001',
    username: 'principal1',
    password: '123456',
    email: 'principal1@yunce.com',
    name: '万老师',
    phone: '13800000001',
    createdAt: '2024-01-01T00:00:00Z',
  },
  // 教师
  {
    id: 'user-teacher-001',
    username: 'teacher1',
    password: '123456',
    email: 'teacher1@yunce.com',
    name: '张老师',
    phone: '13800000011',
    createdAt: '2024-01-15T00:00:00Z',
  },
  {
    id: 'user-teacher-002',
    username: 'teacher2',
    password: '123456',
    email: 'teacher2@yunce.com',
    name: '李老师',
    phone: '13800000012',
    createdAt: '2024-02-01T00:00:00Z',
  },
  {
    id: 'user-teacher-003',
    username: 'teacher3',
    password: '123456',
    email: 'teacher3@yunce.com',
    name: '王老师',
    phone: '13800000013',
    createdAt: '2024-03-01T00:00:00Z',
  },
  {
    id: 'user-teacher-004',
    username: 'teacher4',
    password: '123456',
    email: 'teacher4@yunce.com',
    name: '赵老师',
    phone: '13800000014',
    createdAt: '2024-06-01T00:00:00Z',
  },
  // 家长
  {
    id: 'user-parent-001',
    username: 'parent1',
    password: '123456',
    email: 'parent1@yunce.com',
    name: '张老师',
    phone: '13900000001',
    createdAt: '2024-02-01T00:00:00Z',
  },
  {
    id: 'user-parent-002',
    username: 'parent2',
    password: '123456',
    email: 'parent2@yunce.com',
    name: '赵小红妈妈',
    phone: '13900000002',
    createdAt: '2024-03-01T00:00:00Z',
  },
  {
    id: 'user-parent-003',
    username: 'parent3',
    password: '123456',
    email: 'parent3@yunce.com',
    name: '李子轩爸爸',
    phone: '13900000003',
    createdAt: '2024-04-01T00:00:00Z',
  },
];

/** 学员-家长绑定关系 */
export interface StudentParentBinding {
  id: string;
  studentId: string;
  parentId: string;
  relation?: string;
  createdAt: string;
}

export const STUDENT_PARENTS: StudentParentBinding[] = [
  {
    id: 'sp-001',
    studentId: 'stu-001',
    parentId: 'user-parent-001',
    relation: '父亲',
    createdAt: '2025-08-20T00:00:00Z',
  },
  {
    id: 'sp-002',
    studentId: 'stu-002',
    parentId: 'user-parent-002',
    relation: '母亲',
    createdAt: '2025-08-20T00:00:00Z',
  },
  {
    id: 'sp-003',
    studentId: 'stu-003',
    parentId: 'user-parent-003',
    relation: '父亲',
    createdAt: '2025-08-25T00:00:00Z',
  },
];

export const IDENTITIES: Identity[] = [
  // 管理员 - 可访问全部校区，拥有系统设置等管理权限
  {
    id: 'identity-principal-001',
    userId: 'user-principal-001',
    role: 'admin',
    organizationId: 'org-yunce',
    campusIds: ['campus-center', 'campus-east', 'campus-west'],
    isDefault: true,
  },
  // 张老师 - 主讲钢琴，主要在曦绘艺术
  {
    id: 'identity-teacher-001',
    userId: 'user-teacher-001',
    role: 'teacher',
    organizationId: 'org-yunce',
    campusIds: ['campus-center'],
    isDefault: true,
  },
  // 李老师 - 主讲声乐，在曦绘艺术和城东校区
  {
    id: 'identity-teacher-002',
    userId: 'user-teacher-002',
    role: 'teacher',
    organizationId: 'org-yunce',
    campusIds: ['campus-center', 'campus-east'],
    isDefault: true,
  },
  // 王老师 - 主讲舞蹈，在城东校区
  {
    id: 'identity-teacher-003',
    userId: 'user-teacher-003',
    role: 'teacher',
    organizationId: 'org-yunce',
    campusIds: ['campus-east'],
    isDefault: true,
  },
  // 赵老师 - 主讲书法，在城西校区
  {
    id: 'identity-teacher-004',
    userId: 'user-teacher-004',
    role: 'teacher',
    organizationId: 'org-yunce',
    campusIds: ['campus-west'],
    isDefault: true,
  },
  // 家长身份
  {
    id: 'identity-parent-001',
    userId: 'user-parent-001',
    role: 'parent',
    organizationId: 'org-yunce',
    campusIds: ['campus-center'],
    isDefault: true,
  },
  {
    id: 'identity-parent-002',
    userId: 'user-parent-002',
    role: 'parent',
    organizationId: 'org-yunce',
    campusIds: ['campus-center'],
    isDefault: true,
  },
  {
    id: 'identity-parent-003',
    userId: 'user-parent-003',
    role: 'parent',
    organizationId: 'org-yunce',
    campusIds: ['campus-center'],
    isDefault: true,
  },
];

// ============================================
// 3. 教师基础信息
// ============================================

export interface Teacher {
  id: string;
  userId: string;
  name: string;
  phone: string;
  subjects: string[];
  campusIds: string[];
  /** 是否允许跨校区上课，默认 false */
  canCrossCampus: boolean;
  accessScope: 'self' | 'subject' | 'org';
  managedSubjectIds?: string[];
  role: 'lead' | 'assist' | 'parttime';
  status: 'active' | 'resigned';
  /** 薪资状态（来自管理库，统一视图同步展示） */
  salaryStatus?: TeacherUIModel['salaryStatus'];
  /** 扣款/补发明细（来自管理库，统一视图同步展示） */
  deductions?: TeacherUIModel['deductions'];
  joinedAt: string;
  totalHours: number;
  monthHours: number;
  pendingSalary: number;
}

const BASE_TEACHERS: Teacher[] = [
  {
    id: 'teacher-001',
    userId: 'user-teacher-001',
    name: '张老师',
    phone: '138****0011',
    subjects: ['钢琴', '乐理'],
    campusIds: ['campus-center'],
    canCrossCampus: false,
    accessScope: 'self',
    managedSubjectIds: ['sub-piano', 'sub-theory'],
    role: 'lead',
    status: 'active',
    joinedAt: '2024-01-15T00:00:00Z',
    totalHours: 486,
    monthHours: 42,
    pendingSalary: 8600,
  },
  {
    id: 'teacher-002',
    userId: 'user-teacher-002',
    name: '李老师',
    phone: '138****0012',
    subjects: ['声乐', '合唱'],
    campusIds: ['campus-center', 'campus-east'],
    canCrossCampus: true,
    accessScope: 'subject',
    managedSubjectIds: ['sub-vocal'],
    role: 'lead',
    status: 'active',
    joinedAt: '2024-02-01T00:00:00Z',
    totalHours: 358,
    monthHours: 38,
    pendingSalary: 7200,
  },
  {
    id: 'teacher-003',
    userId: 'user-teacher-003',
    name: '王老师',
    phone: '138****0013',
    subjects: ['舞蹈', '形体'],
    campusIds: ['campus-east'],
    canCrossCampus: false,
    accessScope: 'self',
    managedSubjectIds: ['sub-dance'],
    role: 'lead',
    status: 'active',
    joinedAt: '2024-03-01T00:00:00Z',
    totalHours: 276,
    monthHours: 32,
    pendingSalary: 5800,
  },
  {
    id: 'teacher-004',
    userId: 'user-teacher-004',
    name: '赵老师',
    phone: '138****0014',
    subjects: ['书法', '国画'],
    campusIds: ['campus-west'],
    canCrossCampus: false,
    accessScope: 'org',
    managedSubjectIds: ['sub-calligraphy', 'sub-art'],
    role: 'lead',
    status: 'active',
    joinedAt: '2024-06-01T00:00:00Z',
    totalHours: 168,
    monthHours: 28,
    pendingSalary: 4800,
  },
  // 机构创建者（万老师）：拥有教师身份，跨校区授课（与 USERS.user-principal-001 对应）
  {
    id: 'teacher-principal-001',
    userId: 'user-principal-001',
    name: '万老师',
    phone: '138****0001',
    subjects: [],
    campusIds: ['campus-center', 'campus-east', 'campus-west'],
    canCrossCampus: true,
    accessScope: 'org',
    managedSubjectIds: [],
    role: 'lead',
    status: 'active',
    joinedAt: '2024-01-01T00:00:00Z',
    totalHours: 486,
    monthHours: 42,
    pendingSalary: 8600,
  },
];

// ============================================
// 教师统一视图：合并优先级 = 管理库(_teachers)为唯一权威源，BASE_TEACHERS 仅补充管理库缺失的
// 视图关联字段（managedSubjectIds/accessScope/userId/joinedAt/totalHours/monthHours/pendingSalary）。
// 管理库的 name/role/status/subjects/campusIds/salaryStatus/deductions 100% 生效，不被 BASE 覆盖；
// BASE 不再作为主数据基底，消除同 ID（teacher-001 等）双主数据分裂（L-03）。
// ============================================

function buildTeacherView(): Teacher[] {
  const managed = getManagedTeachers();
  // 管理库为基底（权威源），BASE 仅补缺字段
  return managed.map((m) => {
    const base = BASE_TEACHERS.find((b) => b.id === m.id);
    return {
      id: m.id,
      userId: base?.userId ?? `user-${m.id}`,
      name: m.name || m.id,
      phone: m.phone || '',
      subjects: m.subject ? [m.subject] : (base?.subjects ?? []),
      campusIds: m.campusIds ?? base?.campusIds ?? [],
      canCrossCampus: m.canCrossCampus ?? base?.canCrossCampus ?? false,
      accessScope: base?.accessScope ?? 'self',
      managedSubjectIds: base?.managedSubjectIds,
      role: m.role,
      status: m.status,
      salaryStatus: m.salaryStatus,
      deductions: m.deductions,
      joinedAt: base?.joinedAt ?? new Date().toISOString(),
      totalHours: base?.totalHours ?? 0,
      monthHours: base?.monthHours ?? 0,
      pendingSalary: base?.pendingSalary ?? 0,
    };
  });
}

/** 教师统一视图（实时派生） */
export const TEACHERS: Teacher[] = buildTeacherView();

/** 管理库 CRUD 后调用：原位刷新视图，引用不变，关联方即时可见 */
export function syncTeacherView() {
  const view = buildTeacherView();
  TEACHERS.splice(0, TEACHERS.length, ...view);
}

// ============================================
// 4. 科目
// ============================================

export interface Subject {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export const SUBJECTS: Subject[] = [
  { id: 'sub-piano', name: '钢琴', icon: 'piano', color: '#5EC8A8' },
  { id: 'sub-vocal', name: '声乐', icon: 'music', color: '#9b7ed8' },
  { id: 'sub-theory', name: '乐理', icon: 'book', color: '#6BA3D6' },
  { id: 'sub-dance', name: '舞蹈', icon: 'dance', color: '#E89BB8' },
  { id: 'sub-calligraphy', name: '书法', icon: 'calligraphy', color: '#D4A24E' },
  { id: 'sub-art', name: '美术', icon: 'art', color: '#E8864A' },
];

// ============================================
// 5. 班级
// ============================================

export interface Class {
  id: string;
  name: string;
  teacherId: string;
  teachers?: string[];
  campusId: string;
  subjectId: string;
  type: 'unlimited' | 'limited';
  /** 排课模式：fixed=固定排课, open=开放预约 */
  scheduleMode?: 'fixed' | 'open';
  /** 自动开班条件：manual=手动, full=约满, time=到时间, full_or_time=约满或到时间 */
  autoOpenType?: 'manual' | 'full' | 'time' | 'full_or_time';
  /** 最少预约人数（仅 full/full_or_time 有效） */
  minOpenCount?: number;
  schedule: string;
  weekdays: DayOfWeek[];
  startTime: string;
  endTime: string;
  totalLessons?: number;
  usedLessons: number;
  status: 'active' | 'ended';
  startDate: string;
  endDate?: string;
  color: ClassColor;
  icon: ClassIcon;
  /** 课程难度等级 */
  level?: ClassLevel;
  studentCount: number;
  pricePerLesson: number;
  /** 课程分类 ID（决定约课首页 Tab 归属） */
  categoryId?: string;
  createdAt: string;
}

export const CLASSES: Class[] = [
  // 曦绘艺术 - 张老师
  {
    id: 'cls-001',
    name: '钢琴入门A班',
    teacherId: 'teacher-001',
    teachers: ['teacher-001', 'teacher-003'],
    campusId: 'campus-center',
    subjectId: 'sub-piano',
    categoryId: 'cat-class',
    type: 'limited',
    schedule: '周一、周三 14:00-15:30',
    weekdays: [1, 3],
    startTime: '14:00',
    endTime: '15:30',
    totalLessons: 48,
    usedLessons: 32,
    status: 'active',
    startDate: '2025-09-01',
    endDate: '2026-08-31',
    color: 'primary',
    icon: 'piano',
    studentCount: 6,
    pricePerLesson: 150,
    createdAt: '2025-08-15T00:00:00Z',
  },
  {
    id: 'cls-002',
    name: '钢琴进阶B班',
    teacherId: 'teacher-001',
    teachers: ['teacher-001', 'teacher-003'],
    campusId: 'campus-center',
    subjectId: 'sub-piano',
    categoryId: 'cat-class',
    type: 'limited',
    schedule: '周二、周四 16:00-17:30',
    weekdays: [2, 4],
    startTime: '16:00',
    endTime: '17:30',
    totalLessons: 48,
    usedLessons: 28,
    status: 'active',
    startDate: '2025-09-01',
    endDate: '2026-08-31',
    color: 'info',
    icon: 'piano',
    studentCount: 5,
    pricePerLesson: 180,
    createdAt: '2025-08-15T00:00:00Z',
  },
  {
    id: 'cls-003',
    name: '乐理基础班',
    teacherId: 'teacher-001',
    teachers: ['teacher-001'],
    campusId: 'campus-center',
    subjectId: 'sub-theory',
    categoryId: 'cat-class',
    type: 'unlimited',
    schedule: '周六 10:00-11:30',
    weekdays: [6],
    startTime: '10:00',
    endTime: '11:30',
    usedLessons: 38,
    status: 'active',
    startDate: '2025-03-01',
    color: 'purple',
    icon: 'book',
    studentCount: 8,
    pricePerLesson: 120,
    createdAt: '2025-02-20T00:00:00Z',
  },
  // 曦绘艺术 - 李老师
  {
    id: 'cls-004',
    name: '声乐初级班',
    teacherId: 'teacher-002',
    teachers: ['teacher-002'],
    campusId: 'campus-center',
    subjectId: 'sub-vocal',
    categoryId: 'cat-group',
    type: 'limited',
    scheduleMode: 'open',
    autoOpenType: 'full',
    minOpenCount: 5,
    level: 'basic',
    schedule: '周一、周五 15:00-16:30',
    weekdays: [1, 5],
    startTime: '15:00',
    endTime: '16:30',
    totalLessons: 40,
    usedLessons: 24,
    status: 'active',
    startDate: '2025-09-01',
    endDate: '2026-06-30',
    color: 'amber',
    icon: 'music',
    studentCount: 7,
    pricePerLesson: 140,
    createdAt: '2025-08-20T00:00:00Z',
  },
  {
    id: 'cls-005',
    name: '童声合唱团',
    teacherId: 'teacher-002',
    teachers: ['teacher-002'],
    campusId: 'campus-center',
    subjectId: 'sub-vocal',
    categoryId: 'cat-group',
    type: 'unlimited',
    scheduleMode: 'open',
    autoOpenType: 'time',
    level: 'advanced',
    schedule: '周三、周六 09:00-10:30',
    weekdays: [3, 6],
    startTime: '09:00',
    endTime: '10:30',
    usedLessons: 45,
    status: 'active',
    startDate: '2024-09-01',
    color: 'teal',
    icon: 'music',
    studentCount: 12,
    pricePerLesson: 100,
    createdAt: '2024-08-01T00:00:00Z',
  },
  // 城东校区 - 王老师
  {
    id: 'cls-006',
    name: '中国舞初级',
    teacherId: 'teacher-003',
    campusId: 'campus-east',
    subjectId: 'sub-dance',
    categoryId: 'cat-class',
    type: 'limited',
    schedule: '周二、周四 14:00-15:30',
    weekdays: [2, 4],
    startTime: '14:00',
    endTime: '15:30',
    totalLessons: 48,
    usedLessons: 26,
    status: 'active',
    startDate: '2025-09-01',
    endDate: '2026-08-31',
    color: 'red',
    icon: 'dance',
    studentCount: 10,
    pricePerLesson: 130,
    createdAt: '2025-08-25T00:00:00Z',
  },
  {
    id: 'cls-007',
    name: '拉丁舞提高班',
    teacherId: 'teacher-003',
    campusId: 'campus-east',
    subjectId: 'sub-dance',
    categoryId: 'cat-class',
    type: 'limited',
    schedule: '周六 14:00-16:00',
    weekdays: [6],
    startTime: '14:00',
    endTime: '16:00',
    totalLessons: 24,
    usedLessons: 18,
    status: 'active',
    startDate: '2026-01-01',
    endDate: '2026-06-30',
    color: 'amber',
    icon: 'dance',
    studentCount: 8,
    pricePerLesson: 160,
    createdAt: '2025-12-20T00:00:00Z',
  },
  // 城东校区 - 李老师
  {
    id: 'cls-008',
    name: '声乐考级班',
    teacherId: 'teacher-002',
    campusId: 'campus-east',
    subjectId: 'sub-vocal',
    categoryId: 'cat-class',
    type: 'limited',
    schedule: '周五 18:00-20:00',
    weekdays: [5],
    startTime: '18:00',
    endTime: '20:00',
    totalLessons: 20,
    usedLessons: 14,
    status: 'active',
    startDate: '2026-03-01',
    endDate: '2026-08-31',
    color: 'purple',
    icon: 'music',
    studentCount: 5,
    pricePerLesson: 200,
    createdAt: '2026-02-15T00:00:00Z',
  },
  // 城西校区 - 赵老师
  {
    id: 'cls-009',
    name: '硬笔书法入门',
    teacherId: 'teacher-004',
    campusId: 'campus-west',
    subjectId: 'sub-calligraphy',
    categoryId: 'cat-class',
    type: 'limited',
    schedule: '周三、周五 15:00-16:30',
    weekdays: [3, 5],
    startTime: '15:00',
    endTime: '16:30',
    totalLessons: 48,
    usedLessons: 20,
    status: 'active',
    startDate: '2025-09-01',
    endDate: '2026-08-31',
    color: 'info',
    icon: 'calligraphy',
    studentCount: 8,
    pricePerLesson: 120,
    createdAt: '2025-08-28T00:00:00Z',
  },
  {
    id: 'cls-010',
    name: '国画基础班',
    teacherId: 'teacher-004',
    campusId: 'campus-west',
    subjectId: 'sub-art',
    categoryId: 'cat-class',
    type: 'unlimited',
    schedule: '周日 10:00-12:00',
    weekdays: [7],
    startTime: '10:00',
    endTime: '12:00',
    usedLessons: 22,
    status: 'active',
    startDate: '2025-10-01',
    color: 'teal',
    icon: 'art',
    studentCount: 6,
    pricePerLesson: 150,
    createdAt: '2025-09-20T00:00:00Z',
  },
  // 曦绘艺术 - 张老师（开放预约）
  {
    id: 'cls-011',
    name: '钢琴启蒙体验班',
    teacherId: 'teacher-001',
    teachers: ['teacher-001'],
    campusId: 'campus-center',
    subjectId: 'sub-piano',
    categoryId: 'cat-group',
    type: 'limited',
    scheduleMode: 'open',
    autoOpenType: 'full_or_time',
    minOpenCount: 3,
    level: 'all',
    schedule: '周二、周四 16:00-17:00',
    weekdays: [2, 4],
    startTime: '16:00',
    endTime: '17:00',
    totalLessons: 24,
    usedLessons: 0,
    status: 'active',
    startDate: '2026-06-01',
    endDate: '2026-12-31',
    color: 'info',
    icon: 'piano',
    studentCount: 0,
    pricePerLesson: 150,
    createdAt: '2026-06-01T00:00:00Z',
  },
  // 曦绘艺术 - 张老师（开放预约）
  {
    id: 'cls-012',
    name: '吉他弹唱班',
    teacherId: 'teacher-001',
    teachers: ['teacher-001'],
    campusId: 'campus-center',
    subjectId: 'sub-vocal',
    categoryId: 'cat-group',
    type: 'limited',
    scheduleMode: 'open',
    autoOpenType: 'full',
    minOpenCount: 4,
    level: 'basic',
    schedule: '周一、周四 17:00-18:30',
    weekdays: [1, 4],
    startTime: '17:00',
    endTime: '18:30',
    totalLessons: 32,
    usedLessons: 8,
    status: 'active',
    startDate: '2026-07-01',
    endDate: '2026-12-31',
    color: 'amber',
    icon: 'music',
    studentCount: 6,
    pricePerLesson: 130,
    createdAt: '2026-07-01T00:00:00Z',
  },
];

// ============================================
// 6. 学员
// ============================================

export interface Student {
  id: string;
  name: string;
  nickname?: string;
  /** 与家长的亲属关系（儿子/女儿），家长端子女卡片展示用 */
  relation?: string;
  gender: 'male' | 'female' | 'other';
  birthday: string;
  phone: string;
  address: string;
  parentId?: string;
  campusId: string;
  teacherId: string;
  classIds: string[];
  totalHours: number;
  remainingHours: number;
  status: 'active' | 'inactive' | 'graduated';
  createdAt: string;
  note?: string;
  avatar_url?: string;
}

export const STUDENTS: Student[] = [
  // ============================================
  // 曦绘艺术(36人) - 张老师
  // ============================================
  // cls-001 钢琴入门A班 (6人, 周一、周三)
  {
    id: 'stu-001',
    name: '张小明',
    nickname: '小明',
    relation: '儿子',
    gender: 'male',
    birthday: '2015-03-12',
    phone: '13800001101',
    address: '杭州市西湖区文三路100号',
    parentId: 'user-parent-001',
    campusId: 'campus-center',
    teacherId: 'teacher-001',
    classIds: ['cls-001'],
    totalHours: 45,
    remainingHours: 15,
    status: 'active',
    createdAt: '2025-08-20T00:00:00Z',
    note: '钢琴考级学员',
  },
  {
    id: 'stu-002',
    name: '赵小红',
    nickname: '小红',
    relation: '女儿',
    gender: 'female',
    birthday: '2016-07-22',
    phone: '13800001102',
    address: '杭州市西湖区学院路88号',
    parentId: 'user-parent-002',
    campusId: 'campus-center',
    teacherId: 'teacher-001',
    classIds: ['cls-001'],
    totalHours: 38,
    remainingHours: 22,
    status: 'active',
    createdAt: '2025-08-20T00:00:00Z',
  },
  {
    id: 'stu-003',
    name: '李子轩',
    nickname: '轩轩',
    relation: '儿子',
    gender: 'male',
    birthday: '2014-11-05',
    phone: '13800001103',
    address: '杭州市西湖区黄龙雅苑',
    parentId: 'user-parent-003',
    campusId: 'campus-center',
    teacherId: 'teacher-001',
    classIds: ['cls-001'],
    totalHours: 52,
    remainingHours: 8,
    status: 'active',
    createdAt: '2025-08-25T00:00:00Z',
    note: '准备钢琴五级考试',
  },
  {
    id: 'stu-004',
    name: '陈雨萱',
    nickname: '雨萱',
    gender: 'female',
    birthday: '2017-01-18',
    phone: '13800001104',
    address: '杭州市西湖区文二路50号',
    campusId: 'campus-center',
    teacherId: 'teacher-001',
    classIds: ['cls-001'],
    totalHours: 32,
    remainingHours: 18,
    status: 'active',
    createdAt: '2025-09-01T00:00:00Z',
  },
  {
    id: 'stu-005',
    name: '刘浩然',
    nickname: '浩然',
    gender: 'male',
    birthday: '2015-09-30',
    phone: '13800001105',
    address: '杭州市西湖区保俶路120号',
    campusId: 'campus-center',
    teacherId: 'teacher-001',
    classIds: ['cls-001'],
    totalHours: 35,
    remainingHours: 25,
    status: 'active',
    createdAt: '2025-09-05T00:00:00Z',
    note: '学习认真',
  },
  {
    id: 'stu-006',
    name: '周思琪',
    nickname: '思琪',
    gender: 'female',
    birthday: '2016-05-14',
    phone: '13800001106',
    address: '杭州市西湖区玉古路66号',
    campusId: 'campus-center',
    teacherId: 'teacher-001',
    classIds: ['cls-001'],
    totalHours: 28,
    remainingHours: 12,
    status: 'active',
    createdAt: '2025-09-10T00:00:00Z',
  },

  // cls-002 钢琴进阶B班 (5人, 周二、周四)
  {
    id: 'stu-007',
    name: '吴俊杰',
    nickname: '俊杰',
    gender: 'male',
    birthday: '2014-08-20',
    phone: '13800001107',
    address: '杭州市西湖区教工路88号',
    campusId: 'campus-center',
    teacherId: 'teacher-001',
    classIds: ['cls-002'],
    totalHours: 58,
    remainingHours: 12,
    status: 'active',
    createdAt: '2025-09-01T00:00:00Z',
    note: '钢琴四级',
  },
  {
    id: 'stu-008',
    name: '孙悦涵',
    nickname: '悦涵',
    gender: 'female',
    birthday: '2016-02-28',
    phone: '13800001108',
    address: '杭州市西湖区求是路8号',
    campusId: 'campus-center',
    teacherId: 'teacher-001',
    classIds: ['cls-002'],
    totalHours: 42,
    remainingHours: 18,
    status: 'active',
    createdAt: '2025-09-01T00:00:00Z',
  },
  {
    id: 'stu-009',
    name: '郑博文',
    nickname: '博文',
    gender: 'male',
    birthday: '2015-12-10',
    phone: '13800001109',
    address: '杭州市西湖区黄姑山路24号',
    campusId: 'campus-center',
    teacherId: 'teacher-001',
    classIds: ['cls-002'],
    totalHours: 36,
    remainingHours: 16,
    status: 'active',
    createdAt: '2025-09-05T00:00:00Z',
  },
  {
    id: 'stu-010',
    name: '林雅婷',
    nickname: '雅婷',
    gender: 'female',
    birthday: '2017-04-05',
    phone: '13800001110',
    address: '杭州市西湖区莫干山路50号',
    campusId: 'campus-center',
    teacherId: 'teacher-001',
    classIds: ['cls-002'],
    totalHours: 30,
    remainingHours: 14,
    status: 'active',
    createdAt: '2025-09-08T00:00:00Z',
  },
  {
    id: 'stu-011',
    name: '王子豪',
    nickname: '子豪',
    gender: 'male',
    birthday: '2014-06-18',
    phone: '13800001111',
    address: '杭州市西湖区马塍路66号',
    campusId: 'campus-center',
    teacherId: 'teacher-001',
    classIds: ['cls-002'],
    totalHours: 48,
    remainingHours: 20,
    status: 'active',
    createdAt: '2025-09-15T00:00:00Z',
  },

  // cls-003 乐理基础班 (8人, 周六)
  {
    id: 'stu-012',
    name: '杨诗琪',
    nickname: '诗琪',
    gender: 'female',
    birthday: '2016-09-25',
    phone: '13800001112',
    address: '杭州市西湖区文三路168号',
    campusId: 'campus-center',
    teacherId: 'teacher-001',
    classIds: ['cls-003'],
    totalHours: 24,
    remainingHours: 12,
    status: 'active',
    createdAt: '2025-10-10T00:00:00Z',
  },
  {
    id: 'stu-013',
    name: '马梓轩',
    nickname: '梓轩',
    gender: 'male',
    birthday: '2014-03-08',
    phone: '13800001113',
    address: '杭州市西湖区学院路120号',
    campusId: 'campus-center',
    teacherId: 'teacher-001',
    classIds: ['cls-003'],
    totalHours: 28,
    remainingHours: 16,
    status: 'active',
    createdAt: '2025-10-15T00:00:00Z',
  },
  {
    id: 'stu-014',
    name: '许思敏',
    nickname: '思敏',
    gender: 'female',
    birthday: '2017-07-12',
    phone: '13800001114',
    address: '杭州市西湖区黄龙雅苑2期',
    campusId: 'campus-center',
    teacherId: 'teacher-001',
    classIds: ['cls-003'],
    totalHours: 20,
    remainingHours: 14,
    status: 'active',
    createdAt: '2025-10-20T00:00:00Z',
  },
  {
    id: 'stu-015',
    name: '高晨曦',
    nickname: '晨曦',
    gender: 'female',
    birthday: '2015-11-30',
    phone: '13800001115',
    address: '杭州市西湖区文二路200号',
    campusId: 'campus-center',
    teacherId: 'teacher-001',
    classIds: ['cls-003'],
    totalHours: 32,
    remainingHours: 18,
    status: 'active',
    createdAt: '2025-11-01T00:00:00Z',
  },
  {
    id: 'stu-016',
    name: '何俊杰',
    nickname: '俊杰',
    gender: 'male',
    birthday: '2014-05-15',
    phone: '13800001116',
    address: '杭州市西湖区保俶路88号',
    campusId: 'campus-center',
    teacherId: 'teacher-001',
    classIds: ['cls-003'],
    totalHours: 26,
    remainingHours: 10,
    status: 'active',
    createdAt: '2025-11-05T00:00:00Z',
  },
  {
    id: 'stu-017',
    name: '程雅琳',
    nickname: '雅琳',
    gender: 'female',
    birthday: '2016-08-22',
    phone: '13800001117',
    address: '杭州市西湖区教工路150号',
    campusId: 'campus-center',
    teacherId: 'teacher-001',
    classIds: ['cls-003'],
    totalHours: 22,
    remainingHours: 16,
    status: 'active',
    createdAt: '2025-11-10T00:00:00Z',
  },
  {
    id: 'stu-018',
    name: '唐宇轩',
    nickname: '宇轩',
    gender: 'male',
    birthday: '2015-02-14',
    phone: '13800001118',
    address: '杭州市西湖区玉古路99号',
    campusId: 'campus-center',
    teacherId: 'teacher-001',
    classIds: ['cls-003'],
    totalHours: 34,
    remainingHours: 20,
    status: 'active',
    createdAt: '2025-11-15T00:00:00Z',
  },
  {
    id: 'stu-019',
    name: '苏雨萱',
    nickname: '雨萱',
    gender: 'female',
    birthday: '2016-06-28',
    phone: '13800001119',
    address: '杭州市西湖区求是里8号',
    campusId: 'campus-center',
    teacherId: 'teacher-001',
    classIds: ['cls-003'],
    totalHours: 18,
    remainingHours: 12,
    status: 'active',
    createdAt: '2025-12-01T00:00:00Z',
  },

  // cls-004 声乐初级班 (7人, 周一、周五)
  {
    id: 'stu-020',
    name: '曹浩然',
    nickname: '浩然',
    gender: 'male',
    birthday: '2015-10-05',
    phone: '13800001120',
    address: '杭州市西湖区黄龙花园',
    campusId: 'campus-center',
    teacherId: 'teacher-002',
    classIds: ['cls-004'],
    totalHours: 40,
    remainingHours: 18,
    status: 'active',
    createdAt: '2024-09-01T00:00:00Z',
    note: '声乐考级学员',
  },
  {
    id: 'stu-021',
    name: '秦思琪',
    nickname: '思琪',
    gender: 'female',
    birthday: '2017-03-18',
    phone: '13800001121',
    address: '杭州市西湖区文三新居',
    campusId: 'campus-center',
    teacherId: 'teacher-002',
    classIds: ['cls-004'],
    totalHours: 35,
    remainingHours: 22,
    status: 'active',
    createdAt: '2024-09-01T00:00:00Z',
  },
  {
    id: 'stu-022',
    name: '韩俊杰',
    nickname: '俊杰',
    gender: 'male',
    birthday: '2014-12-20',
    phone: '13800001122',
    address: '杭州市西湖区学院春天',
    campusId: 'campus-center',
    teacherId: 'teacher-002',
    classIds: ['cls-004'],
    totalHours: 50,
    remainingHours: 8,
    status: 'active',
    createdAt: '2024-09-10T00:00:00Z',
  },
  {
    id: 'stu-023',
    name: '沈雅婷',
    nickname: '雅婷',
    gender: 'female',
    birthday: '2017-05-12',
    phone: '13800001123',
    address: '杭州市西湖区文二新村',
    campusId: 'campus-center',
    teacherId: 'teacher-002',
    classIds: ['cls-004'],
    totalHours: 28,
    remainingHours: 16,
    status: 'active',
    createdAt: '2025-09-01T00:00:00Z',
  },
  {
    id: 'stu-024',
    name: '卢子豪',
    nickname: '子豪',
    gender: 'male',
    birthday: '2015-08-30',
    phone: '13800001124',
    address: '杭州市西湖区保俶花园',
    campusId: 'campus-center',
    teacherId: 'teacher-002',
    classIds: ['cls-004'],
    totalHours: 42,
    remainingHours: 24,
    status: 'active',
    createdAt: '2025-09-05T00:00:00Z',
  },
  {
    id: 'stu-025',
    name: '冯诗琪',
    nickname: '诗琪',
    gender: 'female',
    birthday: '2016-11-08',
    phone: '13800001125',
    address: '杭州市西湖区教工苑',
    campusId: 'campus-center',
    teacherId: 'teacher-002',
    classIds: ['cls-004'],
    totalHours: 36,
    remainingHours: 20,
    status: 'active',
    createdAt: '2025-09-10T00:00:00Z',
  },
  {
    id: 'stu-026',
    name: '于梓萱',
    nickname: '梓萱',
    gender: 'female',
    birthday: '2015-04-22',
    phone: '13800001126',
    address: '杭州市西湖区玉泉花园',
    campusId: 'campus-center',
    teacherId: 'teacher-002',
    classIds: ['cls-004'],
    totalHours: 44,
    remainingHours: 18,
    status: 'active',
    createdAt: '2025-09-15T00:00:00Z',
  },

  // cls-005 童声合唱团 (10人, 周三、周六)
  {
    id: 'stu-027',
    name: '丁明轩',
    nickname: '明轩',
    gender: 'male',
    birthday: '2014-07-15',
    phone: '13800001127',
    address: '杭州市西湖区黄龙雅苑',
    campusId: 'campus-center',
    teacherId: 'teacher-002',
    classIds: ['cls-005'],
    totalHours: 62,
    remainingHours: 0,
    status: 'active',
    createdAt: '2024-09-01T00:00:00Z',
    note: '合唱团主力',
  },
  {
    id: 'stu-028',
    name: '梁欣怡',
    nickname: '欣怡',
    gender: 'female',
    birthday: '2016-01-28',
    phone: '13800001128',
    address: '杭州市西湖区文三路50号',
    campusId: 'campus-center',
    teacherId: 'teacher-002',
    classIds: ['cls-005'],
    totalHours: 58,
    remainingHours: 12,
    status: 'active',
    createdAt: '2024-09-01T00:00:00Z',
  },
  {
    id: 'stu-029',
    name: '莫天宇',
    nickname: '天宇',
    gender: 'male',
    birthday: '2015-09-12',
    phone: '13800001129',
    address: '杭州市西湖区学院路66号',
    campusId: 'campus-center',
    teacherId: 'teacher-002',
    classIds: ['cls-005'],
    totalHours: 54,
    remainingHours: 18,
    status: 'active',
    createdAt: '2024-09-05T00:00:00Z',
  },
  {
    id: 'stu-030',
    name: '解雅静',
    nickname: '雅静',
    gender: 'female',
    birthday: '2017-06-18',
    phone: '13800001130',
    address: '杭州市西湖区文二路88号',
    campusId: 'campus-center',
    teacherId: 'teacher-002',
    classIds: ['cls-005'],
    totalHours: 48,
    remainingHours: 24,
    status: 'active',
    createdAt: '2024-09-10T00:00:00Z',
  },
  {
    id: 'stu-031',
    name: '戚浩然',
    nickname: '浩然',
    gender: 'male',
    birthday: '2014-11-25',
    phone: '13800001131',
    address: '杭州市西湖区保俶路120号',
    campusId: 'campus-center',
    teacherId: 'teacher-002',
    classIds: ['cls-005'],
    totalHours: 60,
    remainingHours: 6,
    status: 'active',
    createdAt: '2024-09-15T00:00:00Z',
  },
  {
    id: 'stu-032',
    name: '卫俊豪',
    nickname: '俊豪',
    gender: 'male',
    birthday: '2015-07-22',
    phone: '13800001132',
    address: '杭州市西湖区教工路150号',
    campusId: 'campus-center',
    teacherId: 'teacher-002',
    classIds: ['cls-005'],
    totalHours: 52,
    remainingHours: 14,
    status: 'active',
    createdAt: '2025-09-01T00:00:00Z',
  },
  {
    id: 'stu-033',
    name: '魏天宇',
    nickname: '天宇',
    gender: 'male',
    birthday: '2015-07-22',
    phone: '13800001133',
    address: '杭州市西湖区玉古路200号',
    campusId: 'campus-center',
    teacherId: 'teacher-002',
    classIds: ['cls-005'],
    totalHours: 46,
    remainingHours: 20,
    status: 'active',
    createdAt: '2025-09-05T00:00:00Z',
  },
  {
    id: 'stu-034',
    name: '游梓萱',
    nickname: '梓萱',
    gender: 'female',
    birthday: '2016-12-30',
    phone: '13800001134',
    address: '杭州市西湖区求是里66号',
    campusId: 'campus-center',
    teacherId: 'teacher-002',
    classIds: ['cls-005'],
    totalHours: 38,
    remainingHours: 16,
    status: 'active',
    createdAt: '2025-09-10T00:00:00Z',
  },
  {
    id: 'stu-035',
    name: '樊晨曦',
    nickname: '晨曦',
    gender: 'female',
    birthday: '2017-02-14',
    phone: '13800001135',
    address: '杭州市西湖区黄龙花园2期',
    campusId: 'campus-center',
    teacherId: 'teacher-002',
    classIds: ['cls-005'],
    totalHours: 34,
    remainingHours: 22,
    status: 'active',
    createdAt: '2025-09-15T00:00:00Z',
  },
  {
    id: 'stu-036',
    name: '董俊杰',
    nickname: '俊杰',
    gender: 'male',
    birthday: '2014-10-08',
    phone: '13800001136',
    address: '杭州市西湖区文三新居8号',
    campusId: 'campus-center',
    teacherId: 'teacher-002',
    classIds: ['cls-005'],
    totalHours: 56,
    remainingHours: 10,
    status: 'active',
    createdAt: '2025-09-20T00:00:00Z',
  },

  // ============================================
  // 城东校区(19人) - 王老师
  // ============================================
  // cls-006 中国舞初级 (8人, 周二、周四)
  {
    id: 'stu-037',
    name: '鲁峻熙',
    nickname: '峻熙',
    gender: 'male',
    birthday: '2015-06-18',
    phone: '13800001137',
    address: '杭州市上城区钱江路300号',
    campusId: 'campus-east',
    teacherId: 'teacher-003',
    classIds: ['cls-006'],
    totalHours: 42,
    remainingHours: 18,
    status: 'active',
    createdAt: '2025-09-01T00:00:00Z',
    note: '舞蹈天赋高',
  },
  {
    id: 'stu-038',
    name: '景诗琪',
    nickname: '诗琪',
    gender: 'female',
    birthday: '2016-09-25',
    phone: '13800001138',
    address: '杭州市上城区之江路168号',
    campusId: 'campus-east',
    teacherId: 'teacher-003',
    classIds: ['cls-006'],
    totalHours: 36,
    remainingHours: 24,
    status: 'active',
    createdAt: '2025-09-05T00:00:00Z',
  },
  {
    id: 'stu-039',
    name: '顾梓轩',
    nickname: '梓轩',
    gender: 'male',
    birthday: '2014-03-08',
    phone: '13800001139',
    address: '杭州市上城区钱潮路66号',
    campusId: 'campus-east',
    teacherId: 'teacher-003',
    classIds: ['cls-006'],
    totalHours: 48,
    remainingHours: 12,
    status: 'active',
    createdAt: '2025-09-10T00:00:00Z',
  },
  {
    id: 'stu-040',
    name: '梅思敏',
    nickname: '思敏',
    gender: 'female',
    birthday: '2017-07-12',
    phone: '13800001140',
    address: '杭州市上城区市民街88号',
    campusId: 'campus-east',
    teacherId: 'teacher-003',
    classIds: ['cls-006'],
    totalHours: 30,
    remainingHours: 20,
    status: 'active',
    createdAt: '2025-09-15T00:00:00Z',
  },
  {
    id: 'stu-041',
    name: '俞晨曦',
    nickname: '晨曦',
    gender: 'female',
    birthday: '2015-11-30',
    phone: '13800001141',
    address: '杭州市上城区富春路188号',
    campusId: 'campus-east',
    teacherId: 'teacher-003',
    classIds: ['cls-006'],
    totalHours: 44,
    remainingHours: 16,
    status: 'active',
    createdAt: '2025-09-20T00:00:00Z',
  },
  {
    id: 'stu-042',
    name: '任俊杰',
    nickname: '俊杰',
    gender: 'male',
    birthday: '2014-05-15',
    phone: '13800001142',
    address: '杭州市上城区钱江东路88号',
    campusId: 'campus-east',
    teacherId: 'teacher-003',
    classIds: ['cls-006'],
    totalHours: 38,
    remainingHours: 22,
    status: 'active',
    createdAt: '2025-10-01T00:00:00Z',
  },
  {
    id: 'stu-043',
    name: '葛雅琳',
    nickname: '雅琳',
    gender: 'female',
    birthday: '2016-08-22',
    phone: '13800001143',
    address: '杭州市上城区钱江二路66号',
    campusId: 'campus-east',
    teacherId: 'teacher-003',
    classIds: ['cls-006'],
    totalHours: 32,
    remainingHours: 18,
    status: 'active',
    createdAt: '2025-10-05T00:00:00Z',
  },
  {
    id: 'stu-044',
    name: '左宇轩',
    nickname: '宇轩',
    gender: 'male',
    birthday: '2015-02-14',
    phone: '13800001144',
    address: '杭州市上城区之江新城',
    campusId: 'campus-east',
    teacherId: 'teacher-003',
    classIds: ['cls-006'],
    totalHours: 40,
    remainingHours: 14,
    status: 'active',
    createdAt: '2025-10-10T00:00:00Z',
  },

  // cls-007 拉丁舞提高班 (6人, 周六)
  {
    id: 'stu-045',
    name: '徐雨萱',
    nickname: '雨萱',
    gender: 'female',
    birthday: '2016-06-28',
    phone: '13800001145',
    address: '杭州市上城区钱江路168号',
    campusId: 'campus-east',
    teacherId: 'teacher-003',
    classIds: ['cls-007'],
    totalHours: 24,
    remainingHours: 12,
    status: 'active',
    createdAt: '2026-01-05T00:00:00Z',
  },
  {
    id: 'stu-046',
    name: '蒋浩然',
    nickname: '浩然',
    gender: 'male',
    birthday: '2015-10-05',
    phone: '13800001146',
    address: '杭州市上城区市民街66号',
    campusId: 'campus-east',
    teacherId: 'teacher-003',
    classIds: ['cls-007'],
    totalHours: 28,
    remainingHours: 16,
    status: 'active',
    createdAt: '2026-01-10T00:00:00Z',
  },
  {
    id: 'stu-047',
    name: '韩思琪',
    nickname: '思琪',
    gender: 'female',
    birthday: '2017-03-18',
    phone: '13800001147',
    address: '杭州市上城区钱潮路120号',
    campusId: 'campus-east',
    teacherId: 'teacher-003',
    classIds: ['cls-007'],
    totalHours: 22,
    remainingHours: 14,
    status: 'active',
    createdAt: '2026-01-15T00:00:00Z',
  },
  {
    id: 'stu-048',
    name: '冯俊杰',
    nickname: '俊杰',
    gender: 'male',
    birthday: '2014-12-20',
    phone: '13800001148',
    address: '杭州市上城区富春街88号',
    campusId: 'campus-east',
    teacherId: 'teacher-003',
    classIds: ['cls-007'],
    totalHours: 32,
    remainingHours: 18,
    status: 'active',
    createdAt: '2026-01-20T00:00:00Z',
  },
  {
    id: 'stu-049',
    name: '陈雅婷',
    nickname: '雅婷',
    gender: 'female',
    birthday: '2017-04-12',
    phone: '13800001149',
    address: '杭州市上城区钱江东路200号',
    campusId: 'campus-east',
    teacherId: 'teacher-003',
    classIds: ['cls-007'],
    totalHours: 26,
    remainingHours: 20,
    status: 'active',
    createdAt: '2026-02-01T00:00:00Z',
  },
  {
    id: 'stu-050',
    name: '李子豪',
    nickname: '子豪',
    gender: 'male',
    birthday: '2015-08-30',
    phone: '13800001150',
    address: '杭州市上城区之江路88号',
    campusId: 'campus-east',
    teacherId: 'teacher-003',
    classIds: ['cls-007'],
    totalHours: 30,
    remainingHours: 12,
    status: 'active',
    createdAt: '2026-02-05T00:00:00Z',
  },

  // cls-008 声乐考级班 (5人, 周五) - 李老师
  {
    id: 'stu-051',
    name: '吴诗琪',
    nickname: '诗琪',
    gender: 'female',
    birthday: '2016-11-08',
    phone: '13800001151',
    address: '杭州市上城区钱江路158号',
    campusId: 'campus-east',
    teacherId: 'teacher-002',
    classIds: ['cls-008'],
    totalHours: 20,
    remainingHours: 12,
    status: 'active',
    createdAt: '2026-03-01T00:00:00Z',
    note: '准备声乐考级',
  },
  {
    id: 'stu-052',
    name: '孙梓萱',
    nickname: '梓萱',
    gender: 'female',
    birthday: '2015-04-22',
    phone: '13800001152',
    address: '杭州市上城区市民街168号',
    campusId: 'campus-east',
    teacherId: 'teacher-002',
    classIds: ['cls-008'],
    totalHours: 18,
    remainingHours: 14,
    status: 'active',
    createdAt: '2026-03-05T00:00:00Z',
  },
  {
    id: 'stu-053',
    name: '周晨曦',
    nickname: '晨曦',
    gender: 'female',
    birthday: '2017-02-14',
    phone: '13800001153',
    address: '杭州市上城区钱潮路188号',
    campusId: 'campus-east',
    teacherId: 'teacher-002',
    classIds: ['cls-008'],
    totalHours: 16,
    remainingHours: 10,
    status: 'active',
    createdAt: '2026-03-10T00:00:00Z',
  },
  {
    id: 'stu-054',
    name: '郑俊杰',
    nickname: '俊杰',
    gender: 'male',
    birthday: '2014-10-08',
    phone: '13800001154',
    address: '杭州市上城区富春路66号',
    campusId: 'campus-east',
    teacherId: 'teacher-002',
    classIds: ['cls-008'],
    totalHours: 24,
    remainingHours: 16,
    status: 'active',
    createdAt: '2026-03-15T00:00:00Z',
  },
  {
    id: 'stu-055',
    name: '王雅琳',
    nickname: '雅琳',
    gender: 'female',
    birthday: '2016-08-22',
    phone: '13800001155',
    address: '杭州市上城区钱江二路88号',
    campusId: 'campus-east',
    teacherId: 'teacher-002',
    classIds: ['cls-008'],
    totalHours: 22,
    remainingHours: 18,
    status: 'active',
    createdAt: '2026-03-20T00:00:00Z',
  },

  // ============================================
  // 城西校区(13人) - 赵老师
  // ============================================
  // cls-009 硬笔书法入门 (7人, 周三、周五)
  {
    id: 'stu-056',
    name: '刘宇轩',
    nickname: '宇轩',
    gender: 'male',
    birthday: '2015-02-14',
    phone: '13800001156',
    address: '杭州市余杭区EFC欧美金融城',
    campusId: 'campus-west',
    teacherId: 'teacher-004',
    classIds: ['cls-009'],
    totalHours: 38,
    remainingHours: 22,
    status: 'active',
    createdAt: '2025-09-15T00:00:00Z',
    note: '书法天赋高',
  },
  {
    id: 'stu-057',
    name: '陈雨萱',
    nickname: '雨萱',
    gender: 'female',
    birthday: '2016-06-28',
    phone: '13800001157',
    address: '杭州市余杭区梦想小镇',
    campusId: 'campus-west',
    teacherId: 'teacher-004',
    classIds: ['cls-009'],
    totalHours: 32,
    remainingHours: 18,
    status: 'active',
    createdAt: '2025-09-20T00:00:00Z',
  },
  {
    id: 'stu-058',
    name: '林浩然',
    nickname: '浩然',
    gender: 'male',
    birthday: '2015-10-05',
    phone: '13800001158',
    address: '杭州市余杭区海创园',
    campusId: 'campus-west',
    teacherId: 'teacher-004',
    classIds: ['cls-009'],
    totalHours: 36,
    remainingHours: 24,
    status: 'active',
    createdAt: '2025-10-05T00:00:00Z',
  },
  {
    id: 'stu-059',
    name: '黄思琪',
    nickname: '思琪',
    gender: 'female',
    birthday: '2017-03-18',
    phone: '13800001159',
    address: '杭州市余杭区阿里巴城园区',
    campusId: 'campus-west',
    teacherId: 'teacher-004',
    classIds: ['cls-009'],
    totalHours: 28,
    remainingHours: 16,
    status: 'active',
    createdAt: '2025-10-10T00:00:00Z',
  },
  {
    id: 'stu-060',
    name: '杨俊杰',
    nickname: '俊杰',
    gender: 'male',
    birthday: '2014-12-20',
    phone: '13800001160',
    address: '杭州市余杭区未来科技城',
    campusId: 'campus-west',
    teacherId: 'teacher-004',
    classIds: ['cls-009'],
    totalHours: 40,
    remainingHours: 20,
    status: 'active',
    createdAt: '2025-10-15T00:00:00Z',
  },
  {
    id: 'stu-061',
    name: '赵雅婷',
    nickname: '雅婷',
    gender: 'female',
    birthday: '2017-04-12',
    phone: '13800001161',
    address: '杭州市余杭区EFC澳洲村',
    campusId: 'campus-west',
    teacherId: 'teacher-004',
    classIds: ['cls-009'],
    totalHours: 34,
    remainingHours: 18,
    status: 'active',
    createdAt: '2025-10-20T00:00:00Z',
  },
  {
    id: 'stu-062',
    name: '钱子豪',
    nickname: '子豪',
    gender: 'male',
    birthday: '2015-08-30',
    phone: '13800001162',
    address: '杭州市余杭区梦想小镇二期',
    campusId: 'campus-west',
    teacherId: 'teacher-004',
    classIds: ['cls-009'],
    totalHours: 26,
    remainingHours: 14,
    status: 'active',
    createdAt: '2025-11-01T00:00:00Z',
  },

  // cls-010 国画基础班 (6人, 周日)
  {
    id: 'stu-063',
    name: '李白璐',
    nickname: '白璐',
    gender: 'female',
    birthday: '2016-11-08',
    phone: '13800001163',
    address: '杭州市余杭区海创园8号',
    campusId: 'campus-west',
    teacherId: 'teacher-004',
    classIds: ['cls-010'],
    totalHours: 22,
    remainingHours: 14,
    status: 'active',
    createdAt: '2025-10-01T00:00:00Z',
  },
  {
    id: 'stu-064',
    name: '杜甫欣',
    nickname: '欣怡',
    gender: 'female',
    birthday: '2017-02-14',
    phone: '13800001164',
    address: '杭州市余杭区梦想小镇12号',
    campusId: 'campus-west',
    teacherId: 'teacher-004',
    classIds: ['cls-010'],
    totalHours: 28,
    remainingHours: 18,
    status: 'active',
    createdAt: '2025-10-05T00:00:00Z',
  },
  {
    id: 'stu-065',
    name: '王维浩',
    nickname: '维浩',
    gender: 'male',
    birthday: '2015-07-22',
    phone: '13800001165',
    address: '杭州市余杭区EFC英国村',
    campusId: 'campus-west',
    teacherId: 'teacher-004',
    classIds: ['cls-010'],
    totalHours: 24,
    remainingHours: 12,
    status: 'active',
    createdAt: '2025-10-10T00:00:00Z',
  },
  {
    id: 'stu-066',
    name: '苏轼萱',
    nickname: '轼萱',
    gender: 'female',
    birthday: '2016-04-22',
    phone: '13800001166',
    address: '杭州市余杭区未来科技城',
    campusId: 'campus-west',
    teacherId: 'teacher-004',
    classIds: ['cls-010'],
    totalHours: 30,
    remainingHours: 16,
    status: 'active',
    createdAt: '2025-10-15T00:00:00Z',
  },
  {
    id: 'stu-067',
    name: '李白白',
    nickname: '白白',
    gender: 'male',
    birthday: '2014-10-08',
    phone: '13800001167',
    address: '杭州市余杭区海创园66号',
    campusId: 'campus-west',
    teacherId: 'teacher-004',
    classIds: ['cls-010'],
    totalHours: 26,
    remainingHours: 20,
    status: 'active',
    createdAt: '2025-10-20T00:00:00Z',
  },
  {
    id: 'stu-068',
    name: '杜甫怡',
    nickname: '怡怡',
    gender: 'female',
    birthday: '2017-06-18',
    phone: '13800001168',
    address: '杭州市余杭区梦想小镇88号',
    campusId: 'campus-west',
    teacherId: 'teacher-004',
    classIds: ['cls-010'],
    totalHours: 20,
    remainingHours: 14,
    status: 'active',
    createdAt: '2025-11-01T00:00:00Z',
  },
  {
    id: 'stu-069',
    name: '顾书瑶',
    nickname: '书瑶',
    gender: 'female',
    birthday: '2016-03-16',
    phone: '13800001169',
    address: '杭州市西湖区文一路218号',
    campusId: 'campus-center',
    teacherId: 'teacher-001',
    classIds: ['cls-002'],
    totalHours: 36,
    remainingHours: 18,
    status: 'active',
    createdAt: '2026-02-18T00:00:00Z',
    note: '补录添加学员测试样本',
  },
  {
    id: 'stu-070',
    name: '沈奕辰',
    nickname: '奕辰',
    gender: 'male',
    birthday: '2015-12-09',
    phone: '13800001170',
    address: '杭州市西湖区万塘路98号',
    campusId: 'campus-center',
    teacherId: 'teacher-001',
    classIds: ['cls-003'],
    totalHours: 24,
    remainingHours: 10,
    status: 'active',
    createdAt: '2026-03-06T00:00:00Z',
    note: '补录添加学员测试样本',
  },
  {
    id: 'stu-071',
    name: '许安琪',
    nickname: '安琪',
    gender: 'female',
    birthday: '2017-08-21',
    phone: '13800001171',
    address: '杭州市西湖区古荡新村32号',
    campusId: 'campus-center',
    teacherId: 'teacher-001',
    classIds: ['cls-002'],
    totalHours: 28,
    remainingHours: 22,
    status: 'active',
    createdAt: '2026-04-12T00:00:00Z',
    note: '补录添加学员测试样本',
  },

  // 尚未排入任何班级的学员（classIds 为空），用于「未排班」筛选展示
  {
    id: 'stu-073',
    name: '周子涵',
    nickname: '子涵',
    gender: 'male',
    birthday: '2016-05-14',
    phone: '13800001173',
    address: '杭州市西湖区文三西路90号',
    campusId: 'campus-center',
    teacherId: 'teacher-001',
    classIds: [],
    totalHours: 30,
    remainingHours: 30,
    status: 'active',
    createdAt: '2026-06-01T00:00:00Z',
    note: '新报名待排班',
  },
  {
    id: 'stu-074',
    name: '吴梓萱',
    nickname: '梓萱',
    gender: 'female',
    birthday: '2015-09-03',
    phone: '13800001174',
    address: '杭州市西湖区益乐新村',
    campusId: 'campus-center',
    teacherId: 'teacher-001',
    classIds: [],
    totalHours: 24,
    remainingHours: 24,
    status: 'active',
    createdAt: '2026-06-05T00:00:00Z',
    note: '新报名待排班',
  },
  {
    id: 'stu-075',
    name: '郑宇轩',
    nickname: '宇轩',
    gender: 'male',
    birthday: '2014-11-28',
    phone: '13800001175',
    address: '杭州市西湖区荷花苑',
    campusId: 'campus-center',
    teacherId: 'teacher-002',
    classIds: [],
    totalHours: 20,
    remainingHours: 20,
    status: 'active',
    createdAt: '2026-06-10T00:00:00Z',
    note: '体验课待转化排班',
  },
  {
    id: 'stu-076',
    name: '王诗韵',
    nickname: '诗韵',
    gender: 'female',
    birthday: '2017-02-19',
    phone: '13800001176',
    address: '杭州市西湖区马塍路',
    campusId: 'campus-center',
    teacherId: 'teacher-001',
    classIds: [],
    totalHours: 16,
    remainingHours: 16,
    status: 'active',
    createdAt: '2026-06-15T00:00:00Z',
    note: '新报名待排班',
  },
];

// ============================================
// 7. 课包
// ============================================

export interface CoursePackage {
  id: string;
  studentId: string;
  classId: string;
  name: string;
  type?: 'hour_package' | 'term' | 'monthly' | 'trial';
  subjectId: string;
  totalHours: number;
  purchasedHours: number;
  bonusHours: number;
  usedHours: number;
  remainingHours: number;
  pricePerHour: number;
  totalAmount: number;
  paymentMethod: 'wechat' | 'alipay' | 'cash' | 'transfer';
  status: 'active' | 'expired' | 'finished';
  purchaseDate: string;
  expireDate?: string;
  note?: string;
  /** 关联会员卡 ID（次卡发卡时建立，用于「剩余次数 ↔ 剩余课时」双向同步，消除脆弱的 name 字符串匹配） */
  memberCardId?: string;
}

export const COURSE_PACKAGES: CoursePackage[] = [
  {
    id: 'pkg-001',
    studentId: 'stu-001',
    classId: 'cls-001',
    name: '钢琴入门课包',
    subjectId: 'sub-piano',
    totalHours: 60,
    purchasedHours: 50,
    bonusHours: 10,
    usedHours: 45,
    remainingHours: 15,
    pricePerHour: 150,
    totalAmount: 7500,
    paymentMethod: 'transfer',
    status: 'active',
    purchaseDate: '2025-08-20T00:00:00Z',
    expireDate: '2026-08-20T00:00:00Z',
  },
  {
    id: 'pkg-002',
    studentId: 'stu-001',
    classId: 'cls-003',
    name: '乐理课包',
    subjectId: 'sub-theory',
    totalHours: 24,
    purchasedHours: 24,
    bonusHours: 0,
    usedHours: 0,
    remainingHours: 24,
    pricePerHour: 120,
    totalAmount: 2880,
    paymentMethod: 'wechat',
    status: 'active',
    purchaseDate: '2026-01-15T00:00:00Z',
    expireDate: '2026-07-15T00:00:00Z',
  },
  {
    id: 'pkg-003',
    studentId: 'stu-002',
    classId: 'cls-001',
    name: '钢琴课包',
    subjectId: 'sub-piano',
    totalHours: 60,
    purchasedHours: 48,
    bonusHours: 12,
    usedHours: 38,
    remainingHours: 22,
    pricePerHour: 150,
    totalAmount: 7200,
    paymentMethod: 'wechat',
    status: 'active',
    purchaseDate: '2025-08-20T00:00:00Z',
    expireDate: '2026-08-20T00:00:00Z',
  },
  {
    id: 'pkg-004',
    studentId: 'stu-002',
    classId: 'cls-002',
    name: '钢琴进阶课包',
    subjectId: 'sub-piano',
    totalHours: 48,
    purchasedHours: 48,
    bonusHours: 0,
    usedHours: 0,
    remainingHours: 48,
    pricePerHour: 180,
    totalAmount: 8640,
    paymentMethod: 'alipay',
    status: 'active',
    purchaseDate: '2026-02-01T00:00:00Z',
    expireDate: '2026-08-01T00:00:00Z',
  },
  {
    id: 'pkg-005',
    studentId: 'stu-003',
    classId: 'cls-001',
    name: '钢琴考级课包',
    subjectId: 'sub-piano',
    totalHours: 60,
    purchasedHours: 50,
    bonusHours: 10,
    usedHours: 52,
    remainingHours: 8,
    pricePerHour: 180,
    totalAmount: 9000,
    paymentMethod: 'transfer',
    status: 'active',
    purchaseDate: '2025-08-25T00:00:00Z',
    expireDate: '2026-08-25T00:00:00Z',
    note: '准备钢琴五级考试',
  },
  {
    id: 'pkg-006',
    studentId: 'stu-004',
    classId: 'cls-002',
    name: '钢琴课包',
    subjectId: 'sub-piano',
    totalHours: 48,
    purchasedHours: 40,
    bonusHours: 8,
    usedHours: 28,
    remainingHours: 20,
    pricePerHour: 180,
    totalAmount: 7200,
    paymentMethod: 'cash',
    status: 'active',
    purchaseDate: '2025-09-01T00:00:00Z',
    expireDate: '2026-09-01T00:00:00Z',
  },
  {
    id: 'pkg-007',
    studentId: 'stu-005',
    classId: 'cls-001',
    name: '钢琴课包',
    subjectId: 'sub-piano',
    totalHours: 60,
    purchasedHours: 50,
    bonusHours: 10,
    usedHours: 35,
    remainingHours: 25,
    pricePerHour: 150,
    totalAmount: 7500,
    paymentMethod: 'wechat',
    status: 'active',
    purchaseDate: '2025-09-05T00:00:00Z',
    expireDate: '2026-09-05T00:00:00Z',
  },
  {
    id: 'pkg-008',
    studentId: 'stu-007',
    classId: 'cls-004',
    name: '声乐课包',
    subjectId: 'sub-vocal',
    totalHours: 72,
    purchasedHours: 60,
    bonusHours: 12,
    usedHours: 58,
    remainingHours: 14,
    pricePerHour: 140,
    totalAmount: 8400,
    paymentMethod: 'transfer',
    status: 'active',
    purchaseDate: '2024-09-15T00:00:00Z',
    expireDate: '2025-09-15T00:00:00Z',
  },
  {
    id: 'pkg-009',
    studentId: 'stu-011',
    classId: 'cls-006',
    name: '中国舞课包',
    subjectId: 'sub-dance',
    totalHours: 60,
    purchasedHours: 50,
    bonusHours: 10,
    usedHours: 40,
    remainingHours: 20,
    pricePerHour: 130,
    totalAmount: 6500,
    paymentMethod: 'wechat',
    status: 'active',
    purchaseDate: '2025-09-01T00:00:00Z',
    expireDate: '2026-09-01T00:00:00Z',
  },
  {
    id: 'pkg-010',
    studentId: 'stu-018',
    classId: 'cls-009',
    name: '书法课包',
    subjectId: 'sub-calligraphy',
    totalHours: 60,
    purchasedHours: 48,
    bonusHours: 12,
    usedHours: 38,
    remainingHours: 22,
    pricePerHour: 120,
    totalAmount: 5760,
    paymentMethod: 'alipay',
    status: 'active',
    purchaseDate: '2025-09-15T00:00:00Z',
    expireDate: '2026-09-15T00:00:00Z',
  },
  {
    id: 'pkg-011',
    studentId: 'stu-006',
    classId: 'cls-001',
    name: '钢琴试听课',
    type: 'trial',
    subjectId: 'sub-piano',
    totalHours: 1,
    purchasedHours: 1,
    bonusHours: 0,
    usedHours: 0,
    remainingHours: 1,
    pricePerHour: 0,
    totalAmount: 0,
    paymentMethod: 'wechat',
    status: 'active',
    purchaseDate: '2026-06-20T00:00:00Z',
    expireDate: '2026-06-30T00:00:00Z',
    note: '试听课学员',
  },
  // 2026-08-22 修复：国画基础班(stu-063/064/068)补充课包，与 6/28 补课示例记录(已消2课时)对账
  {
    id: 'pkg-012',
    studentId: 'stu-063',
    classId: 'cls-010',
    name: '国画课包',
    type: 'hour_package',
    subjectId: 'sub-art',
    totalHours: 24,
    purchasedHours: 24,
    bonusHours: 0,
    usedHours: 2,
    remainingHours: 22,
    pricePerHour: 120,
    totalAmount: 2880,
    paymentMethod: 'wechat',
    status: 'active',
    purchaseDate: '2025-09-01T00:00:00Z',
    expireDate: '2026-09-01T00:00:00Z',
  },
  {
    id: 'pkg-013',
    studentId: 'stu-064',
    classId: 'cls-010',
    name: '国画课包',
    type: 'hour_package',
    subjectId: 'sub-art',
    totalHours: 24,
    purchasedHours: 24,
    bonusHours: 0,
    usedHours: 2,
    remainingHours: 22,
    pricePerHour: 120,
    totalAmount: 2880,
    paymentMethod: 'wechat',
    status: 'active',
    purchaseDate: '2025-09-01T00:00:00Z',
    expireDate: '2026-09-01T00:00:00Z',
  },
  {
    id: 'pkg-014',
    studentId: 'stu-068',
    classId: 'cls-010',
    name: '国画课包',
    type: 'hour_package',
    subjectId: 'sub-art',
    totalHours: 24,
    purchasedHours: 24,
    bonusHours: 0,
    usedHours: 2,
    remainingHours: 22,
    pricePerHour: 120,
    totalAmount: 2880,
    paymentMethod: 'wechat',
    status: 'active',
    purchaseDate: '2025-09-01T00:00:00Z',
    expireDate: '2026-09-01T00:00:00Z',
  },
];

// ============================================
// 8. 排课记录
// ============================================

export interface Schedule {
  id: string;
  classId: string;
  teacherId: string;
  campusId: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  room?: string;
  status: 'scheduled' | 'done' | 'cancelled';
  semesterId?: string;
  semesterName?: string;
  createdAt?: string;
}

export const SCHEDULES: Schedule[] = [
  {
    id: 'sch-001',
    classId: 'cls-001',
    teacherId: 'teacher-001',
    campusId: 'campus-center',
    dayOfWeek: 1,
    startTime: '14:00',
    endTime: '15:30',
    room: '101',
    status: 'scheduled',
  },
  {
    id: 'sch-002',
    classId: 'cls-001',
    teacherId: 'teacher-001',
    campusId: 'campus-center',
    dayOfWeek: 3,
    startTime: '14:00',
    endTime: '15:30',
    room: '101',
    status: 'scheduled',
  },
  {
    id: 'sch-003',
    classId: 'cls-002',
    teacherId: 'teacher-001',
    campusId: 'campus-center',
    dayOfWeek: 2,
    startTime: '16:00',
    endTime: '17:30',
    room: '102',
    status: 'scheduled',
  },
  {
    id: 'sch-004',
    classId: 'cls-002',
    teacherId: 'teacher-001',
    campusId: 'campus-center',
    dayOfWeek: 4,
    startTime: '16:00',
    endTime: '17:30',
    room: '102',
    status: 'scheduled',
  },
  {
    id: 'sch-005',
    classId: 'cls-003',
    teacherId: 'teacher-001',
    campusId: 'campus-center',
    dayOfWeek: 6,
    startTime: '10:00',
    endTime: '11:30',
    room: '201',
    status: 'scheduled',
  },
  {
    id: 'sch-006',
    classId: 'cls-004',
    teacherId: 'teacher-002',
    campusId: 'campus-center',
    dayOfWeek: 1,
    startTime: '15:00',
    endTime: '16:30',
    room: '301',
    status: 'scheduled',
  },
  {
    id: 'sch-007',
    classId: 'cls-004',
    teacherId: 'teacher-002',
    campusId: 'campus-center',
    dayOfWeek: 5,
    startTime: '15:00',
    endTime: '16:30',
    room: '301',
    status: 'scheduled',
  },
  {
    id: 'sch-008',
    classId: 'cls-005',
    teacherId: 'teacher-002',
    campusId: 'campus-center',
    dayOfWeek: 3,
    startTime: '09:00',
    endTime: '10:30',
    room: '302',
    status: 'scheduled',
  },
  {
    id: 'sch-009',
    classId: 'cls-005',
    teacherId: 'teacher-002',
    campusId: 'campus-center',
    dayOfWeek: 6,
    startTime: '09:00',
    endTime: '10:30',
    room: '302',
    status: 'scheduled',
  },
  {
    id: 'sch-010',
    classId: 'cls-006',
    teacherId: 'teacher-003',
    campusId: 'campus-east',
    dayOfWeek: 2,
    startTime: '14:00',
    endTime: '15:30',
    room: '舞蹈教室1',
    status: 'scheduled',
  },
  {
    id: 'sch-011',
    classId: 'cls-006',
    teacherId: 'teacher-003',
    campusId: 'campus-east',
    dayOfWeek: 4,
    startTime: '14:00',
    endTime: '15:30',
    room: '舞蹈教室1',
    status: 'scheduled',
  },
  {
    id: 'sch-012',
    classId: 'cls-007',
    teacherId: 'teacher-003',
    campusId: 'campus-east',
    dayOfWeek: 6,
    startTime: '14:00',
    endTime: '16:00',
    room: '舞蹈教室2',
    status: 'scheduled',
  },
  {
    id: 'sch-013',
    classId: 'cls-008',
    teacherId: 'teacher-002',
    campusId: 'campus-east',
    dayOfWeek: 5,
    startTime: '18:00',
    endTime: '20:00',
    room: '声乐教室1',
    status: 'scheduled',
  },
  {
    id: 'sch-014',
    classId: 'cls-009',
    teacherId: 'teacher-004',
    campusId: 'campus-west',
    dayOfWeek: 3,
    startTime: '15:00',
    endTime: '16:30',
    room: '书法教室1',
    status: 'scheduled',
  },
  {
    id: 'sch-015',
    classId: 'cls-009',
    teacherId: 'teacher-004',
    campusId: 'campus-west',
    dayOfWeek: 5,
    startTime: '15:00',
    endTime: '16:30',
    room: '书法教室1',
    status: 'scheduled',
  },
  {
    id: 'sch-016',
    classId: 'cls-010',
    teacherId: 'teacher-004',
    campusId: 'campus-west',
    dayOfWeek: 7,
    startTime: '10:00',
    endTime: '12:00',
    room: '美术教室1',
    status: 'scheduled',
  },
];

// ============================================
// 9. 消课记录（历史数据：过去12个月）
// ============================================

export interface LessonRecord {
  id: string;
  studentId: string;
  classId: string;
  teacherId: string;
  operatorTeacherId?: string;
  assistantTeacherId?: string;
  campusId: string;
  date: string;
  startTime: string;
  endTime: string;
  hours: number;
  status: 'checked' | 'leave' | 'absent' | 'cancelled' | 'makeup';
  checkinTime?: string;
  note?: string;
  /** 上课教室 */
  room?: string;
  /** 消耗的课包 ID（2026-08-22 新增：撤销/删除消课记录时据此回补课时） */
  packageId?: string;
  createdAt: string;
}

// 生成过去12个月的消课记录
// 规则：
// 1. 每个上课日（按班级weekdays）生成一条记录
// 2. 95% checked，3% absent，2% leave
// 3. 时间从2025-07-01到2026-06-22
// 4. 只为班级startDate之后的日期生成记录
// 5. 【2026-08-22 修复】按学员课包对账：Σ 已消课时(checked/makeup) === Σ 课包 usedHours
//    —— 固定示例记录（预览/补课/个人示例）先从预算中扣除，保证 LESSON_RECORDS 与课包剩余课时自洽；
//    课包课时用尽后，签到记录按 0 课时（赠课/免课时场景），不再凭空多扣。
function generateLessonRecords(): LessonRecord[] {
  const records: LessonRecord[] = [];
  let recordId = 10000;

  // 固定示例记录（预览/补课/个人示例）也计入已消课时，先从各学员预算中扣除
  const fixedRecords: LessonRecord[] = [
    ...createLessonCardPreviewRecords(),
    ...createLessonSupplementPreviewRecords(),
    createSamplePersonalLessonRecord(),
  ];
  const budgetByStudent = new Map<string, number>();
  for (const student of STUDENTS) {
    const pkgUsed = COURSE_PACKAGES.filter((p) => p.studentId === student.id).reduce(
      (sum, p) => sum + (p.usedHours || 0),
      0,
    );
    const fixedUsed = fixedRecords
      .filter(
        (r) => r.studentId === student.id && (r.status === 'checked' || r.status === 'makeup'),
      )
      .reduce((sum, r) => sum + (r.hours || 0), 0);
    budgetByStudent.set(student.id, Math.max(pkgUsed - fixedUsed, 0));
  }

  const computeClassHours = (cls: (typeof CLASSES)[number]): number =>
    cls.endTime && cls.startTime
      ? (parseInt(cls.endTime.split(':')[0]) * 60 +
          parseInt(cls.endTime.split(':')[1]) -
          parseInt(cls.startTime.split(':')[0]) * 60 -
          parseInt(cls.startTime.split(':')[1])) /
        60
      : 1.5;

  for (let monthOffset = 11; monthOffset >= 0; monthOffset--) {
    const year = CUR_MONTH - monthOffset <= 0 ? CUR_YEAR - 1 : CUR_YEAR;
    const month =
      CUR_MONTH - monthOffset <= 0 ? CUR_MONTH - monthOffset + 12 : CUR_MONTH - monthOffset;
    const daysInMonth = new Date(year, month, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      // 跳过2026-06-22之后的日期
      if (year === CUR_YEAR && month === CUR_MONTH && day > CUR_DAY) continue;

      const weekday = new Date(year, month - 1, day).getDay() || 7;
      if (weekday === 7) continue; // 周日休息

      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

      CLASSES.forEach((cls) => {
        // 检查今天是否是该班级的上课日
        if (!cls.weekdays.includes(weekday as DayOfWeek)) return;
        // 检查班级是否已经开始
        if (dateStr < cls.startDate) return;

        const classHours = computeClassHours(cls);
        const classStudents = STUDENTS.filter((s) => s.classIds.includes(cls.id));
        classStudents.forEach((student) => {
          const rand = Math.random();
          let status: LessonRecord['status'] = 'checked';
          if (rand > 0.97) {
            status = 'absent';
          } else if (rand > 0.95) {
            status = 'leave';
          }

          let hours = 0;
          if (status === 'checked') {
            const budget = budgetByStudent.get(student.id) ?? 0;
            // 课包仍有余额才扣课时；用尽后签到按 0 课时（赠课/免课时）
            hours = Math.min(classHours, budget);
            budgetByStudent.set(student.id, budget - hours);
          }

          records.push({
            id: `lr-${recordId++}`,
            studentId: student.id,
            classId: cls.id,
            teacherId: cls.teacherId,
            campusId: cls.campusId,
            date: dateStr,
            startTime: cls.startTime,
            endTime: cls.endTime,
            hours,
            status,
            checkinTime: status === 'checked' ? `${cls.startTime}:00` : undefined,
            createdAt: `${dateStr}T${cls.startTime}:00Z`,
          });
        });
      });
    }
  }
  return records;
}

function createSamplePersonalLessonRecord(): LessonRecord {
  const sampleDate = `${CUR_YEAR}-${String(CUR_MONTH).padStart(2, '0')}-${String(CUR_DAY).padStart(2, '0')}`;

  return {
    id: 'lr-personal-sample-001',
    studentId: 'stu-003',
    classId: '',
    teacherId: 'teacher-002',
    operatorTeacherId: 'teacher-001',
    campusId: 'campus-center',
    date: sampleDate,
    startTime: '19:00',
    endTime: '20:00',
    hours: 1,
    status: 'checked',
    note: '个人消课示例 · 指法强化训练',
    checkinTime: '19:00:00',
    createdAt: `${sampleDate}T19:00:00Z`,
  };
}

function createLessonCardPreviewRecords(): LessonRecord[] {
  const sampleDate = `${CUR_YEAR}-${String(CUR_MONTH).padStart(2, '0')}-${String(CUR_DAY).padStart(2, '0')}`;

  return [
    {
      id: 'lr-preview-personal-001',
      studentId: 'stu-001',
      classId: '',
      teacherId: 'teacher-001',
      operatorTeacherId: 'teacher-001',
      campusId: 'campus-center',
      date: sampleDate,
      startTime: '09:00',
      endTime: '10:00',
      hours: 1,
      status: 'checked',
      note: '个人消课示例 · 基础指法巩固',
      checkinTime: '09:00:00',
      createdAt: `${sampleDate}T09:00:00Z`,
    },
    {
      id: 'lr-preview-personal-002',
      studentId: 'stu-003',
      classId: '',
      teacherId: 'teacher-002',
      operatorTeacherId: 'teacher-001',
      campusId: 'campus-center',
      date: sampleDate,
      startTime: '10:30',
      endTime: '11:30',
      hours: 1,
      status: 'checked',
      note: '个人消课示例 · 跨教师陪练',
      checkinTime: '10:30:00',
      createdAt: `${sampleDate}T10:30:00Z`,
    },
    {
      id: 'lr-preview-personal-003',
      studentId: 'stu-002',
      classId: '',
      teacherId: 'teacher-001',
      operatorTeacherId: 'teacher-004',
      campusId: 'campus-center',
      date: sampleDate,
      startTime: '13:00',
      endTime: '14:00',
      hours: 1,
      status: 'makeup',
      note: '个人补课示例 · 节奏纠正加练',
      checkinTime: '13:00:00',
      createdAt: `${sampleDate}T13:00:00Z`,
    },
    {
      id: 'lr-preview-personal-004',
      studentId: 'stu-005',
      classId: '',
      teacherId: 'teacher-001',
      operatorTeacherId: 'teacher-001',
      campusId: 'campus-center',
      date: sampleDate,
      startTime: '14:30',
      endTime: '15:30',
      hours: 1,
      status: 'cancelled',
      note: '个人取消示例 · 家长临时请假',
      createdAt: `${sampleDate}T14:30:00Z`,
    },
    {
      id: 'lr-preview-class-001',
      studentId: 'stu-001',
      classId: 'cls-001',
      teacherId: 'teacher-001',
      operatorTeacherId: 'teacher-002',
      assistantTeacherId: 'teacher-003',
      campusId: 'campus-center',
      date: sampleDate,
      startTime: '16:00',
      endTime: '17:30',
      hours: 1.5,
      status: 'checked',
      note: '班级常规示例 · 手型与节拍训练',
      checkinTime: '16:00:00',
      createdAt: `${sampleDate}T16:00:00Z`,
    },
    {
      id: 'lr-preview-class-002',
      studentId: 'stu-003',
      classId: 'cls-001',
      teacherId: 'teacher-001',
      operatorTeacherId: 'teacher-002',
      assistantTeacherId: 'teacher-003',
      campusId: 'campus-center',
      date: sampleDate,
      startTime: '17:40',
      endTime: '19:10',
      hours: 1.5,
      status: 'makeup',
      note: '班级补课示例 · 补上周课程',
      checkinTime: '17:40:00',
      createdAt: `${sampleDate}T17:40:00Z`,
    },
    {
      id: 'lr-preview-class-003',
      studentId: 'stu-002',
      classId: 'cls-001',
      teacherId: 'teacher-001',
      operatorTeacherId: 'teacher-002',
      assistantTeacherId: 'teacher-003',
      campusId: 'campus-center',
      date: sampleDate,
      startTime: '19:20',
      endTime: '20:50',
      hours: 1.5,
      status: 'cancelled',
      note: '班级取消示例 · 场地临时调整',
      createdAt: `${sampleDate}T19:20:00Z`,
    },
  ];
}

function createLessonSupplementPreviewRecords(): LessonRecord[] {
  // P5（2026-08-22）：示例日期动态靠拢最近的非周日，避免固定 6/28 逐渐过时
  const supplementDate = (() => {
    const d = new Date();
    while (d.getDay() === 0) d.setDate(d.getDate() - 1); // 周日往前推
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate(),
    ).padStart(2, '0')}`;
  })();

  return [
    {
      id: 'lr-supplement-preview-001',
      studentId: 'stu-063',
      classId: 'cls-010',
      teacherId: 'teacher-004',
      operatorTeacherId: 'teacher-004',
      campusId: 'campus-west',
      date: supplementDate,
      startTime: '10:00',
      endTime: '12:00',
      hours: 2,
      status: 'checked',
      note: '6月28日示例 · 正常签到',
      checkinTime: '10:00:00',
      createdAt: `${supplementDate}T10:00:00Z`,
    },
    {
      id: 'lr-supplement-preview-002',
      studentId: 'stu-064',
      classId: 'cls-010',
      teacherId: 'teacher-004',
      operatorTeacherId: 'teacher-004',
      campusId: 'campus-west',
      date: supplementDate,
      startTime: '10:00',
      endTime: '12:00',
      hours: 2,
      status: 'makeup',
      note: '6月28日示例 · 已补录完成',
      checkinTime: '10:08:00',
      createdAt: `${supplementDate}T10:08:00Z`,
    },
    {
      id: 'lr-supplement-preview-003',
      studentId: 'stu-066',
      classId: 'cls-010',
      teacherId: 'teacher-004',
      operatorTeacherId: 'teacher-004',
      campusId: 'campus-west',
      date: supplementDate,
      startTime: '10:00',
      endTime: '12:00',
      hours: 0,
      status: 'leave',
      note: '6月28日示例 · 家长请假',
      createdAt: `${supplementDate}T09:20:00Z`,
    },
    {
      id: 'lr-supplement-preview-004',
      studentId: 'stu-065',
      classId: 'cls-010',
      teacherId: 'teacher-004',
      operatorTeacherId: 'teacher-004',
      campusId: 'campus-west',
      date: supplementDate,
      startTime: '10:00',
      endTime: '12:00',
      hours: 0,
      status: 'absent',
      note: '6月28日示例 · 缺勤待补录',
      createdAt: `${supplementDate}T12:10:00Z`,
    },
    {
      id: 'lr-supplement-preview-005',
      studentId: 'stu-067',
      classId: 'cls-010',
      teacherId: 'teacher-004',
      operatorTeacherId: 'teacher-004',
      campusId: 'campus-west',
      date: supplementDate,
      startTime: '10:00',
      endTime: '12:00',
      hours: 0,
      status: 'cancelled',
      note: '6月28日示例 · 原记录取消',
      createdAt: `${supplementDate}T08:40:00Z`,
    },
    {
      id: 'lr-supplement-preview-006',
      studentId: 'stu-068',
      classId: 'cls-010',
      teacherId: 'teacher-004',
      operatorTeacherId: 'teacher-004',
      campusId: 'campus-west',
      date: supplementDate,
      startTime: '10:00',
      endTime: '12:00',
      hours: 2,
      status: 'checked',
      note: '6月28日示例 · 正常签到补充样本',
      checkinTime: '10:05:00',
      createdAt: `${supplementDate}T10:05:00Z`,
    },
  ];
}

export const LESSON_RECORDS = [
  ...generateLessonRecords(),
  ...createLessonCardPreviewRecords(),
  ...createLessonSupplementPreviewRecords(),
  createSamplePersonalLessonRecord(),
];

// ============================================
// 10. 请假记录
// ============================================

export interface LeaveRequest {
  id: string;
  studentId: string;
  classId: string;
  teacherId: string;
  campusId: string;
  date: string;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  processedAt?: string;
}

export const LEAVE_REQUESTS: LeaveRequest[] = [
  {
    id: 'leave-001',
    studentId: 'stu-001',
    classId: 'cls-001',
    teacherId: 'teacher-001',
    campusId: 'campus-center',
    date: '2026-06-16',
    reason: '身体不适',
    status: 'approved',
    createdAt: '2026-06-15T10:00:00Z',
    processedAt: '2026-06-15T14:00:00Z',
  },
  {
    id: 'leave-002',
    studentId: 'stu-002',
    classId: 'cls-001',
    teacherId: 'teacher-001',
    campusId: 'campus-center',
    date: '2026-06-18',
    reason: '参加比赛',
    status: 'approved',
    createdAt: '2026-06-17T09:00:00Z',
    processedAt: '2026-06-17T10:00:00Z',
  },
  {
    id: 'leave-003',
    studentId: 'stu-011',
    classId: 'cls-006',
    teacherId: 'teacher-003',
    campusId: 'campus-east',
    date: '2026-06-19',
    reason: '感冒发烧',
    status: 'pending',
    createdAt: '2026-06-18T20:00:00Z',
  },
  {
    id: 'leave-004',
    studentId: 'stu-007',
    classId: 'cls-004',
    teacherId: 'teacher-002',
    campusId: 'campus-center',
    date: '2026-06-20',
    status: 'approved',
    createdAt: '2026-06-19T08:00:00Z',
    processedAt: '2026-06-19T09:00:00Z',
  },
  {
    id: 'leave-005',
    studentId: 'stu-018',
    classId: 'cls-009',
    teacherId: 'teacher-004',
    campusId: 'campus-west',
    date: '2026-06-22',
    reason: '外出旅游',
    status: 'approved',
    createdAt: '2026-06-20T12:00:00Z',
    processedAt: '2026-06-20T15:00:00Z',
  },
  {
    id: 'leave-006',
    studentId: 'stu-066',
    classId: 'cls-010',
    teacherId: 'teacher-004',
    campusId: 'campus-west',
    date: '2026-06-28',
    reason: '家长临时请假',
    status: 'approved',
    createdAt: '2026-06-27T18:30:00Z',
    processedAt: '2026-06-27T20:00:00Z',
  },
];

// ============================================
// 11. 统计汇总数据（过去12个月）
// ============================================

export interface MonthlyStats {
  year: number;
  month: number;
  lessonHours: number;
  lessonStudents: number;
  lessonAmount: number;
  newStudents: number;
  newPackages: number;
  packageAmount: number;
  teacherExpense: number;
  netProfit: number;
}

export const MONTHLY_STATS: MonthlyStats[] = [
  {
    year: 2025,
    month: 7,
    lessonHours: 286,
    lessonStudents: 45,
    lessonAmount: 42800,
    newStudents: 8,
    newPackages: 12,
    packageAmount: 68000,
    teacherExpense: 28600,
    netProfit: 82200,
  },
  {
    year: 2025,
    month: 8,
    lessonHours: 312,
    lessonStudents: 48,
    lessonAmount: 46800,
    newStudents: 12,
    newPackages: 18,
    packageAmount: 98000,
    teacherExpense: 31200,
    netProfit: 113600,
  },
  {
    year: 2025,
    month: 9,
    lessonHours: 268,
    lessonStudents: 52,
    lessonAmount: 40200,
    newStudents: 15,
    newPackages: 22,
    packageAmount: 126000,
    teacherExpense: 26800,
    netProfit: 139400,
  },
  {
    year: 2025,
    month: 10,
    lessonHours: 245,
    lessonStudents: 50,
    lessonAmount: 36750,
    newStudents: 6,
    newPackages: 8,
    packageAmount: 42000,
    teacherExpense: 24500,
    netProfit: 54250,
  },
  {
    year: 2025,
    month: 11,
    lessonHours: 256,
    lessonStudents: 48,
    lessonAmount: 38400,
    newStudents: 4,
    newPackages: 6,
    packageAmount: 32000,
    teacherExpense: 25600,
    netProfit: 44800,
  },
  {
    year: 2025,
    month: 12,
    lessonHours: 238,
    lessonStudents: 46,
    lessonAmount: 35700,
    newStudents: 3,
    newPackages: 5,
    packageAmount: 28000,
    teacherExpense: 23800,
    netProfit: 39900,
  },
  {
    year: 2026,
    month: 1,
    lessonHours: 198,
    lessonStudents: 42,
    lessonAmount: 29700,
    newStudents: 2,
    newPackages: 4,
    packageAmount: 22000,
    teacherExpense: 19800,
    netProfit: 31900,
  },
  {
    year: 2026,
    month: 2,
    lessonHours: 86,
    lessonStudents: 30,
    lessonAmount: 12900,
    newStudents: 1,
    newPackages: 2,
    packageAmount: 12000,
    teacherExpense: 8600,
    netProfit: 16300,
  },
  {
    year: 2026,
    month: 3,
    lessonHours: 278,
    lessonStudents: 54,
    lessonAmount: 41700,
    newStudents: 18,
    newPackages: 26,
    packageAmount: 148000,
    teacherExpense: 27800,
    netProfit: 161900,
  },
  {
    year: 2026,
    month: 4,
    lessonHours: 265,
    lessonStudents: 52,
    lessonAmount: 39750,
    newStudents: 5,
    newPackages: 7,
    packageAmount: 38000,
    teacherExpense: 26500,
    netProfit: 51250,
  },
  {
    year: 2026,
    month: 5,
    lessonHours: 282,
    lessonStudents: 55,
    lessonAmount: 42300,
    newStudents: 4,
    newPackages: 6,
    packageAmount: 34000,
    teacherExpense: 28200,
    netProfit: 48100,
  },
  {
    year: 2026,
    month: 6,
    lessonHours: 168,
    lessonStudents: 48,
    lessonAmount: 25200,
    newStudents: 3,
    newPackages: 5,
    packageAmount: 28000,
    teacherExpense: 16800,
    netProfit: 36400,
  },
];

export interface CampusStats {
  campusId: string;
  studentCount: number;
  teacherCount: number;
  monthHours: number;
  monthAmount: number;
  classCount: number;
}

export const CAMPUS_STATS: CampusStats[] = [
  {
    campusId: 'campus-center',
    studentCount: 36,
    teacherCount: 2,
    monthHours: 168,
    monthAmount: 25200,
    classCount: 5,
  },
  {
    campusId: 'campus-east',
    studentCount: 19,
    teacherCount: 2,
    monthHours: 128,
    monthAmount: 19200,
    classCount: 3,
  },
  {
    campusId: 'campus-west',
    studentCount: 13,
    teacherCount: 1,
    monthHours: 56,
    monthAmount: 8400,
    classCount: 2,
  },
];

// ============================================
// 12. 教师薪资历史
// ============================================

export interface TeacherSalaryRecord {
  teacherId: string;
  year: number;
  month: number;
  baseSalary: number;
  lessonHours: number;
  lessonFee: number;
  performance: number;
  total: number;
  status: 'pending' | 'confirmed' | 'paid';
  paidAt?: string;
}

export const TEACHER_SALARY_RECORDS: TeacherSalaryRecord[] = [
  // 张老师
  {
    teacherId: 'teacher-001',
    year: 2026,
    month: 1,
    baseSalary: 3000,
    lessonHours: 48,
    lessonFee: 4800,
    performance: 1000,
    total: 8800,
    status: 'paid',
    paidAt: '2026-02-15T10:00:00Z',
  },
  {
    teacherId: 'teacher-001',
    year: 2026,
    month: 2,
    baseSalary: 3000,
    lessonHours: 22,
    lessonFee: 2200,
    performance: 500,
    total: 5700,
    status: 'paid',
    paidAt: '2026-03-15T10:00:00Z',
  },
  {
    teacherId: 'teacher-001',
    year: 2026,
    month: 3,
    baseSalary: 3000,
    lessonHours: 52,
    lessonFee: 5200,
    performance: 1200,
    total: 9400,
    status: 'paid',
    paidAt: '2026-04-15T10:00:00Z',
  },
  {
    teacherId: 'teacher-001',
    year: 2026,
    month: 4,
    baseSalary: 3000,
    lessonHours: 45,
    lessonFee: 4500,
    performance: 1000,
    total: 8500,
    status: 'paid',
    paidAt: '2026-05-15T10:00:00Z',
  },
  {
    teacherId: 'teacher-001',
    year: 2026,
    month: 5,
    baseSalary: 3000,
    lessonHours: 48,
    lessonFee: 4800,
    performance: 1000,
    total: 8800,
    status: 'paid',
    paidAt: '2026-06-15T10:00:00Z',
  },
  {
    teacherId: 'teacher-001',
    year: 2026,
    month: 6,
    baseSalary: 3000,
    lessonHours: 42,
    lessonFee: 4200,
    performance: 1000,
    total: 8200,
    status: 'confirmed',
  },
  // 李老师
  {
    teacherId: 'teacher-002',
    year: 2026,
    month: 1,
    baseSalary: 2800,
    lessonHours: 38,
    lessonFee: 3800,
    performance: 800,
    total: 7400,
    status: 'paid',
    paidAt: '2026-02-15T10:00:00Z',
  },
  {
    teacherId: 'teacher-002',
    year: 2026,
    month: 2,
    baseSalary: 2800,
    lessonHours: 18,
    lessonFee: 1800,
    performance: 400,
    total: 5000,
    status: 'paid',
    paidAt: '2026-03-15T10:00:00Z',
  },
  {
    teacherId: 'teacher-002',
    year: 2026,
    month: 3,
    baseSalary: 2800,
    lessonHours: 42,
    lessonFee: 4200,
    performance: 900,
    total: 7900,
    status: 'paid',
    paidAt: '2026-04-15T10:00:00Z',
  },
  {
    teacherId: 'teacher-002',
    year: 2026,
    month: 4,
    baseSalary: 2800,
    lessonHours: 40,
    lessonFee: 4000,
    performance: 800,
    total: 7600,
    status: 'paid',
    paidAt: '2026-05-15T10:00:00Z',
  },
  {
    teacherId: 'teacher-002',
    year: 2026,
    month: 5,
    baseSalary: 2800,
    lessonHours: 44,
    lessonFee: 4400,
    performance: 900,
    total: 8100,
    status: 'paid',
    paidAt: '2026-06-15T10:00:00Z',
  },
  {
    teacherId: 'teacher-002',
    year: 2026,
    month: 6,
    baseSalary: 2800,
    lessonHours: 38,
    lessonFee: 3800,
    performance: 800,
    total: 7400,
    status: 'confirmed',
  },
  // 王老师
  {
    teacherId: 'teacher-003',
    year: 2026,
    month: 1,
    baseSalary: 2500,
    lessonHours: 32,
    lessonFee: 3200,
    performance: 600,
    total: 6300,
    status: 'paid',
    paidAt: '2026-02-15T10:00:00Z',
  },
  {
    teacherId: 'teacher-003',
    year: 2026,
    month: 2,
    baseSalary: 2500,
    lessonHours: 12,
    lessonFee: 1200,
    performance: 300,
    total: 4000,
    status: 'paid',
    paidAt: '2026-03-15T10:00:00Z',
  },
  {
    teacherId: 'teacher-003',
    year: 2026,
    month: 3,
    baseSalary: 2500,
    lessonHours: 36,
    lessonFee: 3600,
    performance: 700,
    total: 6800,
    status: 'paid',
    paidAt: '2026-04-15T10:00:00Z',
  },
  {
    teacherId: 'teacher-003',
    year: 2026,
    month: 4,
    baseSalary: 2500,
    lessonHours: 35,
    lessonFee: 3500,
    performance: 600,
    total: 6600,
    status: 'paid',
    paidAt: '2026-05-15T10:00:00Z',
  },
  {
    teacherId: 'teacher-003',
    year: 2026,
    month: 5,
    baseSalary: 2500,
    lessonHours: 38,
    lessonFee: 3800,
    performance: 700,
    total: 7000,
    status: 'paid',
    paidAt: '2026-06-15T10:00:00Z',
  },
  {
    teacherId: 'teacher-003',
    year: 2026,
    month: 6,
    baseSalary: 2500,
    lessonHours: 32,
    lessonFee: 3200,
    performance: 600,
    total: 6300,
    status: 'pending',
  },
  // 赵老师
  {
    teacherId: 'teacher-004',
    year: 2026,
    month: 1,
    baseSalary: 2000,
    lessonHours: 18,
    lessonFee: 1800,
    performance: 400,
    total: 4200,
    status: 'paid',
    paidAt: '2026-02-15T10:00:00Z',
  },
  {
    teacherId: 'teacher-004',
    year: 2026,
    month: 2,
    baseSalary: 2000,
    lessonHours: 8,
    lessonFee: 800,
    performance: 200,
    total: 3000,
    status: 'paid',
    paidAt: '2026-03-15T10:00:00Z',
  },
  {
    teacherId: 'teacher-004',
    year: 2026,
    month: 3,
    baseSalary: 2000,
    lessonHours: 24,
    lessonFee: 2400,
    performance: 500,
    total: 4900,
    status: 'paid',
    paidAt: '2026-04-15T10:00:00Z',
  },
  {
    teacherId: 'teacher-004',
    year: 2026,
    month: 4,
    baseSalary: 2000,
    lessonHours: 22,
    lessonFee: 2200,
    performance: 400,
    total: 4600,
    status: 'paid',
    paidAt: '2026-05-15T10:00:00Z',
  },
  {
    teacherId: 'teacher-004',
    year: 2026,
    month: 5,
    baseSalary: 2000,
    lessonHours: 26,
    lessonFee: 2600,
    performance: 500,
    total: 5100,
    status: 'paid',
    paidAt: '2026-06-15T10:00:00Z',
  },
  {
    teacherId: 'teacher-004',
    year: 2026,
    month: 6,
    baseSalary: 2000,
    lessonHours: 28,
    lessonFee: 2800,
    performance: 500,
    total: 5300,
    status: 'pending',
  },
];

// ============================================
// 通知
// ============================================

export interface Notification {
  id: string;
  type: 'system' | 'leave_request' | 'payment' | 'attendance';
  title: string;
  content: string;
  receiverId: string;
  isRead: boolean;
  createdAt: string;
}

export const NOTIFICATIONS: Notification[] = [
  {
    id: 'notif-001',
    type: 'system',
    title: '系统通知',
    content: '欢迎使用松果排课系统',
    receiverId: 'user-principal-001',
    isRead: true,
    createdAt: '2026-06-01T08:00:00Z',
  },
  {
    id: 'notif-002',
    type: 'system',
    title: '系统通知',
    content: '您有一笔新的课时充值',
    receiverId: 'user-principal-001',
    isRead: false,
    createdAt: '2026-06-15T10:00:00Z',
  },
  {
    id: 'notif-003',
    type: 'leave_request',
    title: '请假申请',
    content: '李明家长提交了请假申请',
    receiverId: 'user-principal-001',
    isRead: false,
    createdAt: '2026-06-20T14:30:00Z',
  },
  {
    id: 'notif-004',
    type: 'payment',
    title: '缴费通知',
    content: '张小红家长已缴费成功',
    receiverId: 'user-principal-001',
    isRead: false,
    createdAt: '2026-06-21T09:00:00Z',
  },
  {
    id: 'notif-005',
    type: 'attendance',
    title: '考勤异常',
    content: '王二小今日未签到',
    receiverId: 'user-principal-001',
    isRead: false,
    createdAt: '2026-06-22T08:30:00Z',
  },
];

// ============================================
// 工具函数
// ============================================

/** 根据用户ID获取可访问的校区列表 */
export function getCampusesByUserId(userId: string): Campus[] {
  const identity = IDENTITIES.find((i) => i.userId === userId);
  if (!identity) return [];
  return CAMPUSES.filter((c) => identity.campusIds.includes(c.id));
}

/** 根据用户ID获取身份信息 */
export function getIdentityByUserId(userId: string): Identity | undefined {
  return IDENTITIES.find((i) => i.userId === userId);
}

/** 根据教师用户ID获取教师信息 */
export function getTeacherByUserId(userId: string): Teacher | undefined {
  return TEACHERS.find((t) => t.userId === userId);
}

/** 根据校区ID获取该校区下的教师 */
export function getTeachersByCampusId(campusId: string): Teacher[] {
  return TEACHERS.filter((t) => t.campusIds.includes(campusId));
}

/** 根据校区ID获取该校区下的班级 */
export function getClassesByCampusId(campusId: string): Class[] {
  return CLASSES.filter((c) => c.campusId === campusId);
}

/** 根据校区ID获取该校区下的学员 */
export function getStudentsByCampusId(campusId: string): Student[] {
  return STUDENTS.filter((s) => s.campusId === campusId);
}

/** 根据班级ID获取该班级的学员 */
export function getStudentsByClassId(classId: string): Student[] {
  return STUDENTS.filter((s) => s.classIds.includes(classId));
}

/** 根据教师ID获取该教师的班级 */
export function getClassesByTeacherId(teacherId: string): Class[] {
  return CLASSES.filter((c) => c.teacherId === teacherId);
}

/** 根据教师ID获取该教师的学员 */
export function getStudentsByTeacherId(teacherId: string): Student[] {
  return STUDENTS.filter((s) => s.teacherId === teacherId);
}

/** 根据学员ID获取该学员的课包 */
export function getPackagesByStudentId(studentId: string): CoursePackage[] {
  return COURSE_PACKAGES.filter((p) => p.studentId === studentId);
}

/** 获取某月的统计数据 */
export function getMonthlyStats(year: number, month: number): MonthlyStats | undefined {
  return MONTHLY_STATS.find((s) => s.year === year && s.month === month);
}

/** 获取某教师某月的薪资记录 */
export function getTeacherSalaryByMonth(
  teacherId: string,
  year: number,
  month: number,
): TeacherSalaryRecord | undefined {
  return TEACHER_SALARY_RECORDS.find(
    (r) => r.teacherId === teacherId && r.year === year && r.month === month,
  );
}

/** 获取今日的消课记录 */
export function getTodayLessonRecords(): LessonRecord[] {
  const today = `${CUR_YEAR}-${String(CUR_MONTH).padStart(2, '0')}-${String(CUR_DAY).padStart(2, '0')}`;
  return LESSON_RECORDS.filter((r) => r.date === today);
}

/** 获取某月的消课记录 */
export function getLessonRecordsByMonth(year: number, month: number): LessonRecord[] {
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  return LESSON_RECORDS.filter((r) => r.date.startsWith(prefix));
}

/** 获取待处理的请假请求 */
export function getPendingLeaveRequests(): LeaveRequest[] {
  return LEAVE_REQUESTS.filter((r) => r.status === 'pending');
}
