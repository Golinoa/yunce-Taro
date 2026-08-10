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
import type {
  TeacherUIModel,
  SalaryModel,
  SalarySettings,
  Deduction,
  SalaryTemplate,
  SalaryRuleConfig,
} from '@/types/teacher';

// ============================================
// 教师 Service
// ============================================
export const teacherService = {
  /** 获取教师列表 */
  getList: (campusId?: string, month?: string) => mockGetTeachers(campusId, month),

  /** 获取在职教师列表（用于班级表单选择器） */
  getActiveList: (campusId?: string) => mockGetActiveTeachers(campusId),

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
  executePay: (ids: string[], remark?: string, payMethod?: string) =>
    mockExecutePay(ids, remark, payMethod),

  /** 发送工资单（供老师核对） */
  sendSalarySlip: (ids: string[], remark?: string) => mockSendSalarySlip(ids, remark),

  /** 教师离职 */
  resign: (id: string, resignType: string, reason?: string) =>
    mockResignTeacher(id, resignType, reason),

  /** 添加扣款/补发 */
  addDeduction: (teacherId: string, deduction: Deduction) => mockAddDeduction(teacherId, deduction),

  /** 更新扣款/补发 */
  updateDeduction: (
    teacherId: string,
    deductionId: string,
    updates: Partial<Pick<Deduction, 'reason' | 'amount' | 'type'>>,
  ) => mockUpdateDeduction(teacherId, deductionId, updates),

  /** 删除扣款/补发 */
  deleteDeduction: (teacherId: string, deductionId: string) =>
    mockDeleteDeduction(teacherId, deductionId),
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

// ============================================
// 薪资模板 Service
// ============================================
export const salaryTemplateService = {
  /** 获取薪资模板列表 */
  getList: () => mockGetSalaryTemplates(),
  /** 获取单个薪资模板 */
  getById: (id: string) => mockGetSalaryTemplateById(id),
  /** 创建薪资模板 */
  create: (data: Omit<SalaryTemplate, 'id' | 'createdAt' | 'updatedAt'>) =>
    mockCreateSalaryTemplate(data),
  /** 更新薪资模板 */
  update: (id: string, updates: Partial<Omit<SalaryTemplate, 'id'>>) =>
    mockUpdateSalaryTemplate(id, updates),
  /** 删除薪资模板 */
  remove: (id: string) => mockDeleteSalaryTemplate(id),
  /** 套用薪资模板到多个教师 */
  apply: (templateId: string, teacherIds: string[]) =>
    mockApplySalaryTemplate(templateId, teacherIds),
  /** 创建默认空薪资规则配置 */
  createDefaultRule: () => createDefaultSalaryRule(),
};

// ============================================
// 教师薪资规则 Service
// ============================================
export const teacherSalaryRuleService = {
  /** 获取教师薪资规则配置 */
  get: (teacherId: string) => mockGetTeacherSalaryRule(teacherId),
  /** 更新教师薪资规则配置 */
  update: (teacherId: string, config: SalaryRuleConfig, templateId?: string) =>
    mockUpdateTeacherSalaryRule(teacherId, config, templateId),
  /** 把当前教师薪资规则配置复制给其他教师 */
  copyToTeachers: (sourceTeacherId: string, targetTeacherIds: string[]) =>
    mockCopySalaryRuleToTeachers(sourceTeacherId, targetTeacherIds),
};
