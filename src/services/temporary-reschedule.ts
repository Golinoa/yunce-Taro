import Taro from '@tarojs/taro';
import dayjs from 'dayjs';
import type { Class, Schedule, TemporaryReschedule } from '@/types';
import { get, post } from '@/utils/request';

const STORAGE_KEY = 'yunce-temporary-reschedules';
const USE_MOCK =
  typeof process !== 'undefined' && typeof process.env !== 'undefined'
    ? process.env.VITE_USE_MOCK !== 'false'
    : true;

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

interface BackendTemporaryRescheduleItem {
  classId: string;
  createdAt: string;
  endTime: string;
  id: string;
  scheduleId: string;
  sourceDate: string;
  startTime: string;
  targetDate: string;
  teacherId: string;
  updatedAt: string;
}

interface BackendTemporaryRescheduleListResponse {
  list: BackendTemporaryRescheduleItem[];
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

interface BackendTemporaryRescheduleBatchResponse {
  items: BackendTemporaryRescheduleItem[];
}

function readStorage(): TemporaryReschedule[] {
  try {
    const raw = Taro.getStorageSync(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? (parsed as TemporaryReschedule[]) : [];
  } catch {
    return [];
  }
}

function writeStorage(list: TemporaryReschedule[]) {
  Taro.setStorageSync(STORAGE_KEY, JSON.stringify(list));
}

function mapBackendTemporaryReschedule(item: BackendTemporaryRescheduleItem): TemporaryReschedule {
  return {
    id: item.id,
    teacher_id: item.teacherId,
    class_id: item.classId,
    schedule_id: item.scheduleId,
    source_date: item.sourceDate,
    target_date: item.targetDate,
    start_time: item.startTime,
    end_time: item.endTime,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  };
}

function toMinutes(time: string): number {
  const [hour, minute] = time.split(':').map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return 0;
  }
  return hour * 60 + minute;
}

function isTimeOverlap(left: LessonSlot, right: LessonSlot): boolean {
  return (
    toMinutes(left.startTime) < toMinutes(right.endTime) &&
    toMinutes(right.startTime) < toMinutes(left.endTime)
  );
}

function buildLessonSlot(
  schedule: Pick<Schedule, 'class_id' | 'end_time' | 'id' | 'start_time'>,
  classById?: Record<string, Class>,
): LessonSlot {
  const classId = schedule.class_id || '';
  const className = classById?.[classId]?.name || '未命名班级';
  return {
    key: schedule.id,
    scheduleId: schedule.id,
    classId,
    startTime: schedule.start_time,
    endTime: schedule.end_time,
    label: `${className} ${schedule.start_time}-${schedule.end_time}`,
  };
}

function buildAdjustmentSlot(
  item: TemporaryReschedule,
  classById?: Record<string, Class>,
): LessonSlot {
  const className = classById?.[item.class_id]?.name || '未命名班级';
  return {
    key: item.id,
    scheduleId: item.schedule_id,
    classId: item.class_id,
    startTime: item.start_time,
    endTime: item.end_time,
    label: `${className} ${item.start_time}-${item.end_time}`,
  };
}

export const temporaryRescheduleService = {
  /**
   * 获取指定日期范围内的临时调课记录。
   * 只要原日期或目标日期落在范围内，就需要返回给页面参与渲染。
   */
  getByTeacherAndRange: async (
    teacherId: string,
    startDate: string,
    endDate: string,
  ): Promise<TemporaryReschedule[]> => {
    if (!USE_MOCK) {
      const response = await get<
        BackendTemporaryRescheduleListResponse | BackendTemporaryRescheduleItem[]
      >(
        `/temporary-reschedules?page=1&pageSize=200&teacherId=${encodeURIComponent(
          teacherId,
        )}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`,
      );
      const list = Array.isArray(response) ? response : response.list || [];
      return list.map(mapBackendTemporaryReschedule);
    }

    return readStorage()
      .filter((item) => item.teacher_id === teacherId)
      .filter((item) => {
        const inSourceRange = item.source_date >= startDate && item.source_date <= endDate;
        const inTargetRange = item.target_date >= startDate && item.target_date <= endDate;
        return inSourceRange || inTargetRange;
      })
      .sort((left, right) => left.source_date.localeCompare(right.source_date));
  },

  /**
   * 批量保存临时调课，只覆盖指定日期对应的课程实例。
   * 同一条排课在同一天重复调课时，会直接覆盖旧记录。
   */
  saveBatch: async ({
    teacherId,
    sourceDate,
    targetDate,
    schedules,
  }: SaveBatchParams): Promise<TemporaryReschedule[]> => {
    if (!USE_MOCK) {
      const response = await post<
        BackendTemporaryRescheduleBatchResponse | BackendTemporaryRescheduleItem[]
      >('/temporary-reschedules/batch', {
        teacherId,
        sourceDate,
        targetDate,
        items: schedules.map((schedule) => ({
          classId: schedule.class_id || '',
          scheduleId: schedule.id,
          startTime: schedule.start_time,
          endTime: schedule.end_time,
        })),
      });
      const list = Array.isArray(response) ? response : response.items || [];
      return list.map(mapBackendTemporaryReschedule);
    }

    const now = new Date().toISOString();
    const nextItems = schedules.map<TemporaryReschedule>((schedule) => ({
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
    const replaceKeys = new Set(
      nextItems.map((item) => `${item.schedule_id}__${item.source_date}`),
    );
    const preserved = readStorage().filter(
      (item) => !replaceKeys.has(`${item.schedule_id}__${item.source_date}`),
    );
    writeStorage([...preserved, ...nextItems]);
    return nextItems;
  },

  /**
   * 检查目标日期是否会和教师已有课程冲突。
   * 冲突来源同时包含：
   * 1. 该日期原本的固定排课
   * 2. 其他已经调到该日期的临时课程
   * 3. 本次批量调课内部多个班级之间的时间冲突
   */
  checkDateConflict: async ({
    teacherId,
    sourceDate,
    targetDate,
    movingSchedules,
    allSchedules,
    classById,
  }: CheckDateConflictParams): Promise<string[]> => {
    const targetWeekday = (dayjs(targetDate).day() || 7) as Schedule['day_of_week'];
    const rangeStart = sourceDate < targetDate ? sourceDate : targetDate;
    const rangeEnd = sourceDate > targetDate ? sourceDate : targetDate;
    const allAdjustments = await temporaryRescheduleService.getByTeacherAndRange(
      teacherId,
      rangeStart,
      rangeEnd,
    );
    const movedOutOnTarget = new Set(
      allAdjustments
        .filter((item) => item.source_date === targetDate)
        .map((item) => item.schedule_id),
    );
    const replacingKeys = new Set(movingSchedules.map((item) => `${item.id}__${sourceDate}`));

    const occupiedSlots: LessonSlot[] = allSchedules
      .filter((item) => item.day_of_week === targetWeekday)
      .filter((item) => !movedOutOnTarget.has(item.id))
      .map((item) => buildLessonSlot(item, classById));

    const movedInSlots = allAdjustments
      .filter((item) => item.target_date === targetDate)
      .filter((item) => !replacingKeys.has(`${item.schedule_id}__${item.source_date}`))
      .map((item) => buildAdjustmentSlot(item, classById));

    occupiedSlots.push(...movedInSlots);

    const conflictItems = new Set<string>();
    for (const schedule of movingSchedules) {
      const currentSlot = buildLessonSlot(schedule, classById);
      const hasConflict = occupiedSlots.some((item) => isTimeOverlap(item, currentSlot));
      if (hasConflict) {
        conflictItems.add(currentSlot.label);
        continue;
      }
      occupiedSlots.push(currentSlot);
    }

    return Array.from(conflictItems);
  },
};
