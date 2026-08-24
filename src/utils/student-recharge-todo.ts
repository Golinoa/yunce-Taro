/**
 * 学员课时续费待办 — 统一标题与描述文案
 */

/** 待办标题：`「张三」课时续费提醒` */
export function buildStudentRechargeTodoTitle(studentName: string): string {
  const name = studentName.trim() || '学员';
  return `「${name}」课时续费提醒`;
}

/** 待办描述：`剩余 X 课时 · 请尽快跟进续费` */
export function buildStudentRechargeTodoDesc(
  remainingHours?: number,
  options?: { exhausted?: boolean },
): string {
  if (options?.exhausted || remainingHours === 0) {
    return '课时已用尽 · 请尽快跟进续费';
  }
  if (remainingHours !== undefined && Number.isFinite(remainingHours)) {
    return `剩余 ${remainingHours} 课时 · 请尽快跟进续费`;
  }
  return '课时不足 · 请尽快跟进续费';
}

/** 从运营预警 info 文案归一化为统一描述 */
export function normalizeStudentRechargeTodoDesc(info: string): string {
  if (info.includes('已用尽')) {
    return buildStudentRechargeTodoDesc(0, { exhausted: true });
  }
  const match = /剩余\s*(\d+)\s*课时/.exec(info);
  if (match) {
    return buildStudentRechargeTodoDesc(Number(match[1]));
  }
  return buildStudentRechargeTodoDesc();
}
