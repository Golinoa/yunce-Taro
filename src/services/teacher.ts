/**
 * Service 层 — 教师管理 API
 * 定义接口契约，当前由 mock 实现，联调时替换为 request 调用
 *
 * A11 口径：真实接口路径待后端 OpenAPI 契约后接入，当前 VITE_USE_MOCK=false
 * 一律抛 notWired 显式报错，禁止猜测 URL。
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
import { notWired } from '@/utils/not-wired';

const USE_MOCK =
  typeof process !== 'undefined' && typeof process.env !== 'undefined'
    ? process.env.VITE_USE_MOCK !== 'false'
    : true;

// ============================================
// 教师 Service
// ============================================
export const teacherService = {
  /** 获取教师列表 */
  getList: (campusId?: string, month?: string) => {
    if (USE_MOCK) return mockGetTeachers(campusId, month);
    return notWired('teacher.getList');
  },

  /** 获取在职教师列表（用于班级表单选择器） */
  getActiveList: (campusId?: string) => {
    if (USE_MOCK) return mockGetActiveTeachers(campusId);
    return notWired('teacher.getActiveList');
  },

  /** 获取教师详情 */
  getById: (id: string) => {
    if (USE_MOCK) return mockGetTeacherById(id);
    return notWired('teacher.getById');
  },

  /** 添加教师 */
  add: (teacher: TeacherUIModel) => {
    if (USE_MOCK) return mockAddTeacher(teacher);
    return notWired('teacher.add');
  },

  /** 更新教师信息 */
  update: (id: string, updates: Partial<TeacherUIModel>) => {
    if (USE_MOCK) return mockUpdateTeacher(id, updates);
    return notWired('teacher.update');
  },

  /** 确认薪资 */
  confirmSalary: (id: string) => {
    if (USE_MOCK) return mockConfirmSalary(id);
    return notWired('teacher.confirmSalary');
  },

  /** 批量确认薪资 */
  batchConfirm: (ids: string[]) => {
    if (USE_MOCK) return mockBatchConfirm(ids);
    return notWired('teacher.batchConfirm');
  },

  /** 发放薪资 */
  executePay: (ids: string[], remark?: string, payMethod?: string) => {
    if (USE_MOCK) return mockExecutePay(ids, remark, payMethod);
    return notWired('teacher.executePay');
  },

  /** 发送工资单（供老师核对） */
  sendSalarySlip: (ids: string[], remark?: string) => {
    if (USE_MOCK) return mockSendSalarySlip(ids, remark);
    return notWired('teacher.sendSalarySlip');
  },

  /** 教师离职 */
  resign: (id: string, resignType: string, reason?: string) => {
    if (USE_MOCK) return mockResignTeacher(id, resignType, reason);
    return notWired('teacher.resign');
  },

  /** 添加扣款/补发 */
  addDeduction: (teacherId: string, deduction: Deduction) => {
    if (USE_MOCK) return mockAddDeduction(teacherId, deduction);
    return notWired('teacher.addDeduction');
  },

  /** 更新扣款/补发 */
  updateDeduction: (
    teacherId: string,
    deductionId: string,
    updates: Partial<Pick<Deduction, 'reason' | 'amount' | 'type'>>,
  ) => {
    if (USE_MOCK) return mockUpdateDeduction(teacherId, deductionId, updates);
    return notWired('teacher.updateDeduction');
  },

  /** 删除扣款/补发 */
  deleteDeduction: (teacherId: string, deductionId: string) => {
    if (USE_MOCK) return mockDeleteDeduction(teacherId, deductionId);
    return notWired('teacher.deleteDeduction');
  },
};

// ============================================
// 工资模型 Service
// ============================================
export const salaryModelService = {
  /** 获取工资模型列表 */
  getList: () => {
    if (USE_MOCK) return mockGetSalaryModels();
    return notWired('salaryModel.getList');
  },

  /** 创建工资模型 */
  create: (model: SalaryModel) => {
    if (USE_MOCK) return mockCreateSalaryModel(model);
    return notWired('salaryModel.create');
  },

  /** 更新工资模型（含历史一致性处理） */
  update: (id: string, updates: Partial<SalaryModel>) => {
    if (USE_MOCK) return mockUpdateSalaryModel(id, updates);
    return notWired('salaryModel.update');
  },

  /** 切换工资模型 — 按薪资状态处理历史数据一致性
   * 已发放 → 冻结不变
   * 已确认未发放 → 可重算（标记需重算）
   * 待确认 → 按新模型计算
   */
  switchModel: async (modelId: string, updates: Partial<SalaryModel>) => {
    if (USE_MOCK) return mockUpdateSalaryModel(modelId, updates);
    return notWired('salaryModel.switchModel');
  },
};

// ============================================
// 发薪设置 Service
// ============================================
export const salarySettingsService = {
  /** 获取发薪设置 */
  get: () => {
    if (USE_MOCK) return mockGetSettings();
    return notWired('salarySettings.get');
  },

  /** 更新发薪设置 */
  update: (updates: Partial<SalarySettings>) => {
    if (USE_MOCK) return mockUpdateSettings(updates);
    return notWired('salarySettings.update');
  },
};

// ============================================
// 排课 Service
// ============================================
export const teacherScheduleService = {
  /** 获取排课数据 */
  getList: () => {
    if (USE_MOCK) return mockGetScheduleData();
    return notWired('teacherSchedule.getList');
  },
};

// ============================================
// 薪资模板 Service
// ============================================
export const salaryTemplateService = {
  /** 获取薪资模板列表 */
  getList: () => {
    if (USE_MOCK) return mockGetSalaryTemplates();
    return notWired('salaryTemplate.getList');
  },
  /** 获取单个薪资模板 */
  getById: (id: string) => {
    if (USE_MOCK) return mockGetSalaryTemplateById(id);
    return notWired('salaryTemplate.getById');
  },
  /** 创建薪资模板 */
  create: (data: Omit<SalaryTemplate, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (USE_MOCK) return mockCreateSalaryTemplate(data);
    return notWired('salaryTemplate.create');
  },
  /** 更新薪资模板 */
  update: (id: string, updates: Partial<Omit<SalaryTemplate, 'id'>>) => {
    if (USE_MOCK) return mockUpdateSalaryTemplate(id, updates);
    return notWired('salaryTemplate.update');
  },
  /** 删除薪资模板 */
  remove: (id: string) => {
    if (USE_MOCK) return mockDeleteSalaryTemplate(id);
    return notWired('salaryTemplate.remove');
  },
  /** 套用薪资模板到多个教师 */
  apply: (templateId: string, teacherIds: string[]) => {
    if (USE_MOCK) return mockApplySalaryTemplate(templateId, teacherIds);
    return notWired('salaryTemplate.apply');
  },
  /** 创建默认空薪资规则配置 */
  createDefaultRule: () => createDefaultSalaryRule(),
};

// ============================================
// 教师薪资规则 Service
// ============================================
export const teacherSalaryRuleService = {
  /** 获取教师薪资规则配置 */
  get: (teacherId: string) => {
    if (USE_MOCK) return mockGetTeacherSalaryRule(teacherId);
    return notWired('teacherSalaryRule.get');
  },
  /** 更新教师薪资规则配置 */
  update: (teacherId: string, config: SalaryRuleConfig, templateId?: string) => {
    if (USE_MOCK) return mockUpdateTeacherSalaryRule(teacherId, config, templateId);
    return notWired('teacherSalaryRule.update');
  },
  /** 把当前教师薪资规则配置复制给其他教师 */
  copyToTeachers: (sourceTeacherId: string, targetTeacherIds: string[]) => {
    if (USE_MOCK) return mockCopySalaryRuleToTeachers(sourceTeacherId, targetTeacherIds);
    return notWired('teacherSalaryRule.copyToTeachers');
  },
};
