import Taro from '@tarojs/taro';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addPhoneCalendarEvent,
  isPhoneCalendarAuthError,
  promptPhoneCalendarPermissionSetting,
} from '@/utils/phone-calendar';

describe('phone-calendar', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubEnv('TARO_ENV', 'weapp');
    (Taro as unknown as { openSetting: typeof Taro.openSetting }).openSetting = vi
      .fn()
      .mockResolvedValue({} as Taro.openSetting.SuccessCallbackResult);
  });

  it('isPhoneCalendarAuthError 识别权限类 errMsg', () => {
    expect(isPhoneCalendarAuthError({ errMsg: 'addPhoneCalendar:fail auth deny' })).toBe(true);
    expect(isPhoneCalendarAuthError(new Error('permission denied'))).toBe(true);
    expect(isPhoneCalendarAuthError({ errMsg: 'network error' })).toBe(false);
    expect(isPhoneCalendarAuthError({ errMsg: 'addPhoneCalendar:fail cancel' })).toBe(false);
    expect(isPhoneCalendarAuthError({ errMsg: 'addPhoneCalendar:fail' })).toBe(false);
  });

  it('addPhoneCalendarEvent 权限失败返回 auth_denied', async () => {
    vi.spyOn(Taro, 'addPhoneCalendar').mockRejectedValue({
      errMsg: 'addPhoneCalendar:fail auth deny',
    });

    const result = await addPhoneCalendarEvent({
      title: '钢琴课',
      startTime: 1_700_000_000,
      endTime: 1_700_000_360,
    });

    expect(result).toBe('auth_denied');
  });

  it('promptPhoneCalendarPermissionSetting 确认后调 openSetting', async () => {
    vi.spyOn(Taro, 'showModal').mockResolvedValue({ confirm: true, cancel: false } as never);
    const openSettingSpy = vi.spyOn(Taro, 'openSetting').mockResolvedValue({} as never);

    const opened = await promptPhoneCalendarPermissionSetting();

    expect(opened).toBe(true);
    expect(openSettingSpy).toHaveBeenCalled();
  });

  it('promptPhoneCalendarPermissionSetting 取消不打开设置', async () => {
    vi.spyOn(Taro, 'showModal').mockResolvedValue({ confirm: false, cancel: true } as never);
    const openSettingSpy = vi.spyOn(Taro, 'openSetting');

    const opened = await promptPhoneCalendarPermissionSetting();

    expect(opened).toBe(false);
    expect(openSettingSpy).not.toHaveBeenCalled();
  });
});
