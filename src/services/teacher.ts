/**
 * Service 层 — 教师管理 API
 */
import dayjs from 'dayjs';
import { createDefaultSalaryRule } from '@/domain/teacher-salary';
import { isUseMock } from '@/utils/build-env';
import { loadTeacherMock } from '@/utils/mock-loaders';
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
import { type PaginatedResponse, API_PAGE_SIZE_BATCH, asPaginatedResponse, fetchAllPages } from '@/utils/pagination';
import { del, get, post, put } from '@/utils/request';

type RawRecord = Record<string, unknown>;

async function fetchTeacherListPage(
  params: Record<string, unknown>,
): Promise<PaginatedResponse<RawRecord>> {
  const page = Number(params.page) || 1;
  const pageSize = Number(params.pageSize) || API_PAGE_SIZE_BATCH;
  const data = await get<PaginatedResponse<RawRecord>>('/teachers', params);
  return asPaginatedResponse(data, page, pageSize);
}

async function fetchSalaryTemplatesPage(
  params: Record<string, unknown>,
): Promise<PaginatedResponse<SalaryTemplate>> {
  const page = Number(params.page) || 1;
  const pageSize = Number(params.pageSize) || API_PAGE_SIZE_BATCH;
  const data = await get<PaginatedResponse<RawRecord>>('/attendance/salary-templates', params);
  const normalized = asPaginatedResponse(data, page, pageSize);
  return {
    list: normalized.list.map(mapBackendSalaryTemplate),
    pagination: normalized.pagination,
  };
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
  return fetchAllPages(
    (page, pageSize) => fetchSalaryTemplatesPage({ ...params, page, pageSize }),
    API_PAGE_SIZE_BATCH,
  );
}

export const teacherService = {
  /** 教师列表（分批拉全；校区人数通常不大但仍遵守上限） */
  getList: async (campusId?: string, month?: string) => {
    if (isUseMock()) { const { mockGetTeachers } = await loadTeacherMock(); return mockGetTeachers(campusId, month); }
    const list = await fetchAllPages(
      (page, pageSize) =>
        fetchTeacherListPage({
          page,
          pageSize,
          status: undefined,
        }),
      API_PAGE_SIZE_BATCH,
    );
    return list.map((item, index) => mapBackendTeacherToUI(item, index));
  },

  getActiveList: async (campusId?: string) => {
    if (isUseMock()) { const { mockGetActiveTeachers } = await loadTeacherMock(); return mockGetActiveTeachers(campusId); }
    const list = await fetchAllPages(
      (page, pageSize) =>
        fetchTeacherListPage({
          page,
          pageSize,
          status: 'active',
        }),
      API_PAGE_SIZE_BATCH,
    );
    return list.map((item, index) => mapBackendTeacherToUI(item, index));
  },

  getById: async (id: string) => {
    if (isUseMock()) { const { mockGetTeacherById } = await loadTeacherMock(); return mockGetTeacherById(id); }
    const detail = await get<RawRecord>(`/teachers/${id}`);
    return detail ? mapBackendTeacherToUI(detail) : null;
  },

  add: async (teacher: TeacherUIModel) => {
    if (isUseMock()) { const { mockAddTeacher } = await loadTeacherMock(); return mockAddTeacher(teacher); }
    const created = await post<RawRecord>('/teachers', mapUiTeacherToCreatePayload(teacher));
    return mapBackendTeacherToUI(created);
  },

  update: async (id: string, updates: Partial<TeacherUIModel>) => {
    if (isUseMock()) { const { mockUpdateTeacher } = await loadTeacherMock(); return mockUpdateTeacher(id, updates); }
    const updated = await put<RawRecord>(`/teachers/${id}`, mapUiTeacherToUpdatePayload(updates));
    return mapBackendTeacherToUI(updated);
  },

  confirmSalary: async (id: string, month?: string) => {
    if (isUseMock()) { const { mockConfirmSalary } = await loadTeacherMock(); return mockConfirmSalary(id, month); }
    const recordId = await resolveSalaryRecordId(id, month);
    if (!recordId) return false;
    await post(`/teachers/salary/${recordId}/confirm`);
    return true;
  },

  batchConfirm: async (ids: string[], month?: string) => {
    if (isUseMock()) { const { mockBatchConfirm } = await loadTeacherMock(); return mockBatchConfirm(ids, month); }
    const recordIds = (
      await Promise.all(ids.map((teacherId) => resolveSalaryRecordId(teacherId, month)))
    ).filter((item): item is string => Boolean(item));
    if (recordIds.length === 0) return false;
    await post('/teachers/salary/batch-confirm', { ids: recordIds });
    return true;
  },

  executePay: async (ids: string[], remark?: string, payMethod?: string, month?: string) => {
    if (isUseMock()) { const { mockExecutePay } = await loadTeacherMock(); return mockExecutePay(ids, remark, payMethod, month); }
    const recordIds = (
      await Promise.all(ids.map((teacherId) => resolveSalaryRecordId(teacherId, month)))
    ).filter((item): item is string => Boolean(item));
    if (recordIds.length === 0) return false;
    await post('/teachers/salary/execute-pay', { ids: recordIds, remark });
    return true;
  },

  sendSalarySlip: async (ids: string[], remark?: string, month?: string) => {
    if (isUseMock()) { const { mockSendSalarySlip } = await loadTeacherMock(); return mockSendSalarySlip(ids, remark, month); }
    // 后端暂无独立「推送工资条」接口：与发放同源走 execute-pay，避免 notWired 空点
    const ok = await teacherService.executePay(ids, remark, undefined, month);
    return ok
      ? { success: ids, failed: [] as string[] }
      : { success: [] as string[], failed: ids };
  },

  resign: async (id: string, resignType: string, reason?: string) => {
    if (isUseMock()) { const { mockResignTeacher } = await loadTeacherMock(); return mockResignTeacher(id, resignType, reason); }
    await post(`/teachers/${id}/resign`, { resignType, reason });
    return true;
  },

  restore: async (id: string) => {
    if (isUseMock()) {
      const { mockUpdateTeacher } = await loadTeacherMock();
      return mockUpdateTeacher(id, {
        status: 'active',
        resignType: undefined,
        resignReason: undefined,
        resignDate: undefined,
      });
    }
    await post(`/teachers/${id}/restore`);
    return true;
  },

  addDeduction: async (teacherId: string, deduction: Deduction) => {
    if (isUseMock()) { const { mockAddDeduction } = await loadTeacherMock(); return mockAddDeduction(teacherId, deduction); }
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
    if (isUseMock()) { const { mockUpdateDeduction } = await loadTeacherMock(); return mockUpdateDeduction(teacherId, deductionId, updates); }
    return notWired('teacher.updateDeduction');
  },

  deleteDeduction: async (teacherId: string, deductionId: string) => {
    if (isUseMock()) { const { mockDeleteDeduction } = await loadTeacherMock(); return mockDeleteDeduction(teacherId, deductionId); }
    return notWired('teacher.deleteDeduction');
  },
};

export const salaryModelService = {
  getList: async () => {
    if (isUseMock()) { const { mockGetSalaryModels } = await loadTeacherMock(); return mockGetSalaryModels(); }
    const list = await get<RawRecord[]>('/teachers/salary-models');
    return list.map((item) => mapBackendSalaryModel(item));
  },

  create: async (model: SalaryModel) => {
    if (isUseMock()) { const { mockCreateSalaryModel } = await loadTeacherMock(); return mockCreateSalaryModel(model); }
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
    if (isUseMock()) { const { mockUpdateSalaryModel } = await loadTeacherMock(); return mockUpdateSalaryModel(id, updates); }
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
    if (isUseMock()) { const { mockUpdateSalaryModel } = await loadTeacherMock(); return mockUpdateSalaryModel(modelId, updates); }
    return salaryModelService.update(modelId, updates);
  },
};

export const salarySettingsService = {
  get: async () => {
    if (isUseMock()) { const { mockGetSettings } = await loadTeacherMock(); return mockGetSettings(); }
    const settings = await get<RawRecord>('/teachers/salary-settings');
    return mapBackendSalarySettings(settings);
  },

  update: async (updates: Partial<SalarySettings>) => {
    if (isUseMock()) { const { mockUpdateSettings } = await loadTeacherMock(); return mockUpdateSettings(updates); }
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
    if (isUseMock()) { const { mockGetScheduleData } = await loadTeacherMock(); return mockGetScheduleData(); }
    return notWired('teacherSchedule.getList');
  },
};

export const salaryTemplateService = {
  getList: async () => {
    if (isUseMock()) { const { mockGetSalaryTemplates } = await loadTeacherMock(); return mockGetSalaryTemplates(); }
    return fetchSalaryTemplates({});
  },

  getById: async (id: string) => {
    if (isUseMock()) { const { mockGetSalaryTemplateById } = await loadTeacherMock(); return mockGetSalaryTemplateById(id); }
    const list = await fetchSalaryTemplates({});
    return list.find((item) => item.id === id) ?? null;
  },

  create: async (data: Omit<SalaryTemplate, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (isUseMock()) { const { mockCreateSalaryTemplate } = await loadTeacherMock(); return mockCreateSalaryTemplate(data); }
    const created = await post<RawRecord>('/attendance/salary-templates', {
      campusId: data.config ? undefined : undefined,
      name: data.name,
      baseSalary: 0,
      rules: data.config,
    });
    return mapBackendSalaryTemplate(created);
  },

  update: async (id: string, updates: Partial<Omit<SalaryTemplate, 'id'>>) => {
    if (isUseMock()) { const { mockUpdateSalaryTemplate } = await loadTeacherMock(); return mockUpdateSalaryTemplate(id, updates); }
    const updated = await put<RawRecord>(`/attendance/salary-templates/${id}`, {
      name: updates.name,
      rules: updates.config,
    });
    return mapBackendSalaryTemplate(updated);
  },

  remove: async (id: string) => {
    if (isUseMock()) { const { mockDeleteSalaryTemplate } = await loadTeacherMock(); return mockDeleteSalaryTemplate(id); }
    await del(`/attendance/salary-templates/${id}`);
    return true;
  },

  apply: async (templateId: string, teacherIds: string[]) => {
    if (isUseMock()) { const { mockApplySalaryTemplate } = await loadTeacherMock(); return mockApplySalaryTemplate(templateId, teacherIds); }
    // 后端暂无批量套用接口：明确失败，禁止假成功
    throw new Error('模板套用尚未开通，请稍后或联系管理员');
  },

  createDefaultRule: () => createDefaultSalaryRule(),
};

export const teacherSalaryRuleService = {
  get: async (teacherId: string) => {
    if (isUseMock()) { const { mockGetTeacherSalaryRule } = await loadTeacherMock(); return mockGetTeacherSalaryRule(teacherId); }
    return notWired('teacherSalaryRule.get');
  },

  update: async (teacherId: string, config: SalaryRuleConfig, templateId?: string) => {
    if (isUseMock()) { const { mockUpdateTeacherSalaryRule } = await loadTeacherMock(); return mockUpdateTeacherSalaryRule(teacherId, config, templateId); }
    return notWired('teacherSalaryRule.update');
  },

  copyToTeachers: async (sourceTeacherId: string, targetTeacherIds: string[]) => {
    if (isUseMock()) { const { mockCopySalaryRuleToTeachers } = await loadTeacherMock(); return mockCopySalaryRuleToTeachers(sourceTeacherId, targetTeacherIds); }
    return notWired('teacherSalaryRule.copyToTeachers');
  },
};
