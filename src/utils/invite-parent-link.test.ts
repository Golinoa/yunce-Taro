import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildTeacherInvitePath,
  consumePendingInviteCode,
  consumeShareAttached,
  copyParentInviteLink,
  copyTeacherInviteLink,
  getPendingInviteCode,
  hasPendingInviteCode,
  markShareAttached,
  normalizeInviteCodeParam,
  PENDING_INVITE_CODE_KEY,
  storePendingInviteCode,
} from './invite-parent-link';

const {
  setClipboardData,
  showToast,
  post,
  setStorageSync,
  getStorageSync,
  removeStorageSync,
  parentShareCreate,
} = vi.hoisted(() => ({
  setClipboardData: vi.fn().mockResolvedValue({}),
  showToast: vi.fn(),
  post: vi.fn(),
  setStorageSync: vi.fn(),
  getStorageSync: vi.fn(),
  removeStorageSync: vi.fn(),
  parentShareCreate: vi.fn(),
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

vi.mock('@/services/parent-share-invite', () => ({
  parentShareInviteService: {
    create: parentShareCreate,
  },
}));

describe('invite-parent-link', () => {
  beforeEach(() => {
    setClipboardData.mockClear();
    showToast.mockClear();
    post.mockReset();
    setStorageSync.mockClear();
    getStorageSync.mockReset();
    removeStorageSync.mockClear();
    parentShareCreate.mockReset();
    parentShareCreate.mockResolvedValue({
      inviteCode: 'PABC12345',
      landingPath: '/package-auth/pages/invite-register/index?code=PABC12345',
    });
  });

  it('normalizeInviteCodeParam：trim/大写并剥 TEACHERCODE=/CODE= 前缀', () => {
    expect(normalizeInviteCodeParam('  ab-1  ')).toBe('AB-1');
    expect(normalizeInviteCodeParam('TEACHERCODE=xyz9')).toBe('XYZ9');
    expect(normalizeInviteCodeParam('code:abc')).toBe('ABC');
    expect(normalizeInviteCodeParam('')).toBe('');
  });

  it('buildTeacherInvitePath 指向 invite-register 直链（code 参数）', () => {
    expect(buildTeacherInvitePath('pabc-123')).toBe(
      '/package-auth/pages/invite-register/index?code=PABC-123',
    );
  });

  it('编码往返：特殊字符 encode/decode 一致', () => {
    const path = buildTeacherInvitePath('p@1/二');
    const encoded = path.split('code=')[1];
    expect(decodeURIComponent(encoded)).toBe('P@1/二');
  });

  it('copyTeacherInviteLink 先创建临时码再复制直链', async () => {
    await copyTeacherInviteLink();
    expect(parentShareCreate).toHaveBeenCalled();
    expect(setClipboardData).toHaveBeenCalledWith({
      data: '/package-auth/pages/invite-register/index?code=PABC12345',
    });
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringContaining('邀请链接已复制') }),
    );
  });

  it('copyTeacherInviteLink：无 landingPath/inviteCode → 失败 toast', async () => {
    parentShareCreate.mockResolvedValueOnce({});
    await copyTeacherInviteLink();
    expect(setClipboardData).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ title: '生成邀请链接失败' }));
  });

  it('copyTeacherInviteLink：create 抛错 → 失败 toast', async () => {
    parentShareCreate.mockRejectedValueOnce(new Error('network'));
    await copyTeacherInviteLink();
    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ title: '生成邀请链接失败' }));
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
