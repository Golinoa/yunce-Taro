/**
 * Service 层 — 学员相关 API
 * 定义接口契约，当前由 mock 实现，联调时替换为 request 调用
 */
import { loadMockDatabase, loadStudentsMock } from '@/utils/mock-loaders';
import { isUseMock } from '@/utils/build-env';
type StudentsMockModule = Awaited<ReturnType<typeof loadStudentsMock>>;
type MockDbModule = Awaited<ReturnType<typeof loadMockDatabase>>;
let studentsMockModule: StudentsMockModule | undefined;
let mockDbModule: MockDbModule | undefined;

async function getStudentsMock(): Promise<StudentsMockModule> {
  mockDbModule ??= await loadMockDatabase();
  studentsMockModule ??= await loadStudentsMock();
  return studentsMockModule;
}

function getMockDb(): MockDbModule {
  if (!mockDbModule) throw new Error('mock database not loaded');
  return mockDbModule;
}

import type { Class } from '@/types/class';
import type {
  CoursePackage,
  CoursePackageTemplate,
  DeductResult,
  FeeMethod,
  PackageType,
  PackageTransaction,
  RechargeFormData,
  RefundFormData,
} from '@/types/course-package';
import type { LeaveRequest } from '@/types/leave-request';
import type { LessonRecord } from '@/types/lesson-record';
import type { Notification, NotificationType } from '@/types/notification';
import type { Schedule } from '@/types/schedule';
import type { Student } from '@/types/student';
import { del, get, post, put } from '@/utils/request';

interface BackendStudentListItem {
  avatar?: null | string;
  birthday?: null | string;
  classCount?: number;
  createdAt: string;
  gender?: null | 'FEMALE' | 'MALE';
  id: string;
  name: string;
  parentCount?: number;
  phone?: null | string;
  remark?: null | string;
  status?: 'ACTIVE' | 'GRADUATED' | 'INACTIVE';
  totalHours?: number;
  usedHours?: number;
}

interface BackendStudentListResponse {
  list: BackendStudentListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

interface BackendStudentDetailResponse {
  avatar?: null | string;
  birthday?: null | string;
  classes?: Array<{
    id: string;
    name: string;
    schedule?: null | string;
    subject?: null | string;
  }>;
  coursePackages?: Array<{
    id: string;
    name: string;
    status?: string;
    totalHours: number;
    type?: null | string;
    usedHours: number;
    validEnd?: null | string;
  }>;
  createdAt: string;
  gender?: null | 'FEMALE' | 'MALE';
  id: string;
  name: string;
  parents?: Array<{
    bindStatus?: string;
    id: string;
    profile?: {
      avatar?: null | string;
      nickname?: null | string;
      phone?: null | string;
    } | null;
    relation?: null | string;
  }>;
  phone?: null | string;
  recentLessons?: Array<{
    content?: null | string;
    duration?: number;
    id: string;
    lessonDate: string;
    status?: string;
  }>;
  remark?: null | string;
  status?: 'ACTIVE' | 'GRADUATED' | 'INACTIVE';
  teacher?: {
    id: string;
    institution?: null | string;
    nickname?: null | string;
  } | null;
}

interface BackendClassListItem {
  createdAt: string;
  grade?: null | string;
  id: string;
  location?: null | string;
  name: string;
  schedule?: null | string;
  scheduleCount?: number;
  status?: 'ACTIVE' | 'DISBANDED';
  studentCount?: number;
  subject?: null | string;
}

interface BackendClassListResponse {
  list: BackendClassListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

interface BackendClassDetailResponse {
  createdAt: string;
  id: string;
  location?: null | string;
  name: string;
  recentLessons?: Array<{
    duration?: number;
    id: string;
    lessonDate: string;
  }>;
  schedule?: null | string;
  schedules?: Array<{
    dayOfWeek?: number;
    endTime: string;
    id: string;
    startTime: string;
  }>;
  status?: 'ACTIVE' | 'DISBANDED';
  students?: Array<{
    avatar?: null | string;
    gender?: null | 'FEMALE' | 'MALE';
    id: string;
    joinedAt: string;
    name: string;
    phone?: null | string;
  }>;
  subject?: null | string;
  teacher?: {
    id: string;
    nickname?: null | string;
  } | null;
}

interface BackendPackageListItem {
  createdAt: string;
  feeAmount?: null | number;
  feeMethod?: null | string;
  giftHours?: null | number;
  id: string;
  name: string;
  note?: null | string;
  remainingHours: number;
  status?: 'ACTIVE' | 'DEPLETED' | 'EXPIRED';
  studentId: string;
  studentName?: string;
  totalHours: number;
  usedHours: number;
  validEnd?: null | string;
  validStart?: null | string;
}

interface BackendPackageListResponse {
  list: BackendPackageListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

interface BackendActivePackageItem extends BackendPackageListItem {
  feeAmount?: null | number;
  feeMethod?: null | string;
  giftHours?: null | number;
  note?: null | string;
  studentAvatar?: null | string;
  type?: null | string;
  validDays?: null | number;
}

interface BackendPackageMutationResponse {
  createdAt?: string;
  feeAmount?: null | number;
  feeMethod?: null | string;
  giftHours?: null | number;
  id: string;
  name?: string;
  note?: null | string;
  remainingHours: number;
  status?: 'ACTIVE' | 'DEPLETED' | 'EXPIRED';
  studentId?: string;
  totalHours: number;
  usedHours: number;
  validEnd?: null | string;
  validStart?: null | string;
}

interface BackendRechargeRecord {
  amount?: number;
  createdAt: string;
  hours?: number;
  id: string;
  method?: null | string;
  packageId: string;
  packageName?: null | string;
  studentId?: string;
  studentName?: string;
}

interface BackendPackageTransactionRecord {
  amount?: number;
  createdAt: string;
  feeMethod?: null | string;
  giftHours?: number;
  id: string;
  operatorName?: null | string;
  packageId?: string;
  packageName?: null | string;
  purchasedHours?: number;
  reason?: null | string;
  studentId?: string;
  studentName?: string;
  type?: 'RECHARGE' | 'REFUND';
}

interface BackendLessonRecordListItem {
  classId?: null | string;
  className?: null | string;
  content?: null | string;
  createdAt: string;
  duration: number;
  feeAmount?: null | number;
  feeMethod?: null | string;
  homework?: null | string;
  homeworkImages?: null | string[];
  hoursUsed?: null | number;
  id: string;
  lessonDate: string;
  note?: null | string;
  remark?: null | string;
  packageId?: null | string;
  packageName?: null | string;
  performance?: null | string;
  operatorTeacherId?: null | string;
  operatorTeacherName?: null | string;
  assistantTeacherId?: null | string;
  assistantTeacherName?: null | string;
  status?: 'NORMAL' | 'CANCELLED' | 'MAKEUP';
  studentAvatar?: null | string;
  studentId: string;
  studentName?: null | string;
  teacherId?: null | string;
  teacherName?: null | string;
  campusId?: null | string;
  room?: null | string;
  updatedAt?: string;
}

interface BackendLessonRecordListResponse {
  list: BackendLessonRecordListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

interface BackendLessonRecordDetailResponse {
  class?: {
    id: string;
    name: string;
  } | null;
  content?: null | string;
  createdAt: string;
  duration: number;
  homework?: null | string;
  hoursUsed?: null | number;
  id: string;
  lessonDate: string;
  note?: null | string;
  remark?: null | string;
  package?: {
    id?: string;
    name: string;
  } | null;
  performance?: null | string;
  operatorTeacher?: {
    id?: string;
    name: string;
  } | null;
  assistantTeacher?: {
    id?: string;
    name: string;
  } | null;
  status?: 'NORMAL' | 'CANCELLED' | 'MAKEUP';
  student?: {
    avatar?: null | string;
    id?: string;
    name: string;
  } | null;
  teacher?: {
    id?: string;
    name: string;
  } | null;
  campusId?: null | string;
  room?: null | string;
  updatedAt: string;
}

interface BackendLessonRecordCreateResponse {
  classId?: null | string;
  className?: null | string;
  content?: null | string;
  createdAt: string;
  duration: number;
  homework?: null | string;
  id: string;
  lessonDate: string;
  note?: null | string;
  remark?: null | string;
  operatorTeacherId?: null | string;
  operatorTeacherName?: null | string;
  assistantTeacherId?: null | string;
  assistantTeacherName?: null | string;
  packageId?: null | string;
  packageName?: null | string;
  remainingHours?: null | number;
  status?: 'NORMAL' | 'CANCELLED' | 'MAKEUP';
  studentId: string;
  studentName?: null | string;
  teacherId?: null | string;
  teacherName?: null | string;
  campusId?: null | string;
  room?: null | string;
}

interface BackendScheduleListItem {
  classId?: null | string;
  className?: null | string;
  createdAt: string;
  dayOfWeek: number;
  endDate?: null | string;
  endTime: string;
  id: string;
  startDate?: null | string;
  startTime: string;
}

interface BackendScheduleListResponse {
  list: BackendScheduleListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

interface BackendScheduleDetailResponse {
  assistantTeacher?: {
    id?: string;
    name?: string;
  } | null;
  assistantTeacherId?: null | string;
  assistantTeacherName?: null | string;
  class?: {
    id: string;
    name: string;
  } | null;
  color?: null | string;
  courseType?: null | string;
  createdAt: string;
  dayOfWeek: number;
  endDate?: null | string;
  endTime: string;
  id: string;
  note?: null | string;
  operatorTeacher?: {
    id?: string;
    name?: string;
  } | null;
  operatorTeacherId?: null | string;
  operatorTeacherName?: null | string;
  reminderMinutes?: null | number;
  room?: null | string;
  startDate?: null | string;
  startTime: string;
  studentId?: null | string;
  tag?: null | string;
  teacher?: {
    id?: string;
    name?: string;
  } | null;
  teacherId?: null | string;
  teacherName?: null | string;
  updatedAt: string;
}

interface BackendScheduleConflictResponse {
  conflictSummary?: string;
  conflicts: Array<{
    classId?: null | string;
    className?: null | string;
    conflictTypes?: Array<'time' | 'teacher' | 'room' | 'class'>;
    dayOfWeek: number;
    dayOfWeekText?: string;
    endTime: string;
    id: string;
    room?: null | string;
    startTime: string;
    teacherId?: string;
    teacherName?: null | string;
  }>;
  hasConflict: boolean;
}

interface BackendLeaveRequestItem {
  createdAt: string;
  endDate: string;
  id: string;
  parentName?: null | string;
  reason: string;
  startDate: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  studentAvatar?: null | string;
  studentId: string;
  studentName?: null | string;
}

interface BackendLeaveRequestListResponse {
  list: BackendLeaveRequestItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

interface BackendLeaveRequestCreateResponse {
  createdAt: string;
  endDate: string;
  id: string;
  reason: string;
  startDate: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  studentId: string;
  studentName?: null | string;
}

interface BackendNotificationItem {
  content?: null | string;
  createdAt: string;
  id: string;
  read: boolean;
  senderName?: null | string;
  title: string;
  type: 'SYSTEM' | 'LEAVE' | 'SCHEDULE' | 'CHECKIN' | 'HOMEWORK';
}

interface BackendNotificationListResponse {
  list: BackendNotificationItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  unreadCount: number;
}

const mapBackendGender = (gender?: null | 'FEMALE' | 'MALE'): Student['gender'] => {
  if (gender === 'MALE') return 'male';
  if (gender === 'FEMALE') return 'female';
  return undefined;
};

const mapBackendStudentStatus = (
  status?: 'ACTIVE' | 'GRADUATED' | 'INACTIVE',
): Student['status'] => {
  return status === 'ACTIVE' ? 'active' : 'deleted';
};

const mapBackendClassStatus = (status?: 'ACTIVE' | 'DISBANDED'): Class['status'] =>
  status === 'ACTIVE' ? 'active' : 'ended';

const mapBackendPackageType = (type?: string | null): PackageType | undefined => {
  if (type === 'hour_package' || type === 'term' || type === 'monthly' || type === 'trial') {
    return type;
  }
  return undefined;
};

const mapBackendPackageStatus = (
  status?: 'ACTIVE' | 'DEPLETED' | 'EXPIRED',
): CoursePackage['status'] => {
  if (status === 'ACTIVE') return 'active';
  if (status === 'EXPIRED') return 'expired';
  return 'completed';
};

const buildInviteCode = (studentId: string): string => `INV-${studentId.slice(-4).toUpperCase()}`;

const normalizeLessonDate = (value?: null | string): string => {
  if (!value) return '';
  return value.includes('T') ? value.slice(0, 10) : value;
};

const derivePackageHourSplit = (
  totalHoursInput?: number | null,
  remainingHoursInput?: number | null,
  giftHoursInput?: number | null,
) => {
  const totalHours = Math.max(Number(totalHoursInput ?? 0), 0);
  const remainingHours = Math.min(Math.max(Number(remainingHoursInput ?? 0), 0), totalHours);
  const giftHours = Math.min(Math.max(Number(giftHoursInput ?? 0), 0), totalHours);

  const bonusRemaining = remainingHours > giftHours ? giftHours : remainingHours;
  const purchasedRemaining = Math.max(remainingHours - bonusRemaining, 0);

  return {
    totalHours,
    remainingHours,
    giftHours,
    purchasedRemaining,
    bonusRemaining,
  };
};

const mapBackendLessonRecordStatus = (
  status?: 'NORMAL' | 'CANCELLED' | 'MAKEUP',
): LessonRecord['status'] => {
  if (status === 'CANCELLED') return 'cancelled';
  if (status === 'MAKEUP') return 'makeup';
  return 'normal';
};

function mapBackendStudentListItem(item: BackendStudentListItem): Student {
  const totalHours = Number(item.totalHours ?? 0);
  const usedHours = Number(item.usedHours ?? 0);

  return {
    id: item.id,
    name: item.name,
    teacher_id: '',
    invite_code: buildInviteCode(item.id),
    avatar_url: item.avatar || undefined,
    gender: mapBackendGender(item.gender),
    birthday: item.birthday || undefined,
    phone: item.phone || undefined,
    note: item.remark || undefined,
    status: mapBackendStudentStatus(item.status),
    created_at: item.createdAt,
    updated_at: item.createdAt,
    course_packages:
      totalHours > 0 || usedHours > 0
        ? [
            {
              id: `${item.id}-aggregate-package`,
              name: '课时汇总',
              total_hours: totalHours,
              remaining_hours: Math.max(totalHours - usedHours, 0),
              purchased_remaining: Math.max(totalHours - usedHours, 0),
              bonus_remaining: 0,
              status: 'active',
              created_at: item.createdAt,
            },
          ]
        : [],
  };
}

function mapBackendStudentDetail(item: BackendStudentDetailResponse): Student {
  return {
    id: item.id,
    name: item.name,
    teacher_id: item.teacher?.id || '',
    invite_code: buildInviteCode(item.id),
    avatar_url: item.avatar || undefined,
    gender: mapBackendGender(item.gender),
    birthday: item.birthday || undefined,
    phone: item.phone || undefined,
    note: item.remark || undefined,
    status: mapBackendStudentStatus(item.status),
    created_at: item.createdAt,
    updated_at: item.createdAt,
    course_packages: (item.coursePackages || []).map((pkg) => ({
      id: pkg.id,
      name: pkg.name,
      type: 'type' in pkg ? mapBackendPackageType(pkg.type) : undefined,
      total_hours: pkg.totalHours,
      remaining_hours: Math.max(pkg.totalHours - pkg.usedHours, 0),
      purchased_remaining: Math.max(pkg.totalHours - pkg.usedHours, 0),
      bonus_remaining: 0,
      status:
        pkg.status === 'ACTIVE' ? 'active' : pkg.status === 'EXPIRED' ? 'expired' : 'completed',
      created_at: pkg.validEnd || item.createdAt,
    })),
  };
}

function mapBackendClassListItem(item: BackendClassListItem): Class {
  return {
    id: item.id,
    name: item.name,
    teacher_id: '',
    created_at: item.createdAt,
    updated_at: item.createdAt,
    type: item.status === 'ACTIVE' ? 'unlimited' : 'ended',
    status: mapBackendClassStatus(item.status),
    schedule: item.schedule || undefined,
    used_lessons: 0,
    color: 'primary',
    student_count: item.studentCount ?? 0,
    note: item.location || undefined,
  };
}

function mapBackendClassDetail(item: BackendClassDetailResponse): Class {
  return {
    id: item.id,
    name: item.name,
    teacher_id: item.teacher?.id || '',
    created_at: item.createdAt,
    updated_at: item.createdAt,
    type: item.status === 'ACTIVE' ? 'unlimited' : 'ended',
    status: mapBackendClassStatus(item.status),
    schedule: item.schedule || undefined,
    used_lessons: item.recentLessons?.length || 0,
    color: 'primary',
    student_count: item.students?.length || 0,
    note: item.location || undefined,
    weekdays: item.schedules
      ?.map((schedule) => {
        const dayMap: Record<number, string> = {
          1: '一',
          2: '二',
          3: '三',
          4: '四',
          5: '五',
          6: '六',
          7: '日',
        };
        return dayMap[schedule.dayOfWeek ?? 0];
      })
      .filter((day): day is string => Boolean(day)),
    start_time: item.schedules?.[0]?.startTime,
    end_time: item.schedules?.[0]?.endTime,
  };
}

function mapBackendPackage(
  item: BackendPackageListItem | BackendActivePackageItem | BackendPackageMutationResponse,
): CoursePackage {
  const totalHours = Number(item.totalHours ?? 0);
  const usedHours = Number(item.usedHours ?? 0);
  const remainingHours = Number(item.remainingHours ?? Math.max(totalHours - usedHours, 0));
  const giftHours = 'giftHours' in item ? (item.giftHours ?? 0) : 0;
  const split = derivePackageHourSplit(totalHours, remainingHours, giftHours);

  return {
    id: item.id,
    teacher_id: '',
    student_id: 'studentId' in item && item.studentId ? item.studentId : '',
    name: item.name || '课时包',
    type: 'type' in item ? mapBackendPackageType(item.type) : undefined,
    total_hours: split.totalHours,
    remaining_hours: split.remainingHours,
    purchased_remaining: split.purchasedRemaining,
    bonus_remaining: split.bonusRemaining,
    status: mapBackendPackageStatus(item.status),
    start_date: 'validStart' in item ? item.validStart || undefined : undefined,
    end_date: 'validEnd' in item ? item.validEnd || undefined : undefined,
    expiry_date: 'validEnd' in item ? item.validEnd || undefined : undefined,
    fee_amount: 'feeAmount' in item ? (item.feeAmount ?? undefined) : undefined,
    fee_method:
      'feeMethod' in item && item.feeMethod
        ? (item.feeMethod as FeeMethod) || undefined
        : undefined,
    note: 'note' in item ? item.note || undefined : undefined,
    gift_hours: split.giftHours || undefined,
    valid_days: 'validDays' in item ? (item.validDays ?? undefined) : undefined,
    created_at: 'createdAt' in item && item.createdAt ? item.createdAt : new Date().toISOString(),
    updated_at: 'createdAt' in item && item.createdAt ? item.createdAt : new Date().toISOString(),
  };
}

function mapBackendLessonRecord(
  item:
    | BackendLessonRecordCreateResponse
    | BackendLessonRecordDetailResponse
    | BackendLessonRecordListItem,
): LessonRecord {
  const status = mapBackendLessonRecordStatus(item.status);
  const studentName =
    'student' in item && item.student
      ? item.student.name
      : 'studentName' in item
        ? item.studentName || undefined
        : undefined;
  const studentAvatar =
    'student' in item && item.student
      ? item.student.avatar || undefined
      : 'studentAvatar' in item
        ? item.studentAvatar || undefined
        : undefined;
  const packageName =
    'package' in item && item.package
      ? item.package.name
      : 'packageName' in item
        ? item.packageName || undefined
        : undefined;
  const classInfo =
    'class' in item
      ? item.class
      : {
          id: 'classId' in item ? item.classId || '' : '',
          name: 'className' in item ? item.className || '' : '',
        };
  const teacherName =
    'teacher' in item && item.teacher
      ? item.teacher.name
      : 'teacherName' in item
        ? item.teacherName || undefined
        : undefined;
  const operatorTeacherName =
    'operatorTeacher' in item && item.operatorTeacher
      ? item.operatorTeacher.name
      : 'operatorTeacherName' in item
        ? item.operatorTeacherName || undefined
        : undefined;
  const assistantTeacherName =
    'assistantTeacher' in item && item.assistantTeacher
      ? item.assistantTeacher.name
      : 'assistantTeacherName' in item
        ? item.assistantTeacherName || undefined
        : undefined;

  return {
    id: item.id,
    teacher_id: '',
    student_id:
      'studentId' in item
        ? item.studentId
        : 'student' in item && item.student?.id
          ? item.student.id
          : '',
    package_id:
      'packageId' in item
        ? item.packageId || ''
        : 'package' in item && item.package?.id
          ? item.package.id
          : '',
    lesson_date: normalizeLessonDate(item.lessonDate),
    hours_used: Number(('hoursUsed' in item ? item.hoursUsed : null) ?? item.duration / 60),
    status,
    content: item.content || undefined,
    // 单学员备注：后端契约字段为 remark，兼容 note 命名
    note:
      'remark' in item && item.remark != null
        ? item.remark || undefined
        : 'note' in item && item.note != null
          ? item.note || undefined
          : undefined,
    performance: 'performance' in item ? item.performance || undefined : undefined,
    homework: item.homework || undefined,
    homework_images: 'homeworkImages' in item ? item.homeworkImages || undefined : undefined,
    fee_amount: 'feeAmount' in item ? (item.feeAmount ?? undefined) : undefined,
    fee_method:
      'feeMethod' in item && item.feeMethod
        ? (item.feeMethod as FeeMethod) || undefined
        : undefined,
    remaining_hours: 'remainingHours' in item ? (item.remainingHours ?? undefined) : undefined,
    revoke_status: status === 'cancelled' ? 'revoked' : 'none',
    revoked_at:
      status === 'cancelled'
        ? 'updatedAt' in item && item.updatedAt
          ? item.updatedAt
          : item.createdAt
        : undefined,
    class_id: classInfo?.id || undefined,
    class_name: classInfo?.name || undefined,
    campus_id: ('campusId' in item ? item.campusId : undefined) || undefined,
    room: ('room' in item ? item.room : undefined) || undefined,
    created_at: item.createdAt,
    updated_at: 'updatedAt' in item && item.updatedAt ? item.updatedAt : item.createdAt,
    course_package: packageName ? { name: packageName } : undefined,
    student:
      studentName || studentAvatar
        ? {
            name: studentName || '学员',
            avatar_url: studentAvatar,
          }
        : undefined,
    teacher: teacherName ? { name: teacherName } : undefined,
    operator_teacher: operatorTeacherName ? { name: operatorTeacherName } : undefined,
    assistant_teacher: assistantTeacherName ? { name: assistantTeacherName } : undefined,
  };
}

function buildLessonRecordPayload(
  data: Omit<LessonRecord, 'id' | 'created_at' | 'updated_at'> | Partial<LessonRecord>,
) {
  const status =
    data.status === 'cancelled'
      ? 'CANCELLED'
      : data.status === 'makeup'
        ? 'MAKEUP'
        : data.status === 'normal' || !data.status
          ? 'NORMAL'
          : undefined;

  return {
    studentId: data.student_id || '',
    teacherId: data.teacher_id || undefined,
    operatorTeacherId: data.operator_teacher_id || undefined,
    assistantTeacherId: data.assistant_teacher_id || undefined,
    packageId: data.package_id || undefined,
    classId: data.class_id || undefined,
    campusId: data.campus_id || undefined,
    room: data.room,
    lessonDate: normalizeLessonDate(data.lesson_date) || new Date().toISOString().slice(0, 10),
    duration: Math.max(Math.round(Number(data.hours_used || 0) * 60), 1),
    content: data.content,
    homework: data.homework,
    // 单学员备注 → 后端 remark 字段
    remark: data.note,
    // 补录等：前端已传；后端 create 目前写死 NORMAL，对齐后落库（见对照文档）
    ...(status ? { status } : {}),
  };
}

function mapStudentPayload(data: Partial<Student>) {
  return {
    avatar: data.avatar_url,
    birthday: data.birthday,
    gender: data.gender === 'male' ? 'MALE' : data.gender === 'female' ? 'FEMALE' : undefined,
    name: data.name,
    phone: data.phone,
    remark: data.note,
    campusId: data.campus_id,
  };
}

type StudentsMock = Awaited<ReturnType<typeof loadStudentsMock>>;
type MockStudent = Awaited<ReturnType<StudentsMock['mockGetStudentById']>>;
type MockClass = Awaited<ReturnType<StudentsMock['mockGetClassById']>>;
type MockPackage = Awaited<ReturnType<StudentsMock['mockGetPackageById']>>;
type MockSchedule = Awaited<ReturnType<StudentsMock['mockGetScheduleById']>>;
type MockNotification = Awaited<ReturnType<StudentsMock['mockGetNotificationsByReceiver']>>[number];
type MockLeave = Awaited<ReturnType<StudentsMock['mockGetLeavesByTeacher']>>[number];
type MockLessonRecord = Awaited<ReturnType<StudentsMock['mockGetLessonRecordById']>>;

function mapMockPackage(pkg: NonNullable<MockPackage>): CoursePackage {
  return {
    id: pkg.id,
    teacher_id: pkg.classId ? `teacher-from-${pkg.classId}` : '',
    student_id: pkg.studentId,
    name: pkg.name,
    type: pkg.type,
    total_hours: pkg.totalHours,
    remaining_hours: pkg.remainingHours,
    purchased_remaining: pkg.purchasedHours,
    bonus_remaining: pkg.bonusHours,
    gift_hours: pkg.bonusHours,
    status:
      pkg.status === 'finished' ? 'completed' : pkg.status === 'expired' ? 'expired' : 'active',
    subject_id: pkg.subjectId,
    fee_amount: pkg.totalAmount,
    fee_method: pkg.paymentMethod === 'transfer' ? 'transfer' : pkg.paymentMethod,
    created_at: pkg.purchaseDate,
    updated_at: pkg.purchaseDate,
    start_date: pkg.purchaseDate,
    end_date: pkg.expireDate,
    expiry_date: pkg.expireDate,
  };
}

function mapBackendPackageTransaction(item: BackendPackageTransactionRecord): PackageTransaction {
  return {
    id: item.id,
    type: item.type === 'REFUND' ? 'refund' : 'recharge',
    student_id: item.studentId || '',
    student_name: item.studentName || '学员',
    package_id: item.packageId || undefined,
    package_name: item.packageName || undefined,
    purchased_hours: item.purchasedHours,
    gift_hours: item.giftHours ?? 0,
    fee_amount: item.amount,
    fee_method: item.feeMethod ? (item.feeMethod as FeeMethod) : undefined,
    refund_amount: item.type === 'REFUND' ? item.amount : undefined,
    reason: item.reason || undefined,
    operator_name: item.operatorName || undefined,
    created_at: item.createdAt,
  };
}

function mapMockPackageTransaction(item: {
  amount?: number;
  createdAt: string;
  feeAmount?: number;
  feeMethod?: string;
  giftHours?: number;
  id: string;
  operatorName?: string;
  packageId?: string;
  packageName?: string;
  purchasedHours?: number;
  purchasedRemainingSnapshot?: number;
  bonusRemainingSnapshot?: number;
  reason?: string;
  studentId: string;
  studentName: string;
  type: 'recharge' | 'refund';
}): PackageTransaction {
  return {
    id: item.id,
    type: item.type,
    student_id: item.studentId,
    student_name: item.studentName,
    package_id: item.packageId,
    package_name: item.packageName,
    purchased_hours: item.purchasedHours,
    gift_hours: item.giftHours ?? 0,
    fee_amount: item.feeAmount ?? item.amount,
    fee_method: item.feeMethod ? (item.feeMethod as FeeMethod) : undefined,
    refund_amount: item.type === 'refund' ? (item.feeAmount ?? item.amount) : undefined,
    reason: item.reason,
    operator_name: item.operatorName,
    purchased_remaining_snapshot: item.purchasedRemainingSnapshot,
    bonus_remaining_snapshot: item.bonusRemainingSnapshot,
    created_at: item.createdAt,
  };
}

function mapMockStudent(student: NonNullable<MockStudent>): Student {
  const packages = studentServicePackagesCache.get(student.id) || [];
  return {
    id: student.id,
    name: student.name,
    teacher_id: student.teacherId,
    invite_code: `INV-${student.id.slice(-4).toUpperCase()}`,
    nickname: student.nickname,
    relation: student.relation,
    gender: student.gender,
    birthday: student.birthday,
    phone: student.phone,
    address: student.address,
    note: student.note,
    parent_id: student.parentId,
    campus_id: student.campusId || (student as { campus_id?: string }).campus_id,
    campus_name:
      (student as { campusName?: string }).campusName ||
      (student as { campus_name?: string }).campus_name,
    class_ids: (student as { classIds?: string[] }).classIds || [],
    avatar_url: (student as { avatar_url?: string }).avatar_url,
    status: student.status === 'active' ? 'active' : 'deleted',
    created_at: student.createdAt,
    updated_at: student.createdAt,
    course_packages: packages.map((pkg) => ({
      id: pkg.id,
      name: pkg.name,
      type: pkg.type,
      total_hours: pkg.total_hours,
      remaining_hours: pkg.remaining_hours,
      purchased_remaining: pkg.purchased_remaining,
      bonus_remaining: pkg.bonus_remaining,
      status: pkg.status,
      subject_id: pkg.subject_id,
      fee_amount: pkg.fee_amount,
      fee_method: pkg.fee_method,
      created_at: pkg.created_at,
    })),
  };
}

function mapMockClass(cls: NonNullable<MockClass>): Class {
  return {
    id: cls.id,
    name: cls.name,
    teacher_id: cls.teacherId,
    note: cls.note,
    created_at: cls.createdAt,
    updated_at: cls.createdAt,
    type: cls.status === 'ended' ? 'ended' : cls.type,
    status: cls.status === 'paused' ? 'paused' : cls.status === 'ended' ? 'ended' : 'active',
    schedule: cls.schedule,
    weekdays: cls.weekdays?.map(String),
    start_time: cls.startTime,
    end_time: cls.endTime,
    total_lessons: cls.totalLessons,
    used_lessons: cls.usedLessons,
    teachers: cls.teachers,
    start_date: cls.startDate,
    end_date: cls.endDate,
    color: cls.color,
    icon: cls.icon,
    level: cls.level,
    student_count: cls.studentCount,
    campus_id: cls.campusId,
    schedule_mode: cls.scheduleMode,
    auto_open_type: cls.autoOpenType,
    min_open_count: cls.minOpenCount,
    subject_id: cls.subjectId,
    category_id: cls.categoryId,
    hours_per_lesson: cls.hoursPerLesson ?? 1,
    pricePerLesson: cls.pricePerLesson,
  };
}

function mapMockSchedule(schedule: NonNullable<MockSchedule>): Schedule {
  const db = getMockDb();
  const lead = db.TEACHERS.find((item) => item.id === schedule.teacherId);
  const assistantId = (schedule as { assistantTeacherId?: string }).assistantTeacherId;
  const assistant = assistantId
    ? db.TEACHERS.find((item) => item.id === assistantId)
    : undefined;
  const classInfo = schedule.classId
    ? db.CLASSES.find((item) => item.id === schedule.classId)
    : undefined;

  return {
    id: schedule.id,
    teacher_id: schedule.teacherId,
    class_id: schedule.classId,
    day_of_week: schedule.dayOfWeek,
    start_time: schedule.startTime,
    end_time: schedule.endTime,
    room: schedule.room,
    assistant_teacher_id: assistantId || undefined,
    note: (schedule as { note?: string }).note || undefined,
    status:
      schedule.status === 'done' ? 'done' : schedule.status === 'cancelled' ? 'ended' : 'upcoming',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    class_info: classInfo?.name ? { name: classInfo.name } : undefined,
    teacher_name: lead?.name || undefined,
    assistant_teacher_name: assistant?.name || undefined,
  };
}

function mapScheduleInput(
  data: Omit<Schedule, 'id' | 'created_at' | 'updated_at'> | Partial<Schedule>,
) {
  const status: 'done' | 'scheduled' | 'cancelled' =
    data.status === 'done' ? 'done' : data.status === 'ended' ? 'cancelled' : 'scheduled';

  return {
    teacherId: data.teacher_id || '',
    classId: data.class_id || '',
    dayOfWeek: data.day_of_week,
    startTime: data.start_time,
    endTime: data.end_time,
    room: data.room,
    assistantTeacherId: data.assistant_teacher_id || undefined,
    note: data.note || undefined,
    status,
  };
}

function mapBackendDayOfWeek(dayOfWeek: number): Schedule['day_of_week'] {
  return (dayOfWeek === 0 ? 7 : dayOfWeek) as Schedule['day_of_week'];
}

function mapFrontendDayOfWeek(dayOfWeek?: number): number {
  const normalized = Number(dayOfWeek ?? 1);
  if (!Number.isFinite(normalized)) return 1;
  return normalized === 7 ? 0 : normalized;
}

function enrichConflictDisplay(
  result: import('@/types/schedule-conflict').ScheduleConflictResult,
  dateHint?: string,
): import('@/types/schedule-conflict').ScheduleConflictResult {
  const DAY_LABELS = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  return {
    ...result,
    conflictSummary:
      result.conflictSummary ||
      (result.hasConflict
        ? [...new Set(result.conflicts.flatMap((c) => c.conflictTypes))]
            .map((t) =>
              ({ time: '时间冲突', teacher: '老师冲突', room: '教室冲突', class: '班级冲突' } as const)[
                t
              ],
            )
            .join('、')
        : ''),
    conflicts: result.conflicts.map((c) => ({
      ...c,
      dayOfWeekText: c.dayOfWeekText || DAY_LABELS[c.dayOfWeek] || '',
      displayTime:
        c.displayTime ||
        (dateHint
          ? `${dateHint} ${c.startTime}-${c.endTime}`
          : `${c.dayOfWeekText || DAY_LABELS[c.dayOfWeek] || ''} ${c.startTime}-${c.endTime}`.trim()),
    })),
  };
}

function mapBackendSchedule(
  item: BackendScheduleListItem | BackendScheduleDetailResponse,
): Schedule {
  const classInfo =
    'class' in item
      ? item.class
      : {
          id: ('classId' in item ? item.classId : '') || '',
          name: ('className' in item ? item.className : '') || '',
        };
  const teacherId =
    'teacher' in item && item.teacher?.id
      ? item.teacher.id
      : 'teacherId' in item
        ? item.teacherId || ''
        : '';
  const teacherName =
    'teacher' in item && item.teacher
      ? item.teacher.name
      : 'teacherName' in item
        ? item.teacherName || undefined
        : undefined;
  const operatorTeacherId =
    'operatorTeacher' in item && item.operatorTeacher?.id
      ? item.operatorTeacher.id
      : 'operatorTeacherId' in item
        ? item.operatorTeacherId || undefined
        : undefined;
  const operatorTeacherName =
    'operatorTeacher' in item && item.operatorTeacher
      ? item.operatorTeacher.name
      : 'operatorTeacherName' in item
        ? item.operatorTeacherName || undefined
        : undefined;
  const assistantTeacherId =
    'assistantTeacher' in item && item.assistantTeacher?.id
      ? item.assistantTeacher.id
      : 'assistantTeacherId' in item
        ? item.assistantTeacherId || undefined
        : undefined;
  const assistantTeacherName =
    'assistantTeacher' in item && item.assistantTeacher
      ? item.assistantTeacher.name
      : 'assistantTeacherName' in item
        ? item.assistantTeacherName || undefined
        : undefined;

  return {
    id: item.id,
    teacher_id: teacherId,
    operator_teacher_id: operatorTeacherId,
    assistant_teacher_id: assistantTeacherId,
    student_id: 'studentId' in item ? item.studentId || undefined : undefined,
    class_id: classInfo?.id || undefined,
    day_of_week: mapBackendDayOfWeek(item.dayOfWeek),
    start_time: item.startTime,
    end_time: item.endTime,
    color:
      'color' in item && item.color ? (item.color as Schedule['color']) || undefined : undefined,
    note: 'note' in item ? item.note || undefined : undefined,
    reminder_minutes: 'reminderMinutes' in item ? (item.reminderMinutes ?? undefined) : undefined,
    room: 'room' in item ? item.room || undefined : undefined,
    tag: 'tag' in item ? item.tag || undefined : undefined,
    course_type:
      'courseType' in item && item.courseType
        ? (item.courseType as Schedule['course_type']) || undefined
        : undefined,
    created_at: item.createdAt,
    updated_at: 'updatedAt' in item ? item.updatedAt : item.createdAt,
    class_info: classInfo?.name ? { name: classInfo.name } : undefined,
    teacher_name: teacherName,
    operator_teacher_name: operatorTeacherName,
    assistant_teacher_name: assistantTeacherName,
  };
}

function mapNotificationType(type: MockNotification['type']): NotificationType {
  switch (type) {
    case 'leave_request':
      return 'leave_request';
    default:
      return 'general';
  }
}

function mapMockNotification(notification: MockNotification): Notification {
  return {
    id: notification.id,
    sender_id: '',
    receiver_id: notification.receiverId,
    type: mapNotificationType(notification.type),
    title: notification.title,
    content: notification.content,
    is_read: notification.isRead,
    created_at: notification.createdAt,
  };
}

function mapBackendNotificationType(
  notification: Pick<BackendNotificationItem, 'type' | 'title'>,
): NotificationType {
  switch (notification.type) {
    case 'LEAVE':
      return /审批|结果|回复/.test(notification.title) ? 'leave_response' : 'leave_request';
    case 'SCHEDULE':
      return 'schedule_change';
    case 'CHECKIN':
      return 'lesson_complete';
    default:
      return 'general';
  }
}

function mapBackendNotification(notification: BackendNotificationItem): Notification {
  return {
    id: notification.id,
    sender_id: '',
    receiver_id: '',
    type: mapBackendNotificationType(notification),
    title: notification.title,
    content: notification.content || undefined,
    is_read: notification.read,
    created_at: notification.createdAt,
    sender: notification.senderName ? { name: notification.senderName } : undefined,
  };
}

function mapFrontendNotificationType(
  type?: NotificationType,
  title?: string,
): 'SYSTEM' | 'LEAVE' | 'SCHEDULE' | 'CHECKIN' | 'HOMEWORK' {
  switch (type) {
    case 'leave_request':
    case 'leave_response':
      return 'LEAVE';
    case 'schedule_change':
      return 'SCHEDULE';
    case 'lesson_complete':
      return 'CHECKIN';
    case 'general':
      return /作业/.test(title || '') ? 'HOMEWORK' : 'SYSTEM';
    default:
      return /请假/.test(title || '')
        ? 'LEAVE'
        : /排课|课表/.test(title || '')
          ? 'SCHEDULE'
          : /上课|消课|核销/.test(title || '')
            ? 'CHECKIN'
            : /作业/.test(title || '')
              ? 'HOMEWORK'
              : 'SYSTEM';
  }
}

function mapMockLeave(leave: MockLeave): LeaveRequest {
  const student = getMockDb().STUDENTS.find((item) => item.id === leave.studentId);

  return {
    id: leave.id,
    parent_id: student?.parentId || '',
    student_id: leave.studentId,
    teacher_id: leave.teacherId,
    type: 'leave',
    original_date: leave.date,
    end_date: leave.date,
    reason: leave.reason,
    status: leave.status,
    created_at: leave.createdAt,
    updated_at: leave.processedAt || leave.createdAt,
    student: student ? { name: student.name } : undefined,
  };
}

function mapBackendLeaveStatus(status: BackendLeaveRequestItem['status']): LeaveRequest['status'] {
  switch (status) {
    case 'APPROVED':
      return 'approved';
    case 'REJECTED':
      return 'rejected';
    default:
      return 'pending';
  }
}

function mapBackendLeave(
  leave: BackendLeaveRequestItem | BackendLeaveRequestCreateResponse,
): LeaveRequest {
  return {
    id: leave.id,
    parent_id: '',
    student_id: leave.studentId,
    teacher_id: '',
    type: 'leave',
    original_date: leave.startDate,
    end_date: leave.endDate,
    reason: leave.reason,
    status: mapBackendLeaveStatus(leave.status),
    created_at: leave.createdAt,
    updated_at: leave.createdAt,
    student: leave.studentName ? { name: leave.studentName } : undefined,
  };
}

function mapMockLessonRecord(record: NonNullable<MockLessonRecord>): LessonRecord {
  const student = getMockDb().STUDENTS.find((item) => item.id === record.studentId);
  const teacher = getMockDb().TEACHERS.find((item) => item.id === record.teacherId);
  const operatorTeacher = record.operatorTeacherId
    ? getMockDb().TEACHERS.find((item) => item.id === record.operatorTeacherId)
    : teacher;
  const assistantTeacher = record.assistantTeacherId
    ? getMockDb().TEACHERS.find((item) => item.id === record.assistantTeacherId)
    : undefined;
  const classInfo = getMockDb().CLASSES.find((item) => item.id === record.classId);
  const pkg =
    getMockDb().COURSE_PACKAGES.find(
      (item) => item.studentId === record.studentId && item.classId === record.classId,
    ) || getMockDb().COURSE_PACKAGES.find((item) => item.studentId === record.studentId);
  const mappedStatus =
    record.status === 'makeup'
      ? 'makeup'
      : record.status === 'cancelled'
        ? 'cancelled'
        : record.status === 'leave'
          ? 'leave'
          : record.status === 'absent'
            ? 'absent'
            : 'normal';

  return {
    id: record.id,
    teacher_id: record.teacherId,
    operator_teacher_id: record.operatorTeacherId || record.teacherId,
    assistant_teacher_id: record.assistantTeacherId,
    student_id: record.studentId,
    package_id: pkg?.id || '',
    lesson_date: record.date,
    hours_used: record.hours,
    status: mappedStatus,
    content: record.note,
    // mock 记录：note=课程内容(content)，remark=单学员备注(note)
    note: record.remark,
    fee_amount: (classInfo?.pricePerLesson || 0) * record.hours,
    remaining_hours: pkg?.remainingHours,
    purchased_deduct: record.hours,
    bonus_deduct: 0,
    class_id: record.classId,
    class_name: classInfo?.name,
    campus_id: record.campusId || classInfo?.campusId,
    room: record.room,
    created_at: record.createdAt,
    updated_at: record.createdAt,
    course_package: pkg ? { name: pkg.name } : undefined,
    student: student ? { name: student.name } : undefined,
    teacher: teacher ? { name: teacher.name } : undefined,
    operator_teacher: operatorTeacher ? { name: operatorTeacher.name } : undefined,
    assistant_teacher: assistantTeacher ? { name: assistantTeacher.name } : undefined,
  };
}

function mapLessonRecordInput(
  data: Omit<LessonRecord, 'id' | 'created_at' | 'updated_at'> | Partial<LessonRecord>,
) {
  const classInfo = data.class_id
    ? getMockDb().CLASSES.find((item) => item.id === data.class_id)
    : undefined;
  const status =
    data.status === 'cancelled'
      ? 'cancelled'
      : data.status === 'makeup'
        ? 'makeup'
        : data.status === 'leave'
          ? 'leave'
          : data.status === 'absent'
            ? 'absent'
            : 'checked';

  return {
    studentId: data.student_id || '',
    classId: data.class_id || '',
    teacherId: data.teacher_id || classInfo?.teacherId || '',
    operatorTeacherId: data.operator_teacher_id || data.teacher_id || classInfo?.teacherId || '',
    assistantTeacherId: data.assistant_teacher_id || '',
    campusId: data.campus_id || classInfo?.campusId || '',
    room: data.room,
    date: data.lesson_date || new Date().toISOString().split('T')[0],
    startTime: classInfo?.startTime || '09:00',
    endTime: classInfo?.endTime || '10:00',
    hours: data.hours_used || 0,
    status,
    note: data.content,
    // 单学员备注 → mock 记录 remark 字段（与 note=课程内容区分开）
    remark: data.note,
    packageId: data.package_id || '', // 保留课包关联，供 mock 扣减课时（模拟后端自动扣减）
    createdAt: new Date().toISOString(),
  };
}

const studentServicePackagesCache = new Map<string, CoursePackage[]>();

/**
 * 失效学员课包缓存（消课/办卡/充值/退卡后调用，保证剩余课时实时一致）
 * @param studentId 指定学员；缺省清空全部
 */
export function invalidatePackagesCache(studentId?: string) {
  if (studentId) {
    studentServicePackagesCache.delete(studentId);
  } else {
    studentServicePackagesCache.clear();
  }
}

// ============================================
// Mock 数据（从 @/data/students 迁移，作为唯一数据源）
// ============================================

// ============================================
// 学员 Service
// ============================================
export const studentService = {
  /** 获取教师的学员列表 */
  getByTeacher: async (teacherId: string, campusId?: string): Promise<Student[]> => {
    if (!isUseMock()) {
      const params = new URLSearchParams();
      if (campusId) params.set('campusId', campusId);
      const query = params.toString();
      const data = await get<BackendStudentListResponse>(`/students${query ? `?${query}` : ''}`);
      return data.list.map(mapBackendStudentListItem);
    }

    const students = await (await getStudentsMock()).mockGetStudentsByTeacher(teacherId, campusId);
    const packagesByStudent = new Map<string, CoursePackage[]>();
    await Promise.all(
      students.map(async (student) => {
        const packages = (await (await getStudentsMock()).mockGetPackagesByStudent(student.id)).map(mapMockPackage);
        packagesByStudent.set(student.id, packages);
        studentServicePackagesCache.set(student.id, packages);
      }),
    );
    return students.map((student) => {
      const mapped = mapMockStudent(student);
      mapped.course_packages = packagesByStudent.get(student.id)?.map((pkg) => ({
        id: pkg.id,
        name: pkg.name,
        type: pkg.type,
        total_hours: pkg.total_hours,
        remaining_hours: pkg.remaining_hours,
        purchased_remaining: pkg.purchased_remaining,
        bonus_remaining: pkg.bonus_remaining,
        status: pkg.status,
        subject_id: pkg.subject_id,
        fee_amount: pkg.fee_amount,
        fee_method: pkg.fee_method,
        created_at: pkg.created_at,
      }));
      return mapped;
    });
  },
  // 联调时替换为:
  // getByTeacher: (teacherId: string) => get<Student[]>(`/api/teachers/${teacherId}/students`),

  /** 获取家长绑定的学员列表 */
  getByParent: async (parentId: string): Promise<Student[]> =>
    isUseMock()
      ? (await (await getStudentsMock()).mockGetStudentsByParent(parentId)).map((student) => mapMockStudent(student))
      : (await get<BackendStudentListResponse>('/students')).list.map(mapBackendStudentListItem),

  /** 获取学员详情 */
  getById: async (studentId: string): Promise<Student | null> => {
    if (!isUseMock()) {
      try {
        const student = await get<BackendStudentDetailResponse>(`/students/${studentId}`);
        return mapBackendStudentDetail(student);
      } catch {
        return null;
      }
    }

    const student = await (await getStudentsMock()).mockGetStudentById(studentId);
    if (!student) return null;
    const packages = (await (await getStudentsMock()).mockGetPackagesByStudent(student.id)).map(mapMockPackage);
    studentServicePackagesCache.set(student.id, packages);
    return {
      ...mapMockStudent(student),
      course_packages: packages.map((pkg) => ({
        id: pkg.id,
        name: pkg.name,
        type: pkg.type,
        total_hours: pkg.total_hours,
        remaining_hours: pkg.remaining_hours,
        purchased_remaining: pkg.purchased_remaining,
        bonus_remaining: pkg.bonus_remaining,
        status: pkg.status,
        subject_id: pkg.subject_id,
        fee_amount: pkg.fee_amount,
        fee_method: pkg.fee_method,
        created_at: pkg.created_at,
      })),
    };
  },

  /** 后端搜索学员（最少 2 字符） */
  search: async (teacherId: string, query: string, campusId?: string) => {
    if (!isUseMock()) {
      const params = new URLSearchParams({
        page: '1',
        pageSize: '100',
        keyword: query,
      });
      if (campusId) params.set('campusId', campusId);
      const data = await get<BackendStudentListResponse>(`/students?${params.toString()}`);
      return data.list.map(mapBackendStudentListItem);
    }

    return (await (await getStudentsMock()).mockSearchStudents(teacherId, query, campusId)).map(mapMockStudent);
  },

  /** 创建学员 */
  create: async (data: Omit<Student, 'id' | 'created_at' | 'updated_at'>) => {
    if (!isUseMock()) {
      const created = await post<BackendStudentListItem>('/students', mapStudentPayload(data));
      return mapBackendStudentListItem(created);
    }

    const created = await (await getStudentsMock()).mockCreateStudent(data);
    return mapMockStudent(created);
  },

  /** 更新学员 */
  update: async (studentId: string, data: Partial<Student>) => {
    if (!isUseMock()) {
      const updated = await put<BackendStudentListItem>(
        `/students/${studentId}`,
        mapStudentPayload(data),
      );
      return mapBackendStudentListItem(updated);
    }

    return (await getStudentsMock()).mockUpdateStudent(studentId, data);
  },

  /** 删除学员（软删除） */
  remove: async (studentId: string) => {
    if (!isUseMock()) {
      await del(`/students/${studentId}`);
      return;
    }

    return (await getStudentsMock()).mockDeleteStudent(studentId);
  },

  /** 获取学员关联数据统计（用于删除确认弹窗） */
  getDependencies: async (studentId: string) => (await getStudentsMock()).mockGetStudentDependencies(studentId),

  /** 重名检测 */
  checkDuplicateName: async (teacherId: string, name: string, excludeId?: string) => {
    if (!isUseMock()) {
      const result = await get<{ duplicate: boolean }>(
        `/students/check-duplicate?name=${encodeURIComponent(name)}${excludeId ? `&excludeId=${encodeURIComponent(excludeId)}` : ''}`,
      );
      return result.duplicate;
    }

    return (await getStudentsMock()).mockCheckDuplicateName(teacherId, name, excludeId);
  },

  /** 获取学员的绑定家长 */
  getParents: async (studentId: string) => (await getStudentsMock()).mockGetParentsByStudent(studentId),

  /** 解绑家长 */
  removeParent: async (bindingId: string) => (await getStudentsMock()).mockRemoveParentFromStudent(bindingId),

  /** 通过邀请码查找学员 */
  findByInviteCode: async (code: string) => (await getStudentsMock()).mockFindStudentByInviteCode(code),

  /** 绑定家长到学员 */
  bindParent: async (studentId: string, parentId: string) => (await getStudentsMock()).mockBindParentToStudent(studentId, parentId),
};

// ============================================
// 课包 Service
// ============================================
export const packageService = {
  /** 获取学员的课包列表 */
  getByStudent: async (studentId: string): Promise<CoursePackage[]> => {
    if (!isUseMock()) {
      const data = await get<BackendPackageListResponse>(
        `/course-packages?page=1&pageSize=100&studentId=${encodeURIComponent(studentId)}`,
      );
      return data.list.map(mapBackendPackage);
    }

    return (await (await getStudentsMock()).mockGetPackagesByStudent(studentId)).map(mapMockPackage);
  },

  /** 获取课包详情 */
  getById: async (packageId: string): Promise<CoursePackage | null> => {
    const pkg = await (await getStudentsMock()).mockGetPackageById(packageId);
    return pkg ? mapMockPackage(pkg) : null;
  },

  /** 创建课包 */
  create: async (data: Omit<CoursePackage, 'id' | 'created_at' | 'updated_at'>) => {
    if (!isUseMock()) {
      const created = await post<BackendPackageMutationResponse>('/course-packages', {
        studentId: data.student_id,
        name: data.name,
        totalHours: data.total_hours,
        giftHours: data.gift_hours,
        feeAmount: data.fee_amount,
        feeMethod: data.fee_method,
        validStart: data.start_date,
        validEnd: data.end_date || data.expiry_date,
      });
      return mapBackendPackage(created);
    }

    return (await getStudentsMock()).mockCreatePackage(data);
  },

  /** 更新课包 */
  update: async (packageId: string, data: Partial<CoursePackage>) => {
    if (!isUseMock()) {
      const updated = await put<BackendPackageMutationResponse>(`/course-packages/${packageId}`, {
        name: data.name,
        totalHours:
          data.total_hours !== undefined
            ? data.total_hours + (data.gift_hours || 0)
            : data.remaining_hours !== undefined
              ? data.remaining_hours
              : undefined,
        giftHours: data.gift_hours,
        validEnd: data.end_date || data.expiry_date,
        feeAmount: data.fee_amount,
        feeMethod: data.fee_method,
        note: data.note,
      });
      return mapBackendPackage(updated);
    }

    return (await getStudentsMock()).mockUpdatePackage(packageId, data);
  },

  /** 扣减课时（FIFO：先扣购买再扣赠送，返回课包+扣减明细） */
  deductHours: async (
    packageId: string,
    hours: number,
  ): Promise<{ pkg: CoursePackage; deduct: DeductResult }> =>
    isUseMock()
      ? (await getStudentsMock()).mockDeductPackageHours(packageId, hours).then(({ pkg, deduct }) => ({
          pkg: mapMockPackage(pkg),
          deduct: {
            purchased_deduct: deduct.purchasedHours,
            bonus_deduct: deduct.bonusHours,
            purchased_remaining: Math.max((pkg.purchasedHours || 0) - deduct.purchasedHours, 0),
            bonus_remaining: Math.max((pkg.bonusHours || 0) - deduct.bonusHours, 0),
            remaining_hours: Math.max(pkg.remainingHours - hours, 0),
          },
        }))
      : post<BackendPackageMutationResponse>(`/course-packages/${packageId}/deduct`, {
          hours,
        }).then((pkg) => ({
          pkg: mapBackendPackage(pkg),
          deduct: {
            purchased_deduct: hours,
            bonus_deduct: 0,
            purchased_remaining: Math.max(pkg.remainingHours, 0),
            bonus_remaining: 0,
            remaining_hours: Math.max(pkg.remainingHours, 0),
          },
        })),

  /** 获取学员的活跃课包 */
  getActiveByStudent: async (studentId: string): Promise<CoursePackage[]> => {
    if (!isUseMock()) {
      const data = await get<BackendActivePackageItem[]>(
        `/course-packages/active?studentId=${encodeURIComponent(studentId)}`,
      );
      return data.map(mapBackendPackage);
    }

    return (await (await getStudentsMock()).mockGetActivePackagesByStudent(studentId)).map(mapMockPackage);
  },

  /** 自动匹配最优课包 */
  pickBest: async (packages: CoursePackage[], hoursNeeded: number, subjectId?: string) =>
    (await getStudentsMock()).pickBestPackage(packages, hoursNeeded, subjectId),

  /** 课时充值（含赠送课时+分期） */
  createRecharge: async (data: RechargeFormData): Promise<CoursePackage> =>
    isUseMock()
      ? (await getStudentsMock()).mockCreateRecharge(data).then(mapMockPackage)
      : post<BackendPackageMutationResponse>('/course-packages', {
          studentId: data.student_id,
          name: data.name,
          totalHours: data.total_hours + (data.gift_hours || 0),
          giftHours: data.gift_hours,
          feeAmount: data.fee_amount,
          feeMethod: data.fee_method,
          note: data.note,
        }).then(mapBackendPackage),

  /** 提交退费记录 */
  createRefund: async (data: RefundFormData): Promise<PackageTransaction> => {
    if (!isUseMock()) {
      const created = await post<BackendPackageTransactionRecord>('/course-package-refunds', {
        studentId: data.student_id,
        packageId: data.package_id,
        amount: data.refund_amount,
        reason: data.reason,
        operatorId: data.operator_id,
        operatorName: data.operator_name,
      });
      return mapBackendPackageTransaction(created);
    }

    return (await getStudentsMock()).mockCreateRefund({
      studentId: data.student_id,
      packageId: data.package_id,
      refundAmount: data.refund_amount,
      reason: data.reason,
      operatorId: data.operator_id,
      operatorName: data.operator_name,
    }).then(mapMockPackageTransaction);
  },

  /** 获取课包流水（充值 + 退费） */
  getTransactions: async (teacherId: string, studentId?: string): Promise<PackageTransaction[]> => {
    if (!isUseMock()) {
      const params = new URLSearchParams({
        page: '1',
        pageSize: '100',
      });
      if (studentId) {
        params.set('studentId', studentId);
      }

      const data = await get<{ list: BackendPackageTransactionRecord[]; pagination: unknown }>(
        `/package-transactions?${params.toString()}`,
      );
      return (data.list || []).map(mapBackendPackageTransaction);
    }

    const transactions = await (await getStudentsMock()).mockGetPackageTransactions(teacherId, studentId);
    return transactions.map(mapMockPackageTransaction);
  },

  /** 获取教师的充值记录（按时间倒序） */
  getRechargeRecords: async (teacherId: string, studentId?: string) => {
    if (!isUseMock()) {
      const params = new URLSearchParams({
        page: '1',
        pageSize: '100',
      });
      const data = await get<
        BackendPackageListResponse | { list: BackendRechargeRecord[]; pagination: unknown }
      >(`/recharges?${params.toString()}`);
      const list = 'list' in data ? data.list : [];
      return (list as BackendRechargeRecord[])
        .filter((item) => !studentId || item.studentId === studentId)
        .map((item) => ({
          id: item.id,
          packageId: item.packageId,
          studentId: item.studentId || '',
          studentName: item.studentName || '学员',
          packageName: item.packageName || '',
          totalHours: item.hours ?? item.amount ?? 0,
          giftHours: 0,
          hours: item.hours ?? item.amount ?? 0,
          feeAmount: item.amount,
          feeMethod: item.method || undefined,
          method: item.method || '',
          createdAt: item.createdAt,
        }));
    }

    const transactions = await packageService.getTransactions(teacherId, studentId);
    return transactions
      .filter((item) => item.type === 'recharge')
      .map((item) => ({
        id: item.id,
        packageId: item.package_id,
        studentId: item.student_id,
        studentName: item.student_name,
        packageName: item.package_name || '',
        totalHours: (item.purchased_hours || 0) + (item.gift_hours || 0),
        giftHours: item.gift_hours || 0,
        hours: item.purchased_hours || 0,
        feeAmount: item.fee_amount,
        feeMethod: item.fee_method,
        method: item.fee_method || '',
        createdAt: item.created_at,
      }));
  },
};

// ============================================
// 课包模板 Service
// ============================================
export const packageTemplateService = {
  /** 获取教师的课包模板列表 */
  getByTeacher: async (teacherId: string) => (await getStudentsMock()).mockGetPackageTemplates(teacherId),

  /** 创建课包模板 */
  create: async (data: Omit<CoursePackageTemplate, 'id' | 'created_at' | 'updated_at'>) =>
    (await getStudentsMock()).mockCreatePackageTemplate(data),

  /** 更新课包模板 */
  update: async (templateId: string, data: Partial<CoursePackageTemplate>) =>
    (await getStudentsMock()).mockUpdatePackageTemplate(templateId, data),

  /** 删除课包模板 */
  remove: async (templateId: string) => (await getStudentsMock()).mockDeletePackageTemplate(templateId),
};

// ============================================
// 消课记录 Service
// ============================================
export const lessonRecordService = {
  /** 获取学员的消课记录 */
  getByStudent: async (studentId: string): Promise<LessonRecord[]> => {
    if (!isUseMock()) {
      const data = await get<BackendLessonRecordListResponse>(
        `/lesson-records?page=1&pageSize=100&studentId=${encodeURIComponent(studentId)}`,
      );
      return data.list.map(mapBackendLessonRecord);
    }

    return (await (await getStudentsMock()).mockGetRecordsByStudent(studentId)).map(mapMockLessonRecord);
  },

  /** 获取全部消课记录（校长/管理员视角） */
  getAll: async (): Promise<LessonRecord[]> => {
    if (!isUseMock()) {
      const data = await get<BackendLessonRecordListResponse>(
        '/lesson-records?page=1&pageSize=100',
      );
      return data.list.map(mapBackendLessonRecord);
    }

    return (await (await getStudentsMock()).mockGetAllLessonRecords()).map(mapMockLessonRecord);
  },

  /** 获取教师的消课记录 */
  getByTeacher: async (teacherId: string, campusId?: string): Promise<LessonRecord[]> => {
    if (!isUseMock()) {
      const params = new URLSearchParams({ page: '1', pageSize: '100' });
      if (campusId) params.set('campusId', campusId);
      const data = await get<BackendLessonRecordListResponse>(
        `/lesson-records?${params.toString()}`,
      );
      return data.list.map(mapBackendLessonRecord);
    }

    return (await (await getStudentsMock()).mockGetLessonRecordsByTeacher(teacherId, campusId)).map(mapMockLessonRecord);
  },

  /** 按月份获取教师的消课记录 */
  getByTeacherAndMonth: async (
    teacherId: string,
    year: number,
    month: number,
    campusId?: string,
  ): Promise<LessonRecord[]> => {
    if (!isUseMock()) {
      const params = new URLSearchParams({ year: String(year), month: String(month) });
      if (campusId) params.set('campusId', campusId);
      const data = await get<BackendLessonRecordListItem[]>(
        `/lesson-records/by-month?${params.toString()}`,
      );
      return data.map(mapBackendLessonRecord);
    }

    return (await (await getStudentsMock()).mockGetLessonRecordsByTeacherAndMonth(teacherId, year, month, campusId)).map(
      mapMockLessonRecord,
    );
  },

  /** 按日期范围获取教师的消课记录 */
  getByTeacherAndRange: async (
    teacherId: string,
    startDate: string,
    endDate: string,
    campusId?: string,
  ): Promise<LessonRecord[]> => {
    if (!isUseMock()) {
      const params = new URLSearchParams({
        startDate,
        endDate,
      });
      if (campusId) params.set('campusId', campusId);
      const data = await get<BackendLessonRecordListItem[]>(
        `/lesson-records/by-range?${params.toString()}`,
      );
      return data.map(mapBackendLessonRecord);
    }

    return (
      await (await getStudentsMock()).mockGetLessonRecordsByTeacherAndRange(teacherId, startDate, endDate, campusId)
    ).map(mapMockLessonRecord);
  },

  /** 获取学员消课记录（别名） */
  getRecordsByStudent: async (studentId: string): Promise<LessonRecord[]> =>
    lessonRecordService.getByStudent(studentId),

  /** 创建消课记录（悲观更新：成功后才更新 UI） */
  create: async (
    data: Omit<LessonRecord, 'id' | 'created_at' | 'updated_at'>,
  ): Promise<LessonRecord> => {
    if (!isUseMock()) {
      const created = await post<BackendLessonRecordCreateResponse>(
        '/lesson-records',
        buildLessonRecordPayload(data),
      );
      return mapBackendLessonRecord(created);
    }

    const created = await (await getStudentsMock()).mockCreateLessonRecord(mapLessonRecordInput(data));
    // 消课扣减课包后失效该学员课时缓存，保证详情/列表实时一致
    invalidatePackagesCache(data.student_id);
    return mapMockLessonRecord(created);
  },

  /** 获取单条消课记录 */
  getById: async (recordId: string): Promise<LessonRecord | null> => {
    if (!isUseMock()) {
      try {
        const record = await get<BackendLessonRecordDetailResponse>(`/lesson-records/${recordId}`);
        return mapBackendLessonRecord(record);
      } catch {
        return null;
      }
    }

    const record = await (await getStudentsMock()).mockGetLessonRecordById(recordId);
    return record ? mapMockLessonRecord(record) : null;
  },

  /** 删除消课记录 */
  remove: async (recordId: string) => {
    if (!isUseMock()) {
      await del(`/lesson-records/${recordId}`);
      return;
    }

    return (await getStudentsMock()).mockDeleteLessonRecord(recordId);
  },

  /** 修改消课记录（P4，2026-08-22）：改课时 → 差额回补/追扣关联课包 */
  update: async (
    recordId: string,
    updates: { hours?: number; note?: string },
  ): Promise<LessonRecord | null> => {
    if (!isUseMock()) {
      const updated = await put<BackendLessonRecordDetailResponse>(
        `/lesson-records/${recordId}`,
        buildLessonRecordPayload({
          hours: updates.hours,
          note: updates.note,
        } as unknown as Omit<LessonRecord, 'id' | 'created_at' | 'updated_at'>),
      );
      return mapBackendLessonRecord(updated);
    }

    const updated = await (await getStudentsMock()).mockUpdateLessonRecord(recordId, updates);
    return updated ? mapMockLessonRecord(updated) : null;
  },

  /** 撤销消课记录（恢复课包余额，按扣减来源分别回加） */
  revoke: async (recordId: string, operatorId: string, reason: string) => {
    if (!isUseMock()) {
      await put(`/lesson-records/${recordId}`, {
        status: 'CANCELLED',
      });
      return;
    }

    return (await getStudentsMock()).mockRevokeLessonRecord(recordId, operatorId, reason);
  },
};

// ============================================
// 请假 Service
// ============================================
export const leaveService = {
  getByStudent: async (studentId: string): Promise<LeaveRequest[]> => {
    if (!isUseMock()) {
      const params = new URLSearchParams({
        page: '1',
        pageSize: '100',
        studentId,
      });
      const data = await get<BackendLeaveRequestListResponse>(
        `/leave-requests?${params.toString()}`,
      );
      return data.list.map(mapBackendLeave);
    }

    return (await (await getStudentsMock()).mockGetLeavesByStudent(studentId)).map(mapMockLeave);
  },
  getByTeacher: async (teacherId: string): Promise<LeaveRequest[]> => {
    if (!isUseMock()) {
      const params = new URLSearchParams({
        page: '1',
        pageSize: '100',
      });
      const data = await get<BackendLeaveRequestListResponse>(
        `/leave-requests?${params.toString()}`,
      );
      return data.list.map(mapBackendLeave);
    }

    return (await (await getStudentsMock()).mockGetLeavesByTeacher(teacherId)).map(mapMockLeave);
  },
  create: async (
    data: Omit<LeaveRequest, 'id' | 'created_at' | 'updated_at'>,
  ): Promise<LeaveRequest> => {
    if (!isUseMock()) {
      const created = await post<BackendLeaveRequestCreateResponse>('/leave-requests', {
        studentId: data.student_id,
        startDate: data.original_date,
        endDate: data.end_date || data.original_date,
        reason: data.reason || '',
      });
      return mapBackendLeave(created);
    }

    const student = getMockDb().STUDENTS.find((item) => item.id === data.student_id);
    const created = await (await getStudentsMock()).mockCreateLeaveRequest({
      studentId: data.student_id,
      classId: student?.classIds[0] || '',
      teacherId: student?.teacherId || data.teacher_id,
      campusId: student?.campusId || '',
      date: data.original_date,
      reason: data.reason,
      status: data.status,
      createdAt: new Date().toISOString(),
    });

    return mapMockLeave(created);
  },
  updateStatus: async (leaveId: string, status: 'approved' | 'rejected') => {
    if (!isUseMock()) {
      await put(`/leave-requests/${leaveId}/approve`, {
        status: status === 'approved' ? 'APPROVED' : 'REJECTED',
      });
      return;
    }

    return (await getStudentsMock()).mockUpdateLeaveRequestStatus(leaveId, status);
  },
};

// ============================================
// 班级 Service
// ============================================
export const classService = {
  getByTeacher: async (teacherId: string, campusId?: string): Promise<Class[]> => {
    if (!isUseMock()) {
      const params = new URLSearchParams({ page: '1', pageSize: '100' });
      if (campusId) params.set('campusId', campusId);
      const data = await get<BackendClassListResponse>(`/classes?${params.toString()}`);
      return data.list.map(mapBackendClassListItem);
    }

    return (await (await getStudentsMock()).mockGetClassesByTeacher(teacherId, campusId)).map(mapMockClass);
  },
  getById: async (classId: string): Promise<Class | null> => {
    if (!isUseMock()) {
      try {
        const cls = await get<BackendClassDetailResponse>(`/classes/${classId}`);
        return mapBackendClassDetail(cls);
      } catch {
        return null;
      }
    }

    const cls = await (await getStudentsMock()).mockGetClassById(classId);
    return cls ? mapMockClass(cls) : null;
  },
  getStudents: async (classId: string): Promise<Student[]> => {
    /** 班级学员列表接口暂无课时；补拉课包后写入 course_packages，供排课页展示剩余课时 */
    const withPackages = async (base: Student[]): Promise<Student[]> => {
      if (base.length === 0) return base;
      return Promise.all(
        base.map(async (student) => {
          if (student.course_packages && student.course_packages.length > 0) return student;
          try {
            const packages = await packageService.getByStudent(student.id);
            return {
              ...student,
              course_packages: packages.map((pkg) => ({
                id: pkg.id,
                name: pkg.name,
                type: pkg.type,
                total_hours: pkg.total_hours,
                remaining_hours: pkg.remaining_hours,
                purchased_remaining: pkg.purchased_remaining,
                bonus_remaining: pkg.bonus_remaining,
                status: pkg.status,
                subject_id: pkg.subject_id,
                fee_amount: pkg.fee_amount,
                fee_method: pkg.fee_method,
                created_at: pkg.created_at,
              })),
            };
          } catch {
            return student;
          }
        }),
      );
    };

    if (!isUseMock()) {
      const list = await get<
        Array<{
          avatar?: null | string;
          gender?: null | 'FEMALE' | 'MALE';
          id: string;
          joinedAt: string;
          name: string;
          phone?: null | string;
          remainingHours?: null | number;
        }>
      >(`/classes/${classId}/students`);
      const mapped = list.map((item) => {
        const remaining = Number(item.remainingHours);
        return {
          id: item.id,
          name: item.name,
          teacher_id: '',
          invite_code: buildInviteCode(item.id),
          avatar_url: item.avatar || undefined,
          gender: mapBackendGender(item.gender),
          phone: item.phone || undefined,
          status: 'active' as const,
          created_at: item.joinedAt,
          updated_at: item.joinedAt,
          // 若后端已带 remainingHours，先写成单包摘要，避免全 0；无则后续 withPackages 补齐
          course_packages:
            Number.isFinite(remaining) && remaining >= 0
              ? [
                  {
                    id: `summary-${item.id}`,
                    name: '课时',
                    type: 'hour_package' as const,
                    total_hours: remaining,
                    remaining_hours: remaining,
                    purchased_remaining: remaining,
                    bonus_remaining: 0,
                    status: 'active' as const,
                    created_at: item.joinedAt,
                  },
                ]
              : undefined,
        };
      });
      return withPackages(mapped);
    }

    const mockList = (await (await getStudentsMock()).mockGetStudentsByClass(classId)).map((student) =>
      mapMockStudent(student),
    );
    return withPackages(mockList);
  },
  getStudentCount: async (classId: string) =>
    isUseMock() ? (await getStudentsMock()).mockGetClassStudentCount(classId) : (await classService.getStudents(classId)).length,
  /**
   * 获取所有"已排课"的班级 id 列表（用于课程管理·班课列表区分已/未排课）
   * 真实后端：联调时按 teacher/admin 权限返回
   */
  getScheduledClassIds: async (): Promise<string[]> => {
    if (!isUseMock()) {
      const data = await get<{ list: Array<{ classId?: string; class_id?: string }> }>(
        '/schedules',
        { page: 1, pageSize: 500 },
      );
      const ids = new Set<string>();
      for (const item of data.list ?? []) {
        const classId = item.classId ?? item.class_id;
        if (classId) ids.add(classId);
      }
      return Array.from(ids);
    }
    return Array.from(getMockDb().getScheduledClassIdSet());
  },
  create: async (data: Omit<Class, 'id' | 'created_at' | 'updated_at'>) => {
    if (!isUseMock()) {
      const created = await post<BackendClassListItem>('/classes', {
        name: data.name,
        schedule: data.schedule,
      });
      return mapBackendClassListItem(created);
    }

    return (await getStudentsMock()).mockCreateClass(data);
  },
  update: async (classId: string, data: Partial<Class>) => {
    if (!isUseMock()) {
      const updated = await put<BackendClassListItem>(`/classes/${classId}`, {
        name: data.name,
        schedule: data.schedule,
      });
      return mapBackendClassListItem(updated);
    }

    // 前端 Class（snake_case）→ mock DB（camelCase），保证 mock 读写一致
    const mockPatch: Record<string, unknown> = {};
    if (data.name !== undefined) mockPatch.name = data.name;
    if (data.teacher_id !== undefined) mockPatch.teacherId = data.teacher_id;
    if (data.teachers !== undefined) mockPatch.teachers = data.teachers;
    if (data.color !== undefined) mockPatch.color = data.color;
    if (data.category_id !== undefined) mockPatch.categoryId = data.category_id;
    if (data.subject_id !== undefined) mockPatch.subjectId = data.subject_id;
    if (data.level !== undefined) mockPatch.level = data.level;
    if (data.note !== undefined) mockPatch.note = data.note;
    if (data.min_open_count !== undefined) mockPatch.minOpenCount = data.min_open_count;
    if (data.auto_open_type !== undefined) mockPatch.autoOpenType = data.auto_open_type;
    if (data.student_count !== undefined) mockPatch.studentCount = data.student_count;
    if (data.hours_per_lesson !== undefined) mockPatch.hoursPerLesson = data.hours_per_lesson;
    if (data.pricePerLesson !== undefined) mockPatch.pricePerLesson = data.pricePerLesson;
    if (data.schedule !== undefined) mockPatch.schedule = data.schedule;
    if (data.status !== undefined) mockPatch.status = data.status;
    if (data.campus_id !== undefined) mockPatch.campusId = data.campus_id;
    if (data.room !== undefined) mockPatch.room = data.room;

    const updated = await (await getStudentsMock()).mockUpdateClass(classId, mockPatch);
    return updated ? mapMockClass(updated) : undefined;
  },
  remove: async (classId: string) => {
    if (!isUseMock()) {
      await del(`/classes/${classId}`);
      return;
    }

    return (await getStudentsMock()).mockDeleteClass(classId);
  },
  /** 停课：课表隐藏该班排课/开放时段，可恢复 */
  pause: async (classId: string) => classService.update(classId, { status: 'paused' }),
  /** 恢复上课 */
  resume: async (classId: string) => classService.update(classId, { status: 'active' }),
  removeStudent: async (classId: string, studentId: string) =>
    isUseMock()
      ? (await getStudentsMock()).mockRemoveStudentFromClass(classId, studentId)
      : del(`/classes/${classId}/students/${studentId}`),
  addStudents: async (classId: string, studentIds: string[]) => {
    if (!isUseMock()) {
      for (const studentId of studentIds) {
        await post(`/classes/${classId}/students`, { studentId });
      }
      return;
    }

    return (await getStudentsMock()).mockAddStudentsToClass(classId, studentIds);
  },
  transferStudent: async (classId: string, targetClassId: string, studentId: string) => {
    if (!isUseMock()) {
      await post(`/classes/${classId}/transfer`, {
        studentId,
        targetClassId,
      });
      return;
    }

    return (await getStudentsMock()).mockTransferStudent(classId, targetClassId, studentId);
  },
  end: async (classId: string) => {
    if (!isUseMock()) {
      await post(`/classes/${classId}/end`, {});
      return;
    }

    return (await getStudentsMock()).mockEndClass(classId);
  },
};

// ============================================
// 排课 Service
// ============================================
export const scheduleService = {
  getByTeacher: async (teacherId: string, campusId?: string): Promise<Schedule[]> => {
    if (!isUseMock()) {
      const params = new URLSearchParams({ page: '1', pageSize: '100' });
      if (campusId) params.set('campusId', campusId);
      const data = await get<BackendScheduleListResponse>(`/schedules?${params.toString()}`);
      return data.list.map(mapBackendSchedule);
    }

    return (await (await getStudentsMock()).mockGetSchedulesByTeacher(teacherId, campusId)).map(mapMockSchedule);
  },
  getById: async (scheduleId: string): Promise<Schedule | null> => {
    if (!isUseMock()) {
      try {
        const schedule = await get<BackendScheduleDetailResponse>(`/schedules/${scheduleId}`);
        return mapBackendSchedule(schedule);
      } catch {
        return null;
      }
    }

    const schedule = await (await getStudentsMock()).mockGetScheduleById(scheduleId);
    return schedule ? mapMockSchedule(schedule) : null;
  },
  create: async (
    data: Omit<Schedule, 'id' | 'created_at' | 'updated_at'> & {
      ignoreConflict?: boolean;
      start_date?: string;
      end_date?: string;
    },
  ): Promise<Schedule> => {
    if (!isUseMock()) {
      const created = await post<BackendScheduleDetailResponse>('/schedules', {
        classId: data.class_id,
        dayOfWeek: mapFrontendDayOfWeek(data.day_of_week),
        startTime: data.start_time,
        endTime: data.end_time,
        startDate: data.start_date,
        endDate: data.end_date,
        room: data.room,
        note: data.note,
        ignoreConflict: data.ignoreConflict === true,
      });
      return mapBackendSchedule(created);
    }

    return mapMockSchedule(await (await getStudentsMock()).mockCreateSchedule(mapScheduleInput(data)));
  },
  update: async (
    scheduleId: string,
    data: Partial<Schedule> & {
      ignoreConflict?: boolean;
      start_date?: string;
      end_date?: string;
    },
  ): Promise<Schedule | null> => {
    if (!isUseMock()) {
      const updated = await put<BackendScheduleDetailResponse>(`/schedules/${scheduleId}`, {
        classId: data.class_id,
        dayOfWeek: mapFrontendDayOfWeek(data.day_of_week),
        startTime: data.start_time,
        endTime: data.end_time,
        startDate: data.start_date,
        endDate: data.end_date,
        room: data.room,
        note: data.note,
        ignoreConflict: data.ignoreConflict === true,
      });
      return mapBackendSchedule(updated);
    }

    const updated = await (await getStudentsMock()).mockUpdateSchedule(scheduleId, mapScheduleInput(data));
    return updated ? mapMockSchedule(updated) : null;
  },
  remove: async (scheduleId: string) => {
    if (!isUseMock()) {
      await del(`/schedules/${scheduleId}`);
      return;
    }

    return (await getStudentsMock()).mockDeleteSchedule(scheduleId);
  },
  checkConflict: async (params: {
    teacherId: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    classId?: string;
    room?: string;
    excludeId?: string;
    /** 用于展示的具体日期 YYYY-MM-DD */
    dateHint?: string;
  }): Promise<import('@/types/schedule-conflict').ScheduleConflictResult> => {
    const { teacherId, dayOfWeek, startTime, endTime, classId, room, excludeId, dateHint } = params;

    if (isUseMock()) {
      const result = await (await getStudentsMock()).mockCheckScheduleConflict(
        teacherId,
        dayOfWeek,
        startTime,
        endTime,
        excludeId,
        { classId, room },
      );
      // 兼容旧 mock 返回 boolean
      if (typeof result === 'boolean') {
        return { hasConflict: result, conflictSummary: result ? '时间冲突、老师冲突' : '', conflicts: [] };
      }
      return enrichConflictDisplay(result, dateHint);
    }

    const qs = new URLSearchParams({
      dayOfWeek: String(mapFrontendDayOfWeek(dayOfWeek)),
      startTime,
      endTime,
    });
    if (teacherId) qs.set('teacherId', teacherId);
    if (classId) qs.set('classId', classId);
    if (room) qs.set('room', room);
    if (excludeId) qs.set('excludeScheduleId', excludeId);

    const result = await get<BackendScheduleConflictResponse>(`/schedules/check-conflict?${qs.toString()}`);
    return enrichConflictDisplay(
      {
        hasConflict: result.hasConflict,
        conflictSummary: result.conflictSummary || '',
        conflicts: (result.conflicts || []).map((c) => ({
          id: c.id,
          classId: c.classId,
          className: c.className,
          teacherId: c.teacherId,
          teacherName: c.teacherName,
          dayOfWeek: mapBackendDayOfWeek(c.dayOfWeek),
          dayOfWeekText: c.dayOfWeekText,
          startTime: c.startTime,
          endTime: c.endTime,
          room: c.room,
          conflictTypes: c.conflictTypes?.length ? c.conflictTypes : (['time', 'teacher'] as const),
        })),
      },
      dateHint,
    );
  },
};

// ============================================
// 通知 Service
// ============================================
export const notificationService = {
  getByReceiver: async (receiverId: string): Promise<Notification[]> => {
    if (!isUseMock()) {
      const data = await get<BackendNotificationListResponse>('/notifications?page=1&pageSize=100');
      return data.list.map(mapBackendNotification);
    }

    return (await (await getStudentsMock()).mockGetNotificationsByReceiver(receiverId)).map(mapMockNotification);
  },
  markAsRead: async (notificationId: string) => {
    if (!isUseMock()) {
      await put(`/notifications/${notificationId}/read`, {});
      return;
    }

    return (await getStudentsMock()).mockMarkNotificationAsRead(notificationId);
  },
  markAllAsRead: async (receiverId: string) => {
    if (!isUseMock()) {
      await put('/notifications/read-all', {});
      return;
    }

    return (await getStudentsMock()).mockMarkAllNotificationsAsRead(receiverId);
  },
  send: async (data: {
    sender_id: string;
    receiver_id?: string;
    receiver_ids?: string[];
    title: string;
    content: string;
    related_id?: string;
    type?: NotificationType;
  }): Promise<Notification> => {
    if (!isUseMock()) {
      const receiverIds = data.receiver_ids || (data.receiver_id ? [data.receiver_id] : []);
      const filteredReceiverIds = receiverIds.filter(Boolean);
      if (filteredReceiverIds.length === 0) {
        throw new Error('缺少通知接收者');
      }

      await post('/notifications', {
        receiverIds: filteredReceiverIds,
        type: mapFrontendNotificationType(data.type, data.title),
        title: data.title,
        content: data.content,
      });

      return {
        id: '',
        sender_id: data.sender_id,
        receiver_id: filteredReceiverIds[0],
        type:
          data.type ||
          mapBackendNotificationType({
            type: mapFrontendNotificationType(data.type, data.title),
            title: data.title,
          }),
        title: data.title,
        content: data.content,
        related_id: data.related_id,
        is_read: false,
        created_at: new Date().toISOString(),
      };
    }

    return (await getStudentsMock()).mockSendNotification({
      type: 'system',
      title: data.title,
      content: data.content,
      receiverId: data.receiver_id || data.receiver_ids?.[0] || '',
    }).then(mapMockNotification);
  },
};

// ============================================
// 工具函数
// ============================================
export { formatDateCN } from '@/utils/format';
export type { FeeMethod };
