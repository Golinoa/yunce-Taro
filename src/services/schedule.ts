/**
 * 排课 Service（Q2-4，从 student.ts 抽出）
 */
import type { Schedule, ScheduleRuleStatus } from '@/types/schedule';
import { normalizeLessonStartTime } from '@/utils/lesson-identity';
import { API_PAGE_SIZE_BATCH, fetchAllPages } from '@/utils/pagination';
import { del, get, post, put } from '@/utils/request';

/** `/schedules/today?date=` 返回的一天课次（服务端已做规则+调课+节假日推导） */
export interface ScheduleDayLesson {
  /** 排课编号＝「哪一节」的身份 */
  scheduleId: string;
  classId: string | null;
  className: string;
  startTime: string;
  endTime: string;
  teacherName?: string;
  checkedCount: number;
  totalCount: number;
}

interface BackendDayScheduleItem {
  id: string;
  startTime: string;
  endTime: string;
  class?: { id: string; name: string; subject?: null | string } | null;
  teacherName?: string;
  checkedCount?: number;
  totalCount?: number;
  /** 有值＝这是试听/补课预约卡，不是排课规则 */
  bookingId?: string;
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
  status?: ScheduleRuleStatus;
  stoppedAt?: null | string;
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
  /** 节假日是否跳过排课（来自排课表单「节假日排课」开关的反值） */
  skipHoliday?: boolean;
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
  status?: ScheduleRuleStatus;
  stoppedAt?: null | string;
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
    rule_status: item.status,
    stopped_at: item.stoppedAt || undefined,
    /**
     * 规则有效期：后端两个接口都返回了（`startDate`/`endDate`），前端此前**没接**，
     * 导致展开课次时无法按有效期收窄（真源 `isScheduleRuleEffectiveOnDate`）。
     * 典型后果：排课时设了「开始日期 = 下月」，本周课表就已经排上了；
     * 以及「删了规则再重建」时新规则会回填到历史日期，同一节课出现两张卡片。
     */
    start_date: item.startDate || undefined,
    end_date: item.endDate || undefined,
    skip_holiday: 'skipHoliday' in item ? Boolean(item.skipHoliday) : undefined,
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
      /**
       * 生成课次时是否跳过节假日（排课表单「节假日排课」开关的反值：选「否」⇒ true）。
       * ⚠️ 曾漏传此参数，后端始终走 default(true)，导致「节假日排课=是」形同虚设。
       */
      skipHoliday?: boolean;
    },
  ): Promise<Schedule> => {
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
      skipHoliday: data.skipHoliday,
    });
    return mapBackendSchedule(created);
  },
  update: async (
    scheduleId: string,
    data: Partial<Schedule> & {
      ignoreConflict?: boolean;
      start_date?: string;
      end_date?: string;
      /** 见 create 的 skipHoliday 说明 */
      skipHoliday?: boolean;
    },
  ): Promise<Schedule | null> => {
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
      skipHoliday: data.skipHoliday,
    });
    return mapBackendSchedule(updated);
  },
  remove: async (scheduleId: string) => {
    await del(`/schedules/${scheduleId}`);
    return;
  },
  changeRuleStatus: async (
    scheduleId: string,
    action: 'pause' | 'resume' | 'stop',
  ): Promise<Schedule> => {
    const updated = await post<BackendScheduleDetailResponse>(
      `/schedules/${scheduleId}/rule-status`,
      { action },
    );
    return mapBackendSchedule(updated);
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

  /**
   * 某一天的课次列表（服务端推导：排课规则 + 临时调课叠加 + 节假日停课 + 点名进度）。
   *
   * 用途：从「没有节次信息」的入口（首页快速消课 / 预约页 / 线索详情）进点名页时，
   * 需要知道**这个班当天有哪几节课**，才能按「排课编号」定位到具体那一节
   * （同班同一天可以排多节课，只按班级+日期分不清）。
   *
   * 复用后端 `/schedules/today?date=`（它接受 date 参数），不新增接口、不自己再推导一遍。
   */
  getDayLessons: async (date: string): Promise<ScheduleDayLesson[]> => {
    const data = await get<{ schedules?: BackendDayScheduleItem[] }>(
      `/schedules/today?date=${encodeURIComponent(date)}`,
    );
    return (
      (data.schedules || [])
        // 试听/补课预约卡不是「排课规则」，不参与选节次
        .filter((item) => !item.bookingId)
        .map((item) => ({
          scheduleId: item.id,
          classId: item.class?.id ?? null,
          className: item.class?.name ?? '',
          startTime: normalizeLessonStartTime(item.startTime),
          endTime: normalizeLessonStartTime(item.endTime),
          teacherName: item.teacherName,
          checkedCount: item.checkedCount ?? 0,
          totalCount: item.totalCount ?? 0,
        }))
    );
  },
};
