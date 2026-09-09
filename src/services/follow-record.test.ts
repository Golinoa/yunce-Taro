import { beforeEach, describe, expect, it, vi } from 'vitest';

const request = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn() }));
vi.mock('@/utils/request', () => request);

describe('followRecordService', () => {
  beforeEach(() => vi.resetAllMocks());

  it('loads student records and maps operator/date fields', async () => {
    request.get.mockResolvedValue([
      {
        id: 'follow-1',
        studentId: 'student-1',
        content: '已沟通',
        operatorName: '老师',
        createdAt: '2026-09-10T00:00:00.000Z',
      },
    ]);
    const { followRecordService } = await import('@/services/follow-record');
    await expect(followRecordService.getByStudent('student-1')).resolves.toEqual([
      expect.objectContaining({ id: 'follow-1', operatorName: '老师' }),
    ]);
    expect(request.get).toHaveBeenCalledWith('/students/student-1/follow-records');
  });

  it('writes only fields accepted by the backend validator', async () => {
    request.post.mockResolvedValue({ id: 'follow-1', studentId: 'student-1', content: '记录' });
    request.put.mockResolvedValue({ id: 'follow-1', studentId: 'student-1', content: '更新' });
    const { followRecordService } = await import('@/services/follow-record');
    await followRecordService.create({
      studentId: 'student-1',
      content: '记录',
      operatorName: '本地名',
    });
    await followRecordService.update('follow-1', { content: '更新', operatorName: '本地名' });
    expect(request.post).toHaveBeenCalledWith('/follow-records', {
      studentId: 'student-1',
      content: '记录',
    });
    expect(request.put).toHaveBeenCalledWith('/follow-records/follow-1', { content: '更新' });
  });
});
