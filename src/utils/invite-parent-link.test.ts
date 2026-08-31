import { beforeEach, describe, expect, it, vi } from 'vitest';
import { copyParentInviteLink } from './invite-parent-link';

const { setClipboardData, showToast } = vi.hoisted(() => ({
  setClipboardData: vi.fn().mockResolvedValue({}),
  showToast: vi.fn(),
}));

vi.mock('@tarojs/taro', () => ({
  default: {
    setClipboardData,
    showToast,
  },
}));

describe('invite-parent-link', () => {
  beforeEach(() => {
    setClipboardData.mockClear();
    showToast.mockClear();
  });

  it('复制学员邀请链接到剪贴板', async () => {
    await copyParentInviteLink('student-001');
    expect(setClipboardData).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.stringContaining('student-001'),
      }),
    );
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: '邀请链接已复制，请发送给家长' }),
    );
  });
});
