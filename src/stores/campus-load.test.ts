import Taro from '@tarojs/taro';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCampusStore } from '@/stores/campus';

const CAMPUS_SNAPSHOT_KEY = 'yunce_campus_list_snapshot';

const services = vi.hoisted(() => ({
  campusService: { getList: vi.fn() },
  salaryModelCampusService: { getList: vi.fn() },
  payDaySettingsService: { get: vi.fn() },
  holidayService: { getList: vi.fn() },
  notifyService: { getList: vi.fn() },
  subjectService: { getList: vi.fn() },
}));

vi.mock('@/services', () => services);
vi.mock('@/utils/logger', () => ({ logError: vi.fn() }));

describe('校区设置聚合加载', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useCampusStore.setState({ campuses: [], error: null, loading: false });
    services.campusService.getList.mockResolvedValue([
      { id: 'c1', name: '门店', businessHours: '10:00:00至18:00:00' },
    ]);
    services.salaryModelCampusService.getList.mockResolvedValue([]);
    services.payDaySettingsService.get.mockResolvedValue({ mode: 'fixed', fixedDay: 15 });
    services.holidayService.getList.mockResolvedValue([]);
    services.notifyService.getList.mockResolvedValue([]);
  });

  it('只依赖已有设置 API，营业时间从校区资料获得', async () => {
    await useCampusStore.getState().fetchAll();
    const state = useCampusStore.getState();
    expect(state.error).toBeNull();
    expect(state.loading).toBe(false);
    expect(state.campuses[0].businessHours).toBe('10:00:00至18:00:00');
  });

  it('真实接口失败仍保留失败状态，不伪造成功', async () => {
    services.campusService.getList.mockRejectedValue(new Error('网络异常'));
    await useCampusStore.getState().fetchAll();
    expect(useCampusStore.getState().error).toBe('校区设置加载失败，请重试');
    expect(useCampusStore.getState().loading).toBe(false);
  });

  it('fetchCampuses 成功后落校区快照，失败时保留旧快照（不把内存清空写成"无校区"）', async () => {
    await useCampusStore.getState().fetchCampuses(true);
    expect(JSON.parse(String(Taro.getStorageSync(CAMPUS_SNAPSHOT_KEY)))).toHaveLength(1);

    services.campusService.getList.mockRejectedValue(new Error('网络异常'));
    await useCampusStore.getState().fetchCampuses(true);
    expect(useCampusStore.getState().error).toBe('校区数据加载失败');
    expect(JSON.parse(String(Taro.getStorageSync(CAMPUS_SNAPSHOT_KEY)))).toHaveLength(1);
  });

  it('并发进入不同页面时共享同一个校区请求', async () => {
    let resolveRequest!: (value: Array<{ id: string; name: string }>) => void;
    services.campusService.getList.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );

    const first = useCampusStore.getState().fetchCampuses(true);
    const second = useCampusStore.getState().fetchCampuses(true);
    expect(services.campusService.getList).toHaveBeenCalledTimes(1);

    resolveRequest([{ id: 'c1', name: '门店' }]);
    await Promise.all([first, second]);
  });

  it('并发进入不同页面时共享同一个科目请求', async () => {
    let resolveRequest!: (value: Array<{ id: string; name: string }>) => void;
    services.subjectService.getList.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );

    const first = useCampusStore.getState().fetchSubjects(true);
    const second = useCampusStore.getState().fetchSubjects(true);
    expect(services.subjectService.getList).toHaveBeenCalledTimes(1);

    resolveRequest([{ id: 's1', name: '钢琴' }]);
    await Promise.all([first, second]);
  });

  it('清缓存（登出/切机构）会移除校区快照，避免下一账号先渲染上一家的校区', async () => {
    await useCampusStore.getState().fetchCampuses(true);
    expect(Taro.getStorageSync(CAMPUS_SNAPSHOT_KEY)).not.toBe('');

    useCampusStore.getState().invalidateCache();
    expect(Taro.getStorageSync(CAMPUS_SNAPSHOT_KEY)).toBe('');
  });

  it('清缓存后 fetchCampuses 不再被 TTL 短路，必然真正重拉（首页 staleTime=0 依赖此语义）', async () => {
    await useCampusStore.getState().fetchCampuses(true);
    expect(services.campusService.getList).toHaveBeenCalledTimes(1);

    // TTL 内重复调用被短路：稳态下不会多发网络
    await useCampusStore.getState().fetchCampuses();
    expect(services.campusService.getList).toHaveBeenCalledTimes(1);

    // invalidateCache 把 lastCampusesFetchAt 归零 → 下一次（即首页 queryFn）必须真的重拉，
    // 否则「清了内存 + 清了快照」之后首页会一直停在空列表
    useCampusStore.getState().invalidateCache();
    await useCampusStore.getState().fetchCampuses();
    expect(services.campusService.getList).toHaveBeenCalledTimes(2);
    expect(useCampusStore.getState().campuses).toHaveLength(1);
  });

  it('冷启动：本地有校区快照时 store 初始即有校区，首页不会先渲染「未设置校区」', async () => {
    vi.resetModules();
    const taro = (await import('@tarojs/taro')).default;
    taro.setStorageSync(
      CAMPUS_SNAPSHOT_KEY,
      JSON.stringify([{ id: 'c1', name: '松果总校', isMain: true }]),
    );

    const { useCampusStore: freshStore } = await import('@/stores/campus');
    expect(freshStore.getState().campuses.map((c) => c.name)).toEqual(['松果总校']);
  });
});
