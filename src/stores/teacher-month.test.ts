import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  PendingPayAction,
  PendingSendAction,
  SalaryModel,
  SalaryTemplate,
  TeacherUIModel,
} from '@/types/teacher';

const services = vi.hoisted(() => ({
  getList: vi.fn(),
  getSalaryModels: vi.fn(),
  getSalaryTemplates: vi.fn(),
  getSettings: vi.fn(),
}));

vi.mock('@/services/teacher', () => ({
  teacherService: { getList: services.getList },
  salaryModelService: { getList: services.getSalaryModels },
  salaryTemplateService: { getList: services.getSalaryTemplates },
  salarySettingsService: { get: services.getSettings },
  teacherSalaryRuleService: {},
}));

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('教师月份加载竞态', () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    services.getSalaryModels.mockResolvedValue([]);
    services.getSalaryTemplates.mockResolvedValue([]);
    services.getSettings.mockResolvedValue({
      payDay: 10,
      pushDaysBefore: 3,
      autoConfirm: false,
      pushEnabled: true,
    });
    const { useTeacherStore } = await import('@/stores/teacher');
    useTeacherStore.setState({
      teachers: [],
      teachersMonth: '',
      salaryModels: [],
      salaryTemplates: [],
      settings: {
        payDay: 10,
        pushDaysBefore: 3,
        autoConfirm: false,
        pushEnabled: true,
      },
      lastTeachersFetchAt: {},
      lastMetaFetchAt: 0,
      salaryMonth: '2026-08',
      loading: false,
      error: null,
    });
  });

  it('忽略旧月份失败，不覆盖新月份结果或 error/loading', async () => {
    const oldRequest = deferred<unknown[]>();
    const newRequest = deferred<unknown[]>();
    services.getList
      .mockReturnValueOnce(oldRequest.promise)
      .mockReturnValueOnce(newRequest.promise);
    const { useTeacherStore } = await import('@/stores/teacher');
    const oldLoad = useTeacherStore.getState().fetchAll('2026-08', true);
    useTeacherStore.getState().setSalaryMonth('2026-09');
    const newLoad = useTeacherStore.getState().fetchAll('2026-09', true);

    newRequest.resolve([{ id: 'new-month' }]);
    await newLoad;
    oldRequest.reject(new Error('stale failure'));
    await oldLoad;

    expect(useTeacherStore.getState().teachers).toEqual([{ id: 'new-month' }]);
    expect(useTeacherStore.getState().teachersMonth).toBe('2026-09');
    expect(useTeacherStore.getState().error).toBeNull();
    expect(useTeacherStore.getState().loading).toBe(false);
  });

  it('清缓存后忽略在途请求，并清理不能跨机构保留的教师上下文', async () => {
    const oldRequest = deferred<unknown[]>();
    services.getList.mockReturnValueOnce(oldRequest.promise);
    const { useTeacherStore } = await import('@/stores/teacher');
    useTeacherStore.setState({
      teachers: [{ id: 'previous-org-teacher' } as TeacherUIModel],
      salaryModels: [{ id: 'previous-org-model' } as SalaryModel],
      salaryTemplates: [{ id: 'previous-org-template' } as SalaryTemplate],
      selectedIds: ['previous-org-teacher'],
      pendingPayAction: { type: 'single', ids: ['previous-org-teacher'] } as PendingPayAction,
      pendingSendAction: { type: 'single', ids: ['previous-org-teacher'] } as PendingSendAction,
    });
    const load = useTeacherStore.getState().fetchAll('2026-08', true);

    useTeacherStore.getState().invalidateCache();
    oldRequest.resolve([{ id: 'previous-org-teacher' }]);
    await load;

    const state = useTeacherStore.getState();
    expect(state.teachers).toEqual([]);
    expect(state.salaryModels).toEqual([]);
    expect(state.salaryTemplates).toEqual([]);
    expect(state.selectedIds).toEqual([]);
    expect(state.pendingPayAction).toBeNull();
    expect(state.pendingSendAction).toBeNull();
    expect(state.loading).toBe(false);
  });

  it('清缓存后忽略在途薪资模型响应', async () => {
    const oldRequest = deferred<SalaryModel[]>();
    services.getSalaryModels.mockReturnValueOnce(oldRequest.promise);
    const { useTeacherStore } = await import('@/stores/teacher');

    const load = useTeacherStore.getState().fetchSalaryModels(true);
    useTeacherStore.getState().invalidateCache();
    oldRequest.resolve([{ id: 'previous-org-model' } as SalaryModel]);
    await load;

    expect(useTeacherStore.getState().salaryModels).toEqual([]);
  });

  it('fetchTeachers 不取消 fetchAll，且旧聚合列表不会覆盖较新的列表结果', async () => {
    const aggregateList = deferred<unknown[]>();
    const directList = deferred<unknown[]>();
    services.getList
      .mockReturnValueOnce(aggregateList.promise)
      .mockReturnValueOnce(directList.promise);
    const { useTeacherStore } = await import('@/stores/teacher');

    const aggregateLoad = useTeacherStore.getState().fetchAll('2026-08', true);
    const directLoad = useTeacherStore.getState().fetchTeachers('2026-08', true);
    directList.resolve([{ id: 'newer-list' }]);
    await directLoad;

    expect(useTeacherStore.getState().teachers).toEqual([{ id: 'newer-list' }]);
    expect(useTeacherStore.getState().loading).toBe(true);

    aggregateList.resolve([{ id: 'older-list' }]);
    await aggregateLoad;

    expect(useTeacherStore.getState().teachers).toEqual([{ id: 'newer-list' }]);
    expect(useTeacherStore.getState().loading).toBe(false);
  });
});
