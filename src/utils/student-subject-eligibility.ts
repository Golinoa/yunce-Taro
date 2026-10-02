/**
 * 「这个学员能不能进这个班（这个科目）」——前端唯一的判定口径。
 *
 * ## 为什么要单独一个文件
 *
 * 判定要同时服务四个入口（班级编辑 / 排课选人 / 补录名单 / 点名加人）。
 * 之前判定散在弹窗组件里，且依赖"学员卡包"这种**没有科目维度**的假数据
 * ⇒ 过滤恒放行、课时显示的是跨科目总数。现在只在这里判一次，四个入口共用。
 *
 * ## 口径（写死在这里）
 *
 * | 情况 | 判定 | 界面表现 |
 * | --- | --- | --- |
 * | `subject_hours` 缺失（`undefined`） | **不拦**（数据缺失不能把人挡在门外） | 正常可勾，行内不显示科目课时 |
 * | 有该科目且剩余 > 0 | 通过 | 显示"钢琴 12 课时" |
 * | 有该科目但剩余 = 0 | **硬拦**（点名必然失败） | 灰显 + "钢琴剩 0 课时" |
 * | 没有该科目 | 默认**软提醒**（可勾，确认前提示）；`strictMode` 下变硬拦 | "没有钢琴的课时" |
 */

import type { Student } from '@/types/student';

/** 目标科目（id 与名称二选一命中即可：老数据可能把中文名写进 id 列） */
export interface SubjectTarget {
  id?: string;
  name?: string;
}

export type IneligibleReason = 'exhausted' | 'no-subject';

export interface StudentEligibility {
  /** 可以直接加入（无需任何提醒） */
  ok: boolean;
  /** true = 不允许勾选（硬拦） */
  blocking: boolean;
  reason?: IneligibleReason;
  /** 给界面直接用的中文说明 */
  label?: string;
  /** 该科目剩余；`null` = 接口没给数据，无从判断 */
  remaining: number | null;
  /** 数据缺失（字段没返回）⇒ 调用方可以按需打点 */
  dataMissing: boolean;
}

const normalize = (value?: string) => (value ?? '').replace(/\s/g, '').trim();

/** 找到学员在该科目上的剩余条目（id 命中优先，再按名称兜底） */
export function findSubjectHours(student: Student, target: SubjectTarget) {
  const list = student.subject_hours;
  if (!list) return undefined;
  const id = normalize(target.id);
  const name = normalize(target.name);
  if (!id && !name) return undefined;

  return (
    (id ? list.find((item) => normalize(item.subjectId) === id) : undefined) ??
    (name ? list.find((item) => normalize(item.subjectName) === name) : undefined)
  );
}

/** 该科目剩余课时；`null` = 数据缺失（不是 0，别混淆） */
export function getSubjectRemaining(student: Student, target: SubjectTarget): number | null {
  if (!student.subject_hours) return null;
  const hit = findSubjectHours(student, target);
  return hit ? hit.remaining : 0;
}

/** 该科目有没有可用课时（数据缺失时返回 false —— 调用方要自己看 dataMissing） */
export function hasSubjectHours(student: Student, target: SubjectTarget): boolean {
  return (getSubjectRemaining(student, target) ?? 0) > 0;
}

export interface EvaluateOptions {
  /** true = 「没有该科目」也从软提醒升级为硬拦 */
  strictMode?: boolean;
  /** 科目名称（用于拼提示文案，缺省用目标科目的 name） */
  subjectLabel?: string;
}

export function evaluateStudent(
  student: Student,
  target: SubjectTarget,
  options: EvaluateOptions = {},
): StudentEligibility {
  const label = options.subjectLabel || target.name || '该科目';

  // 1) 数据缺失 ⇒ 不拦（宁可放过，也不能因为接口没给字段把人全挡住）
  if (!student.subject_hours) {
    return { ok: true, blocking: false, remaining: null, dataMissing: true };
  }

  const hit = findSubjectHours(student, target);
  // 2) 没有这个科目
  if (!hit) {
    return {
      ok: false,
      blocking: Boolean(options.strictMode),
      reason: 'no-subject',
      label: `没有${label}的课时`,
      remaining: 0,
      dataMissing: false,
    };
  }
  // 3) 有卡但上完了
  if (hit.remaining <= 0) {
    return {
      ok: false,
      blocking: true,
      reason: 'exhausted',
      label: `${label}剩 0 课时`,
      remaining: 0,
      dataMissing: false,
    };
  }
  // 4) 正常
  return {
    ok: true,
    blocking: false,
    remaining: hit.remaining,
    dataMissing: false,
  };
}

export interface EligibilityGroups {
  /** 可以直接加入 */
  ready: Student[];
  /** 硬拦（剩 0 / strictMode 下无该科目） */
  blocked: { student: Student; label: string }[];
  /** 软提醒（默认：没有该科目，可勾但确认前要提示） */
  warned: { student: Student; label: string }[];
}

/** 一次把一批学员分好组（确认按钮前用） */
export function partitionStudents(
  students: Student[],
  target: SubjectTarget,
  options: EvaluateOptions = {},
): EligibilityGroups {
  const groups: EligibilityGroups = { ready: [], blocked: [], warned: [] };
  for (const student of students) {
    const result = evaluateStudent(student, target, options);
    if (result.ok) {
      groups.ready.push(student);
    } else if (result.blocking) {
      groups.blocked.push({ student, label: result.label ?? '不可加入' });
    } else {
      groups.warned.push({ student, label: result.label ?? '需确认' });
    }
  }
  return groups;
}
