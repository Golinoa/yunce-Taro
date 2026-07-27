/**
 * 校区设置 Store — Zustand
 *
 * 管理校区列表、薪资模板、发薪日、节假日、营业时间等状态
 */
import Taro from '@tarojs/taro';
import { create } from 'zustand';
import {
  campusService,
  salaryModelCampusService,
  payDaySettingsService,
  holidayService,
  businessHoursService,
  notifyService,
  subjectService,
} from '@/services';
import type {
  CampusUIModel,
  CampusFormData,
  SalaryModel,
  PayDaySettings,
  Holiday,
  BusinessHours,
  NotifyGroup,
  Subject,
  SubjectFormData,
} from '@/types/campus';
import { logError } from '@/utils/logger';

/** 机构名称本地存储键 */
const ORG_NAME_KEY = 'yunce_org_name';
const DEFAULT_ORG_NAME = '松果排课';

interface CampusState {
  // 数据
  orgName: string;
  campuses: CampusUIModel[];
  salaryModels: SalaryModel[];
  payDaySettings: PayDaySettings;
  holidays: Holiday[];
  businessHours: BusinessHours;
  notifyGroups: NotifyGroup[];
  subjects: Subject[];
  loading: boolean;
  error: string | null;

  // 校区操作
  fetchCampuses: () => Promise<void>;
  addCampus: (data: CampusFormData) => Promise<CampusUIModel | null>;
  updateCampus: (id: string, data: Partial<CampusFormData>) => Promise<boolean>;
  deleteCampus: (id: string) => Promise<boolean>;
  setMainCampus: (id: string) => Promise<boolean>;

  // 薪资模板操作
  fetchSalaryModels: () => Promise<void>;
  createSalaryModel: (
    model: Omit<SalaryModel, 'id' | 'teacherCount'>,
  ) => Promise<SalaryModel | null>;
  updateSalaryModel: (id: string, updates: Partial<SalaryModel>) => Promise<boolean>;
  deleteSalaryModel: (id: string) => Promise<boolean>;

  // 发薪日操作
  fetchPayDaySettings: () => Promise<void>;
  updatePayDaySettings: (updates: Partial<PayDaySettings>) => Promise<void>;

  // 节假日操作
  fetchHolidays: () => Promise<void>;
  addHoliday: (holiday: Omit<Holiday, 'id'>) => Promise<Holiday | null>;
  updateHoliday: (id: string, updates: Partial<Holiday>) => Promise<boolean>;
  deleteHoliday: (id: string) => Promise<boolean>;

  // 营业时间操作
  fetchBusinessHours: () => Promise<void>;
  updateBusinessHours: (updates: Partial<BusinessHours>) => Promise<void>;

  // 通知设置操作
  fetchNotifySettings: () => Promise<void>;
  toggleNotify: (itemId: string) => Promise<void>;

  // 科目操作
  fetchSubjects: () => Promise<void>;
  addSubject: (data: SubjectFormData) => Promise<Subject | null>;
  deleteSubject: (id: string) => Promise<boolean>;

  // 机构名称
  setOrgName: (name: string) => void;

  // 全量加载
  fetchAll: () => Promise<void>;
}

export const useCampusStore = create<CampusState>((set) => ({
  orgName: Taro.getStorageSync(ORG_NAME_KEY) || DEFAULT_ORG_NAME,
  campuses: [],
  salaryModels: [],
  payDaySettings: { mode: 'fixed', fixedDay: 15 },
  holidays: [],
  businessHours: {
    weekdayStart: '09:00',
    weekdayEnd: '21:00',
    weekendStart: '08:30',
    weekendEnd: '21:30',
    specialDates: [],
  },
  notifyGroups: [],
  subjects: [],
  loading: false,
  error: null,

  // ============================================
  // 校区
  // ============================================
  fetchCampuses: async () => {
    set({ loading: true, error: null });
    try {
      const campuses = await campusService.getList();
      set({ campuses, error: null, loading: false });
    } catch (err) {
      logError('fetchCampuses', err);
      set({ error: '校区数据加载失败', loading: false });
    }
  },

  addCampus: async (data) => {
    try {
      const campus = await campusService.add(data);
      const campuses = await campusService.getList();
      set({ campuses, error: null });
      return campus;
    } catch (err) {
      logError('addCampus', err);
      set({ error: '添加校区失败' });
      return null;
    }
  },

  updateCampus: async (id, data) => {
    try {
      const result = await campusService.update(id, data);
      if (result) {
        const campuses = await campusService.getList();
        set({ campuses, error: null });
        return true;
      }
      return false;
    } catch (err) {
      logError('updateCampus', err);
      set({ error: '更新校区失败' });
      return false;
    }
  },

  deleteCampus: async (id) => {
    try {
      const success = await campusService.delete(id);
      if (success) {
        const campuses = await campusService.getList();
        set({ campuses, error: null });
        return true;
      }
      return false;
    } catch (err) {
      logError('deleteCampus', err);
      set({ error: '删除校区失败' });
      return false;
    }
  },

  setMainCampus: async (id) => {
    try {
      const success = await campusService.setMain(id);
      if (success) {
        const campuses = await campusService.getList();
        set({ campuses, error: null });
        return true;
      }
      return false;
    } catch (err) {
      logError('setMainCampus', err);
      set({ error: '设置主校区失败' });
      return false;
    }
  },

  // ============================================
  // 薪资模板
  // ============================================
  fetchSalaryModels: async () => {
    try {
      const salaryModels = await salaryModelCampusService.getList();
      set({ salaryModels, error: null });
    } catch (err) {
      logError('fetchSalaryModels', err);
      set({ error: '薪资模板加载失败' });
    }
  },

  createSalaryModel: async (model) => {
    try {
      const result = await salaryModelCampusService.create(model);
      const salaryModels = await salaryModelCampusService.getList();
      set({ salaryModels, error: null });
      return result;
    } catch (err) {
      logError('createSalaryModel', err);
      set({ error: '创建薪资模板失败' });
      return null;
    }
  },

  updateSalaryModel: async (id, updates) => {
    try {
      const result = await salaryModelCampusService.update(id, updates);
      if (result) {
        const salaryModels = await salaryModelCampusService.getList();
        set({ salaryModels, error: null });
        return true;
      }
      return false;
    } catch (err) {
      logError('updateSalaryModel', err);
      set({ error: '更新薪资模板失败' });
      return false;
    }
  },

  deleteSalaryModel: async (id) => {
    try {
      const success = await salaryModelCampusService.delete(id);
      if (success) {
        const salaryModels = await salaryModelCampusService.getList();
        set({ salaryModels, error: null });
        return true;
      }
      return false;
    } catch (err) {
      logError('deleteSalaryModel', err);
      set({ error: '删除薪资模板失败' });
      return false;
    }
  },

  // ============================================
  // 发薪日
  // ============================================
  fetchPayDaySettings: async () => {
    try {
      const payDaySettings = await payDaySettingsService.get();
      set({ payDaySettings, error: null });
    } catch (err) {
      logError('fetchPayDaySettings', err);
      set({ error: '发薪日设置加载失败' });
    }
  },

  updatePayDaySettings: async (updates) => {
    try {
      const payDaySettings = await payDaySettingsService.update(updates);
      set({ payDaySettings, error: null });
    } catch (err) {
      logError('updatePayDaySettings', err);
      set({ error: '更新发薪日设置失败' });
    }
  },

  // ============================================
  // 节假日
  // ============================================
  fetchHolidays: async () => {
    try {
      const holidays = await holidayService.getList();
      set({ holidays, error: null });
    } catch (err) {
      logError('fetchHolidays', err);
      set({ error: '节假日数据加载失败' });
    }
  },

  addHoliday: async (holiday) => {
    try {
      const result = await holidayService.add(holiday);
      const holidays = await holidayService.getList();
      set({ holidays, error: null });
      return result;
    } catch (err) {
      logError('addHoliday', err);
      set({ error: '添加节假日失败' });
      return null;
    }
  },

  updateHoliday: async (id, updates) => {
    try {
      const result = await holidayService.update(id, updates);
      if (result) {
        const holidays = await holidayService.getList();
        set({ holidays, error: null });
        return true;
      }
      return false;
    } catch (err) {
      logError('updateHoliday', err);
      set({ error: '更新节假日失败' });
      return false;
    }
  },

  deleteHoliday: async (id) => {
    try {
      const success = await holidayService.delete(id);
      if (success) {
        const holidays = await holidayService.getList();
        set({ holidays, error: null });
        return true;
      }
      return false;
    } catch (err) {
      logError('deleteHoliday', err);
      set({ error: '删除节假日失败' });
      return false;
    }
  },

  // ============================================
  // 营业时间
  // ============================================
  fetchBusinessHours: async () => {
    try {
      const businessHours = await businessHoursService.get();
      set({ businessHours, error: null });
    } catch (err) {
      logError('fetchBusinessHours', err);
      set({ error: '营业时间加载失败' });
    }
  },

  updateBusinessHours: async (updates) => {
    try {
      const businessHours = await businessHoursService.update(updates);
      set({ businessHours, error: null });
    } catch (err) {
      logError('updateBusinessHours', err);
      set({ error: '更新营业时间失败' });
    }
  },

  // ============================================
  // 通知设置
  // ============================================
  fetchNotifySettings: async () => {
    try {
      const notifyGroups = await notifyService.getList();
      set({ notifyGroups, error: null });
    } catch (err) {
      logError('fetchNotifySettings', err);
      set({ error: '通知设置加载失败' });
    }
  },

  toggleNotify: async (itemId) => {
    try {
      const notifyGroups = await notifyService.toggle(itemId);
      set({ notifyGroups, error: null });
    } catch (err) {
      logError('toggleNotify', err);
      set({ error: '切换通知设置失败' });
    }
  },

  // ============================================
  // 科目
  // ============================================
  fetchSubjects: async () => {
    try {
      const subjects = await subjectService.getList();
      set({ subjects, error: null });
    } catch (err) {
      logError('fetchSubjects', err);
      set({ error: '科目数据加载失败' });
    }
  },

  addSubject: async (data) => {
    try {
      const result = await subjectService.add(data);
      const subjects = await subjectService.getList();
      set({ subjects, error: null });
      return result;
    } catch (err) {
      logError('addSubject', err);
      set({ error: '添加科目失败' });
      return null;
    }
  },

  deleteSubject: async (id) => {
    try {
      const success = await subjectService.delete(id);
      if (success) {
        const subjects = await subjectService.getList();
        set({ subjects, error: null });
        return true;
      }
      return false;
    } catch (err) {
      logError('deleteSubject', err);
      set({ error: '删除科目失败' });
      return false;
    }
  },

  // ============================================
  // 全量加载
  // ============================================
  setOrgName: (name: string) => {
    Taro.setStorageSync(ORG_NAME_KEY, name);
    set({ orgName: name });
  },

  fetchAll: async () => {
    set({ loading: true, error: null });
    try {
      const [campuses, salaryModels, payDaySettings, holidays, businessHours, notifyGroups] =
        await Promise.all([
          campusService.getList(),
          salaryModelCampusService.getList(),
          payDaySettingsService.get(),
          holidayService.getList(),
          businessHoursService.get(),
          notifyService.getList(),
        ]);
      set({
        campuses,
        salaryModels,
        payDaySettings,
        holidays,
        businessHours,
        notifyGroups,
        loading: false,
      });
    } catch (err) {
      logError('fetchAll campus', err);
      set({ loading: false, error: '校区设置加载失败，请重试' });
    }
  },
}));
