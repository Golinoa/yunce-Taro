/**
 * 排课 Service（Q2-4，从 student.ts 抽出）
 */
import type { Schedule } from '@/types/schedule';
import { API_PAGE_SIZE_BATCH, fetchAllPages } from '@/utils/pagination';
import { del, get, post, put } from '@/utils/request';

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


