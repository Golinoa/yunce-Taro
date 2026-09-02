/**
 * 课表危险操作纯逻辑（供 use-schedule-danger-actions 与单测共用）
 * 使用场景：恢复取消记录筛选、消课记录合并、开放时段休息态、批量解散结果文案。
 */
import type { Class, ClassBookingSlot } from '@/types/class';
import type { LessonRecord } from '@/types/lesson-record';
import type { Schedule } from '@/types/schedule';

/** 恢复开课时：筛出当日该班已取消记录。 */
export function filterCancelledRecordsForRestore(
  lessonRecords: LessonRecord[],
  classId: string,
  lessonDate: string,
): LessonRecord[] {
  return lessonRecords.filter(
    (record) =>
      record.class_id === classId &&
      record.lesson_date === lessonDate &&
      record.status === 'cancelled',
  );
}

/** 写入停课/取消记录后：去掉同班同日旧记录再追加新建。 */
export function mergeLessonRecordsForDate(
  prev: LessonRecord[],
  classId: string,
  lessonDate: string,
  createdRecords: LessonRecord[],
): LessonRecord[] {
  const filtered = prev.filter(
    (record) => !(record.class_id === classId && record.lesson_date === lessonDate),
  );
  return [...filtered, ...createdRecords];
}

/** 恢复开课成功后：移除当日该班 cancelled 记录。 */
export function removeCancelledRecordsForDate(
  prev: LessonRecord[],
  classId: string,
  lessonDate: string,
): LessonRecord[] {
  return prev.filter(
    (record) =>
      !(
        record.class_id === classId &&
        record.lesson_date === lessonDate &&
        record.status === 'cancelled'
      ),
  );
}

/** 团课停课：将指定 slot 标记为 rest（不可变更新）。 */
export function applyOpenSlotRestStatus(
  prev: Record<string, Record<string, ClassBookingSlot[]>>,
  slot: Pick<ClassBookingSlot, 'id' | 'class_id' | 'lesson_date'>,
): Record<string, Record<string, ClassBookingSlot[]>> {
  const next = { ...prev };
  const dateKey = slot.lesson_date;
  if (!next[dateKey]) {
    return next;
  }
  next[dateKey] = { ...next[dateKey] };
  const classSlots = next[dateKey][slot.class_id];
  if (classSlots) {
    next[dateKey][slot.class_id] = classSlots.map((s) =>
      s.id === slot.id ? { ...s, status: 'rest' as const } : s,
    );
  }
  return next;
}

/** 批量解散成功后：从班级列表剔除成功 id。 */
export function filterClassesAfterBatchDelete(classes: Class[], successIds: string[]): Class[] {
  return classes.filter((classItem) => !successIds.includes(classItem.id));
}

/** 批量解散成功后：剔除成功班级相关排课。 */
export function filterSchedulesAfterBatchDelete(
  schedules: Schedule[],
  successIds: string[],
): Schedule[] {
  return schedules.filter((scheduleItem) => !successIds.includes(scheduleItem.class_id || ''));
}

export interface BatchDeleteToastResult {
  title: string;
  icon: 'success' | 'none';
  duration?: number;
}

/** 批量解散结果 toast 文案。 */
export function resolveBatchDeleteToast(
  successCount: number,
  failedCount: number,
): BatchDeleteToastResult {
  if (failedCount === 0) {
    return { title: `已删除 ${successCount} 个班级`, icon: 'success' };
  }
  if (successCount === 0) {
    return { title: '删除失败，请重试', icon: 'none' };
  }
  return {
    title: `${successCount}个已删除，${failedCount}个失败`,
    icon: 'none',
    duration: 3000,
  };
}
