/**
 * 课表卡片状态解析测试（Q2-1）
 */
import dayjs from 'dayjs';
import { describe, expect, it } from 'vitest';
import {
  getClassCardStatusRank,
  getCountdownText,
  getDurationText,
  isBookingSchedule,
  resolveScheduleStatus,
} from '@/utils/schedule-card-status';
import type { LessonRecord } from '@/types/lesson-record';

const NOW = dayjs('2026-09-02T10:00:00');

describe('getDurationText / getCountdownText', () => {
  it('时长与倒计时文案', () => {
    expect(getDurationText('09:00', '10:30')).toBe("90'");
    expect(getDurationText('10:00', '09:00')).toBe('');
    expect(getCountdownText(3)).toBe('还有3分钟开课');
    expect(getCountdownText(20)).toBe('20分钟后开课');
    expect(getCountdownText(40)).toBeUndefined();
  });
});

describe('getClassCardStatusRank', () => {
  it('active 优先于 ended', () => {
    expect(getClassCardStatusRank('active')).toBeLessThan(getClassCardStatusRank('ended'));
  });
});

describe('resolveScheduleStatus', () => {
  it('全取消 → cancelled', () => {
    const records = [
      { student_id: 's1', status: 'cancelled' },
      { student_id: 's2', status: 'cancelled' },
    ] as LessonRecord[];
    const r = resolveScheduleStatus({
      selectedDate: NOW,
      startTime: '14:00',
      endTime: '15:00',
      records,
      totalCount: 2,
      now: NOW,
    });
    expect(r.status).toBe('cancelled');
  });

  it('今日未开课 → upcoming / urgent', () => {
    const upcoming = resolveScheduleStatus({
      selectedDate: NOW,
      startTime: '14:00',
      endTime: '15:00',
      records: [],
      totalCount: 5,
      now: NOW,
    });
    expect(upcoming.status).toBe('upcoming');

    const urgent = resolveScheduleStatus({
      selectedDate: NOW,
      startTime: '10:20',
      endTime: '11:00',
      records: [],
      totalCount: 5,
      now: NOW,
    });
    expect(urgent.status).toBe('urgent');
    expect(urgent.countdownText).toBe('20分钟后开课');
  });

  it('今日上课中 → active', () => {
    const r = resolveScheduleStatus({
      selectedDate: NOW,
      startTime: '09:30',
      endTime: '10:30',
      records: [],
      totalCount: 5,
      now: NOW,
    });
    expect(r.status).toBe('active');
  });

  it('有消课记录 → done', () => {
    const r = resolveScheduleStatus({
      selectedDate: NOW,
      startTime: '14:00',
      endTime: '15:00',
      records: [{ student_id: 's1', status: 'normal' } as LessonRecord],
      totalCount: 5,
      now: NOW,
    });
    expect(r.status).toBe('done');
    expect(r.checkedCount).toBe(1);
  });
});

describe('isBookingSchedule', () => {
  it('有 tag 或 student_id 视为约课', () => {
    expect(isBookingSchedule({ tag: '试听', student_id: undefined })).toBe(true);
    expect(isBookingSchedule({ tag: undefined, student_id: 's1' })).toBe(true);
    expect(isBookingSchedule({ tag: undefined, student_id: undefined })).toBe(false);
  });
});
