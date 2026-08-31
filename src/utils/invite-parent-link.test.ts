import { beforeEach, describe, expect, it, vi } from 'vitest';
import { copyParentInviteLink } from './invite-parent-link';

const { setClipboardData, showToast, post } = vi.hoisted(() => ({
  setClipboardData: vi.fn().mockResolvedValue({}),
  showToast: vi.fn(),
  post: vi.fn(),
}));

vi.mock('@tarojs/taro', () => ({
  default: {
    setClipboardData,
    showToast,
  },
}));

vi.mock('@/utils/request', () => ({
  post,
  get: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
}));

describe('invite-parent-link', () => {
  beforeEach(() => {
    setClipboardData.mockClear();
    showToast.mockClear();
    post.mockReset();
    post.mockResolvedValue({
      token: 'server-token-abc',
      expiresAt: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
    });
  });

  it('复制学员邀请链接到剪贴板', async () => {
    await copyParentInviteLink('student-001');
    expect(post).toHaveBeenCalledWith('/students/student-001/parent-invite-links', {});
    expect(setClipboardData).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.stringContaining('student-001'),
      }),
    );
    expect(setClipboardData).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.stringContaining('server-token-abc'),
      }),
    );
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringContaining('48h') }),
    );
  });
});
