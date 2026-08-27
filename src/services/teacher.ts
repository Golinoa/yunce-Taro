/**
 * Service 层 — 教师管理 API
 */
import dayjs from 'dayjs';
import {
  mockGetTeachers,
  mockGetActiveTeachers,
  mockGetTeacherById,
  mockAddTeacher,
  mockUpdateTeacher,
  mockConfirmSalary,
  mockBatchConfirm,
  mockExecutePay,
  mockSendSalarySlip,
  mockResignTeacher,
  mockAddDeduction,
  mockUpdateDeduction,
  mockDeleteDeduction,
  mockGetSalaryModels,
  mockCreateSalaryModel,
  mockUpdateSalaryModel,
  mockGetSettings,
  mockUpdateSettings,
  mockGetScheduleData,
  mockGetSalaryTemplates,
  mockGetSalaryTemplateById,
  mockCreateSalaryTemplate,
  mockUpdateSalaryTemplate,
  mockDeleteSalaryTemplate,
  mockApplySalaryTemplate,
  mockGetTeacherSalaryRule,
  mockUpdateTeacherSalaryRule,
  mockCopySalaryRuleToTeachers,
  createDefaultSalaryRule,
} from '@/data/teacher';
import {
  mapBackendDeduction,
  mapBackendSalaryModel,
  mapBackendSalarySettings,
  mapBackendSalaryTemplate,
  mapBackendTeacherToUI,
  mapUiTeacherToCreatePayload,
  mapUiTeacherToUpdatePayload,
} from '@/services/mappers/teacher-api.mapper';
import type {
  Deduction,
  SalaryModel,
  SalaryRuleConfig,
  SalarySettings,
  SalaryTemplate,
  TeacherUIModel,
} from '@/types/teacher';
import { notWired } from '@/utils/not-wired';
import { type PaginatedResponse, unwrapPaginatedList } from '@/utils/pagination';
import { del, get, post, put } from '@/utils/request';

const USE_MOCK =
  typeof process !== 'undefined' && typeof process.env !== 'undefined'
    ? process.env.VITE_USE_MOCK !== 'false'
    : true;

type RawRecord = Record<string, unknown>;

async function fetchTeacherList(params: Record<string, unknown>) {
  const data = await get<PaginatedResponse<RawRecord>>('/teachers', params);
  return unwrapPaginatedList(data);
}

function currentSalaryMonth(month?: string): string {
  return month || dayjs().format('YYYY-MM');
}

async function resolveSalaryRecordId(teacherId: string, month?: string): Promise<string | null> {
  const detail = await get<RawRecord>(`/teachers/${teacherId}`);
  const monthKey = currentSalaryMonth(month);
  const history = Array.isArray(detail.payHistory) ? detail.payHistory : [];
  const matched = history.find((item) => String((item as RawRecord).month ?? '') === monthKey) as
    | RawRecord
    | undefined;
  return matched?.id ? String(matched.id) : null;
}

async function fetchSalaryTemplates(params: Record<string, unknown>) {
  const data = await get<PaginatedResponse<RawRecord>>('/attendance/salary-templates', params);
  return unwrapPaginatedList(data).map(mapBackendSalaryTemplate);
}

export const teacherService = {
  getList: async (campusId?: string, month?: string) => {
    if (USE_MOCK) return mockGetTeachers(campusId, month);
    const list = await fetchTeacherList({
      page: 1,
      pageSize: 100,
      status: undefined,
    });
    return list.map((item, index) => mapBackendTeacherToUI(item, index));
  },

  getActiveList: async (campusId?: string) => {
    if (USE_MOCK) return mockGetActiveTeachers(campusId);
    const list = await fetchTeacherList({
      page: 1,
      pageSize: 100,
      status: 'active',
    });
    return list.map((item, index) => mapBackendTeacherToUI(item, index));
  },

  getById: async (id: string) => {
    if (USE_MOCK) return mockGetTeacherById(id);
    const detail = await get<RawRecord>(`/teachers/${id}`);
    return detail ? mapBackendTeacherToUI(detail) : null;
  },

  add: async (teacher: TeacherUIModel) => {
    if (USE_MOCK) return mockAddTeacher(teacher);
    const created = await post<RawRecord>('/teachers', mapUiTeacherToCreatePayload(teacher));
    return mapBackendTeacherToUI(created);
  },

  update: async (id: string, updates: Partial<TeacherUIModel>) => {
    if (USE_MOCK) return mockUpdateTeacher(id, updates);
    const updated = await put<RawRecord>(`/teachers/${id}`, mapUiTeacherToUpdatePayload(updates));
    return mapBackendTeacherToUI(updated);
  },

  confirmSalary: async (id: string, month?: string) => {
    if (USE_MOCK) return mockConfirmSalary(id, month);
    const recordId = await resolveSalaryRecordId(id, month);
    if (!recordId) return false;
    await post(`/teachers/salary/${recordId}/confirm`);
    return true;
  },

  batchConfirm: async (ids: string[], month?: string) => {
    if (USE_MOCK) return mockBatchConfirm(ids, month);
    const recordIds = (
      await Promise.all(ids.map((teacherId) => resolveSalaryRecordId(teacherId, month)))
    ).filter((item): item is string => Boolean(item));
    if (recordIds.length === 0) return false;
    await post('/teachers/salary/batch-confirm', { ids: recordIds });
    return true;
  },

  executePay: async (ids: string[], remark?: string, payMethod?: string, month?: string) => {
    if (USE_MOCK) return mockExecutePay(ids, remark, payMethod, month);
    const recordIds = (
      await Promise.all(ids.map((teacherId) => resolveSalaryRecordId(teacherId, month)))
    ).filter((item): item is string => Boolean(item));
    if (recordIds.length === 0) return false;
    await post('/teachers/salary/execute-pay', { ids: recordIds, remark });
    return true;
  },

  sendSalarySlip: async (ids: string[], remark?: string, month?: string) => {
    if (USE_MOCK) return mockSendSalarySlip(ids, remark, month);
    return notWired('teacher.sendSalarySlip');
  },

  resign: async (id: string, resignType: string, reason?: string) => {
    if (USE_MOCK) return mockResignTeacher(id, resignType, reason);
    await post(`/teachers/${id}/resign`, { resignType, reason });
    return true;
  },

  addDeduction: async (teacherId: string, deduction: Deduction) => {
    if (USE_MOCK) return mockAddDeduction(teacherId, deduction);
    const created = await post<RawRecord>(`/teachers/${teacherId}/deductions`, {
      reason: deduction.reason,
      amount: deduction.amount,
      type: deduction.type,
    });
    return mapBackendDeduction(created);
  },

  updateDeduction: async (
    teacherId: string,
    deductionId: string,
    updates: Partial<Pick<Deduction, 'reason' | 'amount' | 'type'>>,
  ) => {
    if (USE_MOCK) return mockUpdateDeduction(teacherId, deductionId, updates);
    return notWired('teacher.updateDeduction');
  },

  deleteDeduction: async (teacherId: string, deductionId: string) => {
    if (USE_MOCK) return mockDeleteDeduction(teacherId, deductionId);
    return notWired('teacher.deleteDeduction');
  },
};

export const salaryModelService = {
  getList: async () => {
    if (USE_MOCK) return mockGetSalaryModels();
    const list = await get<RawRecord[]>('/teachers/salary-models');
    return list.map((item) => mapBackendSalaryModel(item));
  },

  create: async (model: SalaryModel) => {
    if (USE_MOCK) return mockCreateSalaryModel(model);
    const created = await post<RawRecord>('/teachers/salary-models', {
      name: model.name,
      type: model.type,
      base: model.base,
      rate: model.rate,
      attend: model.attend,
      perf: model.perf,
      isDefault: model.isDefault,
    });
    return mapBackendSalaryModel(created);
  },

  update: async (id: string, updates: Partial<SalaryModel>) => {
    if (USE_MOCK) return mockUpdateSalaryModel(id, updates);
    const updated = await put<RawRecord>(`/teachers/salary-models/${id}`, {
      name: updates.name,
      type: updates.type,
      base: updates.base,
      rate: updates.rate,
      attend: updates.attend,
      perf: updates.perf,
      isDefault: updates.isDefault,
    });
    return mapBackendSalaryModel(updated);
  },

  switchModel: async (modelId: string, updates: Partial<SalaryModel>) => {
    if (USE_MOCK) return mockUpdateSalaryModel(modelId, updates);
    return salaryModelService.update(modelId, updates);
  },
};

export const salarySettingsService = {
  get: async () => {
    if (USE_MOCK) return mockGetSettings();
    const settings = await get<RawRecord>('/teachers/salary-settings');
    return mapBackendSalarySettings(settings);
  },

  update: async (updates: Partial<SalarySettings>) => {
    if (USE_MOCK) return mockUpdateSettings(updates);
    const updated = await put<RawRecord>('/teachers/salary-settings', {
      payDay: updates.payDay,
      pushDaysBefore: updates.pushDaysBefore,
      autoConfirm: updates.autoConfirm,
      pushEnabled: updates.pushEnabled,
    });
    return mapBackendSalarySettings(updated);
  },
};

export const teacherScheduleService = {
  getList: async () => {
    if (USE_MOCK) return mockGetScheduleData();
    return notWired('teacherSchedule.getList');
  },
};

export const salaryTemplateService = {
  getList: async () => {
    if (USE_MOCK) return mockGetSalaryTemplates();
    return fetchSalaryTemplates({ page: 1, pageSize: 100 });
  },

  getById: async (id: string) => {
    if (USE_MOCK) return mockGetSalaryTemplateById(id);
    const list = await fetchSalaryTemplates({ page: 1, pageSize: 100 });
    return list.find((item) => item.id === id) ?? null;
  },

  create: async (data: Omit<SalaryTemplate, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (USE_MOCK) return mockCreateSalaryTemplate(data);
    const created = await post<RawRecord>('/attendance/salary-templates', {
      campusId: data.config ? undefined : undefined,
      name: data.name,
      baseSalary: 0,
      rules: data.config,
    });
    return mapBackendSalaryTemplate(created);
  },

  update: async (id: string, updates: Partial<Omit<SalaryTemplate, 'id'>>) => {
    if (USE_MOCK) return mockUpdateSalaryTemplate(id, updates);
    const updated = await put<RawRecord>(`/attendance/salary-templates/${id}`, {
      name: updates.name,
      rules: updates.config,
    });
    return mapBackendSalaryTemplate(updated);
  },

  remove: async (id: string) => {
    if (USE_MOCK) return mockDeleteSalaryTemplate(id);
    await del(`/attendance/salary-templates/${id}`);
    return true;
  },

  apply: async (templateId: string, teacherIds: string[]) => {
    if (USE_MOCK) return mockApplySalaryTemplate(templateId, teacherIds);
    return notWired('salaryTemplate.apply');
  },

  createDefaultRule: () => createDefaultSalaryRule(),
};

export const teacherSalaryRuleService = {
  get: async (teacherId: string) => {
    if (USE_MOCK) return mockGetTeacherSalaryRule(teacherId);
    return notWired('teacherSalaryRule.get');
  },

  update: async (teacherId: string, config: SalaryRuleConfig, templateId?: string) => {
    if (USE_MOCK) return mockUpdateTeacherSalaryRule(teacherId, config, templateId);
    return notWired('teacherSalaryRule.update');
  },

  copyToTeachers: async (sourceTeacherId: string, targetTeacherIds: string[]) => {
    if (USE_MOCK) return mockCopySalaryRuleToTeachers(sourceTeacherId, targetTeacherIds);
    return notWired('teacherSalaryRule.copyToTeachers');
  },
};
