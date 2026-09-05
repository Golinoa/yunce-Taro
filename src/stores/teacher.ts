import dayjs from 'dayjs';
import { create } from 'zustand';
import { calcTotal } from '@/domain/teacher-salary';
import {
  teacherService,
  salaryModelService,
  salarySettingsService,
  salaryTemplateService,
  teacherSalaryRuleService,
} from '@/services/teacher';
import type {
  TeacherUIModel,
  TeacherFilter,
  SalarySettings,
  Deduction,
  PendingPayAction,
  PendingSendAction,
  SendResult,
  SalaryModel,
  SalaryTemplate,
  SalaryRuleConfig,
} from '@/types/teacher';
import { TTL } from '@/utils/data-freshness';
import { logError } from '@/utils/logger';

/** 薪资总额算法（与 mockExecutePay 共用同一实现，消除 B-01 实发≠展示） */
export { calcTotal };

interface TeacherState {
  teachers: TeacherUIModel[];
  salaryModels: SalaryModel[];
  salaryTemplates: SalaryTemplate[];
  filter: TeacherFilter;
  selectedIds: string[];
  settings: SalarySettings;
  pendingPayAction: PendingPayAction | null;
  pendingSendAction: PendingSendAction | null;
  loading: boolean;
  error: string | null;
  /** 当前查看/操作的薪资月份 YYYY-MM */
  salaryMonth: string;
  /** 教师列表按月份的上次拉取时间 */
  lastTeachersFetchAt: Record<string, number>;
  lastMetaFetchAt: number;

  // 数据加载
  fetchTeachers: (month?: string, force?: boolean) => Promise<void>;
  fetchSalaryModels: (force?: boolean) => Promise<void>;
  fetchSalaryTemplates: (force?: boolean) => Promise<void>;
  fetchSettings: (force?: boolean) => Promise<void>;
  fetchAll: (month?: string, force?: boolean) => Promise<void>;
  invalidateCache: () => void;

  // 筛选
  setFilter: (filter: Partial<TeacherFilter>) => void;
  getFilteredTeachers: () => TeacherUIModel[];
  setSalaryMonth: (month: string) => void;

  // 薪资操作
  confirmSalary: (id: string) => Promise<void>;
  batchConfirm: (ids: string[]) => Promise<void>;
  setPendingPayAction: (action: PendingPayAction | null) => void;
  executePay: (remark?: string, payMethod?: string) => Promise<void>;
  setPendingSendAction: (action: PendingSendAction | null) => void;
  executeSend: (remark?: string) => Promise<SendResult>;

  // 选择
  toggleSelect: (id: string) => void;
  toggleSelectAll: () => void;
  clearSelection: () => void;

  // 教师操作
  addTeacher: (teacher: TeacherUIModel) => Promise<void>;
  updateTeacher: (id: string, updates: Partial<TeacherUIModel>) => Promise<void>;
  resignTeacher: (id: string, resignType: string, reason?: string) => Promise<void>;
  restoreTeacher: (id: string) => Promise<void>;
  addDeduction: (teacherId: string, deduction: Deduction) => Promise<void>;
  updateDeduction: (
    teacherId: string,
    deductionId: string,
    updates: Partial<Pick<Deduction, 'reason' | 'amount' | 'type'>>,
  ) => Promise<void>;
  deleteDeduction: (teacherId: string, deductionId: string) => Promise<void>;

  // 设置
  updateSettings: (updates: Partial<SalarySettings>) => Promise<void>;

  // 工资模型
  createSalaryModel: (model: SalaryModel) => Promise<void>;
  updateSalaryModel: (id: string, updates: Partial<SalaryModel>) => Promise<void>;

  // 薪资模板
  createSalaryTemplate: (
    data: Omit<SalaryTemplate, 'id' | 'createdAt' | 'updatedAt'>,
  ) => Promise<void>;
  updateSalaryTemplate: (id: string, updates: Partial<Omit<SalaryTemplate, 'id'>>) => Promise<void>;
  deleteSalaryTemplate: (id: string) => Promise<boolean>;
  applySalaryTemplate: (templateId: string, teacherIds: string[]) => Promise<boolean>;

  // 教师薪资规则
  fetchTeacherSalaryRule: (teacherId: string) => Promise<SalaryRuleConfig | null>;
  updateTeacherSalaryRule: (
    teacherId: string,
    config: SalaryRuleConfig,
    templateId?: string,
  ) => Promise<boolean>;
  copySalaryRuleToTeachers: (
    sourceTeacherId: string,
    targetTeacherIds: string[],
  ) => Promise<{ success: boolean; copiedIds: string[]; failedIds: string[]; message?: string }>;

  // 统计
  getActiveCount: () => number;
  getPendingCount: () => number;
  getTotalHours: () => number;
  getTotalSalary: () => number;
}

export const useTeacherStore = create<TeacherState>((set, get) => ({
  teachers: [],
  salaryModels: [],
  salaryTemplates: [],
  filter: { role: 'all', subject: 'all', status: 'active' },
  selectedIds: [],
  settings: { payDay: 15, pushDaysBefore: 1, autoConfirm: false, pushEnabled: true },
  pendingPayAction: null,
  pendingSendAction: null,
  loading: false,
  error: null,
  salaryMonth: dayjs().format('YYYY-MM'),
  lastTeachersFetchAt: {},
  lastMetaFetchAt: 0,

  // ===== 数据加载 =====
  fetchTeachers: async (month, force = false) => {
    const targetMonth = month ?? get().salaryMonth;
    const { teachers, lastTeachersFetchAt } = get();
    const now = Date.now();
    if (
      !force &&
      teachers.length > 0 &&
      lastTeachersFetchAt[targetMonth] &&
      now - lastTeachersFetchAt[targetMonth] < TTL.list
    ) {
      return;
    }
    const list = await teacherService.getList(undefined, targetMonth);
    set((s) => ({
      teachers: list,
      lastTeachersFetchAt: { ...s.lastTeachersFetchAt, [targetMonth]: now },
    }));
  },

  fetchSalaryModels: async (force = false) => {
    const { salaryModels, lastMetaFetchAt } = get();
    const now = Date.now();
    if (!force && salaryModels.length > 0 && now - lastMetaFetchAt < TTL.list) {
      return;
    }
    const list = await salaryModelService.getList();
    set({ salaryModels: list, lastMetaFetchAt: now });
  },

  fetchSalaryTemplates: async (force = false) => {
    const { salaryTemplates, lastMetaFetchAt } = get();
    const now = Date.now();
    if (!force && salaryTemplates.length > 0 && now - lastMetaFetchAt < TTL.list) {
      return;
    }
    const list = await salaryTemplateService.getList();
    set({ salaryTemplates: list, lastMetaFetchAt: now });
  },

  fetchSettings: async (force = false) => {
    const { lastMetaFetchAt } = get();
    const now = Date.now();
    if (!force && lastMetaFetchAt > 0 && now - lastMetaFetchAt < TTL.list) {
      return;
    }
    const settings = await salarySettingsService.get();
    set({ settings, lastMetaFetchAt: now });
  },

  fetchAll: async (month, force = false) => {
    const targetMonth = month ?? get().salaryMonth;
    const { teachers, lastTeachersFetchAt, lastMetaFetchAt } = get();
    const now = Date.now();
    const teachersFresh =
      !force &&
      teachers.length > 0 &&
      Boolean(lastTeachersFetchAt[targetMonth]) &&
      now - lastTeachersFetchAt[targetMonth] < TTL.list;
    const metaFresh = !force && lastMetaFetchAt > 0 && now - lastMetaFetchAt < TTL.list;
    if (teachersFresh && metaFresh) {
      return;
    }

    set({ loading: true, error: null });
    try {
      const [list, salaryModels, salaryTemplates, settings] = await Promise.all([
        teachersFresh ? Promise.resolve(teachers) : teacherService.getList(undefined, targetMonth),
        metaFresh ? Promise.resolve(get().salaryModels) : salaryModelService.getList(),
        metaFresh ? Promise.resolve(get().salaryTemplates) : salaryTemplateService.getList(),
        metaFresh ? Promise.resolve(get().settings) : salarySettingsService.get(),
      ]);
      set((s) => ({
        teachers: list,
        salaryModels,
        salaryTemplates,
        settings,
        loading: false,
        lastTeachersFetchAt: teachersFresh
          ? s.lastTeachersFetchAt
          : { ...s.lastTeachersFetchAt, [targetMonth]: now },
        lastMetaFetchAt: metaFresh ? s.lastMetaFetchAt : now,
      }));
    } catch (err) {
      logError('teacher fetchAll', err);
      set({ loading: false, error: '教师数据加载失败，请重试' });
    }
  },

  invalidateCache: () => {
    set({ lastTeachersFetchAt: {}, lastMetaFetchAt: 0, teachers: [] });
  },

  setSalaryMonth: (month) => set({ salaryMonth: month }),

  // ===== 筛选 =====
  setFilter: (partial) => set((s) => ({ filter: { ...s.filter, ...partial } })),

  getFilteredTeachers: () => {
    const { teachers, filter } = get();
    return teachers.filter((t) => {
      if (filter.role !== 'all' && t.role !== filter.role) return false;
      if (filter.subject !== 'all') {
        const subjectMap: Record<string, string[]> = {
          piano: ['钢琴'],
          vocal: ['声乐'],
          theory: ['乐理'],
          calligraphy: ['书法'],
          art: ['美术'],
          guitar: ['吉他'],
          dance: ['舞蹈'],
          drum: ['架子鼓'],
          violin: ['小提琴'],
        };
        const matchSubjects = subjectMap[filter.subject] || [];
        if (!matchSubjects.some((s) => t.subject.includes(s))) return false;
      }
      if (filter.status !== 'all' && t.status !== filter.status) return false;
      return true;
    });
  },

  // ===== 薪资操作 =====
  confirmSalary: async (id) => {
    try {
      await teacherService.confirmSalary(id);
      const teachers = await teacherService.getList(undefined, get().salaryMonth);
      set({ teachers });
    } catch (err) {
      logError('teacherStore.confirmSalary', err);
      set({ error: '薪资确认失败，请重试' });
      throw err;
    }
  },

  batchConfirm: async (ids) => {
    try {
      await teacherService.batchConfirm(ids);
      const teachers = await teacherService.getList(undefined, get().salaryMonth);
      set({ teachers, selectedIds: [] });
    } catch (err) {
      logError('teacherStore.batchConfirm', err);
      set({ error: '批量确认失败，请重试' });
      throw err;
    }
  },

  setPendingPayAction: (action) => set({ pendingPayAction: action }),

  executePay: async (remark, payMethod) => {
    const { pendingPayAction } = get();
    if (!pendingPayAction) return;
    const { ids } = pendingPayAction;
    try {
      await teacherService.executePay(ids, remark, payMethod);
      const teachers = await teacherService.getList(undefined, get().salaryMonth);
      set({ teachers, pendingPayAction: null, selectedIds: [] });
    } catch (err) {
      logError('teacherStore.executePay', err);
      set({ error: '薪资发放失败，请重试' });
      throw err;
    }
  },

  setPendingSendAction: (action) => set({ pendingSendAction: action }),

  executeSend: async (remark) => {
    const { pendingSendAction } = get();
    if (!pendingSendAction) return { success: [], failed: [] };
    const { ids } = pendingSendAction;
    try {
      const result = await teacherService.sendSalarySlip(ids, remark);
      const teachers = await teacherService.getList(undefined, get().salaryMonth);
      set({ teachers, pendingSendAction: null });
      return result;
    } catch (err) {
      logError('teacherStore.executeSend', err);
      set({ error: '工资单发送失败，请重试' });
      throw err;
    }
  },

  // ===== 选择 =====
  toggleSelect: (id) =>
    set((s) => ({
      selectedIds: s.selectedIds.includes(id)
        ? s.selectedIds.filter((i) => i !== id)
        : [...s.selectedIds, id],
    })),

  toggleSelectAll: () => {
    const { selectedIds, teachers } = get();
    const selectable = teachers.filter(
      (t) => t.status === 'active' || t.salaryStatus !== 'archived',
    );
    if (selectedIds.length === selectable.length) {
      set({ selectedIds: [] });
    } else {
      set({ selectedIds: selectable.map((t) => t.id) });
    }
  },

  clearSelection: () => set({ selectedIds: [] }),

  // ===== 教师操作 =====
  addTeacher: async (teacher) => {
    try {
      await teacherService.add(teacher);
      const teachers = await teacherService.getList(undefined, get().salaryMonth);
      set({ teachers });
    } catch (err) {
      logError('teacherStore.addTeacher', err);
      set({ error: '新增教师失败，请重试' });
      throw err;
    }
  },

  updateTeacher: async (id, updates) => {
    try {
      await teacherService.update(id, updates);
      const teachers = await teacherService.getList(undefined, get().salaryMonth);
      set({ teachers });
    } catch (err) {
      logError('teacherStore.updateTeacher', err);
      set({ error: '更新教师失败，请重试' });
      throw err;
    }
  },

  resignTeacher: async (id, resignType, reason) => {
    try {
      await teacherService.resign(id, resignType, reason);
      const teachers = await teacherService.getList(undefined, get().salaryMonth);
      set({ teachers });
    } catch (err) {
      logError('teacherStore.resignTeacher', err);
      set({ error: '离职操作失败，请重试' });
      throw err;
    }
  },

  restoreTeacher: async (id) => {
    try {
      await teacherService.restore(id);
      const teachers = await teacherService.getList(undefined, get().salaryMonth);
      set({ teachers });
    } catch (err) {
      logError('teacherStore.restoreTeacher', err);
      set({ error: '恢复在职失败，请重试' });
      throw err;
    }
  },

  addDeduction: async (teacherId, deduction) => {
    try {
      await teacherService.addDeduction(teacherId, deduction);
      const teachers = await teacherService.getList(undefined, get().salaryMonth);
      set({ teachers });
    } catch (err) {
      logError('teacherStore.addDeduction', err);
      set({ error: '添加扣款/补发失败，请重试' });
      throw err;
    }
  },

  updateDeduction: async (teacherId, deductionId, updates) => {
    try {
      await teacherService.updateDeduction(teacherId, deductionId, updates);
      const teachers = await teacherService.getList(undefined, get().salaryMonth);
      set({ teachers });
    } catch (err) {
      logError('teacherStore.updateDeduction', err);
      set({ error: '更新扣款/补发失败，请重试' });
      throw err;
    }
  },

  deleteDeduction: async (teacherId, deductionId) => {
    try {
      await teacherService.deleteDeduction(teacherId, deductionId);
      const teachers = await teacherService.getList(undefined, get().salaryMonth);
      set({ teachers });
    } catch (err) {
      logError('teacherStore.deleteDeduction', err);
      set({ error: '删除扣款/补发失败，请重试' });
      throw err;
    }
  },

  // ===== 设置 =====
  updateSettings: async (updates) => {
    await salarySettingsService.update(updates);
    const settings = await salarySettingsService.get();
    set({ settings });
  },

  // ===== 工资模型 =====
  createSalaryModel: async (model) => {
    await salaryModelService.create(model);
    const salaryModels = await salaryModelService.getList();
    set({ salaryModels });
  },

  updateSalaryModel: async (id, updates) => {
    await salaryModelService.update(id, updates);
    const salaryModels = await salaryModelService.getList();
    set({ salaryModels });
  },

  // ===== 薪资模板 =====
  createSalaryTemplate: async (data) => {
    await salaryTemplateService.create(data);
    const salaryTemplates = await salaryTemplateService.getList();
    set({ salaryTemplates });
  },

  updateSalaryTemplate: async (id, updates) => {
    await salaryTemplateService.update(id, updates);
    const salaryTemplates = await salaryTemplateService.getList();
    set({ salaryTemplates });
  },

  deleteSalaryTemplate: async (id) => {
    const ok = await salaryTemplateService.remove(id);
    if (ok) {
      const salaryTemplates = await salaryTemplateService.getList();
      set({ salaryTemplates });
    }
    return ok;
  },

  applySalaryTemplate: async (templateId, teacherIds) => {
    try {
      const result = await salaryTemplateService.apply(templateId, teacherIds);
      if (result.success) {
        const [teachers, salaryTemplates] = await Promise.all([
          teacherService.getList(undefined, get().salaryMonth),
          salaryTemplateService.getList(),
        ]);
        set({ teachers, salaryTemplates });
      }
      return result.success;
    } catch (err) {
      logError('teacherStore.applySalaryTemplate', err);
      return false;
    }
  },

  // ===== 教师薪资规则 =====
  fetchTeacherSalaryRule: async (teacherId) => {
    const rule = await teacherSalaryRuleService.get(teacherId);
    return rule;
  },

  updateTeacherSalaryRule: async (teacherId, config, templateId) => {
    const ok = await teacherSalaryRuleService.update(teacherId, config, templateId);
    if (ok) {
      const teachers = await teacherService.getList(undefined, get().salaryMonth);
      set({ teachers });
    }
    return ok;
  },

  copySalaryRuleToTeachers: async (sourceTeacherId, targetTeacherIds) => {
    const result = await teacherSalaryRuleService.copyToTeachers(sourceTeacherId, targetTeacherIds);
    if (result.success) {
      const teachers = await teacherService.getList(undefined, get().salaryMonth);
      set({ teachers });
    }
    return result;
  },

  // ===== 统计 =====
  getActiveCount: () => get().teachers.filter((t) => t.status === 'active').length,
  getPendingCount: () => get().teachers.filter((t) => t.salaryStatus !== 'archived').length,
  getTotalHours: () =>
    get()
      .teachers.filter((t) => t.status === 'active')
      .reduce((s, t) => s + t.hours, 0),
  getTotalSalary: () =>
    get()
      .teachers.filter((t) => t.status === 'active' || t.salaryStatus !== 'archived')
      .reduce((s, t) => s + calcTotal(t), 0),
}));
