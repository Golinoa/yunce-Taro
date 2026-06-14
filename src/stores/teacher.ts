import { create } from 'zustand';
import { teacherService, salaryModelService, salarySettingsService } from '@/services/teacher';
import type {
  TeacherUIModel,
  TeacherFilter,
  SalaryStatus,
  SalarySettings,
  Deduction,
  PendingPayAction,
  SalaryModel,
} from '@/types/teacher';

/** 计算教师薪资总额（含扣款/补发） */
export function calcTotal(t: TeacherUIModel): number {
  const lessonFee = t.hours * t.rate;
  let total = t.base + lessonFee + t.attend + t.perf;
  t.deductions.forEach((d) => {
    total += d.type === 'bonus' ? d.amount : -d.amount;
  });
  return Math.max(0, total);
}

interface TeacherState {
  teachers: TeacherUIModel[];
  salaryModels: SalaryModel[];
  filter: TeacherFilter;
  selectedIds: string[];
  settings: SalarySettings;
  pendingPayAction: PendingPayAction | null;
  loading: boolean;

  // 数据加载
  fetchTeachers: () => Promise<void>;
  fetchSalaryModels: () => Promise<void>;
  fetchSettings: () => Promise<void>;
  fetchAll: () => Promise<void>;

  // 筛选
  setFilter: (filter: Partial<TeacherFilter>) => void;
  getFilteredTeachers: () => TeacherUIModel[];

  // 薪资操作
  confirmSalary: (id: string) => Promise<void>;
  batchConfirm: (ids: string[]) => Promise<void>;
  setPendingPayAction: (action: PendingPayAction | null) => void;
  executePay: (remark?: string) => Promise<void>;

  // 选择
  toggleSelect: (id: string) => void;
  toggleSelectAll: () => void;
  clearSelection: () => void;

  // 教师操作
  addTeacher: (teacher: TeacherUIModel) => Promise<void>;
  updateTeacher: (id: string, updates: Partial<TeacherUIModel>) => Promise<void>;
  resignTeacher: (id: string, resignType: string, reason?: string) => Promise<void>;
  addDeduction: (teacherId: string, deduction: Deduction) => Promise<void>;

  // 设置
  updateSettings: (updates: Partial<SalarySettings>) => Promise<void>;

  // 工资模型
  createSalaryModel: (model: SalaryModel) => Promise<void>;
  updateSalaryModel: (id: string, updates: Partial<SalaryModel>) => Promise<void>;

  // 统计
  getActiveCount: () => number;
  getPendingCount: () => number;
  getTotalHours: () => number;
  getTotalSalary: () => number;
}

export const useTeacherStore = create<TeacherState>((set, get) => ({
  teachers: [],
  salaryModels: [],
  filter: { role: 'all', subject: 'all', status: 'active' },
  selectedIds: [],
  settings: { payDay: 15, pushDaysBefore: 1, autoConfirm: false, pushEnabled: true },
  pendingPayAction: null,
  loading: false,

  // ===== 数据加载 =====
  fetchTeachers: async () => {
    const teachers = await teacherService.getList();
    set({ teachers });
  },

  fetchSalaryModels: async () => {
    const salaryModels = await salaryModelService.getList();
    set({ salaryModels });
  },

  fetchSettings: async () => {
    const settings = await salarySettingsService.get();
    set({ settings });
  },

  fetchAll: async () => {
    set({ loading: true });
    try {
      const [teachers, salaryModels, settings] = await Promise.all([
        teacherService.getList(),
        salaryModelService.getList(),
        salarySettingsService.get(),
      ]);
      set({ teachers, salaryModels, settings, loading: false });
    } catch {
      set({ loading: false });
    }
  },

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

  executePay: async (remark) => {
    const { pendingPayAction } = get();
    if (!pendingPayAction) return;
    const { ids } = pendingPayAction;
    await teacherService.executePay(ids, remark);
    const teachers = await teacherService.getList();
    set({ teachers, pendingPayAction: null, selectedIds: [] });
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
    const selectable = teachers.filter((t) => t.status === 'active' || t.salaryStatus !== 'paid');
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
    const teachers = await teacherService.getList();
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

  // ===== 统计 =====
  getActiveCount: () => get().teachers.filter((t) => t.status === 'active').length,
  getPendingCount: () =>
    get().teachers.filter(
      (t) =>
        (t.salaryStatus as string) !== 'paid' &&
        (t.status === 'active' || (t.salaryStatus as string) !== 'paid'),
    ).length,
  getTotalHours: () =>
    get()
      .teachers.filter((t) => t.status === 'active')
      .reduce((s, t) => s + t.hours, 0),
  getTotalSalary: () =>
    get()
      .teachers.filter((t) => t.status === 'active' || t.salaryStatus !== 'paid')
      .reduce((s, t) => s + calcTotal(t), 0),
}));
