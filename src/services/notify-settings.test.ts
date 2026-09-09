import { beforeEach, describe, expect, it, vi } from 'vitest';
import { notifyService } from '@/services/campus';

const request = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));

vi.mock('@/utils/request', () => ({
  get: request.get,
  put: request.put,
  post: vi.fn(),
  del: vi.fn(),
}));

describe('通知设置读写', () => {
  beforeEach(() => vi.resetAllMocks());

  it('配置不存在时返回可读错误，不发送更新', async () => {
    request.get.mockResolvedValue([]);
    await expect(notifyService.toggle('removed-setting')).rejects.toThrow(
      '通知设置不存在，请刷新后重试',
    );
    expect(request.put).not.toHaveBeenCalled();
  });

  it('切换后展示后端重新读取的状态', async () => {
    const row = { id: 'n1', group: 'teacher', label: 'teacher-class-remind', enabled: false };
    request.get.mockResolvedValueOnce([row]).mockResolvedValueOnce([{ ...row, enabled: true }]);
    request.put.mockResolvedValue({});

    const groups = await notifyService.toggle('n1');

    expect(request.put).toHaveBeenCalledWith('/notify-settings/n1', { enabled: true });
    expect(groups[0].items[0].enabled).toBe(true);
    expect(request.get).toHaveBeenCalledTimes(2);
  });

  it('更新失败时抛出原错误，不返回假成功', async () => {
    request.get.mockResolvedValue([
      { id: 'n1', group: 'teacher', label: 'teacher-class-remind', enabled: false },
    ]);
    request.put.mockRejectedValue(new Error('保存失败'));
    await expect(notifyService.toggle('n1')).rejects.toThrow('保存失败');
    expect(request.get).toHaveBeenCalledTimes(1);
  });
});
