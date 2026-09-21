import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useStudentStore } from '@/stores/student';

const services = vi.hoisted(() => ({
  studentService: {
    getByTeacher: vi.fn(),
    getByParent: vi.fn(),
    getById: vi.fn(),
  },
}));

vi.mock('@/services/student', () => services);
vi.mock('@/utils/logger', () => ({ logError: vi.fn() }));

describe('学员列表加载', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useStudentStore.setState({ cache: {}, loading: {}, lastFetch: {} });
  });

  it('同一教师和校区的并发加载只发一个请求', async () => {
    let resolveRequest!: (value: Array<{ id: string }>) => void;
    services.studentService.getByTeacher.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );

    const first = useStudentStore.getState().fetchByTeacher('teacher-1', 'campus-1', true);
    const second = useStudentStore.getState().fetchByTeacher('teacher-1', 'campus-1', true);
    expect(services.studentService.getByTeacher).toHaveBeenCalledTimes(1);

    resolveRequest([{ id: 'student-1' }]);
    await Promise.all([first, second]);
  });

  it('同一家长的并发加载只发一个请求', async () => {
    let resolveRequest!: (value: Array<{ id: string }>) => void;
    services.studentService.getByParent.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );

    const first = useStudentStore.getState().fetchByParent('parent-1', true);
    const second = useStudentStore.getState().fetchByParent('parent-1', true);
    expect(services.studentService.getByParent).toHaveBeenCalledTimes(1);

    resolveRequest([{ id: 'student-1' }]);
    await Promise.all([first, second]);
  });
});
