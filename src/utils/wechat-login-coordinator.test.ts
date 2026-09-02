import Taro from '@tarojs/taro';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { wechatLogin } from '@/services/auth';
import { performWechatAuth, resetWechatLoginCoordinatorForTests } from './wechat-login-coordinator';

vi.mock('@tarojs/taro', () => ({
  default: {
    login: vi.fn(),
  },
}));

vi.mock('@/services/auth', () => ({
  wechatLogin: vi.fn(),
}));

const mockedTaroLogin = vi.mocked(Taro.login);
const mockedWechatLogin = vi.mocked(wechatLogin);

describe('wechat-login-coordinator', () => {
  beforeEach(() => {
    resetWechatLoginCoordinatorForTests();
    vi.clearAllMocks();
    mockedTaroLogin.mockResolvedValue({ code: 'wx-code-1', errMsg: 'login:ok' });
    mockedWechatLogin.mockResolvedValue({
      session: { access_token: 't' } as never,
      profile: null,
      error: null,
    });
  });

  it('并发 performWechatAuth 整链单飞（同一 Promise）', async () => {
    mockedWechatLogin.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve({
                session: { access_token: 't' } as never,
                profile: null,
                error: null,
              }),
            10,
          );
        }),
    );

    const p1 = performWechatAuth();
    const p2 = performWechatAuth();

    expect(p1).toBe(p2);

    await Promise.all([p1, p2]);

    expect(mockedTaroLogin).toHaveBeenCalledTimes(1);
    expect(mockedWechatLogin).toHaveBeenCalledTimes(1);
  });

  it('首次失败后重试可再次 login', async () => {
    mockedWechatLogin.mockRejectedValueOnce(new Error('network'));
    mockedWechatLogin.mockResolvedValueOnce({
      session: { access_token: 't2' } as never,
      profile: null,
      error: null,
    });

    await expect(performWechatAuth()).rejects.toThrow('network');
    await performWechatAuth();

    expect(mockedTaroLogin).toHaveBeenCalledTimes(2);
    expect(mockedWechatLogin).toHaveBeenCalledTimes(2);
  });

  it('透传 invite 选项到 wechatLogin', async () => {
    await performWechatAuth({ inviteCode: 'PABC12345', role: 'PARENT' });

    expect(mockedWechatLogin).toHaveBeenCalledWith('wx-code-1', {
      inviteCode: 'PABC12345',
      role: 'PARENT',
    });
  });
});
