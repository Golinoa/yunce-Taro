/**
 * 学员课时续费待办 — 统一标题、描述、跳转与默认参与人
 */
import { TODO_ALERT_RECHARGE_PREFIX } from '@/utils/todo-read';

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

/** 去处理 → 该学员详情页 */
export function buildStudentRechargeTodoUrl(studentId: string): string {
  return `/package-student/pages/student-detail/index?id=${encodeURIComponent(studentId)}`;
}

export function isStudentRechargeTodoId(todoId: string): boolean {
  return Boolean(todoId) && todoId.startsWith(TODO_ALERT_RECHARGE_PREFIX);
}

export function parseStudentIdFromRechargeTodoId(todoId: string): string | null {
  if (!isStudentRechargeTodoId(todoId)) return null;
  const studentId = todoId.slice(TODO_ALERT_RECHARGE_PREFIX.length);
  return studentId || null;
}

export interface RechargeAssigneeStaff {
  id: string;
  /** 教务身份：principal 视为校长 */
  identity?: string | null;
  /** 机构角色：admin=管理员，principal=校长 */
  orgRole?: string | null;
  campusIds?: string[];
}

/**
 * 系统默认参与人：校长 + 管理员 + 学员负责老师（同校区优先）。
 * 手动覆盖不走本函数（见 todo-assignee-override）。
 */
export function resolveDefaultRechargeAssigneeIds(input: {
  responsibleTeacherId?: string | null;
  staff: RechargeAssigneeStaff[];
  campusId?: string;
}): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();

  const push = (id?: string | null) => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    ids.push(id);
  };

  if (input.responsibleTeacherId) push(input.responsibleTeacherId);

  for (const staff of input.staff) {
    if (
      input.campusId &&
      staff.campusIds &&
      staff.campusIds.length > 0 &&
      !staff.campusIds.includes(input.campusId)
    ) {
      continue;
    }
    const isPrincipal = staff.orgRole === 'principal' || staff.identity === 'principal';
    const isAdmin = staff.orgRole === 'admin';
    if (isPrincipal || isAdmin) push(staff.id);
  }

  return ids;
}
