import { beforeEach, describe, expect, it, vi } from 'vitest';

const request = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));

vi.mock('@/utils/request', () => ({
  get: request.get,
  post: request.post,
  put: vi.fn(),
  del: vi.fn(),
}));

describe('工资操作月份与副作用', () => {
  beforeEach(() => vi.resetAllMocks());

  it('发送工资条缺少月份记录时明确失败且不调用接口', async () => {
    request.get.mockResolvedValue({ salaryRecord: null });
    const { teacherService } = await import('@/services/teacher');
    const result = await teacherService.sendSalarySlip(['t1'], '备注', '2026-08');
    expect(result.success).toEqual([]);
    expect(result.failed[0]?.reason).toContain('不存在');
    expect(request.post).not.toHaveBeenCalled();
  });

  it('确认工资按所选月份读取工资记录', async () => {
    request.get.mockResolvedValue({ salaryRecord: { id: 'sr-aug' } });
    request.post.mockResolvedValue({});
    const { teacherService } = await import('@/services/teacher');
    await expect(teacherService.confirmSalary('t1', '2026-08')).resolves.toBe(true);
    expect(request.get).toHaveBeenCalledWith('/teachers/t1', { month: '2026-08' });
    expect(request.post).toHaveBeenCalledWith('/teachers/salary/sr-aug/confirm');
  });

  it('批量操作遇到缺失月份记录时不静默过滤或调用接口', async () => {
    request.get
      .mockResolvedValueOnce({ salaryRecord: { id: 'sr-aug' } })
      .mockResolvedValueOnce({ salaryRecord: null });
    const { teacherService } = await import('@/services/teacher');
    await expect(teacherService.batchConfirm(['t1', 't2'], '2026-08')).resolves.toBe(false);
    expect(request.post).not.toHaveBeenCalled();
  });
});
