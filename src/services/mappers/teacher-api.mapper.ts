import type {
  Deduction,
  SalaryModel,
  SalarySettings,
  SalaryStatus,
  SalaryTemplate,
  TeacherRole,
  TeacherStatus,
  TeacherUIModel,
} from '@/types/teacher';
import { normalizeSalaryStatus } from '@/types/teacher';

type RawRecord = Record<string, unknown>;

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function num(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function mapBackendSalaryModel(raw: RawRecord): SalaryModel {
  return {
    id: String(raw.id ?? ''),
    name: String(raw.name ?? ''),
    type: (raw.type ?? 'standard') as SalaryModel['type'],
    base: num(raw.base),
    rate: num(raw.rate),
    attend: num(raw.attend),
    perf: num(raw.perf),
    isDefault: Boolean(raw.isDefault ?? raw.is_default),
    teacherCount: num(raw.teacherCount ?? raw.teacher_count),
  };
}

export function mapBackendSalarySettings(raw: RawRecord): SalarySettings {
  return {
    payDay: num(raw.payDay ?? raw.pay_day, 10),
    pushDaysBefore: num(raw.pushDaysBefore ?? raw.push_days_before, 3),
    autoConfirm: Boolean(raw.autoConfirm ?? raw.auto_confirm),
    pushEnabled: Boolean(raw.pushEnabled ?? raw.push_enabled ?? true),
  };
}

export function mapBackendDeduction(raw: RawRecord): Deduction {
  return {
    id: String(raw.id ?? ''),
    reason: String(raw.reason ?? ''),
    amount: num(raw.amount),
    type: (raw.type ?? 'deduct') as Deduction['type'],
  };
}

export function mapBackendTeacherToUI(raw: RawRecord, modelIdx = 0): TeacherUIModel {
  const name = String(raw.name ?? '未命名');
  const salaryModel = raw.salaryModel as RawRecord | null | undefined;
  const deductions = Array.isArray(raw.deductions)
    ? raw.deductions.map((item) => mapBackendDeduction(item as RawRecord))
    : [];

  const latestPay = Array.isArray(raw.payHistory)
    ? (raw.payHistory[0] as RawRecord | undefined)
    : undefined;

  return {
    id: String(raw.id ?? ''),
    name,
    avatar: str(raw.avatar) ?? undefined,
    identity: 'teacher',
    role: (raw.role ?? 'lead') as TeacherRole,
    roleText: String(raw.roleText ?? raw.role ?? ''),
    accessScope: 'self',
    accessScopeText: '本人',
    subject: String(raw.subject ?? ''),
    phone: String(raw.phone ?? ''),
    hours: num(raw.hours),
    students: num(raw.students),
    classes: num(raw.classes),
    base: num(salaryModel?.base),
    rate: num(salaryModel?.rate),
    attend: num(salaryModel?.attend),
    perf: num(salaryModel?.perf),
    salaryStatus: normalizeSalaryStatus(String(latestPay?.status ?? raw.salaryStatus ?? 'pending')),
    modelIdx,
    color: String(raw.color ?? '#3B6EF5'),
    initial: name.slice(0, 1),
    deductions,
    payRemark: str(raw.payRemark ?? raw.pay_remark),
    status: (raw.status ?? 'active') as TeacherStatus,
    campusIds: [],
    resignType: raw.resignType as TeacherUIModel['resignType'],
    resignDate: str(raw.resignDate ?? raw.resign_date),
    resignReason: str(raw.resignReason ?? raw.resign_reason),
    paidAt: str(latestPay?.paidAt ?? latestPay?.paid_at),
    serialNo: str(latestPay?.serialNo ?? latestPay?.serial_no),
  };
}

export function mapBackendSalaryTemplate(raw: RawRecord): SalaryTemplate {
  const rules = (raw.rules ?? raw.config ?? {}) as SalaryTemplate['config'];
  return {
    id: String(raw.id ?? ''),
    name: String(raw.name ?? ''),
    summary: str(raw.summary),
    isDefault: Boolean(raw.isDefault ?? raw.is_default),
    teacherCount: num(raw.teacherCount ?? raw.teacher_count),
    config: rules,
    createdAt: String(raw.createdAt ?? raw.created_at ?? ''),
    updatedAt: String(raw.updatedAt ?? raw.updated_at ?? ''),
  };
}

export function mapUiTeacherToCreatePayload(teacher: TeacherUIModel) {
  return {
    name: teacher.name,
    phone: teacher.phone,
    role: teacher.role,
    subject: teacher.subject || undefined,
    institution: teacher.campus || undefined,
    color: teacher.color || undefined,
  };
}

export function mapUiTeacherToUpdatePayload(updates: Partial<TeacherUIModel>) {
  return {
    name: updates.name,
    role: updates.role,
    subject: updates.subject,
    institution: updates.campus,
    color: updates.color,
    payRemark: updates.payRemark,
  };
}

export function salaryStatusFromBackend(value: unknown): SalaryStatus {
  return normalizeSalaryStatus(String(value ?? 'pending'));
}
