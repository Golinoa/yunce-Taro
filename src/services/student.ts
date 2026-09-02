/**
 * Service 层 — 学员相关 API（真实后端）
 */

import type { Class } from '@/types/class';
import type {
  CoursePackage,
  FeeMethod,
} from '@/types/course-package';
import type { LessonRecord } from '@/types/lesson-record';
import type { Schedule } from '@/types/schedule';
import type { Student } from '@/types/student';
import { leaveService } from '@/services/leave';
import { notificationService } from '@/services/notification';
import { studentParentService } from '@/services/student-parents';
import { mapBackendPackageType, packageService } from '@/services/package';
import { notWired } from '@/utils/not-wired';
import type { PaginatedResponse } from '@/utils/pagination';
import { API_PAGE_SIZE_BATCH, asPaginatedResponse, fetchAllPages } from '@/utils/pagination';
import { del, get, post, put } from '@/utils/request';

interface BackendStudentListItem {
  avatar?: null | string;
  birthday?: null | string;
  classCount?: number;
  createdAt: string;
  gender?: null | 'FEMALE' | 'MALE';
  id: string;
  inviteCode?: null | string;
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
  inviteCode?: null | string;
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
  capacity?: null | number;
  color?: null | string;
  createdAt: string;
  endTime?: null | string;
  grade?: null | string;
  id: string;
  location?: null | string;
  name: string;
  note?: null | string;
  schedule?: null | string;
  scheduleCount?: number;
  startTime?: null | string;
  status?: 'ACTIVE' | 'DISBANDED';
  studentCount?: number;
  subject?: null | string;
  totalLessons?: null | number;
  type?: null | string;
  usedLessons?: null | number;
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
  capacity?: null | number;
  color?: null | string;
  createdAt: string;
  endTime?: null | string;
  id: string;
  location?: null | string;
  name: string;
  note?: null | string;
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
  startTime?: null | string;
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
  totalLessons?: null | number;
  type?: null | string;
  usedLessons?: null | number;
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

const resolveInviteCode = (inviteCode?: null | string): string => {
  const code = inviteCode?.trim();
  return code || '请联系老师';
};

const normalizeLessonDate = (value?: null | string): string => {
  if (!value) return '';
  return value.includes('T') ? value.slice(0, 10) : value;
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
    invite_code: resolveInviteCode(item.inviteCode),
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
    invite_code: resolveInviteCode(item.inviteCode),
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
  const ended = item.status === 'DISBANDED';
  const type = ended ? 'ended' : item.type === 'limited' ? 'limited' : 'unlimited';
  return {
    id: item.id,
    name: item.name,
    teacher_id: '',
    created_at: item.createdAt,
    updated_at: item.createdAt,
    type,
    status: mapBackendClassStatus(item.status),
    schedule: item.schedule || undefined,
    total_lessons: item.totalLessons ?? undefined,
    used_lessons: item.usedLessons ?? 0,
    capacity: item.capacity ?? undefined,
    color: (item.color as Class['color']) || 'primary',
    student_count: item.studentCount ?? 0,
    note: item.note || item.location || undefined,
    start_time: item.startTime || undefined,
    end_time: item.endTime || undefined,
  };
}

function mapBackendClassDetail(item: BackendClassDetailResponse): Class {
  const ended = item.status === 'DISBANDED';
  const type = ended ? 'ended' : item.type === 'limited' ? 'limited' : 'unlimited';
  return {
    id: item.id,
    name: item.name,
    teacher_id: item.teacher?.id || '',
    created_at: item.createdAt,
    updated_at: item.createdAt,
    type,
    status: mapBackendClassStatus(item.status),
    schedule: item.schedule || undefined,
    total_lessons: item.totalLessons ?? undefined,
    used_lessons: item.usedLessons ?? item.recentLessons?.length ?? 0,
    capacity: item.capacity ?? undefined,
    color: (item.color as Class['color']) || 'primary',
    student_count: item.students?.length || 0,
    note: item.note || item.location || undefined,
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
    start_time: item.startTime || item.schedules?.[0]?.startTime,
    end_time: item.endTime || item.schedules?.[0]?.endTime,
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
            .map(
              (t) =>
                (
                  ({
                    time: '时间冲突',
                    teacher: '老师冲突',
                    room: '教室冲突',
                    class: '班级冲突',
                  }) as const
                )[t],
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

// ============================================
// 学员 Service
// ============================================
export const studentService = {
  /** 获取教师的学员列表（分批拉全） */
  getByTeacher: async (_teacherId: string, campusId?: string): Promise<Student[]> => {
    const list = await fetchAllPages(async (page, pageSize) => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (campusId) params.set('campusId', campusId);
      const data = await get<BackendStudentListResponse>(`/students?${params.toString()}`);
      return {
        list: data.list || [],
        pagination: data.pagination || {
          page,
          pageSize,
          total: data.list?.length || 0,
          totalPages: 1,
        },
      };
    }, API_PAGE_SIZE_BATCH);
    return list.map(mapBackendStudentListItem);
  },
  // 联调时替换为:
  // getByTeacher: (teacherId: string) => get<Student[]>(`/api/teachers/${teacherId}/students`),

  /** 获取家长绑定的学员列表 */
  getByParent: async (_parentId: string): Promise<Student[]> =>
    (await get<BackendStudentListResponse>('/students')).list.map(mapBackendStudentListItem),

  /** 获取学员详情 */
  getById: async (studentId: string): Promise<Student | null> => {
    try {
      const student = await get<BackendStudentDetailResponse>(`/students/${studentId}`);
      return mapBackendStudentDetail(student);
    } catch {
      return null;
    }
  },

  /** 后端搜索学员（最少 2 字符；分批拉全匹配结果） */
  search: async (_teacherId: string, query: string, campusId?: string) => {
    const list = await fetchAllPages(async (page, pageSize) => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        keyword: query,
      });
      if (campusId) params.set('campusId', campusId);
      const data = await get<BackendStudentListResponse>(`/students?${params.toString()}`);
      return asPaginatedResponse(data, page, pageSize);
    }, API_PAGE_SIZE_BATCH);
    return list.map(mapBackendStudentListItem);
  },

  /** 创建学员 */
  create: async (data: Omit<Student, 'id' | 'created_at' | 'updated_at'>) => {
    const created = await post<BackendStudentListItem>('/students', mapStudentPayload(data));
    return mapBackendStudentListItem(created);
  },

  /** 更新学员 */
  update: async (studentId: string, data: Partial<Student>) => {
    const updated = await put<BackendStudentListItem>(
      `/students/${studentId}`,
      mapStudentPayload(data),
    );
    return mapBackendStudentListItem(updated);
  },

  /** 删除学员（软删除） */
  remove: async (studentId: string) => {
    await del(`/students/${studentId}`);
    return;
  },

  /** 获取学员关联数据统计（用于删除确认弹窗） */
  getDependencies: async (_studentId: string) => notWired('student.getDependencies'),

  /** 重名检测 */
  checkDuplicateName: async (_teacherId: string, name: string, excludeId?: string) => {
    const result = await get<{ duplicate: boolean }>(
      `/students/check-duplicate?name=${encodeURIComponent(name)}${excludeId ? `&excludeId=${encodeURIComponent(excludeId)}` : ''}`,
    );
    return result.duplicate;
  },

  /** 获取学员的绑定家长 */
  getParents: studentParentService.getParents,

  /** 解绑家长 */
  removeParent: studentParentService.removeParent,

  /** 通过邀请码查找学员 */
  findByInviteCode: studentParentService.findByInviteCode,

  /**
   * 绑定家长到学员（后端按手机号绑定，非 parentId）
   * @deprecated 业务侧请使用 parent-invite-links；保留以兼容旧调用
   */
  bindParent: studentParentService.bindParent,
};

// ============================================
// 课包 Service（实现见 package.ts）
// ============================================
export { packageService, packageTemplateService, invalidatePackagesCache } from '@/services/package';

// ============================================
// 消课记录 Service
// ============================================
export const lessonRecordService = {
  /** 获取学员的消课记录（分批拉全） */
  getByStudent: async (studentId: string): Promise<LessonRecord[]> => {
    const list = await fetchAllPages(async (page, pageSize) => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        studentId,
      });
      const data = await get<BackendLessonRecordListResponse>(
        `/lesson-records?${params.toString()}`,
      );
      return {
        list: data.list || [],
        pagination: data.pagination || {
          page,
          pageSize,
          total: data.list?.length || 0,
          totalPages: 1,
        },
      };
    }, API_PAGE_SIZE_BATCH);
    return list.map(mapBackendLessonRecord);
  },

  /** 获取全部消课记录（校长/管理员视角，分批拉全） */
  getAll: async (): Promise<LessonRecord[]> => {
    const list = await fetchAllPages(async (page, pageSize) => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      const data = await get<BackendLessonRecordListResponse>(
        `/lesson-records?${params.toString()}`,
      );
      return {
        list: data.list || [],
        pagination: data.pagination || {
          page,
          pageSize,
          total: data.list?.length || 0,
          totalPages: 1,
        },
      };
    }, API_PAGE_SIZE_BATCH);
    return list.map(mapBackendLessonRecord);
  },

  /** 获取教师的消课记录（分批拉全） */
  getByTeacher: async (_teacherId: string, campusId?: string): Promise<LessonRecord[]> => {
    const list = await fetchAllPages(async (page, pageSize) => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (campusId) params.set('campusId', campusId);
      const data = await get<BackendLessonRecordListResponse>(
        `/lesson-records?${params.toString()}`,
      );
      return {
        list: data.list || [],
        pagination: data.pagination || {
          page,
          pageSize,
          total: data.list?.length || 0,
          totalPages: 1,
        },
      };
    }, API_PAGE_SIZE_BATCH);
    return list.map(mapBackendLessonRecord);
  },

  /** 按月份获取教师的消课记录 */
  getByTeacherAndMonth: async (
    _teacherId: string,
    year: number,
    month: number,
    campusId?: string,
  ): Promise<LessonRecord[]> => {
    const params = new URLSearchParams({ year: String(year), month: String(month) });
    if (campusId) params.set('campusId', campusId);
    const data = await get<BackendLessonRecordListItem[]>(
      `/lesson-records/by-month?${params.toString()}`,
    );
    return data.map(mapBackendLessonRecord);
  },

  /** 按日期范围获取教师的消课记录 */
  getByTeacherAndRange: async (
    _teacherId: string,
    startDate: string,
    endDate: string,
    campusId?: string,
  ): Promise<LessonRecord[]> => {
    const params = new URLSearchParams({
      startDate,
      endDate,
    });
    if (campusId) params.set('campusId', campusId);
    const data = await get<BackendLessonRecordListItem[]>(
      `/lesson-records/by-range?${params.toString()}`,
    );
    return data.map(mapBackendLessonRecord);
  },

  /** 获取学员消课记录（别名） */
  getRecordsByStudent: async (studentId: string): Promise<LessonRecord[]> =>
    lessonRecordService.getByStudent(studentId),

  /** 创建消课记录（悲观更新：成功后才更新 UI） */
  create: async (
    data: Omit<LessonRecord, 'id' | 'created_at' | 'updated_at'>,
  ): Promise<LessonRecord> => {
    const created = await post<BackendLessonRecordCreateResponse>(
      '/lesson-records',
      buildLessonRecordPayload(data),
    );
    return mapBackendLessonRecord(created);
  },

  /** 获取单条消课记录 */
  getById: async (recordId: string): Promise<LessonRecord | null> => {
    try {
      const record = await get<BackendLessonRecordDetailResponse>(`/lesson-records/${recordId}`);
      return mapBackendLessonRecord(record);
    } catch {
      return null;
    }
  },

  /** 删除消课记录 */
  remove: async (recordId: string) => {
    await del(`/lesson-records/${recordId}`);
    return;
  },

  /** 修改消课记录（P4，2026-08-22）：改课时 → 差额回补/追扣关联课包 */
  update: async (
    recordId: string,
    updates: { hours?: number; note?: string },
  ): Promise<LessonRecord | null> => {
    const updated = await put<BackendLessonRecordDetailResponse>(
      `/lesson-records/${recordId}`,
      buildLessonRecordPayload({
        hours: updates.hours,
        note: updates.note,
      } as unknown as Omit<LessonRecord, 'id' | 'created_at' | 'updated_at'>),
    );
    return mapBackendLessonRecord(updated);
  },

  /** 撤销消课记录（恢复课包余额，按扣减来源分别回加） */
  revoke: async (recordId: string, _operatorId: string, _reason: string) => {
    await put(`/lesson-records/${recordId}`, {
      status: 'CANCELLED',
    });
    return;
  },
};

// ============================================
// 请假 Service（实现见 leave.ts）
// ============================================
export { leaveService };

// ============================================
// 班级 Service
// ============================================
export const classService = {
  /** 教师名下班级（分批拉全，课程管理按分类再前端过滤） */
  getByTeacher: async (_teacherId: string, campusId?: string): Promise<Class[]> => {
    const list = await fetchAllPages(async (page, pageSize) => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (campusId) params.set('campusId', campusId);
      const data = await get<BackendClassListResponse>(`/classes?${params.toString()}`);
      return {
        list: data.list || [],
        pagination: data.pagination || {
          page,
          pageSize,
          total: data.list?.length || 0,
          totalPages: 1,
        },
      };
    }, API_PAGE_SIZE_BATCH);
    return list.map(mapBackendClassListItem);
  },
  getById: async (classId: string): Promise<Class | null> => {
    try {
      const cls = await get<BackendClassDetailResponse>(`/classes/${classId}`);
      return mapBackendClassDetail(cls);
    } catch {
      return null;
    }
  },
  /** 校区班级列表（家长调课选补课班用；真实环境按校区过滤教师可见班级） */
  getByCampus: async (campusId: string): Promise<Class[]> => {
    const list = await fetchAllPages(async (page, pageSize) => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (campusId) params.set('campusId', campusId);
      const data = await get<BackendClassListResponse>(`/classes?${params.toString()}`);
      return {
        list: data.list || [],
        pagination: data.pagination || {
          page,
          pageSize,
          total: data.list?.length || 0,
          totalPages: 1,
        },
      };
    }, API_PAGE_SIZE_BATCH);
    return list.map(mapBackendClassListItem);
  },
  getStudents: async (classId: string): Promise<Student[]> => {
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
        invite_code: resolveInviteCode(null),
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
  },
  getStudentCount: async (classId: string) => (await classService.getStudents(classId)).length,
  /**
   * 获取所有"已排课"的班级 id 列表（用于课程管理·班课列表区分已/未排课）
   * 真实后端：联调时按 teacher/admin 权限返回
   */
  getScheduledClassIds: async (): Promise<string[]> => {
    const list = await fetchAllPages(async (page, pageSize) => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      const data = await get<BackendScheduleListResponse>(`/schedules?${params.toString()}`);
      return {
        list: data.list || [],
        pagination: data.pagination || {
          page,
          pageSize,
          total: data.list?.length || 0,
          totalPages: 1,
        },
      };
    }, API_PAGE_SIZE_BATCH);
    const ids = new Set<string>();
    for (const item of list) {
      const classId =
        (item as { classId?: string; class_id?: string }).classId ??
        (item as { class_id?: string }).class_id;
      if (classId) ids.add(classId);
    }
    return Array.from(ids);
  },
  create: async (data: Omit<Class, 'id' | 'created_at' | 'updated_at'>) => {
    const created = await post<BackendClassListItem>('/classes', {
      name: data.name,
      schedule: data.schedule,
      subject: data.subject_id,
      type: data.type === 'limited' ? 'limited' : 'unlimited',
      totalLessons: data.type === 'limited' ? data.total_lessons : null,
      capacity: data.capacity ?? null,
      note: data.note,
      color: data.color,
      teachers: data.teachers,
      startTime: data.start_time,
      endTime: data.end_time,
    });
    return mapBackendClassListItem(created);
  },
  update: async (classId: string, data: Partial<Class>) => {
    const updated = await put<BackendClassListItem>(`/classes/${classId}`, {
      name: data.name,
      schedule: data.schedule,
      subject: data.subject_id,
      type: data.type === 'limited' ? 'limited' : data.type === 'ended' ? 'unlimited' : data.type,
      totalLessons: data.type === 'limited' ? data.total_lessons : null,
      capacity: data.capacity ?? null,
      note: data.note,
      color: data.color,
      teachers: data.teachers,
      startTime: data.start_time,
      endTime: data.end_time,
    });
    return mapBackendClassListItem(updated);
  },
  remove: async (classId: string) => {
    await del(`/classes/${classId}`);
    return;
  },
  /** 停课：课表隐藏该班排课/开放时段，可恢复 */
  pause: async (classId: string) => classService.update(classId, { status: 'paused' }),
  /** 恢复上课 */
  resume: async (classId: string) => classService.update(classId, { status: 'active' }),
  removeStudent: async (classId: string, studentId: string) =>
    del(`/classes/${classId}/students/${studentId}`),
  addStudents: async (classId: string, studentIds: string[]) => {
    for (const studentId of studentIds) {
      await post(`/classes/${classId}/students`, { studentId });
    }
    return;
  },
  transferStudent: async (classId: string, targetClassId: string, studentId: string) => {
    await post(`/classes/${classId}/transfer`, {
      studentId,
      targetClassId,
    });
    return;
  },
  end: async (classId: string) => {
    await post(`/classes/${classId}/end`, {});
    return;
  },
};

// ============================================
// 排课 Service
// ============================================
export const scheduleService = {
  /** 教师排课列表（分批拉全） */
  getByTeacher: async (_teacherId: string, campusId?: string): Promise<Schedule[]> => {
    const list = await fetchAllPages(async (page, pageSize) => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (campusId) params.set('campusId', campusId);
      const data = await get<BackendScheduleListResponse>(`/schedules?${params.toString()}`);
      return {
        list: data.list || [],
        pagination: data.pagination || {
          page,
          pageSize,
          total: data.list?.length || 0,
          totalPages: 1,
        },
      };
    }, API_PAGE_SIZE_BATCH);
    return list.map(mapBackendSchedule);
  },
  /** 校区排课（家长调课补课目标展开用） */
  getByCampus: async (campusId: string): Promise<Schedule[]> => {
    const list = await fetchAllPages(async (page, pageSize) => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (campusId) params.set('campusId', campusId);
      const data = await get<BackendScheduleListResponse>(`/schedules?${params.toString()}`);
      return {
        list: data.list || [],
        pagination: data.pagination || {
          page,
          pageSize,
          total: data.list?.length || 0,
          totalPages: 1,
        },
      };
    }, API_PAGE_SIZE_BATCH);
    return list.map(mapBackendSchedule);
  },

  /**
   * 家长课表：按绑定孩子班级拉排课（真接口靠 PARENT JWT；Mock 按 classIds 过滤）
   */
  listForParent: async (classIds: string[], campusId?: string): Promise<Schedule[]> => {
    const allowed = new Set(classIds);
    const list = await fetchAllPages(async (page, pageSize) => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (campusId) params.set('campusId', campusId);
      const data = await get<BackendScheduleListResponse>(`/schedules?${params.toString()}`);
      return {
        list: data.list || [],
        pagination: data.pagination || {
          page,
          pageSize,
          total: data.list?.length || 0,
          totalPages: 1,
        },
      };
    }, API_PAGE_SIZE_BATCH);
    return list
      .map(mapBackendSchedule)
      .filter((item) => item.class_id && allowed.has(item.class_id));
  },

  getById: async (scheduleId: string): Promise<Schedule | null> => {
    try {
      const schedule = await get<BackendScheduleDetailResponse>(`/schedules/${scheduleId}`);
      return mapBackendSchedule(schedule);
    } catch {
      return null;
    }
  },
  create: async (
    data: Omit<Schedule, 'id' | 'created_at' | 'updated_at'> & {
      ignoreConflict?: boolean;
      start_date?: string;
      end_date?: string;
      maxOccurrences?: number;
    },
  ): Promise<Schedule> => {
    const created = await post<BackendScheduleDetailResponse>('/schedules', {
      classId: data.class_id,
      dayOfWeek: mapFrontendDayOfWeek(data.day_of_week),
      startTime: data.start_time,
      endTime: data.end_time,
      startDate: data.start_date,
      endDate: data.end_date,
      maxOccurrences: data.maxOccurrences,
      room: data.room,
      note: data.note,
      ignoreConflict: data.ignoreConflict === true,
    });
    return mapBackendSchedule(created);
  },
  update: async (
    scheduleId: string,
    data: Partial<Schedule> & {
      ignoreConflict?: boolean;
      start_date?: string;
      end_date?: string;
      maxOccurrences?: number;
    },
  ): Promise<Schedule | null> => {
    const updated = await put<BackendScheduleDetailResponse>(`/schedules/${scheduleId}`, {
      classId: data.class_id,
      dayOfWeek: mapFrontendDayOfWeek(data.day_of_week),
      startTime: data.start_time,
      endTime: data.end_time,
      startDate: data.start_date,
      endDate: data.end_date,
      maxOccurrences: data.maxOccurrences,
      room: data.room,
      note: data.note,
      ignoreConflict: data.ignoreConflict === true,
    });
    return mapBackendSchedule(updated);
  },
  remove: async (scheduleId: string) => {
    await del(`/schedules/${scheduleId}`);
    return;
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

    const qs = new URLSearchParams({
      dayOfWeek: String(mapFrontendDayOfWeek(dayOfWeek)),
      startTime,
      endTime,
    });
    if (teacherId) qs.set('teacherId', teacherId);
    if (classId) qs.set('classId', classId);
    if (room) qs.set('room', room);
    if (excludeId) qs.set('excludeScheduleId', excludeId);

    const result = await get<BackendScheduleConflictResponse>(
      `/schedules/check-conflict?${qs.toString()}`,
    );
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
// 通知 Service（实现见 notification.ts）
// ============================================
export { notificationService };

// ============================================
// 工具函数
// ============================================
export { formatDateCN } from '@/utils/format';
export type { FeeMethod };
