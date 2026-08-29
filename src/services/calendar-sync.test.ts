import { beforeEach, describe, expect, it, vi } from 'vitest';
import dayjs from 'dayjs';
import Taro from '@tarojs/taro';
import {
  __resetCalendarSyncEventMapForTest,
  calendarSyncService,
  expandScheduleOccurrences,
} from '@/services/calendar-sync';
import {
  __resetCalendarSyncSettingsForTest,
  getCalendarSyncSettings,
  saveCalendarSyncSettings,
} from '@/utils/calendar-sync-settings';
import type { Schedule } from '@/types/schedule';
import type { TemporaryReschedule } from '@/types/temporary-reschedule';

vi.mock('@/services', () => ({
  classService: { getByTeacher: vi.fn().mockResolvedValue([]) },
  scheduleService: { getByTeacher: vi.fn().mockResolvedValue([]) },
  temporaryRescheduleService: {
    getByTeacherAndRange: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@/services/subscribe-message', () => ({
  subscribeMessageService: {
    runFlow: vi.fn().mockResolvedValue(undefined),
    requestAuthAndReport: vi.fn().mockResolvedValue(undefined),
  },
}));

const USER = 'calendar-sync-user';

const baseSchedule: Schedule = {
  id: 'sch-1',
  teacher_id: USER,
  class_id: 'class-1',
  day_of_week: 1,
  start_time: '09:00',
  end_time: '10:00',
  created_at: '',
  updated_at: '',
};

describe('expandScheduleOccurrences', () => {
  it('最多展开 7 天', () => {
    const start = dayjs('2026-08-24'); // 周一
    const occurrences = expandScheduleOccurrences(
      [{ ...baseSchedule, day_of_week: 1 }],
      [],
      { 'class-1': { name: '钢琴班' } },
      start,
      7,
    );
    expect(occurrences).toHaveLength(1);
  });

  it('超过 7 天的请求会被截断', () => {
    const start = dayjs('2026-08-24');
    const schedules: Schedule[] = [1, 2, 3, 4, 5, 6, 7].map((dow) => ({
      ...baseSchedule,
      id: `sch-${dow}`,
      day_of_week: dow as Schedule['day_of_week'],
    }));
    const occurrences = expandScheduleOccurrences(
      schedules,
      [],
      { 'class-1': { name: '钢琴班' } },
      start,
      14,
    );
    expect(occurrences).toHaveLength(7);
  });

  it('临时调课会覆盖当天 occurrence', () => {
    const start = dayjs('2026-08-25'); // 周二
    const tuesdaySchedule: Schedule = { ...baseSchedule, day_of_week: 2 };
    const reschedule: TemporaryReschedule = {
      id: 'tmp-1',
      teacher_id: USER,
      class_id: 'class-1',
      schedule_id: 'sch-tue',
      source_date: '2026-08-25',
      target_date: '2026-08-26',
      start_time: '14:00',
      end_time: '15:00',
      created_at: '',
      updated_at: '',
    };
    const schedules: Schedule[] = [
      tuesdaySchedule,
      { ...baseSchedule, id: 'sch-tue', day_of_week: 2 },
    ];
    const occurrences = expandScheduleOccurrences(
      schedules,
      [reschedule],
      { 'class-1': { name: '钢琴班' } },
      start,
      2,
    );
    const movedIn = occurrences.find((item) => item.date === '2026-08-26');
    expect(movedIn?.startTime).toBe('14:00');
    const movedOut = occurrences.find(
      (item) => item.date === '2026-08-25' && item.scheduleId === 'sch-tue',
    );
    expect(movedOut).toBeUndefined();
  });
});

describe('calendarSyncService.syncWeekAhead', () => {
  beforeEach(() => {
    __resetCalendarSyncSettingsForTest(USER);
    __resetCalendarSyncEventMapForTest();
    vi.spyOn(Taro, 'addPhoneCalendar').mockResolvedValue(undefined as never);
  });

  it('未开启时不写入日历', async () => {
    const result = await calendarSyncService.syncWeekAhead({
      userId: USER,
      teacherId: USER,
      schedules: [baseSchedule],
      classes: [{ id: 'class-1', name: '钢琴班' } as never],
      silent: true,
    });
    expect(result.added).toBe(0);
    expect(Taro.addPhoneCalendar).not.toHaveBeenCalled();
  });

  it('开启后会写入日历并记录窗口', async () => {
    saveCalendarSyncSettings(USER, { enabled: true });

    const monday = dayjs().startOf('week').add(1, 'day');
    const schedule: Schedule = {
      ...baseSchedule,
      day_of_week: (monday.day() || 7) as Schedule['day_of_week'],
    };

    const result = await calendarSyncService.syncWeekAhead({
      userId: USER,
      teacherId: USER,
      schedules: [schedule],
      classes: [{ id: 'class-1', name: '钢琴班' } as never],
      silent: true,
    });

    expect(result.added).toBeGreaterThanOrEqual(1);
    expect(Taro.addPhoneCalendar).toHaveBeenCalled();
    expect(getCalendarSyncSettings(USER).lastSyncedUntil).toBeTruthy();
  });
});

describe('calendarSyncService.maybePromptOnSchedulePage', () => {
  beforeEach(() => {
    __resetCalendarSyncSettingsForTest(USER);
    __resetCalendarSyncEventMapForTest();
  });

  it('用户点暂不后提示消息通知入口', async () => {
    vi.spyOn(Taro, 'showModal').mockResolvedValue({ confirm: false, cancel: true } as never);
    const showToastSpy = vi.spyOn(Taro, 'showToast');

    await calendarSyncService.maybePromptOnSchedulePage({
      userId: USER,
      teacherId: USER,
      role: 'teacher',
      scheduleCount: 3,
    });

    expect(showToastSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining('消息通知'),
      }),
    );
    const settings = getCalendarSyncSettings(USER);
    expect(settings.promptDismissed).toBe(true);
  });
});