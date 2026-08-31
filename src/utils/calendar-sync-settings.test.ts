import Taro from '@tarojs/taro';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  __resetCalendarSyncSettingsForTest,
  CALENDAR_SYNC_MAX_DAYS,
  canUseCalendarSync,
  getCalendarSyncSettings,
  isCalendarSyncEnabled,
  markCalendarSyncPromptDismissed,
  needsCalendarResync,
  saveCalendarSyncSettings,
  shouldShowCalendarSyncPrompt,
} from '@/utils/calendar-sync-settings';

const USER = 'calendar-settings-user';

describe('calendar-sync-settings', () => {
  beforeEach(() => {
    __resetCalendarSyncSettingsForTest(USER);
  });

  it('默认关闭同步', () => {
    expect(getCalendarSyncSettings(USER).enabled).toBe(false);
    expect(isCalendarSyncEnabled(USER)).toBe(false);
  });

  it('开启后可读取', () => {
    saveCalendarSyncSettings(USER, { enabled: true });
    expect(isCalendarSyncEnabled(USER)).toBe(true);
  });

  it('拒绝弹窗后不再提示', () => {
    markCalendarSyncPromptDismissed(USER);
    expect(shouldShowCalendarSyncPrompt(USER, '2026-08-27')).toBe(false);
  });

  it('同一天只弹一次', () => {
    saveCalendarSyncSettings(USER, { lastPromptDate: '2026-08-27' });
    expect(shouldShowCalendarSyncPrompt(USER, '2026-08-27')).toBe(false);
    expect(shouldShowCalendarSyncPrompt(USER, '2026-08-28')).toBe(true);
  });

  it('同步窗口未覆盖时需要重同步', () => {
    saveCalendarSyncSettings(USER, {
      enabled: true,
      lastSyncedUntil: '2026-08-30',
    });
    expect(needsCalendarResync(USER, '2026-09-02')).toBe(true);
    expect(needsCalendarResync(USER, '2026-08-30')).toBe(false);
  });

  it('最多同步天数为 7', () => {
    expect(CALENDAR_SYNC_MAX_DAYS).toBe(7);
  });

  it('canUseCalendarSync 含校长与任课角色', () => {
    expect(canUseCalendarSync('teacher')).toBe(true);
    expect(canUseCalendarSync('assistant')).toBe(true);
    expect(canUseCalendarSync('principal')).toBe(true);
    expect(canUseCalendarSync('admin')).toBe(false);
    expect(canUseCalendarSync('parent')).toBe(false);
  });
});

describe('calendar-sync-settings reset', () => {
  it('__resetCalendarSyncSettingsForTest 清除指定用户', () => {
    saveCalendarSyncSettings(USER, { enabled: true });
    __resetCalendarSyncSettingsForTest(USER);
    expect(Taro.getStorageSync(`yunce:calendar-sync:${USER}`)).toBe('');
  });
});
