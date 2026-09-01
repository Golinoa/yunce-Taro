import dayjs from 'dayjs';
import type { Class, Schedule, TemporaryReschedule } from '@/types';
import {
  API_PAGE_SIZE_BATCH,
  asPaginatedResponse,
  fetchAllPages,
  type PaginatedResponse,
} from '@/utils/pagination';
import { get, post } from '@/utils/request';

interface SaveBatchParams {
  teacherId: string;
  sourceDate: string;
  targetDate: string;
  schedules: Schedule[];
}

interface CheckDateConflictParams {
  teacherId: string;
  sourceDate: string;
  targetDate: string;
  movingSchedules: Schedule[];
  allSchedules: Schedule[];
  classById?: Record<string, Class>;
}

interface LessonSlot {
  classId: string;
  endTime: string;
  key: string;
  label: string;
  scheduleId: string;
  startTime: string;
}

/** 后端 /attendance/reschedules 列表项（含 FE 映射字段） */
interface BackendTemporaryRescheduleItem {
  classId?: string;
  createdAt: string;
  endTime?: string;
  id: string;
  originalDate?: string;
  originalTime?: string;
  scheduleId: string;
  sourceDate?: string;
  startTime?: string;
  targetDate: string;
  targetTime?: string;
  teacherId?: string;
  updatedAt: string;
}

interface BackendTemporaryRescheduleBatchResponse {
  batchNo?: string;
  items?: BackendTemporaryRescheduleItem[];
  status?: string;
}

function mapBackendTemporaryReschedule(item: BackendTemporaryRescheduleItem): TemporaryReschedule {
  const sourceDate = item.sourceDate || item.originalDate || '';
  const targetDate = item.targetDate || '';
  const startTime = item.startTime || item.originalTime || '';
  const endTime = item.endTime || item.targetTime || '';
  return {
    id: item.id,
    teacher_id: item.teacherId || '',
    class_id: item.classId || '',
    schedule_id: item.scheduleId,
    source_date: sourceDate,
    target_date: targetDate,
    start_time: startTime,
    end_time: endTime,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  };
}

function rangesOverlap(leftStart: string, leftEnd: string, rightStart: string, rightEnd: string) {
  return leftStart < rightEnd && leftEnd > rightStart;
}

function buildLessonSlotsFromSchedules(
  schedules: Schedule[],
  classById?: Record<string, Class>,
): LessonSlot[] {
  return schedules.map((item) => {
    const className = classById?.[item.class_id || '']?.name || item.class_id || '班级';
    return {
      key: `${item.id}-${item.start_time}-${item.end_time}`,
      classId: item.class_id || '',
      scheduleId: item.id,
      startTime: item.start_time,
      endTime: item.end_time,
      label: `${className} ${item.start_time}-${item.end_time}`,
    };
  });
}

export const temporaryRescheduleService = {
  /**
   * 获取指定日期范围内的临时调课记录（真接口 /attendance/reschedules）。
   */
  getByTeacherAndRange: async (
    teacherId: string,
    startDate: string,
    endDate: string,
  ): Promise<TemporaryReschedule[]> => {
    try {
      const list = await fetchAllPages(async (page, pageSize) => {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
          teacherId,
          startDate,
          endDate,
        });
        const response = await get<
          PaginatedResponse<BackendTemporaryRescheduleItem> | BackendTemporaryRescheduleItem[]
        >(`/attendance/reschedules?${params.toString()}`);
        return asPaginatedResponse(response, page, pageSize);
      }, API_PAGE_SIZE_BATCH);
      return list.map(mapBackendTemporaryReschedule);
    } catch {
      // 真联动失败：空列表（由页面静默）；禁止再写本地假成功
      return [];
    }
  },

  /**
   * 批量保存临时调课 → POST /attendance/reschedules/batch（保存即生效）。
   * UI 载荷不变；此处适配后端字段。
   */
  saveBatch: async ({
    teacherId,
    sourceDate,
    targetDate,
    schedules,
  }: SaveBatchParams): Promise<TemporaryReschedule[]> => {
    const response = await post<
      BackendTemporaryRescheduleBatchResponse | BackendTemporaryRescheduleItem[]
    >('/attendance/reschedules/batch', {
      reason: '课表临时调课',
      schedules: schedules.map((schedule) => ({
        scheduleId: schedule.id,
        originalDate: sourceDate,
        originalTime: schedule.start_time,
        targetDate,
        targetTime: schedule.end_time,
      })),
    });
    const list = Array.isArray(response) ? response : response.items || [];
    if (list.length > 0) {
      return list.map(mapBackendTemporaryReschedule);
    }
    // 兜底：用请求参数组装（后端已入库）
    const now = new Date().toISOString();
    return schedules.map((schedule) => ({
      id: `tmp-reschedule-${schedule.id}-${sourceDate}`,
      teacher_id: teacherId,
      class_id: schedule.class_id || '',
      schedule_id: schedule.id,
      source_date: sourceDate,
      target_date: targetDate,
      start_time: schedule.start_time,
      end_time: schedule.end_time,
      created_at: now,
      updated_at: now,
    }));
  },

  checkDateConflict: async ({
    teacherId,
    sourceDate,
    targetDate,
    movingSchedules,
    allSchedules,
    classById,
  }: CheckDateConflictParams): Promise<{ hasConflict: boolean; conflicts: LessonSlot[] }> => {
    if (sourceDate === targetDate) {
      return { hasConflict: false, conflicts: [] };
    }
    const targetDow = dayjs(targetDate).day();
    const staying = allSchedules.filter(
      (s) =>
        s.teacher_id === teacherId &&
        Number(s.day_of_week) === targetDow &&
        !movingSchedules.some((m) => m.id === s.id),
    );
    const adjusted = await temporaryRescheduleService.getByTeacherAndRange(
      teacherId,
      targetDate,
      targetDate,
    );
    const adjustedSlots: LessonSlot[] = adjusted
      .filter((a) => a.target_date === targetDate)
      .map((a) => ({
        key: a.id,
        classId: a.class_id,
        scheduleId: a.schedule_id,
        startTime: a.start_time,
        endTime: a.end_time,
        label: `${a.start_time}-${a.end_time}`,
      }));

    const existing = [...buildLessonSlotsFromSchedules(staying, classById), ...adjustedSlots];
    const moving = buildLessonSlotsFromSchedules(movingSchedules, classById);
    const conflicts: LessonSlot[] = [];
    for (const m of moving) {
      for (const e of existing) {
        if (rangesOverlap(m.startTime, m.endTime, e.startTime, e.endTime)) {
          conflicts.push(e);
        }
      }
      for (const other of moving) {
        if (other.key === m.key) continue;
        if (rangesOverlap(m.startTime, m.endTime, other.startTime, other.endTime)) {
          conflicts.push(other);
        }
      }
    }
    const uniq = new Map(conflicts.map((c) => [c.key, c]));
    return { hasConflict: uniq.size > 0, conflicts: [...uniq.values()] };
  },
};
