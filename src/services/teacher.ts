/**
 * Service 层 — 教师管理 API
 * 定义接口契约，当前由 mock 实现，联调时替换为 request 调用
 */
import {
  mockGetTeachers,
  mockGetActiveTeachers,
  mockGetTeacherById,
  mockAddTeacher,
  mockUpdateTeacher,
  mockConfirmSalary,
  mockBatchConfirm,
  mockExecutePay,
  mockResignTeacher,
  mockAddDeduction,
  mockGetSalaryModels,
  mockCreateSalaryModel,
  mockUpdateSalaryModel,
  mockGetSettings,
  mockUpdateSettings,
  mockGetScheduleData,
} from '@/data/teacher';
import type { TeacherUIModel, SalaryModel, SalarySettings, Deduction } from '@/types/teacher';

// ============================================
// 教师 Service
// ============================================
export const teacherService = {
  /** 获取教师列表 */
  getList: () => mockGetTeachers(),

  /** 获取在职教师列表（用于班级表单选择器） */
  getActiveList: () => mockGetActiveTeachers(),

  /** 获取教师详情 */
  getById: (id: string) => mockGetTeacherById(id),

  /** 添加教师 */
  add: (teacher: TeacherUIModel) => mockAddTeacher(teacher),

  /** 更新教师信息 */
  update: (id: string, updates: Partial<TeacherUIModel>) => mockUpdateTeacher(id, updates),

  /** 确认薪资 */
  confirmSalary: (id: string) => mockConfirmSalary(id),

  /** 批量确认薪资 */
  batchConfirm: (ids: string[]) => mockBatchConfirm(ids),

  /** 发放薪资 */
  executePay: (ids: string[], remark?: string) => mockExecutePay(ids, remark),

  /** 教师离职 */
  resign: (id: string, resignType: string, reason?: string) =>
    mockResignTeacher(id, resignType, reason),

  /** 添加扣款/补发 */
  addDeduction: (teacherId: string, deduction: Deduction) => mockAddDeduction(teacherId, deduction),
};

// ============================================
// 工资模型 Service
// ============================================
export const salaryModelService = {
  /** 获取工资模型列表 */
  getList: () => mockGetSalaryModels(),

  /** 创建工资模型 */
  create: (model: SalaryModel) => mockCreateSalaryModel(model),

  /** 更新工资模型（含历史一致性处理） */
  update: (id: string, updates: Partial<SalaryModel>) => mockUpdateSalaryModel(id, updates),

  /** 切换工资模型 — 按薪资状态处理历史数据一致性
   * 已发放 → 冻结不变
   * 已确认未发放 → 可重算（标记需重算）
   * 待确认 → 按新模型计算
   */
  switchModel: async (modelId: string, updates: Partial<SalaryModel>) => {
    const result = await mockUpdateSalaryModel(modelId, updates);
    return result;
  },
};

// ============================================
// 发薪设置 Service
// ============================================
export const salarySettingsService = {
  /** 获取发薪设置 */
  get: () => mockGetSettings(),

  /** 更新发薪设置 */
  update: (updates: Partial<SalarySettings>) => mockUpdateSettings(updates),
};

// ============================================
// 排课 Service
// ============================================
export const teacherScheduleService = {
  /** 获取排课数据 */
  getList: () => mockGetScheduleData(),
};
