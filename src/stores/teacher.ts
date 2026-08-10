import dayjs from 'dayjs';
import { create } from 'zustand';
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
import { logError } from '@/utils/logger';

/** 计算教师薪资总额（含扣款/补发） */
export function calcTotal(t: TeacherUIModel): number {
  const lessonFee =
    t.categoryLessonFees?.reduce((sum, item) => sum + item.amount, 0) ?? t.hours * t.rate;
  let total = t.base + lessonFee + t.attend + t.perf;
  total -= t.socialInsurance || 0;
  total -= t.lateFine || 0;
  total -= t.otherFine || 0;
  total += t.bonusAmount || 0;
  t.deductions.forEach((d) => {
    total += d.type === 'bonus' ? d.amount : -d.amount;
  });
  return Math.max(0, total);
}

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

  // 数据加载
  fetchTeachers: (month?: string) => Promise<void>;
  fetchSalaryModels: () => Promise<void>;
  fetchSalaryTemplates: () => Promise<void>;
  fetchSettings: () => Promise<void>;
  fetchAll: (month?: string) => Promise<void>;

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

  // ===== 数据加载 =====
  fetchTeachers: async (month) => {
    const targetMonth = month ?? get().salaryMonth;
    const teachers = await teacherService.getList(undefined, targetMonth);
    set({ teachers });
  },

  fetchSalaryModels: async () => {
    const salaryModels = await salaryModelService.getList();
    set({ salaryModels });
  },

  fetchSalaryTemplates: async () => {
    const salaryTemplates = await salaryTemplateService.getList();
    set({ salaryTemplates });
  },

  fetchSettings: async () => {
    const settings = await salarySettingsService.get();
    set({ settings });
  },

  fetchAll: async (month) => {
    set({ loading: true, error: null });
    try {
      const targetMonth = month ?? get().salaryMonth;
      const [teachers, salaryModels, salaryTemplates, settings] = await Promise.all([
        teacherService.getList(undefined, targetMonth),
        salaryModelService.getList(),
        salaryTemplateService.getList(),
        salarySettingsService.get(),
      ]);
      set({ teachers, salaryModels, salaryTemplates, settings, loading: false });
    } catch (err) {
      logError('teacher fetchAll', err);
      set({ loading: false, error: '教师数据加载失败，请重试' });
    }
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
    await teacherService.confirmSalary(id);
    const teachers = await teacherService.getList();
    set({ teachers });
  },

  batchConfirm: async (ids) => {
    await teacherService.batchConfirm(ids);
    const teachers = await teacherService.getList();
    set({ teachers, selectedIds: [] });
  },

  setPendingPayAction: (action) => set({ pendingPayAction: action }),

  executePay: async (remark, payMethod) => {
    const { pendingPayAction } = get();
    if (!pendingPayAction) return;
    const { ids } = pendingPayAction;
    await teacherService.executePay(ids, remark, payMethod);
    const teachers = await teacherService.getList();
    set({ teachers, pendingPayAction: null, selectedIds: [] });
  },

  setPendingSendAction: (action) => set({ pendingSendAction: action }),

  executeSend: async (remark) => {
    const { pendingSendAction } = get();
    if (!pendingSendAction) return { success: [], failed: [] };
    const { ids } = pendingSendAction;
    const result = await teacherService.sendSalarySlip(ids, remark);
    const teachers = await teacherService.getList();
    set({ teachers, pendingSendAction: null });
    return result;
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
    await teacherService.add(teacher);
    const teachers = await teacherService.getList();
    set({ teachers });
  },

  updateTeacher: async (id, updates) => {
    await teacherService.update(id, updates);
    const teachers = await teacherService.getList();
    set({ teachers });
  },

  resignTeacher: async (id, resignType, reason) => {
    await teacherService.resign(id, resignType, reason);
    const teachers = await teacherService.getList();
    set({ teachers });
  },

  addDeduction: async (teacherId, deduction) => {
    await teacherService.addDeduction(teacherId, deduction);
    const teachers = await teacherService.getList(undefined, get().salaryMonth);
    set({ teachers });
  },

  updateDeduction: async (teacherId, deductionId, updates) => {
    await teacherService.updateDeduction(teacherId, deductionId, updates);
    const teachers = await teacherService.getList(undefined, get().salaryMonth);
    set({ teachers });
  },

  deleteDeduction: async (teacherId, deductionId) => {
    await teacherService.deleteDeduction(teacherId, deductionId);
    const teachers = await teacherService.getList(undefined, get().salaryMonth);
    set({ teachers });
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
    const result = await salaryTemplateService.apply(templateId, teacherIds);
    if (result.success) {
      const [teachers, salaryTemplates] = await Promise.all([
        teacherService.getList(),
        salaryTemplateService.getList(),
      ]);
      set({ teachers, salaryTemplates });
    }
    return result.success;
  },

  // ===== 教师薪资规则 =====
  fetchTeacherSalaryRule: async (teacherId) => {
    const rule = await teacherSalaryRuleService.get(teacherId);
    return rule;
  },

  updateTeacherSalaryRule: async (teacherId, config, templateId) => {
    const ok = await teacherSalaryRuleService.update(teacherId, config, templateId);
    if (ok) {
      const teachers = await teacherService.getList();
      set({ teachers });
    }
    return ok;
  },

  copySalaryRuleToTeachers: async (sourceTeacherId, targetTeacherIds) => {
    const result = await teacherSalaryRuleService.copyToTeachers(sourceTeacherId, targetTeacherIds);
    if (result.success) {
      const teachers = await teacherService.getList();
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
