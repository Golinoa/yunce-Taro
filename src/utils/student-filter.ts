/**
 * 学员软删除过滤（全局唯一口径）
 *
 * 学员 `Student.status` 为 `'active' | 'deleted'`，`deleted` 即软删除。
 * 凡「拉取同一份学员数据」的入口（约试听/补课选择页、点名页添加学员、班级名单等）
 * 都应复用本文件，保证名单里永不出现已软删除的学员，避免散落各处各写一遍过滤。
 */
import type { Student } from '@/types/student';

/** 软删除学员标记（与后端 Student.status 口径一致） */
export const DELETED_STUDENT_STATUS = 'deleted';

/** 剔除软删除学员；入参为空时返回空数组（不抛错）。 */
export function filterSoftDeletedStudents(students: Student[] | undefined | null): Student[] {
  if (!students || students.length === 0) return [];
  return students.filter((student) => student.status !== DELETED_STUDENT_STATUS);
}
