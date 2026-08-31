/**
 * Service 层 — 教师管理 API
 */
import dayjs from 'dayjs';
import { createDefaultSalaryRule } from '@/domain/teacher-salary';
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
  SendFailure,
  SendResult,
  TeacherUIModel,
} from '@/types/teacher';
import { notWired } from '@/utils/not-wired';
import {
  type PaginatedResponse,
  API_PAGE_SIZE_BATCH,
  asPaginatedResponse,
  fetchAllPages,
} from '@/utils/pagination';
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
  getList: async (_campusId?: string, _month?: string) => {
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

  getActiveList: async (_campusId?: string) => {
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

  /** 当前登录教师（GET /teachers/me） */
  getMe: async (): Promise<TeacherUIModel | null> => {
    const detail = await get<RawRecord>('/teachers/me');
    return detail ? mapBackendTeacherToUI(detail) : null;
  },

  getById: async (id: string) => {
    const detail = await get<RawRecord>(`/teachers/${id}`);
    return detail ? mapBackendTeacherToUI(detail) : null;
  },

  add: async (teacher: TeacherUIModel) => {
    const created = await post<RawRecord>('/teachers', mapUiTeacherToCreatePayload(teacher));
    return mapBackendTeacherToUI(created);
  },

  update: async (id: string, updates: Partial<TeacherUIModel>) => {
    const updated = await put<RawRecord>(`/teachers/${id}`, mapUiTeacherToUpdatePayload(updates));
    return mapBackendTeacherToUI(updated);
  },

  confirmSalary: async (id: string, month?: string) => {
    const recordId = await resolveSalaryRecordId(id, month);
    if (!recordId) return false;
    await post(`/teachers/salary/${recordId}/confirm`);
    return true;
  },

  batchConfirm: async (ids: string[], month?: string) => {
    const recordIds = (
      await Promise.all(ids.map((teacherId) => resolveSalaryRecordId(teacherId, month)))
    ).filter((item): item is string => Boolean(item));
    if (recordIds.length === 0) return false;
    await post('/teachers/salary/batch-confirm', { ids: recordIds });
    return true;
  },

  executePay: async (ids: string[], remark?: string, _payMethod?: string, month?: string) => {
    const recordIds = (
      await Promise.all(ids.map((teacherId) => resolveSalaryRecordId(teacherId, month)))
    ).filter((item): item is string => Boolean(item));
    if (recordIds.length === 0) return false;
    await post('/teachers/salary/execute-pay', { ids: recordIds, remark });
    return true;
  },

  sendSalarySlip: async (ids: string[], remark?: string, month?: string): Promise<SendResult> => {
    // 后端暂无独立「推送工资条」接口：与发放同源走 execute-pay，避免 notWired 空点
    const ok = await teacherService.executePay(ids, remark, undefined, month);
    if (ok) {
      return { success: ids, failed: [] };
    }
    const failed: SendFailure[] = ids.map((id) => ({
      id,
      name: id,
      reason: '发放失败',
    }));
    return { success: [], failed };
  },

  resign: async (id: string, resignType: string, reason?: string) => {
    await post(`/teachers/${id}/resign`, { resignType, reason });
    return true;
  },

  restore: async (id: string) => {
    await post(`/teachers/${id}/restore`);
    return true;
  },

  addDeduction: async (teacherId: string, deduction: Deduction & { month?: string }) => {
    const created = await post<RawRecord>(`/teachers/${teacherId}/deductions`, {
      reason: deduction.reason,
      amount: deduction.amount,
      type: deduction.type,
      ...(deduction.month ? { month: deduction.month } : {}),
    });
    return mapBackendDeduction(created);
  },

  updateDeduction: async (
    _teacherId: string,
    _deductionId: string,
    _updates: Partial<Pick<Deduction, 'reason' | 'amount' | 'type'>>,
  ) => {
    // 产品：落库后不可改；草稿仅在提交前本地编辑
    throw new Error('已落库的扣款不可修改');
  },

  deleteDeduction: async (_teacherId: string, _deductionId: string) => {
    throw new Error('已落库的扣款不可删除');
  },
};

export const salaryModelService = {
  getList: async () => {
    const list = await get<RawRecord[]>('/teachers/salary-models');
    return list.map((item) => mapBackendSalaryModel(item));
  },

  create: async (model: SalaryModel) => {
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
    return salaryModelService.update(modelId, updates);
  },
};

export const salarySettingsService = {
  get: async () => {
    const settings = await get<RawRecord>('/teachers/salary-settings');
    return mapBackendSalarySettings(settings);
  },

  update: async (updates: Partial<SalarySettings>) => {
    const updated = await put<RawRecord>('/teachers/salary-settings', {
      payDay: updates.payDay,
      pushDaysBefore: updates.pushDaysBefore,
      autoConfirm: updates.autoConfirm,
      pushEnabled: updates.pushEnabled,
    });
    return mapBackendSalarySettings(updated);
  },
};

export const salaryTemplateService = {
  getList: async () => {
    return fetchSalaryTemplates({});
  },

  getById: async (id: string) => {
    const list = await fetchSalaryTemplates({});
    return list.find((item) => item.id === id) ?? null;
  },

  create: async (data: Omit<SalaryTemplate, 'id' | 'createdAt' | 'updatedAt'>) => {
    const created = await post<RawRecord>('/attendance/salary-templates', {
      campusId: data.config ? undefined : undefined,
      name: data.name,
      baseSalary: 0,
      rules: data.config,
    });
    return mapBackendSalaryTemplate(created);
  },

  update: async (id: string, updates: Partial<Omit<SalaryTemplate, 'id'>>) => {
    const updated = await put<RawRecord>(`/attendance/salary-templates/${id}`, {
      name: updates.name,
      rules: updates.config,
    });
    return mapBackendSalaryTemplate(updated);
  },

  remove: async (id: string) => {
    await del(`/attendance/salary-templates/${id}`);
    return true;
  },

  apply: async (templateId: string, teacherIds: string[]): Promise<{ success: boolean }> => {
    await post(`/attendance/salary-templates/${encodeURIComponent(templateId)}/apply`, {
      teacherIds,
    });
    return { success: true };
  },

  createDefaultRule: () => createDefaultSalaryRule(),
};

export const teacherSalaryRuleService = {
  get: async (_teacherId: string) => {
    return notWired('teacherSalaryRule.get');
  },

  update: async (_teacherId: string, _config: SalaryRuleConfig, _templateId?: string) => {
    return notWired('teacherSalaryRule.update');
  },

  copyToTeachers: async (
    _sourceTeacherId: string,
    targetTeacherIds: string[],
  ): Promise<{
    success: boolean;
    copiedIds: string[];
    failedIds: string[];
    message?: string;
  }> => {
    return {
      success: false,
      copiedIds: [],
      failedIds: targetTeacherIds,
      message: '复制薪资规则尚未开通',
    };
  },
};
