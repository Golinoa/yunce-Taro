/**
 * 课表卡片操作可见性测试（Q2-1）
 */
import dayjs from 'dayjs';
import { describe, expect, it } from 'vitest';
import {
  getCardActionVisibility,
  isHistoricalClassCard,
  isPastScheduleDate,
  isUpcomingClassCard,
  shouldShowCancelLessonAction,
} from '@/utils/schedule-card-actions';

const NOW = dayjs('2026-09-02T10:00:00');

describe('isPastScheduleDate', () => {
  it('过去日期为 true，当日/未来为 false', () => {
    expect(isPastScheduleDate(NOW.subtract(1, 'day'), NOW)).toBe(true);
    expect(isPastScheduleDate(NOW, NOW)).toBe(false);
    expect(isPastScheduleDate(NOW.add(1, 'day'), NOW)).toBe(false);
  });
});

describe('shouldShowCancelLessonAction', () => {
  const base = { canCancelLesson: true, status: 'upcoming' as const, startTime: '14:00' };

  it('未点名且非过去日可取消', () => {
    expect(shouldShowCancelLessonAction(base, NOW, NOW)).toBe(true);
  });

  it('已取消/已完成不可取消', () => {
    expect(shouldShowCancelLessonAction({ ...base, status: 'cancelled' }, NOW, NOW)).toBe(false);
    expect(shouldShowCancelLessonAction({ ...base, status: 'done' }, NOW, NOW)).toBe(false);
  });

  it('过去日不可取消', () => {
    expect(shouldShowCancelLessonAction(base, NOW.subtract(1, 'day'), NOW)).toBe(false);
  });
});

describe('getCardActionVisibility', () => {
  it('今日 upcoming：可编辑改期、可取消、可删除', () => {
    const v = getCardActionVisibility(
      {
        canCancelLesson: true,
        startTime: '14:00',
        status: 'upcoming',
      },
      NOW,
      NOW,
    );
    expect(v.canManageBeforeStart).toBe(true);
    expect(v.showEditAndReschedule).toBe(true);
    expect(v.showCancelLesson).toBe(true);
    expect(v.showDelete).toBe(true);
  });

  it('过去日：不可编辑改期/取消，删除仍保留', () => {
    const v = getCardActionVisibility(
      {
        canCancelLesson: true,
        startTime: '14:00',
        status: 'ended',
      },
      NOW.subtract(1, 'day'),
      NOW,
    );
    expect(v.canManageBeforeStart).toBe(false);
    expect(v.showEditAndReschedule).toBe(false);
    expect(v.showCancelLesson).toBe(false);
    expect(v.showDelete).toBe(true);
  });
});

describe('isHistoricalClassCard / isUpcomingClassCard', () => {
  it('历史与未开课判定', () => {
    expect(isHistoricalClassCard('upcoming', NOW.subtract(1, 'day'), NOW)).toBe(true);
    expect(isHistoricalClassCard('done', NOW, NOW)).toBe(true);
    expect(isHistoricalClassCard('upcoming', NOW, NOW)).toBe(false);
    expect(isUpcomingClassCard('upcoming')).toBe(true);
    expect(isUpcomingClassCard('urgent')).toBe(true);
    expect(isUpcomingClassCard('active')).toBe(false);
  });
});
