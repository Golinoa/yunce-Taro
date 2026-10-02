/**
 * 消课记录 Service（Q2-4，从 student.ts 抽出）
 */
import type { FeeMethod } from '@/types/fee';
import type { LessonRecord } from '@/types/lesson-record';
import { API_PAGE_SIZE_BATCH, fetchAllPages } from '@/utils/pagination';
import { ApiError, del, get, post, put } from '@/utils/request';

interface BackendLessonRecordListItem {
  classId?: null | string;
  className?: null | string;
  /** 本节所属排课规则 ID；同班同一天多节课时用它区分（后端 by-range 必须返回） */
  scheduleId?: null | string;
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
  memberCardId?: null | string;
  memberCardName?: null | string;
  packageName?: null | string;
  performance?: null | string;
  operatorTeacherId?: null | string;
  operatorTeacherName?: null | string;
  assistantTeacherId?: null | string;
  assistantTeacherName?: null | string;
  status?: 'NORMAL' | 'CANCELLED' | 'MAKEUP' | 'LEAVE' | 'ABSENT';
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
  /** 本节所属排课规则（详情接口带回对象形式） */
  schedule?: {
    id: string;
  } | null;
  content?: null | string;
  createdAt: string;
  duration: number;
  homework?: null | string;
  homeworkImages?: null | string[];
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
  status?: 'NORMAL' | 'CANCELLED' | 'MAKEUP' | 'LEAVE' | 'ABSENT';
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
  /** 本节所属排课规则 ID（后端回传，前端据此把记录归到「这一节」） */
  scheduleId?: null | string;
  content?: null | string;
  createdAt: string;
  duration: number;
  homework?: null | string;
  homeworkImages?: null | string[];
  hoursUsed?: null | number;
  performance?: null | string;
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
  status?: 'NORMAL' | 'CANCELLED' | 'MAKEUP' | 'LEAVE' | 'ABSENT';
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
  status?: 'NORMAL' | 'CANCELLED' | 'MAKEUP' | 'LEAVE' | 'ABSENT',
): LessonRecord['status'] => {
  if (status === 'CANCELLED') return 'cancelled';
  if (status === 'MAKEUP') return 'makeup';
  if (status === 'LEAVE') return 'leave';
  if (status === 'ABSENT') return 'absent';
  return 'normal';
};

/**
 * 前端状态 → 后端大写枚举（写方向；读方向见上面的 `mapBackendLessonRecordStatus`）。
 *
 * 🔴 **必须是全量映射，不能只列几个分支**：后端 `lessonStatusSchema` 只认这 5 个大写值，
 * 而且建记录时 `status = input.status ?? NORMAL` ⇒ 前端**少发/漏发**该字段会被静默当成"正常出勤"。
 * 2026-10-01 实测到的真实后果（原实现漏了 leave/absent）：
 * - `leave` 漏发 ⇒ 请假被记成 `NORMAL`，"请假"在点名里显示成"已点名"；
 * - `absent` 漏发 ⇒ 缺勤路径同时带 `createDebt: true`，撞后端规则
 *   `if (input.createDebt && !isAbsent) throw 422「只有缺勤记录可以创建欠课」`
 *   ⇒ **缺勤记录根本建不出来**（点名提交时落进失败清单）。
 * 回归测试：`src/services/lesson-record-status.test.ts`。
 */
const FRONTEND_TO_BACKEND_LESSON_STATUS: Record<NonNullable<LessonRecord['status']>, string> = {
  normal: 'NORMAL',
  makeup: 'MAKEUP',
  leave: 'LEAVE',
  absent: 'ABSENT',
  cancelled: 'CANCELLED',
};

/**
 * 后端记录 → 前端 `LessonRecord`（导出以便对「哪几列必须原样带过来」写回归测试：
 * 见 `lesson-record-mapper.test.ts`，对应 rule `50-lesson-identity` 规则 1）。
 */
export function mapBackendLessonRecord(
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
  /**
   * ⚠️ 班级 id 以**扁平 `classId` 优先**，`class` 对象只作兜底。
   *
   * 原因：列表接口（`GET /lesson-records`）返回的 `class` 只有 `name`（没有 `id`），
   * 若只认 `class.id`，`class_id` 就会恒为 undefined ⇒ 依赖它的
   * 「这节课点过名没有 / 重复点名保护 / 补课试听的幂等」全部判不中。
   * 后端三个取数口都应返回扁平 `classId`（rule `50-lesson-identity` 规则 1）。
   */
  const resolvedClassId = ('classId' in item ? item.classId || '' : '') || classInfo?.id || '';
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
    /**
     * ⚠️ 早先这里把 `teacher_id` 硬编码成 `''` ⇒ 流水账卡片取不到主讲，落回「未知教师」。
     * 后端两个记录接口已返回 `teacherId` / `teacherName`，这里照实映射。
     */
    teacher_id: 'teacherId' in item ? item.teacherId || '' : '',
    operator_teacher_id:
      'operatorTeacherId' in item ? item.operatorTeacherId || undefined : undefined,
    student_id:
      'studentId' in item
        ? item.studentId
        : 'student' in item && item.student?.id
          ? item.student.id
          : '',
    member_card_id: 'memberCardId' in item ? item.memberCardId || undefined : undefined,
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
    class_id: resolvedClassId || undefined,
    class_name: classInfo?.name || undefined,
    schedule_id:
      ('scheduleId' in item ? item.scheduleId : undefined) ||
      ('schedule' in item && item.schedule?.id ? item.schedule.id : undefined) ||
      undefined,
    campus_id: ('campusId' in item ? item.campusId : undefined) || undefined,
    room: ('room' in item ? item.room : undefined) || undefined,
    created_at: item.createdAt,
    updated_at: 'updatedAt' in item && item.updatedAt ? item.updatedAt : item.createdAt,
    member_card_name: packageName || undefined,
    student:
      studentName || studentAvatar
        ? {
            name: studentName || '学员',
            avatar_url: studentAvatar,
          }
        : undefined,
    teacher: teacherName ? { name: teacherName } : undefined,
    operator_teacher: operatorTeacherName ? { name: operatorTeacherName } : undefined,
    /**
     * 助教：`LessonRecord` **没有助教列**（后端从未存储），所以这里永远是 undefined。
     * 保留字段只为兼容旧类型；不要为了让 UI 显示而凭空造值。
     */
    assistant_teacher: assistantTeacherName ? { name: assistantTeacherName } : undefined,
  };
}

function buildLessonRecordPayload(
  data: Omit<LessonRecord, 'id' | 'created_at' | 'updated_at'> | Partial<LessonRecord>,
) {
  return {
    studentId: data.student_id || '',
    teacherId: data.teacher_id || undefined,
    operatorTeacherId: data.operator_teacher_id || undefined,
    assistantTeacherId: data.assistant_teacher_id || undefined,
    memberCardId: data.member_card_id || undefined,
    classId: data.class_id || undefined,
    /**
     * 「哪一节」的排课 ID。同班同一天可能排多节课（如 09:00 与 14:00 两条规则），
     * LessonRecord 没有时段列，只能靠它区分；不传时后端存 null，
     * 读取端按「不区分」兜底（宁可多显示，不能吞记录）。
     */
    scheduleId: data.schedule_id || undefined,
    campusId: data.campus_id || undefined,
    room: data.room,
    lessonDate: normalizeLessonDate(data.lesson_date) || new Date().toISOString().slice(0, 10),
    duration: Math.max(Math.round(Number(data.hours_used || 0) * 60), 1),
    hoursUsed: data.hours_used,
    content: data.content,
    homework: data.homework,
    performance: data.performance,
    homeworkImages: data.homework_images,
    // 单学员备注 → 后端 remark 字段
    remark: data.note,
    createDebt: data.create_debt,
    /**
     * 状态一律显式发出（见 `FRONTEND_TO_BACKEND_LESSON_STATUS` 的注释）：
     * **缺失**会被后端按默认值落成 `NORMAL`，而"没说"和"正常出勤"是两件事。
     */
    status: data.status ? FRONTEND_TO_BACKEND_LESSON_STATUS[data.status] : 'NORMAL',
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
    } catch (error) {
      if (error instanceof ApiError && error.code === 404) return null;
      throw error;
    }
  },

  /** 删除消课记录 */
  remove: async (recordId: string) => {
    await del(`/lesson-records/${recordId}`);
    return;
  },

  /** 修改消课记录；课时变更由后端在同一事务内同步课包/欠课 */
  update: async (
    recordId: string,
    updates: {
      hours?: number;
      note?: string;
      content?: string;
      homework?: string;
      performance?: string;
    },
  ): Promise<LessonRecord> => {
    const updated = await put<BackendLessonRecordDetailResponse>(`/lesson-records/${recordId}`, {
      ...(updates.hours !== undefined ? { hoursUsed: updates.hours } : {}),
      ...(updates.note !== undefined ? { remark: updates.note } : {}),
      ...(updates.content !== undefined ? { content: updates.content } : {}),
      ...(updates.homework !== undefined ? { homework: updates.homework } : {}),
      ...(updates.performance !== undefined ? { performance: updates.performance } : {}),
    });
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
