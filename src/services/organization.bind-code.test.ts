import Taro from '@tarojs/taro';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const postMock = vi.fn();

vi.mock('@/utils/request', () => ({
  get: vi.fn(),
  post: (...args: unknown[]) => postMock(...args),
  put: vi.fn(),
}));

describe('organizationService.bindByCode', () => {
  beforeEach(() => {
    vi.resetModules();
    postMock.mockReset();
    try {
      Taro.removeStorageSync('yunce-edu-auth-token');
    } catch {
      /* ignore */
    }
  });

  it('POST /organization/bind-code 并在返回 token 时持久化会话', async () => {
    postMock.mockResolvedValueOnce({
      kind: 'staff',
      organizationId: '11111111-1111-4111-8111-111111111111',
      campusId: '22222222-2222-4222-8222-222222222222',
      token: 'access-new',
      refreshToken: 'refresh-new',
      expiresIn: 7200,
    });

    const { organizationService } = await import('@/services/organization');
    const result = await organizationService.bindByCode('eabcdefghi');

    expect(postMock).toHaveBeenCalledWith('/organization/bind-code', {
      inviteCode: 'EABCDEFGHI',
    });
    expect(result.kind).toBe('staff');

    const raw = Taro.getStorageSync('yunce-edu-auth-token');
    const session = JSON.parse(String(raw));
    expect(session.access_token).toBe('access-new');
    expect(session.refresh_token).toBe('refresh-new');
  });

  it('学员路径不强制要求 token', async () => {
    postMock.mockResolvedValueOnce({
      kind: 'student',
      organizationId: '11111111-1111-4111-8111-111111111111',
      studentId: 'stu-1',
      studentName: '小明',
      studentParentId: 'sp-1',
    });

    const { organizationService } = await import('@/services/organization');
    const result = await organizationService.bindByCode('SABCDEFGHI');
    expect(result.kind).toBe('student');
    expect(result.studentParentId).toBe('sp-1');
  });
});
