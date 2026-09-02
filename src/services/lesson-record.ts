/**
 * 消课记录 Service（Q2-4，从 student.ts 抽出）
 */
import type { FeeMethod } from '@/types/course-package';
import type { LessonRecord } from '@/types/lesson-record';
import { API_PAGE_SIZE_BATCH, fetchAllPages } from '@/utils/pagination';
import { del, get, post, put } from '@/utils/request';

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


