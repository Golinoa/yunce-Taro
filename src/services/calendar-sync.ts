/**
 * 课表 → 手机日历同步
 * 每次最多同步未来 7 天内的课程 occurrence。
 */
import Taro from '@tarojs/taro';
import dayjs from 'dayjs';
import { classService, scheduleService, temporaryRescheduleService } from '@/services';
import { subscribeMessageService } from '@/services/subscribe-message';
import type { Class } from '@/types/class';
import type { Schedule } from '@/types/schedule';
import type { TemporaryReschedule } from '@/types/temporary-reschedule';
import type { UserRole } from '@/types/profile';
import {
  CALENDAR_SYNC_MAX_DAYS,
  canUseCalendarSync,
  getCalendarSyncSettings,
  isCalendarSyncEnabled,
  markCalendarSyncAuthCompleted,
  markCalendarSyncCompleted,
  markCalendarSyncPromptDismissed,
  markCalendarSyncPromptShown,
  needsCalendarResync,
  saveCalendarSyncSettings,
  setCalendarSyncEnabled,
  shouldShowCalendarSyncPrompt,
} from '@/utils/calendar-sync-settings';
import { logError } from '@/utils/logger';
import { addPhoneCalendarEvent, isAddPhoneCalendarSupported } from '@/utils/phone-calendar';
import { post } from '@/utils/request';

const USE_MOCK =
  typeof process !== 'undefined' && typeof process.env !== 'undefined'
    ? process.env.VITE_USE_MOCK !== 'false'
    : true;

const EVENT_MAP_STORAGE_KEY = 'yunce:calendar-sync-event-map';

let promptInFlight = false;

export interface CalendarOccurrence {
  scheduleId: string;
  date: string;
  startTime: string;
  endTime: string;
  title: string;
  location?: string;
  description?: string;
  reminderMinutes?: number;
}

export interface CalendarSyncWeekResult {
  added: number;
  skipped: number;
  failed: number;
  windowStart: string;
  windowEnd: string;
}

interface SyncedEventRecord {
  fingerprint: string;
  syncedAt: string;
}

type EventMap = Record<string, SyncedEventRecord>;

function eventMapKey(userId: string, scheduleId: string, date: string): string {
  return `${userId}:${scheduleId}:${date}`;
}

function buildOccurrenceFingerprint(occ: CalendarOccurrence): string {
  return `${occ.startTime}|${occ.endTime}|${occ.title}|${occ.location ?? ''}`;
}

function toUnixSeconds(dateStr: string, timeHHmm: string): number {
  const [hour, minute] = timeHHmm.split(':').map((part) => Number(part));
  return dayjs(dateStr).hour(hour).minute(minute).second(0).millisecond(0).unix();
}

function getSyncWindowStart(fromDate = dayjs()): dayjs.Dayjs {
  return fromDate.startOf('day');
}

function getSyncWindowEnd(fromDate = dayjs()): dayjs.Dayjs {
  return getSyncWindowStart(fromDate).add(CALENDAR_SYNC_MAX_DAYS - 1, 'day');
}

function readEventMap(): EventMap {
  try {
    const stored = Taro.getStorageSync(EVENT_MAP_STORAGE_KEY) as EventMap | undefined;
    return stored && typeof stored === 'object' ? stored : {};
  } catch {
    return {};
  }
}

function writeEventMap(map: EventMap): void {
  try {
    Taro.setStorageSync(EVENT_MAP_STORAGE_KEY, map);
  } catch {
    /* 静默 */
  }
}

export function expandScheduleOccurrences(
  schedules: Schedule[],
  temporaryReschedules: TemporaryReschedule[],
  classById: Record<string, Pick<Class, 'name' | 'room'>>,
  startDate: dayjs.Dayjs = dayjs(),
  maxDays: number = CALENDAR_SYNC_MAX_DAYS,
): CalendarOccurrence[] {
  const cappedDays = Math.min(Math.max(maxDays, 1), CALENDAR_SYNC_MAX_DAYS);
  const scheduleById = schedules.reduce<Record<string, Schedule>>((acc, item) => {
    acc[item.id] = item;
    return acc;
  }, {});
  const occurrences: CalendarOccurrence[] = [];

  for (let offset = 0; offset < cappedDays; offset += 1) {
    const date = startDate.startOf('day').add(offset, 'day');
    const dateStr = date.format('YYYY-MM-DD');
    const weekday = (date.day() || 7) as Schedule['day_of_week'];

    const movedOutScheduleIdSet = new Set(
      temporaryReschedules
        .filter((item) => item.source_date === dateStr)
        .map((item) => item.schedule_id),
    );

    const movedInSchedules = temporaryReschedules
      .filter((item) => item.target_date === dateStr)
      .reduce<Schedule[]>((acc, item) => {
        const originalSchedule = scheduleById[item.schedule_id];
        if (!originalSchedule) {
          return acc;
        }
        acc.push({
          ...originalSchedule,
          start_time: item.start_time,
          end_time: item.end_time,
          class_id: item.class_id,
          day_of_week: weekday,
          updated_at: item.updated_at,
        });
        return acc;
      }, []);

    const visibleSchedules = [
      ...schedules
        .filter((schedule) => schedule.day_of_week === weekday)
        .filter((schedule) => !movedOutScheduleIdSet.has(schedule.id)),
      ...movedInSchedules,
    ];

    visibleSchedules.forEach((schedule) => {
      const classInfo = schedule.class_id ? classById[schedule.class_id] : undefined;
      const className =
        classInfo?.name || schedule.class_info?.name || schedule.student?.name || schedule.note || '课程';
      const title = schedule.student?.name && !schedule.class_id ? `${className} 私教` : className;
      occurrences.push({
        scheduleId: schedule.id,
        date: dateStr,
        startTime: schedule.start_time,
        endTime: schedule.end_time,
        title,
        location: schedule.room || classInfo?.room,
        description: schedule.note,
        reminderMinutes: schedule.reminder_minutes,
      });
    });
  }

  return occurrences.sort((left, right) => {
    if (left.date !== right.date) {
      return left.date.localeCompare(right.date);
    }
    return left.startTime.localeCompare(right.startTime);
  });
}

async function reportCalendarSync(
  action: 'add' | 'change',
  items: Array<{
    scheduleId: string;
    title: string;
    start: string;
    end: string;
    location?: string;
  }>,
): Promise<void> {
  if (items.length === 0) {
    return;
  }
  if (USE_MOCK) {
    return;
  }
  try {
    await post('/calendar-sync/report', { action, items });
  } catch (error) {
    logError('calendarSync.report', error);
  }
}

export const calendarSyncService = {
  expandScheduleOccurrences,

  async syncWeekAhead(params: {
    userId: string;
    teacherId: string;
    campusId?: string;
    schedules?: Schedule[];
    temporaryReschedules?: TemporaryReschedule[];
    classes?: Class[];
    silent?: boolean;
  }): Promise<CalendarSyncWeekResult> {
    const windowStart = getSyncWindowStart();
    const windowEnd = getSyncWindowEnd();
    const emptyResult: CalendarSyncWeekResult = {
      added: 0,
      skipped: 0,
      failed: 0,
      windowStart: windowStart.format('YYYY-MM-DD'),
      windowEnd: windowEnd.format('YYYY-MM-DD'),
    };

    if (!params.userId || !isCalendarSyncEnabled(params.userId)) {
      return emptyResult;
    }

    if (!isAddPhoneCalendarSupported()) {
      if (!params.silent) {
        Taro.showToast({ title: '当前环境不支持写入日历', icon: 'none' });
      }
      return emptyResult;
    }

    let schedules = params.schedules;
    let temporaryReschedules = params.temporaryReschedules;
    let classes = params.classes;

    try {
      if (!schedules) {
        schedules = await scheduleService.getByTeacher(params.teacherId, params.campusId);
      }
      if (!temporaryReschedules) {
        temporaryReschedules = await temporaryRescheduleService.getByTeacherAndRange(
          params.teacherId,
          windowStart.format('YYYY-MM-DD'),
          windowEnd.format('YYYY-MM-DD'),
        );
      }
      if (!classes) {
        classes = await classService.getByTeacher(params.teacherId, params.campusId);
      }
    } catch (error) {
      logError('calendarSync.loadData', error);
      if (!params.silent) {
        Taro.showToast({ title: '课表加载失败', icon: 'none' });
      }
      return emptyResult;
    }

    const classById = (classes || []).reduce<Record<string, Pick<Class, 'name' | 'room'>>>(
      (acc, item) => {
        acc[item.id] = { name: item.name, room: item.room };
        return acc;
      },
      {},
    );

    const occurrences = expandScheduleOccurrences(
      schedules,
      temporaryReschedules,
      classById,
      windowStart,
      CALENDAR_SYNC_MAX_DAYS,
    );

    const eventMap = readEventMap();
    let added = 0;
    let skipped = 0;
    let failed = 0;
    const reportItems: Array<{
      scheduleId: string;
      title: string;
      start: string;
      end: string;
      location?: string;
    }> = [];

    for (const occurrence of occurrences) {
      const mapKey = eventMapKey(params.userId, occurrence.scheduleId, occurrence.date);
      const fingerprint = buildOccurrenceFingerprint(occurrence);
      if (eventMap[mapKey]?.fingerprint === fingerprint) {
        skipped += 1;
        continue;
      }

      const ok = await addPhoneCalendarEvent({
        title: occurrence.title,
        startTime: toUnixSeconds(occurrence.date, occurrence.startTime),
        endTime: toUnixSeconds(occurrence.date, occurrence.endTime),
        location: occurrence.location,
        description: occurrence.description,
        alarmOffset: (occurrence.reminderMinutes ?? 15) * 60,
      });

      if (ok) {
        added += 1;
        eventMap[mapKey] = { fingerprint, syncedAt: new Date().toISOString() };
        reportItems.push({
          scheduleId: occurrence.scheduleId,
          title: occurrence.title,
          start: `${occurrence.date}T${occurrence.startTime}:00`,
          end: `${occurrence.date}T${occurrence.endTime}:00`,
          location: occurrence.location,
        });
      } else {
        failed += 1;
      }
    }

    writeEventMap(eventMap);

    if (added > 0) {
      markCalendarSyncCompleted(params.userId, windowEnd.format('YYYY-MM-DD'));
      await reportCalendarSync('add', reportItems);
      if (!params.silent) {
        Taro.showToast({ title: `已同步 ${added} 节课到日历`, icon: 'none' });
      }
    } else if (!params.silent && failed > 0) {
      Taro.showToast({ title: '部分课程未能写入日历', icon: 'none' });
    }

    return { added, skipped, failed, windowStart: emptyResult.windowStart, windowEnd: emptyResult.windowEnd };
  },

  async enableAndSync(params: {
    userId: string;
    teacherId: string;
    role?: UserRole;
    campusId?: string;
    /** 跳过 E19 文案弹框，直接调起微信订阅面板（课表页已确认时使用） */
    directAuth?: boolean;
  }): Promise<CalendarSyncWeekResult> {
    const settings = getCalendarSyncSettings(params.userId);
    if (!settings.authCompleted) {
      try {
        if (params.directAuth) {
          await subscribeMessageService.requestAuthAndReport(
            ['calendar_add', 'calendar_change'],
            'calendar_sync_enable',
            { role: params.role, campusId: params.campusId },
          );
        } else {
          await subscribeMessageService.runFlow('E19', {
            role: params.role,
            campusId: params.campusId,
          });
        }
        markCalendarSyncAuthCompleted(params.userId);
      } catch (error) {
        logError('calendarSync.enableAndSync.auth', error);
      }
    }

    setCalendarSyncEnabled(params.userId, true);

    return this.syncWeekAhead({
      userId: params.userId,
      teacherId: params.teacherId,
      campusId: params.campusId,
    });
  },

  async syncAfterScheduleChange(params: {
    userId: string;
    teacherId: string;
    campusId?: string;
    role?: UserRole;
  }): Promise<void> {
    if (!isCalendarSyncEnabled(params.userId)) {
      return;
    }
    try {
      const result = await this.syncWeekAhead({
        userId: params.userId,
        teacherId: params.teacherId,
        campusId: params.campusId,
        silent: true,
      });
      if (result.added > 0) {
        await reportCalendarSync(
          'change',
          result.added > 0
            ? [
                {
                  scheduleId: 'batch',
                  title: '课表已更新',
                  start: result.windowStart,
                  end: result.windowEnd,
                },
              ]
            : [],
        );
      }
    } catch (error) {
      logError('calendarSync.syncAfterScheduleChange', error);
    }
  },

  async maybePromptOnSchedulePage(params: {
    userId: string;
    teacherId: string;
    role?: UserRole;
    campusId?: string;
    scheduleCount: number;
  }): Promise<void> {
    if (!params.userId || !canUseCalendarSync(params.role) || promptInFlight) {
      return;
    }

    const today = dayjs().format('YYYY-MM-DD');
    const windowEnd = getSyncWindowEnd().format('YYYY-MM-DD');

    if (isCalendarSyncEnabled(params.userId)) {
      if (needsCalendarResync(params.userId, windowEnd)) {
        void this.syncWeekAhead({
          userId: params.userId,
          teacherId: params.teacherId,
          campusId: params.campusId,
          silent: true,
        });
      }
      return;
    }

    if (params.scheduleCount <= 0 || !shouldShowCalendarSyncPrompt(params.userId, today)) {
      return;
    }

    promptInFlight = true;
    markCalendarSyncPromptShown(params.userId, today);

    try {
      const res = await Taro.showModal({
        title: '同步到手机日历',
        content: '开启后，将自动把未来一周课表写入手机日历，上课前可在系统日历收到提醒。',
        confirmText: '开启同步',
        cancelText: '暂不',
      });

      if (res.confirm) {
        await this.enableAndSync({
          userId: params.userId,
          teacherId: params.teacherId,
          role: params.role,
          campusId: params.campusId,
          directAuth: true,
        });
        return;
      }

      markCalendarSyncPromptDismissed(params.userId);
      Taro.showToast({
        title: '可在「我的 → 系统设置」中开启课表同步',
        icon: 'none',
        duration: 3000,
      });
    } finally {
      promptInFlight = false;
    }
  },

  disable(userId: string): void {
    saveCalendarSyncSettings(userId, { enabled: false });
  },
};

export function __resetCalendarSyncEventMapForTest(): void {
  try {
    Taro.removeStorageSync(EVENT_MAP_STORAGE_KEY);
  } catch {
    /* 静默 */
  }
  promptInFlight = false;
}
