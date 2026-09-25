import type { Student } from '@/types/student';

/**
 * 学员是否应出现在「在籍列表」中。
 *
 * 背景（2026-09-25 修复）：删除学员是**软删除** —— 后端只把 `status` 置为 `INACTIVE`，
 * 行仍保留在库中，且 `GET /students` 依然会返回该行（前端不传 status 过滤参数）。
 * 因此**客户端必须自行剔除**，否则删除后列表依旧显示该学员。
 *
 * 与 `services/student.ts` 的 `mapBackendStudentStatus` 配套：
 * 只有 `ACTIVE` 映射为 `'active'`，其余（`INACTIVE` / `GRADUATED`）一律为 `'deleted'`。
 *
 * 容错：`status` 缺省（老数据 / 字段未下发）时视为在籍，避免误隐藏学员。
 */
export function isActiveStudent(student: Pick<Student, 'status'>): boolean {
  return student.status !== 'deleted';
}

/** 过滤出应展示的学员（在籍），保持原顺序与元素类型 */
export function filterActiveStudents<T extends Pick<Student, 'status'>>(list: T[]): T[] {
  return list.filter(isActiveStudent);
}
