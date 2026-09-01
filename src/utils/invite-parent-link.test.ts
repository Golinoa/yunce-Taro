import { beforeEach, describe, expect, it, vi } from 'vitest';
import { copyParentInviteLink, copyTeacherInviteLink, buildTeacherInvitePath } from './invite-parent-link';

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
      inviteCode: 'PABC12345',
      landingPath: '/package-auth/pages/invite-register/index?code=PABC12345',
    });
  });

  it('buildTeacherInvitePath 指向 invite-register 直链（code 参数）', () => {
    expect(buildTeacherInvitePath('pabc-123')).toBe(
      '/package-auth/pages/invite-register/index?code=PABC-123',
    );
  });

  it('copyTeacherInviteLink 先创建临时码再复制直链', async () => {
    await copyTeacherInviteLink();
    expect(post).toHaveBeenCalledWith('/teachers/me/parent-share-invites', {});
    expect(setClipboardData).toHaveBeenCalledWith({
      data: '/package-auth/pages/invite-register/index?code=PABC12345',
    });
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringContaining('邀请链接已复制') }),
    );
  });

  it('copyParentInviteLink 复制家长绑定链接', async () => {
    post.mockResolvedValueOnce({
      token: 'server-token-abc',
      expiresAt: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
    });
    await copyParentInviteLink('student-1');
    expect(setClipboardData).toHaveBeenCalledWith({
      data: expect.stringContaining('parent-bind'),
    });
  });
});
