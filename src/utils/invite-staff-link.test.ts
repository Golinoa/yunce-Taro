import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildCampusInvitePath,
  copyCampusInviteLink,
  PENDING_CAMPUS_INVITE_CODE_KEY,
  storePendingCampusInviteCode,
  getPendingCampusInviteCode,
  hasPendingCampusInviteCode,
  consumePendingCampusInviteCode,
} from './invite-staff-link';

const { setClipboardData, showToast, setStorageSync, getStorageSync, removeStorageSync } =
  vi.hoisted(() => ({
    setClipboardData: vi.fn().mockResolvedValue({}),
    showToast: vi.fn(),
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

describe('invite-staff-link (B0-1 L3 直链)', () => {
  beforeEach(() => {
    setClipboardData.mockClear();
    showToast.mockClear();
    setStorageSync.mockClear();
    getStorageSync.mockReset();
    removeStorageSync.mockClear();
  });

  it('buildCampusInvitePath 指向 campus-invite-landing 直链', () => {
    expect(buildCampusInvitePath('eabc12345')).toBe(
      '/package-auth/pages/campus-invite-landing/index?code=EABC12345',
    );
  });

  it('copyCampusInviteLink 复制落地页直链（不含 index?redirect=）', async () => {
    await copyCampusInviteLink('EABC12345');
    expect(setClipboardData).toHaveBeenCalledWith({
      data: '/package-auth/pages/campus-invite-landing/index?code=EABC12345',
    });
    const copied = setClipboardData.mock.calls[0][0].data as string;
    expect(copied).not.toContain('redirect=');
    expect(copied).not.toContain('pages/index/index');
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringContaining('员工邀请链接已复制') }),
    );
  });

  it('copyCampusInviteLink 空码提示异常', async () => {
    await copyCampusInviteLink('  ');
    expect(setClipboardData).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ title: '邀请码异常' }));
  });

  it('pending campus invite code 存取与消费', () => {
    const store = new Map<string, string>();
    setStorageSync.mockImplementation((k: string, v: string) => {
      store.set(k, v);
    });
    getStorageSync.mockImplementation((k: string) => store.get(k) ?? '');
    removeStorageSync.mockImplementation((k: string) => {
      store.delete(k);
    });

    storePendingCampusInviteCode('eTest01');
    expect(hasPendingCampusInviteCode()).toBe(true);
    expect(getPendingCampusInviteCode()).toBe('ETEST01');
    expect(store.get(PENDING_CAMPUS_INVITE_CODE_KEY)).toBe('ETEST01');
    expect(consumePendingCampusInviteCode()).toBe('ETEST01');
    expect(hasPendingCampusInviteCode()).toBe(false);
  });

  it('缺参：空码不写 storage；consume 空串', () => {
    storePendingCampusInviteCode('   ');
    expect(setStorageSync).not.toHaveBeenCalled();
    getStorageSync.mockReturnValue('');
    expect(consumePendingCampusInviteCode()).toBe('');
    expect(removeStorageSync).not.toHaveBeenCalled();
  });

  it('编码往返：特殊字符经 encodeURIComponent 进 path，大写规范化', () => {
    const path = buildCampusInvitePath('e@b c/1');
    expect(path).toContain('code=');
    const encoded = path.split('code=')[1];
    expect(decodeURIComponent(encoded)).toBe('E@B C/1');
  });

  it('storage 异常时 get 回落空串；set 静默失败', () => {
    getStorageSync.mockImplementation(() => {
      throw new Error('storage');
    });
    expect(getPendingCampusInviteCode()).toBe('');
    setStorageSync.mockImplementation(() => {
      throw new Error('storage');
    });
    expect(() => storePendingCampusInviteCode('EABC')).not.toThrow();
  });
});
