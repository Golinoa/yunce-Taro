import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePackageTemplateStore } from '@/stores/package-template';

const services = vi.hoisted(() => ({
  packageTemplateService: { getByTeacher: vi.fn() },
}));

vi.mock('@/services', () => services);

describe('课包模板加载', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    usePackageTemplateStore.setState({ cache: {}, loading: {}, lastFetch: {} });
  });

  it('同一教师的并发加载只发一个请求', async () => {
    let resolveRequest!: (value: Array<{ id: string }>) => void;
    services.packageTemplateService.getByTeacher.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );

    const first = usePackageTemplateStore.getState().fetchByTeacher('teacher-1', true);
    const second = usePackageTemplateStore.getState().fetchByTeacher('teacher-1', true);
    expect(services.packageTemplateService.getByTeacher).toHaveBeenCalledTimes(1);

    resolveRequest([{ id: 'template-1' }]);
    await Promise.all([first, second]);
  });
});
