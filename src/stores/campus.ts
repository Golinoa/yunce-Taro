/**
 * 校区设置 Store — Zustand
 *
 * 管理校区列表、薪资模板、发薪日、节假日等状态；营业时间随校区资料读写。
 */
import Taro from '@tarojs/taro';
import { create } from 'zustand';
import {
  campusService,
  salaryModelCampusService,
  payDaySettingsService,
  holidayService,
  notifyService,
  subjectService,
} from '@/services';
import type {
  CampusUIModel,
  CampusFormData,
  SalaryModel,
  PayDaySettings,
  Holiday,
  NotifyGroup,
  Subject,
  SubjectFormData,
} from '@/types/campus';
import { TTL } from '@/utils/data-freshness';
import { logError } from '@/utils/logger';

/** 机构名称本地存储键 */
const ORG_NAME_KEY = 'yunce_org_name';
const DEFAULT_ORG_NAME = '松果排课';

/** 当前选中校区本地存储键 */
const CURRENT_CAMPUS_ID_KEY = 'yunce_current_campus_id';

/** 当前机构 ID（与 campusId 配对，跨机构切换后校验残留） */
const CURRENT_ORG_ID_KEY = 'yunce_current_org_id';

/** 上次访问校区本地存储键 */
const LAST_VISITED_CAMPUS_ID_KEY = 'yunce_last_visited_campus_id';

/**
 * 校区列表快照本地存储键。
 * 冷启动时先用它渲染首页校区卡片，再由后台请求校准——
 * 否则「登录态已恢复但 /campuses 还没回来」的窗口里，首页会先显示兜底文案「未设置校区」。
 */
const CAMPUS_SNAPSHOT_KEY = 'yunce_campus_list_snapshot';

/** 读回校区列表快照；解析失败/非数组一律当空，不影响主链路 */
function readCampusSnapshot(): CampusUIModel[] {
  try {
    const raw = Taro.getStorageSync(CAMPUS_SNAPSHOT_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as CampusUIModel[];
  } catch {
    return [];
  }
}

/** 写校区列表快照；列表为空（登出/切机构清缓存）时移除，避免换账号后串上一家的门店 */
function persistCampusSnapshot(list: CampusUIModel[]): void {
  try {
    if (list.length > 0) {
      Taro.setStorageSync(CAMPUS_SNAPSHOT_KEY, JSON.stringify(list));
    } else {
      Taro.removeStorageSync(CAMPUS_SNAPSHOT_KEY);
    }
  } catch {
    /* ignore */
  }
}

interface CampusState {
  // 数据
  orgName: string;
  campuses: CampusUIModel[];
  /** 当前用户有权限访问的校区ID列表 */
  allowedCampusIds: string[];
  /** 当前选中的校区ID */
  currentCampusId: string;
  /** 上次访问的校区ID */
  lastVisitedCampusId: string;
  salaryModels: SalaryModel[];
  payDaySettings: PayDaySettings;
  holidays: Holiday[];
  notifyGroups: NotifyGroup[];
  subjects: Subject[];
  loading: boolean;
  error: string | null;
  /** 校区列表上次成功拉取时间 */
  lastCampusesFetchAt: number;
  /** 科目列表上次成功拉取时间 */
  lastSubjectsFetchAt: number;
  /** 薪资模板上次成功拉取时间 */
  lastSalaryModelsFetchAt: number;
  /** 发薪日设置上次成功拉取时间 */
  lastPayDayFetchAt: number;
  /** 节假日列表上次成功拉取时间 */
  lastHolidaysFetchAt: number;

  // 校区操作
  fetchCampuses: (force?: boolean) => Promise<void>;
  /** 清空校区/科目读缓存时间戳 */
  invalidateCache: () => void;
  invalidateSubjectsCache: () => void;
  addCampus: (data: CampusFormData) => Promise<CampusUIModel | null>;
  updateCampus: (id: string, data: Partial<CampusFormData>) => Promise<boolean>;
  deleteCampus: (id: string) => Promise<boolean>;
  setMainCampus: (id: string) => Promise<boolean>;

  // 薪资模板操作
  fetchSalaryModels: (force?: boolean) => Promise<void>;
  createSalaryModel: (
    model: Omit<SalaryModel, 'id' | 'teacherCount'>,
  ) => Promise<SalaryModel | null>;
  updateSalaryModel: (id: string, updates: Partial<SalaryModel>) => Promise<boolean>;
  deleteSalaryModel: (id: string) => Promise<boolean>;

  // 发薪日操作
  fetchPayDaySettings: (force?: boolean) => Promise<void>;
  updatePayDaySettings: (updates: Partial<PayDaySettings>) => Promise<void>;

  // 节假日操作
  fetchHolidays: (force?: boolean) => Promise<void>;
  addHoliday: (holiday: Omit<Holiday, 'id'>) => Promise<Holiday | null>;
  updateHoliday: (id: string, updates: Partial<Holiday>) => Promise<boolean>;
  deleteHoliday: (id: string) => Promise<boolean>;
  clearHolidays: () => Promise<boolean>;
  generateStatutoryHolidays: (year?: number) => Promise<number>;

  // 通知设置操作
  fetchNotifySettings: () => Promise<void>;
  toggleNotify: (itemId: string) => Promise<void>;

  // 科目操作
  fetchSubjects: (force?: boolean) => Promise<void>;
  addSubject: (data: SubjectFormData) => Promise<Subject | null>;
  deleteSubject: (id: string) => Promise<boolean>;

  // 机构名称
  setOrgName: (name: string) => void;

  // 当前校区
  setCurrentCampusId: (id: string) => void;
  /** 写入当前机构 ID（跨机构切换后与 campusId 配对） */
  setCurrentOrganizationId: (organizationId: string) => void;
  setLastVisitedCampusId: (id: string) => void;
  initCurrentCampus: (identityCampusIds?: string[]) => void;
  setAllowedCampusIds: (ids: string[]) => void;

  // 全量加载
  fetchAll: () => Promise<void>;
}

export const useCampusStore = create<CampusState>((set, get) => ({
  orgName: Taro.getStorageSync(ORG_NAME_KEY) || DEFAULT_ORG_NAME,
  campuses: readCampusSnapshot(),
  allowedCampusIds: [],
  currentCampusId: Taro.getStorageSync(CURRENT_CAMPUS_ID_KEY) || '',
  lastVisitedCampusId: Taro.getStorageSync(LAST_VISITED_CAMPUS_ID_KEY) || '',
  salaryModels: [],
  payDaySettings: { mode: 'fixed', fixedDay: 15 },
  holidays: [],
  notifyGroups: [],
  subjects: [],
  loading: false,
  error: null,
  lastCampusesFetchAt: 0,
  lastSubjectsFetchAt: 0,
  lastSalaryModelsFetchAt: 0,
  lastPayDayFetchAt: 0,
  lastHolidaysFetchAt: 0,

  // ============================================
  // 校区
  // ============================================
  fetchCampuses: async (force = false) => {
    const { campuses, lastCampusesFetchAt } = get();
    const now = Date.now();
    if (
      !force &&
      campuses.length > 0 &&
      lastCampusesFetchAt > 0 &&
      now - lastCampusesFetchAt < TTL.campus
    ) {
      return;
    }
    set({ loading: true, error: null });
    try {
      const list = await campusService.getList();
      persistCampusSnapshot(list);
      set({ campuses: list, error: null, loading: false, lastCampusesFetchAt: now });
    } catch (err) {
      logError('fetchCampuses', err);
      set({ error: '校区数据加载失败', loading: false });
    }
  },

  invalidateCache: () => {
    // 清内存列表的同时清快照：切机构/登出后不得让下一个上下文先渲染上一家的校区
    persistCampusSnapshot([]);
    set({
      lastCampusesFetchAt: 0,
      lastSubjectsFetchAt: 0,
      lastSalaryModelsFetchAt: 0,
      lastPayDayFetchAt: 0,
      lastHolidaysFetchAt: 0,
      campuses: [],
      subjects: [],
    });
  },

  invalidateSubjectsCache: () => {
    set({ lastSubjectsFetchAt: 0, subjects: [] });
  },

  addCampus: async (data) => {
    try {
      const campus = await campusService.add(data);
      const campuses = await campusService.getList();
      persistCampusSnapshot(campuses);
      set({ campuses, error: null, lastCampusesFetchAt: Date.now() });
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
        persistCampusSnapshot(campuses);
        set({ campuses, error: null, lastCampusesFetchAt: Date.now() });
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
        persistCampusSnapshot(campuses);
        set({ campuses, error: null, lastCampusesFetchAt: Date.now() });
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
        persistCampusSnapshot(campuses);
        set({ campuses, error: null, lastCampusesFetchAt: Date.now() });
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
  fetchSalaryModels: async (force = false) => {
    try {
      const { salaryModels, lastSalaryModelsFetchAt } = get();
      const now = Date.now();
      if (
        !force &&
        salaryModels.length > 0 &&
        lastSalaryModelsFetchAt > 0 &&
        now - lastSalaryModelsFetchAt < TTL.list
      ) {
        return;
      }
      const list = await salaryModelCampusService.getList();
      set({ salaryModels: list, error: null, lastSalaryModelsFetchAt: now });
    } catch (err) {
      logError('fetchSalaryModels', err);
      set({ error: '薪资模板加载失败' });
    }
  },

  createSalaryModel: async (model) => {
    try {
      const result = await salaryModelCampusService.create(model);
      const salaryModels = await salaryModelCampusService.getList();
      set({ salaryModels, error: null, lastSalaryModelsFetchAt: Date.now() });
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
        set({ salaryModels, error: null, lastSalaryModelsFetchAt: Date.now() });
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
        set({ salaryModels, error: null, lastSalaryModelsFetchAt: Date.now() });
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
  fetchPayDaySettings: async (force = false) => {
    try {
      const { lastPayDayFetchAt } = get();
      const now = Date.now();
      if (!force && lastPayDayFetchAt > 0 && now - lastPayDayFetchAt < TTL.list) {
        return;
      }
      const payDaySettings = await payDaySettingsService.get();
      set({ payDaySettings, error: null, lastPayDayFetchAt: now });
    } catch (err) {
      logError('fetchPayDaySettings', err);
      set({ error: '发薪日设置加载失败' });
    }
  },

  updatePayDaySettings: async (updates) => {
    try {
      const payDaySettings = await payDaySettingsService.update(updates);
      set({ payDaySettings, error: null, lastPayDayFetchAt: Date.now() });
    } catch (err) {
      logError('updatePayDaySettings', err);
      set({ error: '更新发薪日设置失败' });
    }
  },

  // ============================================
  // 节假日
  // ============================================
  fetchHolidays: async (force = false) => {
    try {
      const { holidays, lastHolidaysFetchAt } = get();
      const now = Date.now();
      if (
        !force &&
        holidays.length > 0 &&
        lastHolidaysFetchAt > 0 &&
        now - lastHolidaysFetchAt < TTL.list
      ) {
        return;
      }
      const list = await holidayService.getList();
      set({ holidays: list, error: null, lastHolidaysFetchAt: now });
    } catch (err) {
      logError('fetchHolidays', err);
      set({ error: '节假日数据加载失败' });
    }
  },

  addHoliday: async (holiday) => {
    try {
      const result = await holidayService.add(holiday);
      const holidays = await holidayService.getList();
      set({ holidays, error: null, lastHolidaysFetchAt: Date.now() });
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
        set({ holidays, error: null, lastHolidaysFetchAt: Date.now() });
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
        set({ holidays, error: null, lastHolidaysFetchAt: Date.now() });
        return true;
      }
      return false;
    } catch (err) {
      logError('deleteHoliday', err);
      set({ error: '删除节假日失败' });
      return false;
    }
  },

  clearHolidays: async () => {
    try {
      const success = await holidayService.clearAll();
      if (success) {
        set({ holidays: [], error: null });
        return true;
      }
      return false;
    } catch (err) {
      logError('clearHolidays', err);
      set({ error: '清空节假日失败' });
      return false;
    }
  },

  generateStatutoryHolidays: async (year) => {
    try {
      const count = await holidayService.generateStatutory(year);
      const holidays = await holidayService.getList();
      set({ holidays, error: null, lastHolidaysFetchAt: Date.now() });
      return count;
    } catch (err) {
      logError('generateStatutoryHolidays', err);
      set({ error: '生成法定节假日失败' });
      return -1;
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
  fetchSubjects: async (force = false) => {
    try {
      const { subjects, lastSubjectsFetchAt } = get();
      const now = Date.now();
      if (
        !force &&
        subjects.length > 0 &&
        lastSubjectsFetchAt > 0 &&
        now - lastSubjectsFetchAt < TTL.list
      ) {
        return;
      }
      const list = await subjectService.getList();
      set({ subjects: list, error: null, lastSubjectsFetchAt: now });
    } catch (err) {
      logError('fetchSubjects', err);
      set({ error: '科目数据加载失败' });
    }
  },

  addSubject: async (data) => {
    try {
      const result = await subjectService.add(data);
      const subjects = await subjectService.getList();
      set({ subjects, error: null, lastSubjectsFetchAt: Date.now() });
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
        set({ subjects, error: null, lastSubjectsFetchAt: Date.now() });
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

  // ============================================
  // 当前校区
  // ============================================
  setCurrentCampusId: (id: string) => {
    if (!id) return;
    let switched = false;
    set((state) => {
      const prevId = state.currentCampusId;
      if (prevId && prevId !== id) {
        switched = true;
        Taro.setStorageSync(LAST_VISITED_CAMPUS_ID_KEY, prevId);
      }
      Taro.setStorageSync(CURRENT_CAMPUS_ID_KEY, id);
      return {
        currentCampusId: id,
        lastVisitedCampusId: prevId && prevId !== id ? prevId : state.lastVisitedCampusId,
      };
    });
    if (switched) {
      void import('@/utils/reset-domain-caches').then(({ resetDomainCaches }) => {
        resetDomainCaches('campus');
      });
    }
  },

  setCurrentOrganizationId: (organizationId: string) => {
    const orgId = (organizationId || '').trim();
    if (!orgId) return;
    Taro.setStorageSync(CURRENT_ORG_ID_KEY, orgId);
  },

  setLastVisitedCampusId: (id: string) => {
    if (!id) return;
    Taro.setStorageSync(LAST_VISITED_CAMPUS_ID_KEY, id);
    set({ lastVisitedCampusId: id });
  },

  initCurrentCampus: (identityCampusIds) => {
    set((state) => {
      const allowedIds = identityCampusIds?.length ? identityCampusIds : state.allowedCampusIds;
      const storedId = Taro.getStorageSync(CURRENT_CAMPUS_ID_KEY) as string | undefined;
      const validStoredId = storedId && allowedIds.includes(storedId) ? storedId : undefined;
      const firstAllowedId = allowedIds[0] || '';
      const nextCurrentCampusId = validStoredId || firstAllowedId;

      if (nextCurrentCampusId) {
        Taro.setStorageSync(CURRENT_CAMPUS_ID_KEY, nextCurrentCampusId);
      }

      return {
        allowedCampusIds: allowedIds,
        currentCampusId: nextCurrentCampusId,
      };
    });
  },

  setAllowedCampusIds: (ids: string[]) => {
    set((state) => {
      const nextAllowedIds = ids;
      const nextCurrentCampusId =
        state.currentCampusId && nextAllowedIds.includes(state.currentCampusId)
          ? state.currentCampusId
          : nextAllowedIds[0] || '';

      if (nextCurrentCampusId) {
        Taro.setStorageSync(CURRENT_CAMPUS_ID_KEY, nextCurrentCampusId);
      }

      return {
        allowedCampusIds: nextAllowedIds,
        currentCampusId: nextCurrentCampusId,
      };
    });
  },

  fetchAll: async () => {
    set({ loading: true, error: null });
    try {
      const [campuses, salaryModels, payDaySettings, holidays, notifyGroups] = await Promise.all([
        campusService.getList(),
        salaryModelCampusService.getList(),
        payDaySettingsService.get(),
        holidayService.getList(),
        notifyService.getList(),
      ]);
      set({
        campuses,
        salaryModels,
        payDaySettings,
        holidays,
        notifyGroups,
        loading: false,
      });
    } catch (err) {
      logError('fetchAll campus', err);
      set({ loading: false, error: '校区设置加载失败，请重试' });
    }
  },
}));
