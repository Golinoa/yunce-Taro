import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  consumePendingInviteCode,
  consumeShareAttached,
  copyParentInviteLink,
  getPendingInviteCode,
  hasPendingInviteCode,
  markShareAttached,
  normalizeInviteCodeParam,
  PENDING_INVITE_CODE_KEY,
  storePendingInviteCode,
} from './invite-parent-link';

const { setClipboardData, showToast, post, setStorageSync, getStorageSync, removeStorageSync } =
  vi.hoisted(() => ({
    setClipboardData: vi.fn().mockResolvedValue({}),
    showToast: vi.fn(),
    post: vi.fn(),
    setStorageSync: vi.fn(),
    getStorageSync: vi.fn(),
    removeStorageSync: vi.fn(),
  }));

vi.mock('@tarojs/taro', () => ({
  default: {
    setClipboardData,
    showToast,
    setStorageSync,
    getStorageSync,
    removeStorageSync,
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
    setStorageSync.mockClear();
    getStorageSync.mockReset();
    removeStorageSync.mockClear();
  });

  it('normalizeInviteCodeParam：trim/大写并剥 TEACHERCODE=/CODE= 前缀', () => {
    expect(normalizeInviteCodeParam('  ab-1  ')).toBe('AB-1');
    expect(normalizeInviteCodeParam('TEACHERCODE=xyz9')).toBe('XYZ9');
    expect(normalizeInviteCodeParam('code:abc')).toBe('ABC');
    expect(normalizeInviteCodeParam('')).toBe('');
  });

  it('copyParentInviteLink 复制家长绑定链接', async () => {
    post.mockResolvedValueOnce({
      token: 'server-token-abc',
      expiresAt: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
    });
    await copyParentInviteLink('student-1');
    expect(post).toHaveBeenCalledWith('/students/student-1/parent-invite-links', {});
    expect(setClipboardData).toHaveBeenCalledWith({
      data: expect.stringContaining('parent-bind'),
    });
    const copied = setClipboardData.mock.calls[0][0].data as string;
    expect(copied).toContain('token=server-token-abc');
    expect(copied).toContain('studentId=student-1');
  });

  it('copyParentInviteLink 缺参 / 无 token / 抛错', async () => {
    await copyParentInviteLink('');
    expect(post).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ title: '学员信息异常' }));

    showToast.mockClear();
    post.mockResolvedValueOnce({});
    await copyParentInviteLink('s1');
    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ title: '生成邀请链接失败' }));

    showToast.mockClear();
    post.mockRejectedValueOnce(new Error('fail'));
    await copyParentInviteLink('s1');
    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ title: '生成邀请链接失败' }));
  });

  it('pending invite code / shareAttached 存取与消费', () => {
    const store = new Map<string, string>();
    setStorageSync.mockImplementation((k: string, v: string) => {
      store.set(k, v);
    });
    getStorageSync.mockImplementation((k: string) => store.get(k) ?? '');
    removeStorageSync.mockImplementation((k: string) => {
      store.delete(k);
    });

    storePendingInviteCode('  ');
    expect(setStorageSync).not.toHaveBeenCalled();

    storePendingInviteCode('ab12');
    expect(hasPendingInviteCode()).toBe(true);
    expect(getPendingInviteCode()).toBe('AB12');
    expect(store.get(PENDING_INVITE_CODE_KEY)).toBe('AB12');
    expect(consumePendingInviteCode()).toBe('AB12');
    expect(hasPendingInviteCode()).toBe(false);

    markShareAttached();
    expect(consumeShareAttached()).toBe(true);
    expect(consumeShareAttached()).toBe(false);
  });
});
