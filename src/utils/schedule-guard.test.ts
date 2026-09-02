/**
 * 课表页守卫纯函数测试（L-05）
 *
 * 验收口径：
 * - 已开课/已完成/已取消课程不可停课
 * - 过去日期不可停课；未来日期可停课
 * - 今日未到开始时间可停课；已到开始时间不可停课
 * - 开放时段 rest 状态不可停课
 * - 历史课 30 天窗口内可补录，超窗口不可
 */
import dayjs from 'dayjs';
import { describe, expect, it } from 'vitest';
import {
  LESSON_OPERATE_WINDOW_DAYS,
  canOperateHistoricalLesson,
  canSuspendOpenSlot,
  canSuspendThisLesson,
  parseTimeToMinutes,
} from '@/utils/schedule-guard';

const NOW = dayjs('2026-09-01T10:00:00');

describe('parseTimeToMinutes', () => {
  it('解析 HH:mm 为当日分钟数', () => {
    expect(parseTimeToMinutes('09:30')).toBe(570);
    expect(parseTimeToMinutes('00:00')).toBe(0);
    expect(parseTimeToMinutes('23:59')).toBe(1439);
  });

  it('非法输入返回 0', () => {
    expect(parseTimeToMinutes('')).toBe(0);
    expect(parseTimeToMinutes('abc')).toBe(0);
  });
});

describe('canSuspendThisLesson', () => {
  it('已开课/已完成/已取消/进行中的课程不可停课', () => {
    for (const status of ['cancelled', 'done', 'ended', 'active']) {
      expect(canSuspendThisLesson({ status, startTime: '14:00' }, NOW, NOW)).toBe(false);
    }
  });

  it('过去日期不可停课', () => {
    const yesterday = NOW.subtract(1, 'day');
    expect(canSuspendThisLesson({ status: 'upcoming', startTime: '14:00' }, yesterday, NOW)).toBe(
      false,
    );
  });

  it('未来日期可停课', () => {
    const tomorrow = NOW.add(1, 'day');
    expect(canSuspendThisLesson({ status: 'upcoming', startTime: '14:00' }, tomorrow, NOW)).toBe(
      true,
    );
  });

  it('今日：未到开始时间可停课，已到开始时间不可停课', () => {
    // 10:00 是现在，课程 14:00 开始 → 可停
    expect(canSuspendThisLesson({ status: 'upcoming', startTime: '14:00' }, NOW, NOW)).toBe(true);
    // 课程 09:00 开始（已开始）→ 不可停
    expect(canSuspendThisLesson({ status: 'upcoming', startTime: '09:00' }, NOW, NOW)).toBe(false);
  });
});

describe('canSuspendOpenSlot', () => {
  it('rest 状态不可停课', () => {
    expect(
      canSuspendOpenSlot({ status: 'rest', start_time: '14:00', lesson_date: '2026-09-01' }, NOW),
    ).toBe(false);
  });

  it('过去日期不可停课，未来日期可停课', () => {
    const yesterday = '2026-08-31';
    const tomorrow = '2026-09-02';
    expect(
      canSuspendOpenSlot({ status: 'active', start_time: '14:00', lesson_date: yesterday }, NOW),
    ).toBe(false);
    expect(
      canSuspendOpenSlot({ status: 'active', start_time: '14:00', lesson_date: tomorrow }, NOW),
    ).toBe(true);
  });

  it('今日：未到开始时间可停课，已到开始时间不可停课', () => {
    expect(
      canSuspendOpenSlot({ status: 'active', start_time: '14:00', lesson_date: '2026-09-01' }, NOW),
    ).toBe(true);
    expect(
      canSuspendOpenSlot({ status: 'active', start_time: '09:00', lesson_date: '2026-09-01' }, NOW),
    ).toBe(false);
  });
});

describe('canOperateHistoricalLesson', () => {
  it('30 天窗口内可补录', () => {
    const withinWindow = NOW.subtract(LESSON_OPERATE_WINDOW_DAYS, 'day');
    expect(canOperateHistoricalLesson(withinWindow, NOW)).toBe(true);
  });

  it('超过 30 天窗口不可操作', () => {
    const beyondWindow = NOW.subtract(LESSON_OPERATE_WINDOW_DAYS + 1, 'day');
    expect(canOperateHistoricalLesson(beyondWindow, NOW)).toBe(false);
  });

  it('今天可操作', () => {
    expect(canOperateHistoricalLesson(NOW, NOW)).toBe(true);
  });
});
