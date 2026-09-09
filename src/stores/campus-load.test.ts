import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCampusStore } from '@/stores/campus';

const services = vi.hoisted(() => ({
  campusService: { getList: vi.fn() },
  salaryModelCampusService: { getList: vi.fn() },
  payDaySettingsService: { get: vi.fn() },
  holidayService: { getList: vi.fn() },
  notifyService: { getList: vi.fn() },
  subjectService: {},
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
});
